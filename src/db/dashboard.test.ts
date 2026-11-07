import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requirePermission: vi.fn(), getActiveOrganizationMembership: vi.fn(), query: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./authorization", () => mocks);
vi.mock("@/auth/organizations", () => mocks);
vi.mock("./index", async () => {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { Client } = await import("pg");
  const client = new Client(); client.query = mocks.query;
  return { db: drizzle({ client }) };
});
import { getDashboard } from "./dashboard";
import { businessRoles, hasPermission } from "@/auth/permissions";

const tenant = { organizationId: "53409e5c-e4d7-4351-a6b3-46ee18c4f532", membershipId: "member_a", userId: "user_a" };
let role = "owner";
beforeEach(() => {
  role = "owner";
  mocks.requirePermission.mockResolvedValue(tenant);
  mocks.getActiveOrganizationMembership.mockResolvedValue({ clerkOrganizationId: "org_a", membershipId: tenant.membershipId, userId: tenant.userId });
  mocks.query.mockImplementation(async (query: { text: string }) => ({ rows:
    query.text?.includes('from "organizations"') ? [["org_a"]] :
    query.text?.includes('from "organization_role_assignments"') ? [[role]] : [],
  }));
});
afterEach(() => vi.resetAllMocks());
const queries = () => mocks.query.mock.calls.filter(([query]) => typeof query === "object" && /^(select|with)/i.test(query.text.trim()));

describe("pilot dashboard boundary", () => {
  it("requires verified access before any database read", async () => {
    mocks.requirePermission.mockRejectedValue({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    await expect(getDashboard()).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it.each(businessRoles)("fetches only datasets allowed to %s on one read snapshot", async (currentRole) => {
    role = currentRole;
    const data = await getDashboard();
    expect(mocks.requirePermission).toHaveBeenCalledExactlyOnceWith("organization.read");
    expect(mocks.query.mock.calls[0][0].text).toBe("begin isolation level repeatable read read only");
    expect(data.capabilities.purchases).toBe(hasPermission(role, "purchases.read"));
    expect(data.capabilities.balances).toBe(hasPermission(role, "supplier_balances.read"));
    expect(data.balances === null).toBe(!hasPermission(role, "supplier_balances.read"));
    const sql = queries().map(([query]) => query.text).join(" ");
    expect(sql.includes('from "purchase_orders" p')).toBe(hasPermission(role, "purchases.read"));
    expect(sql.includes('from "supplier_payables"')).toBe(hasPermission(role, "supplier_balances.read"));
    expect(sql.includes('from "supplier_payments"')).toBe(hasPermission(role, "supplier_payments.read"));
    expect(sql).not.toContain("audit_logs");
    expect(queries().length).toBeLessThanOrEqual(7);
    for (const [query, params] of queries().slice(2)) {
      expect(query.text).toContain("organization_id");
      expect(params).toContain(tenant.organizationId);
    }
    const grant = queries().find(([query]) => query.text.includes('from "organization_role_assignments"'))!;
    expect(grant[1]).toEqual(expect.arrayContaining(Object.values(tenant)));
  });
  it.each([null, { clerkOrganizationId: "foreign", membershipId: tenant.membershipId, userId: tenant.userId },
    { clerkOrganizationId: "org_a", membershipId: "rejoined", userId: tenant.userId },
    { clerkOrganizationId: "org_a", membershipId: tenant.membershipId, userId: "other" }])("denies changed provider membership before metrics: %j", async (membership) => {
    mocks.getActiveOrganizationMembership.mockResolvedValue(membership);
    await expect(getDashboard()).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    expect(queries()).toHaveLength(2);
  });
  it("denies a removed local grant", async () => {
    mocks.query.mockResolvedValue({ rows: [] });
    await expect(getDashboard()).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
  });
  it("sanitizes outages without substituting zero metrics", async () => {
    mocks.query.mockRejectedValue(new Error("secret SQL password"));
    await expect(getDashboard()).rejects.toThrow(/^Dashboard unavailable\.$/);
  });
});
