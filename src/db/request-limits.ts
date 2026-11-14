import "server-only";

import { sql } from "drizzle-orm";
import { db } from "./index";
import { requestRateLimits } from "./schema";

const allowances = { authentication: 60, mutation: 60, anonymous: 30 } as const;
export type RequestLimitScope = keyof typeof allowances;

// Separate from business transactions: failed operations still consume admission.
export async function consumeRequestLimit(scope: RequestLimitScope, key: string) {
  if (!/^[0-9a-f]{64}$/.test(key)) throw new Error("Invalid request-limit identity.");
  const limit = allowances[scope];
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('statement_timeout', '2000', true), set_config('lock_timeout', '500', true)`);
    const result = await tx.execute<{ allowed: boolean; retry_after_seconds: number }>(sql`
      with stale as (
        select scope, key from ${requestRateLimits}
        where reset_at < statement_timestamp() - interval '1 day'
          and not (scope = ${scope} and key = ${key})
        order by reset_at limit 100 for update skip locked
      ), removed as (
        delete from ${requestRateLimits} using stale
        where ${requestRateLimits}.scope = stale.scope and ${requestRateLimits}.key = stale.key
      )
      insert into ${requestRateLimits} as bucket (scope, key, hits, reset_at)
      values (${scope}, ${key}, 1, statement_timestamp() + interval '60 seconds')
      on conflict (scope, key) do update set
        hits = case when bucket.reset_at <= statement_timestamp() then 1 else least(bucket.hits + 1, ${limit + 1}) end,
        reset_at = case when bucket.reset_at <= statement_timestamp() then statement_timestamp() + interval '60 seconds' else bucket.reset_at end
      returning hits <= ${limit} as allowed,
        least(60, greatest(1, ceil(extract(epoch from (reset_at - statement_timestamp())))))::integer as retry_after_seconds
    `);
    const decision = result.rows[0];
    if (!decision) throw new Error("Request limit unavailable.");
    return { allowed: decision.allowed, retryAfterSeconds: decision.retry_after_seconds };
  });
}
