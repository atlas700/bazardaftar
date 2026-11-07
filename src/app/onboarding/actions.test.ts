import { redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(), reserveOnboarding: vi.fn(), getOrCreateCreatorOrganization: vi.fn(),
  pinOnboardingOrganization: vi.fn(), completeOnboarding: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/auth/server", () => mocks);
vi.mock("@/auth/onboarding", () => mocks);
vi.mock("@/db/onboarding", () => mocks);

import { createFirstOrganization } from "./actions";

const details = { name: "Example business", businessType: "Fruit wholesaler", timezone: "Asia/Kabul", baseCurrency: "AFN", locale: "ps-AF" };
const request = { ...details, userId: "user_a", id: "21e2c06c-30fa-4a2a-b8da-49e9e4c0e802", clerkOrganizationId: null, ownerMembershipId: null };
const pinned = { ...request, clerkOrganizationId: "org_a" };
const membership = { userId: "user_a", clerkOrganizationId: "org_a", membershipId: "membership_a" };
function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  Object.entries({ ...details, ...overrides }).forEach(([key, value]) => data.set(key, value));
  return data;
}

beforeEach(() => {
  mocks.requireSession.mockResolvedValue({ userId: "user_a" });
  mocks.reserveOnboarding.mockResolvedValue(request);
  mocks.getOrCreateCreatorOrganization.mockResolvedValue(membership);
  mocks.pinOnboardingOrganization.mockResolvedValue(pinned);
  mocks.completeOnboarding.mockResolvedValue(true);
});
afterEach(() => { vi.resetAllMocks(); vi.restoreAllMocks(); });

describe("first organization action", () => {
  it("derives the creator on the server and returns activation data only after local success", async () => {
    expect(await createFirstOrganization({ status: "idle" }, form({ userId: "attacker", organizationId: "org_other", role: "owner" })))
      .toEqual({ status: "success", clerkOrganizationId: "org_a" });
    expect(mocks.reserveOnboarding).toHaveBeenCalledExactlyOnceWith("user_a", details);
    expect(mocks.getOrCreateCreatorOrganization).toHaveBeenCalledWith(request);
    expect(mocks.pinOnboardingOrganization).toHaveBeenCalledWith(request, "org_a");
    expect(mocks.completeOnboarding).toHaveBeenCalledWith(pinned, membership);
    expect(mocks.completeOnboarding.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.pinOnboardingOrganization.mock.invocationCallOrder[0]);
  });

  it("preserves unauthenticated denial before any side effect", async () => {
    mocks.requireSession.mockImplementation(() => redirect("/sign-in"));
    await expect(createFirstOrganization({ status: "idle" }, form())).rejects.toHaveProperty("digest", expect.stringContaining("NEXT_REDIRECT"));
    expect(mocks.reserveOnboarding).not.toHaveBeenCalled();
    expect(mocks.getOrCreateCreatorOrganization).not.toHaveBeenCalled();
  });

  it.each([
    ["name", ""], ["name", "   "], ["name", "n".repeat(101)],
    ["businessType", ""], ["businessType", "b".repeat(101)],
    ["timezone", "not-a-timezone"], ["timezone", ""],
    ["baseCurrency", "USD"], ["locale", "unknown"],
  ])("rejects invalid %s before side effects", async (field, value) => {
    const diagnostic = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await createFirstOrganization({ status: "idle" }, form({ [field]: value }))).toEqual({ status: "invalid", fields: [field] });
    expect(mocks.reserveOnboarding).not.toHaveBeenCalled();
    expect(diagnostic).not.toHaveBeenCalled();
  });

  it("rejects a file instead of a business name", async () => {
    const data = form();
    data.set("name", new File(["Private"], "private.txt"));
    expect(await createFirstOrganization({ status: "idle" }, data)).toEqual({ status: "invalid", fields: ["name"] });
    expect(mocks.reserveOnboarding).not.toHaveBeenCalled();
  });

  it("normalizes whitespace before reserving the business", async () => {
    await createFirstOrganization({ status: "idle" }, form({ name: "  Example business  ", timezone: " Asia/Kabul " }));
    expect(mocks.reserveOnboarding).toHaveBeenCalledWith("user_a", details);
  });

  it("denies attempts to change an already reserved setup", async () => {
    expect(await createFirstOrganization({ status: "idle" }, form({ name: "Another business" }))).toEqual({ status: "conflict" });
    expect(mocks.getOrCreateCreatorOrganization).not.toHaveBeenCalled();
  });

  it("denies mismatched creators or revoked membership before pinning or local provisioning", async () => {
    mocks.getOrCreateCreatorOrganization.mockResolvedValue(null);
    expect(await createFirstOrganization({ status: "idle" }, form())).toEqual({ status: "denied" });
    expect(mocks.pinOnboardingOrganization).not.toHaveBeenCalled();
    expect(mocks.completeOnboarding).not.toHaveBeenCalled();
  });

  it("does not expose activation data when the one-time bootstrap rejects a stale membership", async () => {
    mocks.completeOnboarding.mockResolvedValue(false);
    expect(await createFirstOrganization({ status: "success", clerkOrganizationId: "org_attacker" }, form({ membershipId: "member_attacker" })))
      .toEqual({ status: "denied" });
    expect(mocks.completeOnboarding).toHaveBeenCalledExactlyOnceWith(pinned, membership);
  });

  it.each([
    ["reserveOnboarding", "reservation"],
    ["getOrCreateCreatorOrganization", "clerk-provisioning"],
    ["pinOnboardingOrganization", "clerk-reference"],
    ["completeOnboarding", "local-provisioning"],
  ] as const)("sanitizes %s failures and records only safe correlation data", async (method, stage) => {
    const diagnostic = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks[method].mockRejectedValue(new Error("Private SQL, credentials, business name and provider payload"));
    const result = await createFirstOrganization({ status: "idle" }, form());
    expect(result).toEqual({ status: "error", correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    expect(diagnostic).toHaveBeenCalledOnce();
    expect(JSON.parse(diagnostic.mock.calls[0][0])).toMatchObject({ event: "organization_onboarding_failed", stage, correlationId: result.status === "error" ? result.correlationId : "missing" });
    expect(JSON.stringify(result)).not.toContain("Private");
    expect(JSON.stringify(diagnostic.mock.calls)).not.toContain("Private");
  });

  it("recovers remote success followed by local failure using the pinned organization", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.completeOnboarding.mockRejectedValueOnce(new Error("Database interrupted"));
    expect(await createFirstOrganization({ status: "idle" }, form())).toHaveProperty("status", "error");
    mocks.reserveOnboarding.mockResolvedValue(pinned);
    expect(await createFirstOrganization({ status: "idle" }, form())).toEqual({ status: "success", clerkOrganizationId: "org_a" });
    expect(mocks.getOrCreateCreatorOrganization).toHaveBeenLastCalledWith(pinned);
  });
});
