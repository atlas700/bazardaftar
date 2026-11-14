import "server-only";

import { z } from "zod";
import { env } from "@/env";
import { REQUEST_LIMIT_PATH, signAdmission, type RequestLimitScope } from "./protocol";

const decisionSchema = z.object({ allowed: z.boolean(), retryAfterSeconds: z.number().int().min(1).max(60) });

export async function consumeRequestLimit(scope: RequestLimitScope, key: string) {
  const timestamp = String(Date.now());
  // A fixed trusted origin prevents caller-controlled hosts from receiving signed admissions.
  const response = await fetch(new URL(REQUEST_LIMIT_PATH, env.appOrigin).href, {
    method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000),
    headers: {
      "x-limit-scope": scope, "x-limit-key": key, "x-limit-timestamp": timestamp,
      "x-limit-signature": signAdmission(scope, key, timestamp),
    },
  });
  if (!response.ok) throw new Error("Request limit unavailable.");
  return decisionSchema.parse(await response.json());
}
