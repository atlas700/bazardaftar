import { randomUUID } from "node:crypto";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { createNextMiddleware } from "gt-next/middleware";
import { REQUEST_ID_HEADER } from "@/diagnostics/failure";
import { env } from "@/env";

const localeMiddleware = createNextMiddleware({ localeRouting: false });

export const authMiddleware = clerkMiddleware(
  (_auth, request) => {
    const requestId = randomUUID();
    // GT forwards these headers with NextResponse's request-header override.
    request.headers.set(REQUEST_ID_HEADER, requestId);
    const response = localeMiddleware(request);
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  },
  { signInUrl: "/sign-in", authorizedParties: [env.appOrigin] },
);
