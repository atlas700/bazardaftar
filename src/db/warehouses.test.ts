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
import { getActiveWarehouse, getWarehouseWorkspace, manageWarehouse } from "./warehouses";

const organizationId = "53409e5c-e4d7-4351-a6b3-46ee18c4f532";
const id = "63409e5c-e4d7-4351-a6b3-46ee18c4f532";
const tenant = { userId: "user_a", membershipId: "member_a", organizationId };
const command = { operation: "create-warehouse", name: "Main warehouse" };
function rows(query: { text: string }) {
  if (query.text.includes('from "organizations"')) return [[organizationId, "org_a"]];
  if (query.text.includes('from "organization_role_assignments"')) return [["owner"]];
  return [];
}
beforeEach(() => {
  mocks.requirePermission.mockResolvedValue(tenant);
  mocks.getActiveOrganizationMembership.mockResolvedValue({ ...tenant, clerkOrganizationId: "org_a" });
  mocks.query.mockImplementation(async (query: { text: string }) => ({ rows: rows(query) }));
});
afterEach(() => vi.resetAllMocks());

describe("single warehouse service", () => {
  it.each([{ ...command, name: " " }, { ...command, name: "x".repeat(81) },
    { ...command, location: "x".repeat(201) }, { ...command, location: 23 },
    { operation: "update-warehouse", id: "bad", name: "Main" }, { operation: "remove-warehouse" },
  ])("validates untrusted setup before querying: %j", async (input) => {
    expect(await manageWarehouse(input)).toMatchObject({ status: "invalid" });
    expect(mocks.requirePermission).toHaveBeenCalledWith("organization.manage");
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("parameterizes trimmed details and ignores client authority/active state", async () => {
    const name = "x'); delete from warehouses; --";
    expect(await manageWarehouse({ ...command, name: ` ${name} `, location: " Lashkar Gah ",
      organizationId: "attacker", role: "owner", isActive: false })).toEqual({ status: "success" });
    const [query, values] = mocks.query.mock.calls.find(([query]) => query.text.startsWith("insert"))!;
    expect(query.text).not.toContain(name);
    expect(values).toEqual(expect.arrayContaining([organizationId, name, "Lashkar Gah"]));
    expect(values).not.toContain("attacker");
    expect(mocks.query.mock.calls.some(([query]) => query.text.includes("for update"))).toBe(true);
  });
  it("normalizes an empty location to null", async () => {
    await manageWarehouse({ ...command, location: " " });
    expect(mocks.query.mock.calls.find(([query]) => query.text.startsWith("insert"))![1]).toContain(null);
  });
  it.each(["update-warehouse", "deactivate-warehouse", "activate-warehouse"])("scopes %s to the server tenant and intended current state", async (operation) => {
    expect(await manageWarehouse({ ...command, operation, id })).toEqual({ status: "conflict" });
    const [query, values] = mocks.query.mock.calls.find(([query]) => query.text.startsWith("update"))!;
    expect(query.text).toContain('"warehouses"."organization_id" =');
    expect(values).toEqual(expect.arrayContaining([organizationId, id]));
    if (operation !== "update-warehouse") {
      expect(query.text).toContain('"warehouses"."is_active" =');
      expect(values.at(-1)).toBe(operation === "deactivate-warehouse");
    }
  });
  it.each([null, { ...tenant, clerkOrganizationId: "other" },
    { ...tenant, clerkOrganizationId: "org_a", membershipId: "other" },
    { ...tenant, clerkOrganizationId: "org_a", userId: "other" },
  ])("rechecks provider identity after waiting: %j", async (current) => {
    mocks.getActiveOrganizationMembership.mockResolvedValue(current);
    await expect(manageWarehouse(command)).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    expect(mocks.query.mock.calls.some(([query]) => /^(insert|update)/.test(query.text))).toBe(false);
  });
  it("denies a revoked local role on the transaction connection", async () => {
    mocks.query.mockImplementation(async (query: { text: string }) => ({ rows:
      query.text.includes('from "organization_role_assignments"') ? [["manager"]] : rows(query),
    }));
    await expect(manageWarehouse(command)).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    expect(mocks.query.mock.calls.some(([query]) => query.text.startsWith("insert"))).toBe(false);
  });
  it("maps only the singleton constraint to an existing-warehouse result", async () => {
    mocks.query.mockImplementation(async (query: { text: string }) => {
      if (query.text.startsWith("insert")) throw Object.assign(new Error("private"), { code: "23505", constraint: "warehouses_one_per_organization" });
      return { rows: rows(query) };
    });
    expect(await manageWarehouse(command)).toEqual({ status: "exists" });
    mocks.query.mockRejectedValue(new Error("private"));
    await expect(manageWarehouse(command)).rejects.toThrow();
  });
  it("returns only the tenant warehouse and approved management access", async () => {
    mocks.query.mockImplementation(async (query: { text: string }) => ({ rows:
      query.text.includes('from "warehouses"') ? [[id, "Main", null, false]] : rows(query),
    }));
    expect(await getWarehouseWorkspace()).toEqual({ organizationId, warehouse: { id, name: "Main", location: null, isActive: false }, canManage: true });
    const [query, values] = mocks.query.mock.calls.find(([query]) => query.text.includes('from "warehouses"'))!;
    expect(query.text).toContain('"warehouses"."organization_id" ='); expect(values).toContain(organizationId);
  });
  it("offers no warehouse before setup and filters inactive warehouses from selection", async () => {
    expect(await getWarehouseWorkspace()).toEqual({ organizationId, warehouse: null, canManage: true });
    expect(await getActiveWarehouse()).toBeNull();
    expect(mocks.requirePermission).toHaveBeenLastCalledWith("organization.read");
    const [query, values] = mocks.query.mock.calls.filter(([query]) => query.text.includes('from "warehouses"')).at(-1)!;
    expect(query.text).toContain('"warehouses"."is_active" =');
    expect(values).toEqual(expect.arrayContaining([organizationId, true]));
  });
  it("preserves permission denial before database work and sanitizes read failures", async () => {
    mocks.requirePermission.mockRejectedValue({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    for (const work of [getWarehouseWorkspace, getActiveWarehouse, () => manageWarehouse(command)]) {
      await expect(work()).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    }
    expect(mocks.query).not.toHaveBeenCalled();
    mocks.requirePermission.mockResolvedValue(tenant); mocks.query.mockRejectedValue(new Error("private SQL password"));
    await expect(getWarehouseWorkspace()).rejects.toThrow(/^Warehouse unavailable\.$/);
    await expect(getActiveWarehouse()).rejects.toThrow(/^Warehouse unavailable\.$/);
  });
});
