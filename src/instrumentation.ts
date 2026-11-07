import type { Instrumentation } from "next";
import { unstable_rethrow } from "next/navigation";
import { errorReference, REQUEST_ID_HEADER } from "@/diagnostics/failure";
import { logFailure } from "@/diagnostics/server";

export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  try { unstable_rethrow(error); } catch { return; }
  logFailure("server_request_failed", context.routeType, error, {
    requestId: request.headers[REQUEST_ID_HEADER], digest: errorReference(error),
  });
};
