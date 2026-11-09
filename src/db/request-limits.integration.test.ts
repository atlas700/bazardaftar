import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/env", () => ({ env: { databaseUrl: process.env.AFCS_TEST_DATABASE_URL ?? "postgresql://unused:unused@127.0.0.1:1/unused", nodeEnvironment: "test" } }));
import { db } from "./index";
import { consumeRequestLimit } from "./request-limits";
import { requestRateLimits } from "./schema";

const keys: string[] = [];
function key() {
  const value = createHash("sha256").update(`task31_${randomUUID()}`).digest("hex");
  keys.push(value);
  return value;
}

describe.skipIf(!process.env.AFCS_TEST_DATABASE_URL)("request limits against isolated PostgreSQL", () => {
  beforeAll(async () => {
    const result = await db.execute<{ database: string }>(sql`select current_database() as database`);
    if (result.rows[0]?.database !== "afcs_task07_verify") throw new Error("Use only isolated afcs_task07_verify.");
  });
  afterAll(async () => {
    if (keys.length) await db.delete(requestRateLimits).where(inArray(requestRateLimits.key, keys));
  });

  it.each(["authentication", "mutation", "anonymous"] as const)("enforces the exact %s allowance under concurrent database connections", async (scope) => {
    const identity = key();
    const limit = scope === "anonymous" ? 30 : 60;
    const results = await Promise.all(Array.from({ length: limit + 8 }, () => consumeRequestLimit(scope, identity)));
    expect(results.filter((result) => result.allowed)).toHaveLength(limit);
    expect(results.every((result) => result.retryAfterSeconds >= 1 && result.retryAfterSeconds <= 60)).toBe(true);
    const [saved] = await db.select().from(requestRateLimits).where(and(eq(requestRateLimits.scope, scope), eq(requestRateLimits.key, identity)));
    expect(saved.hits).toBe(limit + 1);
    expect((await consumeRequestLimit(scope, identity)).allowed).toBe(false);
  });

  it("separates identities and scopes and resets the same row using the database clock", async () => {
    const identity = key();
    await db.insert(requestRateLimits).values({ scope: "mutation", key: identity, hits: 61, resetAt: sql`statement_timestamp() + interval '30 seconds'` });
    expect((await consumeRequestLimit("mutation", identity)).allowed).toBe(false);
    expect((await consumeRequestLimit("mutation", key())).allowed).toBe(true);
    expect((await consumeRequestLimit("authentication", identity)).allowed).toBe(true);
    await db.update(requestRateLimits).set({ resetAt: sql`statement_timestamp() - interval '1 second'` }).where(eq(requestRateLimits.key, identity));
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2099-01-01T00:00:00Z"));
    try {
      expect(await consumeRequestLimit("mutation", identity)).toEqual({ allowed: true, retryAfterSeconds: 60 });
    } finally { vi.useRealTimers(); }
    const rows = await db.select().from(requestRateLimits).where(and(eq(requestRateLimits.scope, "mutation"), eq(requestRateLimits.key, identity)));
    expect(rows).toHaveLength(1);
    expect(rows[0].hits).toBe(1);
  });

  it("keeps admission counts committed when the business operation later rolls back", async () => {
    const identity = key();
    await expect(db.transaction(async () => {
      await consumeRequestLimit("mutation", identity);
      throw new Error("Business failure");
    })).rejects.toThrow("Business failure");
    const [saved] = await db.select().from(requestRateLimits).where(eq(requestRateLimits.key, identity));
    expect(saved.hits).toBe(1);
  });

  it("bounds retry hints when a concurrent counter's reset is ahead of this statement's clock", async () => {
    const identity = key();
    await db.insert(requestRateLimits).values({ scope: "mutation", key: identity, hits: 61, resetAt: sql`statement_timestamp() + interval '61 seconds'` });
    expect(await consumeRequestLimit("mutation", identity)).toEqual({ allowed: false, retryAfterSeconds: 60 });
  });

  it("times out a contended counter instead of admitting a request without accounting", async () => {
    const identity = key();
    await consumeRequestLimit("mutation", identity);
    let release = () => {}, locked = () => {};
    const ready = new Promise<void>((resolve) => { locked = resolve; });
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const blocker = db.transaction(async (tx) => {
      await tx.select().from(requestRateLimits).where(eq(requestRateLimits.key, identity)).for("update");
      locked(); await gate;
    });
    await ready;
    try { await expect(consumeRequestLimit("mutation", identity)).rejects.toThrow(); }
    finally { release(); await blocker; }
    const [saved] = await db.select().from(requestRateLimits).where(eq(requestRateLimits.key, identity));
    expect(saved.hits).toBe(1);
  });

  it("cleans at most 100 day-old rows without deleting active or currently reused counters", async () => {
    const staleKeys = Array.from({ length: 101 }, key);
    const active = key(), reused = key();
    await db.insert(requestRateLimits).values([...staleKeys, reused].map((identity) => ({ scope: "mutation" as const, key: identity, hits: 1, resetAt: sql`statement_timestamp() - interval '2 days'` })));
    expect((await consumeRequestLimit("mutation", reused)).allowed).toBe(true);
    expect(await db.select().from(requestRateLimits).where(inArray(requestRateLimits.key, staleKeys))).toHaveLength(1);
    const [reset] = await db.select().from(requestRateLimits).where(eq(requestRateLimits.key, reused));
    expect(reset.hits).toBe(1);
    await consumeRequestLimit("mutation", active);
    expect(await db.select().from(requestRateLimits).where(inArray(requestRateLimits.key, [active, reused]))).toHaveLength(2);
  });

  it("enforces scope, hashed-key and bounded-counter constraints in PostgreSQL", async () => {
    const valid = { scope: "mutation" as const, key: key(), hits: 1, resetAt: new Date() };
    for (const patch of [{ key: "raw-user-or-ip" }, { hits: 0 }, { hits: 62 }]) {
      await expect(db.insert(requestRateLimits).values({ ...valid, ...patch })).rejects.toThrow();
    }
    await expect(db.execute(sql`insert into request_rate_limits (scope, key, hits, reset_at) values ('unknown', ${key()}, 1, now())`)).rejects.toThrow();
  });
});
