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
import { getProduct, getProducts, manageCatalog } from "./catalog";

const organizationId = "53409e5c-e4d7-4351-a6b3-46ee18c4f532";
const id = "63409e5c-e4d7-4351-a6b3-46ee18c4f532";
const unitId = "73409e5c-e4d7-4351-a6b3-46ee18c4f532";
const categoryId = "83409e5c-e4d7-4351-a6b3-46ee18c4f532";
const tenant = { userId: "user_a", membershipId: "member_a", organizationId };
const command = { operation: "create-product", name: "Wheat", sku: null, categoryId: null, unitId };
function rows(query: { text: string }) {
  if (query.text.startsWith('insert into "products"')) return [[id]];
  if (query.text.includes('from "organizations"')) return [[organizationId, "org_a"]];
  if (query.text.includes('from "organization_role_assignments"')) return [["owner"]];
  if (query.text.includes('from "catalog_units"')) return [[unitId]];
  if (query.text.includes('from "product_categories"')) return [[categoryId]];
  return [];
}
beforeEach(() => {
  mocks.requirePermission.mockResolvedValue(tenant);
  mocks.getActiveOrganizationMembership.mockResolvedValue({ ...tenant, clerkOrganizationId: "org_a" });
  mocks.query.mockImplementation(async (query: { text: string }) => ({ rows: rows(query) }));
});
afterEach(() => vi.resetAllMocks());

describe("product service boundary", () => {
  it.each([{ ...command, name: " " }, { ...command, name: "x".repeat(81) }, { ...command, sku: "x".repeat(41) },
    { ...command, sku: 123 }, { ...command, unitId: "bad" }, { ...command, categoryId: "bad" },
    { ...command, operation: "update-product", id: "bad" }, { operation: "deactivate-product", id: "bad" },
  ])("rejects invalid product fields before any database query: %j", async (input) => {
    expect(await manageCatalog(input)).toMatchObject({ status: "invalid" });
    expect(mocks.requirePermission).toHaveBeenCalledWith("catalog.manage");
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("parameterizes names and ignores caller authority when creating products", async () => {
    const name = "x'); delete from products; --";
    expect(await manageCatalog({ ...command, name: ` ${name} `, sku: " W-1 ", categoryId, organizationId: "attacker" })).toEqual({ status: "success" });
    const [query, values] = mocks.query.mock.calls.find(([query]) => query.text.startsWith("insert"))!;
    expect(query.text).not.toContain(name);
    expect(values).toEqual([organizationId, name, "W-1", categoryId, unitId]);
    expect(mocks.query.mock.calls.some(([query]) => query.text.includes("for update"))).toBe(true);
  });
  it("stores a blank optional code as null", async () => {
    await manageCatalog({ ...command, sku: " " });
    expect(mocks.query.mock.calls.find(([query]) => query.text.startsWith("insert"))![1]).toContain(null);
  });
  it("accepts omitted optional code and category", async () => {
    expect(await manageCatalog({ operation: "create-product", name: "Wheat", unitId })).toEqual({ status: "success" });
    expect(mocks.query.mock.calls.find(([query]) => query.text.startsWith("insert"))![1]).toEqual([organizationId, "Wheat", null, null, unitId]);
  });
  it.each(["unitId", "categoryId"])("rejects unavailable or inactive %s in this tenant", async (field) => {
    mocks.query.mockImplementation(async (query: { text: string }) => ({ rows:
      query.text.includes(field === "unitId" ? 'from "catalog_units"' : 'from "product_categories"') ? [] : rows(query),
    }));
    expect(await manageCatalog({ ...command, categoryId })).toEqual({ status: "invalid", fields: [field] });
    expect(mocks.query.mock.calls.some(([query]) => /^(insert|update)/.test(query.text))).toBe(false);
    const [query, values] = mocks.query.mock.calls.find(([query]) => query.text.includes(field === "unitId" ? 'from "catalog_units"' : 'from "product_categories"'))!;
    expect(query.text).toContain('"organization_id" =');
    expect(values).toContain(organizationId); expect(values).toContain(true);
  });
  it.each(["update-product", "deactivate-product"])("scopes %s to the active server tenant", async (operation) => {
    expect(await manageCatalog({ ...command, operation, id })).toEqual({ status: "conflict" });
    const [query, values] = mocks.query.mock.calls.find(([query]) => query.text.startsWith("update"))!;
    expect(query.text).toContain('"products"."organization_id" =');
    expect(query.text).toContain('"products"."is_active" =');
    expect(values).toEqual(expect.arrayContaining([id, organizationId, true]));
  });
  it.each(["products_organization_name", "products_organization_sku"])("maps the expected %s conflict", async (constraint) => {
    mocks.query.mockImplementation(async (query: { text: string }) => {
      if (query.text.startsWith("insert")) throw Object.assign(new Error("private"), { code: "23505", constraint });
      return { rows: rows(query) };
    });
    expect(await manageCatalog(command)).toEqual({ status: "duplicate" });
  });
  it.each([null, { ...tenant, clerkOrganizationId: "org_other" },
    { ...tenant, clerkOrganizationId: "org_a", membershipId: "other" },
    { ...tenant, clerkOrganizationId: "org_a", userId: "other" },
  ])("denies a changed actor after waiting for the lock: %j", async (current) => {
    mocks.getActiveOrganizationMembership.mockResolvedValue(current);
    await expect(manageCatalog(command)).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    expect(mocks.query.mock.calls.some(([query]) => query.text.startsWith("insert"))).toBe(false);
  });
  it("denies reads and writes before querying when permission is absent", async () => {
    mocks.requirePermission.mockRejectedValue({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    for (const work of [() => getProducts(), () => getProduct(id), () => manageCatalog(command)]) {
      await expect(work()).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    }
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("reads only tenant-bound products and joins without exposing tenant identifiers", async () => {
    mocks.query.mockResolvedValue({ rows: [[id, "Wheat", null, null, unitId, false, "kg", null]] });
    expect(await getProducts()).toEqual([{ id, name: "Wheat", sku: null, categoryId: null, unitId, isActive: false, unitName: "kg", categoryName: null }]);
    expect((await getProduct(id)).id).toBe(id);
    expect(mocks.requirePermission).toHaveBeenCalledWith("catalog.read");
    for (const [query, values] of mocks.query.mock.calls) {
      expect(query.text).toContain('"products"."organization_id" ='); expect(values).toContain(organizationId);
    }
  });
  it("returns not found for malformed, missing, or foreign product IDs", async () => {
    await expect(getProduct("bad")).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    expect(mocks.query).not.toHaveBeenCalled();
    await expect(getProduct(id)).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
  });
  it("sanitizes read failures", async () => {
    mocks.query.mockRejectedValue(new Error("private SQL password"));
    await expect(getProducts()).rejects.toThrow(/^Products unavailable\.$/);
    await expect(getProduct(id)).rejects.toThrow(/^Products unavailable\.$/);
  });
});
