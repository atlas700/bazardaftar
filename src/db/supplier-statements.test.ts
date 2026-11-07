import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requirePermission: vi.fn(), query: vi.fn(), getActiveOrganizationMembership: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./authorization", () => mocks);
vi.mock("@/auth/organizations", () => mocks);
vi.mock("./index", async () => {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { Client } = await import("pg");
  const client = new Client(); client.query = mocks.query;
  return { db: drizzle({ client }) };
});
import { getSupplierAccount } from "./supplier-statements";

const id = "53409e5c-e4d7-4351-a6b3-46ee18c4f532";
const tenant = { organizationId: id, userId: "user_a", membershipId: "member_a" };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.requirePermission.mockResolvedValue(tenant);
  mocks.getActiveOrganizationMembership.mockResolvedValue({ ...tenant, clerkOrganizationId: "clerk_a" });
  mocks.query.mockImplementation(async (query: { text: string }) => ({ rows:
    query.text.includes('from "organizations"') ? [["clerk_a"]] :
    query.text.includes('from "organization_role_assignments"') ? [["viewer"]] :
    query.text.includes('from "suppliers"') ? [[id, "Helmand Grain", false, "By agreement"]] : [],
  }));
});

describe("supplier account read boundary", () => {
  it.each([null, {}, { supplierId: "bad" }, { supplierId: [id] }, { supplierId: id, currency: "USD" },
    { supplierId: id, after: id }, { supplierId: id, after: `unknown:${id}` }, { supplierId: id, after: [`receipt:${id}`] },
    { supplierId: id, currency: ["AFN", "PKR"] }, { supplierId: id, after: `receipt:${id}:extra` },
  ])("rejects malformed filters before database work: %j", async (input) => {
    await expect(getSupplierAccount(input)).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    expect(mocks.requirePermission).toHaveBeenCalledWith("supplier_balances.read");
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("authorizes before validating or reading financial records", async () => {
    mocks.requirePermission.mockRejectedValue({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    await expect(getSupplierAccount(null)).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("uses a read-only consistent snapshot and ignores client authority", async () => {
    const data = await getSupplierAccount({ supplierId: id, organizationId: "spoof", role: "owner" });
    expect(data).toMatchObject({ supplier: { id, isActive: false }, currency: "AFN", entries: [], nextCursor: null, canRecord: false });
    expect(mocks.query.mock.calls[0][0].text).toBe("begin isolation level repeatable read read only");
    expect(mocks.query.mock.calls.flat()).not.toContain("spoof");
    expect(mocks.getActiveOrganizationMembership).toHaveBeenCalledOnce();
  });
  it.each([null, { ...tenant, clerkOrganizationId: "foreign" }, { ...tenant, clerkOrganizationId: "clerk_a", membershipId: "revoked" }])("denies removed or switched provider membership: %j", async (membership) => {
    mocks.getActiveOrganizationMembership.mockResolvedValue(membership);
    await expect(getSupplierAccount({ supplierId: id })).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
  });
  it("sanitizes unexpected read failures", async () => {
    mocks.query.mockRejectedValue(new Error("private SQL and credentials"));
    await expect(getSupplierAccount({ supplierId: id })).rejects.toThrow(/^Supplier account unavailable\.$/);
  });
});
