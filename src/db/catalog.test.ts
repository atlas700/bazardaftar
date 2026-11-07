import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requirePermission: vi.fn(), getActiveOrganizationMembership: vi.fn(), query: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./authorization", () => mocks);
vi.mock("@/auth/organizations", () => mocks);
vi.mock("./index", async () => {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { Client } = await import("pg");
  const client = new Client();
  client.query = mocks.query;
  return { db: drizzle({ client }) };
});

import { getCatalogWorkspace, getUnitSnapshot, manageCatalog } from "./catalog";

const organizationId = "53409e5c-e4d7-4351-a6b3-46ee18c4f532";
const id = "63409e5c-e4d7-4351-a6b3-46ee18c4f532";
const tenant = { userId: "user_a", membershipId: "member_a", organizationId };
beforeEach(() => {
  mocks.requirePermission.mockResolvedValue(tenant);
  mocks.getActiveOrganizationMembership.mockResolvedValue({ ...tenant, clerkOrganizationId: "org_a" });
  mocks.query.mockImplementation(async (query: { text: string }) => ({ rows:
    query.text.startsWith("select") ? (query.text.includes('"organizations"') ? [[organizationId, "org_a"]] : [["owner"]])
      : query.text.startsWith('insert into "catalog_units"') ? [[id]] : [],
  }));
});
afterEach(() => vi.resetAllMocks());

describe("catalogue service boundary", () => {
  it.each([null, {}, { operation: "remove-unit", id }, { operation: "create-category", name: " " },
    { operation: "create-category", name: "x".repeat(81) }, { operation: "update-category", id: "bad", name: "Fruit" },
    ...["0", "-1", "1.0001", "1e3", "NaN", " 1", "1000000000000000000", 1].map((kilogramsPerUnit) => ({
      operation: "create-unit", name: "Invalid", unit: { kind: "fixed", kilogramsPerUnit },
    })), { operation: "create-unit", name: "Bag", unit: { kind: "bag", kilogramsPerUnit: "44" } },
  ])("rejects invalid input before a transaction: %j", async (input) => {
    expect(await manageCatalog(input)).toMatchObject({ status: "invalid" });
    expect(mocks.requirePermission).toHaveBeenCalledWith("catalog.manage");
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("never reads or writes after permission denial", async () => {
    mocks.requirePermission.mockRejectedValue(new Error("denied"));
    await expect(manageCatalog({ operation: "seed-units" })).rejects.toThrow("denied");
    await expect(getUnitSnapshot({ id, quantity: "1" })).rejects.toThrow("denied");
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it.each([null, { ...tenant, clerkOrganizationId: "org_other" },
    { ...tenant, clerkOrganizationId: "org_a", membershipId: "member_other" },
    { ...tenant, clerkOrganizationId: "org_a", userId: "user_other" },
  ])("rechecks the exact actor after locking and rolls back a changed identity: %j", async (current) => {
    mocks.getActiveOrganizationMembership.mockResolvedValue(current);
    await expect(manageCatalog({ operation: "seed-units" })).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    expect(mocks.query.mock.calls.some(([query]) => query.text.includes("for update"))).toBe(true);
    expect(mocks.query.mock.calls.some(([query]) => query.text.startsWith("insert"))).toBe(false);
    expect(mocks.query).toHaveBeenLastCalledWith(expect.objectContaining({ text: "rollback" }), []);
  });

  it("uses the server tenant, normalized weight, and bound name for creation", async () => {
    const name = "x'); delete from organizations; --";
    expect(await manageCatalog({ operation: "create-unit", organizationId: "attacker", name: ` ${name} `,
      unit: { kind: "fixed", kilogramsPerUnit: "4.4" } })).toEqual({ status: "success" });
    const [query, values] = mocks.query.mock.calls.find(([query]) => query.text.startsWith("insert"))!;
    expect(query.text).not.toContain(name);
    expect(values).toEqual([organizationId, name, "fixed", "4.400"]);
    expect(mocks.getActiveOrganizationMembership).toHaveBeenCalledOnce();
  });

  it.each(["update-category", "deactivate-category", "deactivate-unit"])("scopes %s to an active row in the current tenant", async (operation) => {
    expect(await manageCatalog({ operation, id, name: "Fruit" })).toEqual({ status: "conflict" });
    const [query, values] = mocks.query.mock.calls.find(([query]) => query.text.startsWith("update"))!;
    expect(query.text).toContain('"organization_id" =');
    expect(query.text).toContain('"is_active" =');
    expect(values).toContain(id);
    expect(values).toContain(organizationId);
    expect(values).toContain(true);
  });

  it("maps only known name constraints and propagates other database failures", async () => {
    for (const constraint of ["catalog_units_organization_name", "product_categories_organization_name"]) {
      mocks.query.mockImplementation(async (query: { text: string }) => {
        if (query.text.startsWith("insert")) throw Object.assign(new Error("db"), { code: "23505", constraint });
        return { rows: query.text.startsWith("select") ? (query.text.includes('"organizations"') ? [[organizationId, "org_a"]] : [["owner"]]) : [] };
      });
      expect(await manageCatalog({ operation: "create-category", name: "Fruit" })).toEqual({ status: "duplicate" });
    }
    mocks.query.mockRejectedValueOnce(new Error("private SQL details"));
    await expect(manageCatalog({ operation: "seed-units" })).rejects.toThrow("Failed query");
  });

  it("sanitizes read failures while preserving permission control flow", async () => {
    mocks.query.mockRejectedValue(new Error("private SQL details"));
    await expect(getCatalogWorkspace()).rejects.toThrow(/^Catalogue unavailable\.$/);
    mocks.requirePermission.mockRejectedValue({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    await expect(getCatalogWorkspace()).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
  });
});
