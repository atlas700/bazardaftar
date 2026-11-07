import { afterEach, describe, expect, it, vi } from "vitest";

const clerk = vi.hoisted(() => ({
  auth: Object.assign(vi.fn(), { protect: vi.fn() }),
}));
vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => clerk);

import { getSession, requireSession } from "./server";

afterEach(() => vi.resetAllMocks());

describe("authentication session boundary", () => {
  it("returns no session for signed-out or pending users", async () => {
    clerk.auth.mockResolvedValue({ isAuthenticated: false, userId: "pending-user" });
    expect(await getSession()).toBeNull();
  });

  it("returns only the authenticated external identity", async () => {
    clerk.auth.mockResolvedValue({
      isAuthenticated: true,
      userId: "user_123",
      sessionId: "private-session",
      orgId: "untrusted-organization",
    });
    expect(await getSession()).toEqual({ userId: "user_123" });
  });

  it("allows authenticated sessions without exposing tokens or tenant claims", async () => {
    clerk.auth.protect.mockResolvedValue({
      userId: "user_123",
      sessionClaims: { secret: "private" },
    });
    expect(await requireSession()).toEqual({ userId: "user_123" });
  });

  it("preserves denial for expired, signed-out, or revoked sessions", async () => {
    const denied = { digest: "NEXT_REDIRECT;replace;/sign-in;307;" };
    clerk.auth.protect.mockRejectedValue(denied);
    await expect(requireSession()).rejects.toBe(denied);
  });

  it.each(["getSession", "requireSession"])("sanitizes unexpected %s provider failures", async (method) => {
    const failure = new Error("private token provider payload");
    clerk.auth.mockRejectedValue(failure);
    clerk.auth.protect.mockRejectedValue(failure);
    const result = method === "getSession" ? getSession() : requireSession();
    await expect(result).rejects.toThrow(/^Authentication unavailable\.$/);
    await expect(result).rejects.not.toHaveProperty("cause");
  });
});
