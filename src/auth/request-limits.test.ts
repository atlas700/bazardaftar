import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ consumeRequestLimit: vi.fn(), auth: vi.fn(), clerk: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/env", () => ({ env: { appOrigin: "https://example.test", clerkSecretKey: "test-only-private-key" } }));
vi.mock("@/db/request-limits", () => mocks);
vi.mock("@clerk/nextjs/server", () => ({ clerkMiddleware: (handler: (auth: unknown, request: NextRequest) => unknown) => async (request: NextRequest) => {
  mocks.clerk(request);
  // Clerk's Frontend API proxy returns before invoking the application's callback.
  if (request.nextUrl.pathname.startsWith("/__clerk/")) return NextResponse.next();
  return handler(mocks.auth, request);
} }));

import { authMiddleware } from "./middleware";
import { config } from "@/proxy";

async function request(path: string, method = "POST", headers: HeadersInit = {}) {
  return Reflect.apply(authMiddleware, undefined, [new NextRequest(`https://example.test${path}`, { method, headers })]);
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ userId: "user_verified" });
  mocks.consumeRequestLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 60 });
});

describe("request abuse boundary", () => {
  it.each(["GET", "HEAD"])("keeps %s /health independent of Clerk and locale processing", async (method) => {
    const response = await request("/health", method);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("x-generaltranslation-locale")).toBeNull();
    expect(mocks.clerk).not.toHaveBeenCalled();
    expect(mocks.consumeRequestLimit).not.toHaveBeenCalled();
  });

  it.each([["/health", "POST"], ["/health/details", "GET"], ["/inventory", "GET"]])("preserves Clerk processing for %s %s", async (path, method) => {
    await request(path, method);
    expect(mocks.clerk).toHaveBeenCalledOnce();
    if (method === "POST") expect(mocks.consumeRequestLimit.mock.calls[0][0]).toBe("mutation");
  });

  it("matches all application routes, including extension and framework paths", () => {
    for (const path of ["/payments", "/purchases/file.csv", "/products/report.html", "/_next/anything", "/__clerk/v1/client/sign_ins", "/sign-in", "/onboarding"]) {
      expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: `https://example.test${path}` })).toBe(true);
    }
  });
  it.each(["POST", "PUT", "PATCH", "DELETE"])("limits %s by the verified user across URLs and spoofed headers", async (method) => {
    const response = await request("/payments", method, { "x-user-id": "spoofed", "x-forwarded-for": "192.0.2.1", "next-action": "anything" });
    expect(response.status).toBe(200);
    const expected = createHmac("sha256", "test-only-private-key").update(JSON.stringify(["request-limits-v1", "user_verified"])).digest("hex");
    expect(mocks.consumeRequestLimit).toHaveBeenCalledWith("mutation", expected);
    await request("/purchases/file.csv?requestId=changed", method, { "x-forwarded-for": "192.0.2.99" });
    expect(mocks.consumeRequestLimit.mock.calls[1]).toEqual(mocks.consumeRequestLimit.mock.calls[0]);
  });

  it.each(["GET", "HEAD", "OPTIONS"])("leaves ordinary %s requests outside the mutation budget", async (method) => {
    expect((await request("/inventory", method)).status).toBe(200);
    expect(mocks.consumeRequestLimit).not.toHaveBeenCalled();
    expect(mocks.auth).not.toHaveBeenCalled();
  });

  it("gives different verified users independent budgets, with no client organization or request key", async () => {
    await request("/payments");
    mocks.auth.mockResolvedValue({ userId: "user_other" });
    await request("/payments");
    expect(mocks.consumeRequestLimit.mock.calls[0][1]).not.toBe(mocks.consumeRequestLimit.mock.calls[1][1]);
  });

  it("uses one shared anonymous budget instead of trusting forwarded IP, cookies or caller IDs", async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    await request("/onboarding", "POST", { "x-forwarded-for": "192.0.2.1", "x-nf-client-connection-ip": "192.0.2.2" });
    await request("/payments", "POST", { cookie: "userId=user_fake", "x-forwarded-for": "192.0.2.3" });
    expect(mocks.consumeRequestLimit.mock.calls[0][0]).toBe("anonymous");
    expect(mocks.consumeRequestLimit.mock.calls[0]).toEqual(mocks.consumeRequestLimit.mock.calls[1]);
  });

  it.each([["/sign-in", "GET"], ["/sign-in/factor-one", "POST"], ["/__clerk/v1/client/sign_ins", "POST"]])("limits authentication %s before Clerk can short-circuit it", async (path, method) => {
    mocks.consumeRequestLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 17 });
    const response = await request(path, method);
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("17");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ error: "Too many requests. Wait and try again.", retryAfterSeconds: 17 });
    expect(mocks.consumeRequestLimit).toHaveBeenCalledOnce();
    expect(mocks.consumeRequestLimit.mock.calls[0][0]).toBe("authentication");
    expect(mocks.clerk).not.toHaveBeenCalled();
  });

  it("also checks the verified mutation budget for action POSTs sent to sign-in without counting either budget twice", async () => {
    await request("/sign-in", "POST");
    expect(mocks.consumeRequestLimit.mock.calls.map(([scope]) => scope)).toEqual(["authentication", "mutation"]);
    await request("/__clerk/v1/client", "GET");
    expect(mocks.consumeRequestLimit).toHaveBeenCalledTimes(2);
  });

  it("blocks a financial write with a safe 429 and fresh correlation before its action runs", async () => {
    mocks.consumeRequestLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 2 });
    const response = await request("/payments", "POST", { "x-bazardaftar-request-id": "forged" });
    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers.get("x-bazardaftar-request-id")).toBe(body.correlationId);
    expect(JSON.stringify(body)).not.toMatch(/user_verified|test-only-private-key|forged/);
  });

  it("fails closed with safe 503 when the shared store is unavailable", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.consumeRequestLimit.mockRejectedValueOnce(new Error("postgresql://private-password@example.test/private"));
    const response = await request("/payments");
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("5");
    expect(await response.text()).not.toMatch(/private|postgresql/);
    expect(log).toHaveBeenCalledOnce();
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/private|postgresql/);
    log.mockRestore();
  });
});
