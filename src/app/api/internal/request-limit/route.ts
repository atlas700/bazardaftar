import { timingSafeEqual } from "node:crypto";
import { consumeRequestLimit } from "@/db/request-limits";
import { logFailure } from "@/diagnostics/server";
import { admissionSchema, signAdmission } from "@/request-limits/protocol";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const headers = { "cache-control": "no-store" };
  const admission = admissionSchema.safeParse({
    scope: request.headers.get("x-limit-scope"), key: request.headers.get("x-limit-key"),
    timestamp: request.headers.get("x-limit-timestamp"),
  });
  const signature = request.headers.get("x-limit-signature") ?? "";
  if (!admission.success || !/^[0-9a-f]{64}$/.test(signature)) {
    return new Response(null, { status: 404, headers });
  }
  const { scope, key, timestamp } = admission.data;
  if (!timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(signAdmission(scope, key, timestamp), "hex"))) {
    return new Response(null, { status: 404, headers });
  }
  try {
    return Response.json(await consumeRequestLimit(scope, key), { headers });
  } catch (error) {
    logFailure("request_limit_failed", "admission_store", error);
    return new Response(null, { status: 503, headers });
  }
}
