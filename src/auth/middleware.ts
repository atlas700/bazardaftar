import { createHmac, randomUUID } from "node:crypto";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { createNextMiddleware } from "gt-next/middleware";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { consumeRequestLimit, type RequestLimitScope } from "@/db/request-limits";
import { REQUEST_ID_HEADER } from "@/diagnostics/failure";
import { logFailure } from "@/diagnostics/server";
import { env } from "@/env";

const localeMiddleware = createNextMiddleware({ localeRouting: false });

function unsafe(method: string) {
  return !["GET", "HEAD", "OPTIONS"].includes(method);
}

function authenticationRequest(request: NextRequest) {
  const path = request.nextUrl.pathname;
  return ((path === "/sign-in" || path.startsWith("/sign-in/")) && !["HEAD", "OPTIONS"].includes(request.method))
    || ((path === "/__clerk" || path.startsWith("/__clerk/")) && unsafe(request.method));
}

async function limitRequest(scope: RequestLimitScope, identity: string, requestId: string) {
  try {
    const key = createHmac("sha256", env.clerkSecretKey).update(JSON.stringify(["request-limits-v1", identity])).digest("hex");
    const decision = await consumeRequestLimit(scope, key);
    if (decision.allowed) return;
    return NextResponse.json({ error: "Too many requests. Wait and try again.", retryAfterSeconds: decision.retryAfterSeconds, correlationId: requestId }, {
      status: 429, headers: { "retry-after": String(decision.retryAfterSeconds), "cache-control": "no-store", [REQUEST_ID_HEADER]: requestId },
    });
  } catch (error) {
    logFailure("request_limit_failed", scope, error, { requestId });
    return NextResponse.json({ error: "Service temporarily unavailable. Wait and try again.", retryAfterSeconds: 5, correlationId: requestId }, {
      status: 503, headers: { "retry-after": "5", "cache-control": "no-store", [REQUEST_ID_HEADER]: requestId },
    });
  }
}

const withClerk = clerkMiddleware(
  async (auth, request) => {
    const requestId = request.headers.get(REQUEST_ID_HEADER) ?? randomUUID();
    if (unsafe(request.method)) {
      const { userId } = await auth();
      const blocked = await limitRequest(userId ? "mutation" : "anonymous", userId ?? "anonymous", requestId);
      if (blocked) return blocked;
    }
    // GT forwards these headers with NextResponse's request-header override.
    const response = localeMiddleware(request);
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  },
  { signInUrl: "/sign-in", authorizedParties: [env.appOrigin] },
);

export async function authMiddleware(request: NextRequest, event: NextFetchEvent) {
  if (request.nextUrl.pathname === "/health" && ["GET", "HEAD"].includes(request.method)) {
    return NextResponse.next();
  }
  const requestId = randomUUID();
  request.headers.set(REQUEST_ID_HEADER, requestId);
  // Clerk may return its Frontend API proxy before invoking our callback.
  if (authenticationRequest(request)) {
    // shortcut: anonymous clients share a bucket until the deployed adapter supplies a verified client IP.
    const blocked = await limitRequest("authentication", "anonymous", requestId);
    if (blocked) return blocked;
  }
  return withClerk(request, event);
}
