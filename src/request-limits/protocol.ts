import "server-only";

import { createHmac } from "node:crypto";
import { z } from "zod";
import { env } from "@/env";

export const REQUEST_LIMIT_PATH = "/api/internal/request-limit";
export const admissionSchema = z.object({
  scope: z.enum(["authentication", "mutation", "anonymous"]),
  key: z.string().regex(/^[0-9a-f]{64}$/),
  timestamp: z.string().regex(/^\d{13}$/).refine((value) => Math.abs(Date.now() - Number(value)) <= 30_000),
});
export type RequestLimitScope = z.infer<typeof admissionSchema>["scope"];

export function signAdmission(scope: RequestLimitScope, key: string, timestamp: string) {
  return createHmac("sha256", env.clerkSecretKey)
    .update(JSON.stringify(["request-limit-transport-v1", scope, key, timestamp])).digest("hex");
}
