import "server-only";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { errorReference, REQUEST_ID_HEADER, type FailureState } from "./failure";

type FailureEvent =
  | "organization_onboarding_failed" | "staff_management_failed" | "catalogue_management_failed"
  | "product_management_failed" | "supplier_management_failed" | "warehouse_management_failed"
  | "purchase_draft_failed" | "purchase_mutation_failed" | "receipt_acceptance_failed"
  | "inventory_adjustment_failed" | "supplier_settlement_failed" | "database_pool_failed" | "server_request_failed" | "request_limit_failed";
const failureKinds = ["database", "connectivity", "timeout", "provider", "unknown"] as const;
type FailureKind = typeof failureKinds[number];

function failureKind(error: unknown, depth = 0): FailureKind {
  if (depth === 4 || typeof error !== "object" || error === null) return "unknown";
  // A safe category survives separate framework bundles without retaining a cause.
  if ("failureKind" in error) {
    const saved = failureKinds.find((kind) => kind === error.failureKind);
    if (saved) return saved;
  }
  const code = "code" in error ? error.code : undefined;
  if (typeof code === "string" && ["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "EPIPE"].includes(code)) return "connectivity";
  if (typeof code === "string" && ["ETIMEDOUT", "57014"].includes(code)) return "timeout";
  if (typeof code === "string" && /^(08|22|23|25|40|42|53|54|55|57|58|XX)[0-9A-Z]{3}$/.test(code)) return "database";
  if ("clerkError" in error && error.clerkError === true) return "provider";
  return "cause" in error ? failureKind(error.cause, depth + 1) : "unknown";
}

// Preserve a bounded category, never the original error, SQL, message or cause.
export function safeServerError(message: string, error: unknown): Error {
  unstable_rethrow(error);
  return Object.assign(new Error(message), { failureKind: failureKind(error) });
}

function correlationId(value: unknown): string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : randomUUID();
}

export function logFailure(event: FailureEvent, stage: string, error: unknown, context: { requestId?: unknown; digest?: unknown } = {}): string {
  const id = correlationId(context.requestId);
  const digest = errorReference({ digest: context.digest });
  console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: "error", event, stage,
    correlationId: id, failureKind: failureKind(error), ...(digest ? { digest } : {}) }));
  return id;
}

export async function actionFailure(event: FailureEvent, stage: string, error: unknown): Promise<FailureState> {
  unstable_rethrow(error);
  let requestId: string | null = null;
  try { requestId = (await headers()).get(REQUEST_ID_HEADER); }
  catch (contextError) { unstable_rethrow(contextError); }
  return { status: "error", correlationId: logFailure(event, stage, error, { requestId }) };
}
