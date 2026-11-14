import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/env", () => ({ env: { appOrigin: "https://example.test", clerkSecretKey: "test-only-private-key" } }));
vi.mock("@/request-limits/client", () => ({ consumeRequestLimit: async () => ({ allowed: true, retryAfterSeconds: 60 }) }));
vi.mock("@clerk/nextjs/server", () => ({ clerkMiddleware: (handler: (auth: unknown, request: NextRequest) => unknown) => (request: NextRequest) => handler(async () => ({ userId: "user_verified" }), request) }));
import { authMiddleware } from "./middleware";

afterEach(() => vi.restoreAllMocks());
describe("request correlation through locale middleware", () => {
  it("overwrites an incoming reference and forwards a fresh ID with auth, locale and body intact", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const request = new NextRequest("https://example.test/purchases", { method: "POST", body: "quantity=1", headers: { "x-bazardaftar-request-id": "78bbad77-9a30-41d0-ae5c-cad9354eaa40", cookie: "private-cookie", "next-action": "action-id" } });
    // The mocked Clerk wrapper runs the real locale response composer.
    const response = await Reflect.apply(authMiddleware, undefined, [request]);
    const id = response.headers.get("x-bazardaftar-request-id");
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(id).not.toBe("78bbad77-9a30-41d0-ae5c-cad9354eaa40");
    expect(response.headers.get("x-middleware-request-x-bazardaftar-request-id")).toBe(id);
    expect(response.headers.get("x-middleware-request-next-action")).toBe("action-id");
    expect(response.headers.get("x-generaltranslation-locale")).toBeTruthy();
    expect(response.headers.get("cookie")).toBeNull();
    expect(await request.text()).toBe("quantity=1");
    expect(log).not.toHaveBeenCalled();
  });
});
