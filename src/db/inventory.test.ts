import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requirePermission: vi.fn(), query: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./authorization", () => mocks);
vi.mock("./index", async () => {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { Client } = await import("pg");
  const client = new Client(); client.query = mocks.query;
  return { db: drizzle({ client }) };
});
import { getInventoryWorkspace } from "./inventory";

const organizationId = "53409e5c-e4d7-4351-a6b3-46ee18c4f532";
const id = "63409e5c-e4d7-4351-a6b3-46ee18c4f532";
const tenant = { userId: "user_a", membershipId: "member_a", organizationId };
beforeEach(() => {
  mocks.requirePermission.mockResolvedValue(tenant);
  mocks.query.mockImplementation(async (query: { text: string }) => ({ rows:
    query.text.includes('from "organization_role_assignments"') ? [["owner"]] : [],
  }));
});
afterEach(() => vi.resetAllMocks());

describe("inventory read boundary", () => {
  it.each([{ productId: "bad" }, { after: "bad" }, { productId: [id, id] }, { after: [id] }, null])("rejects malformed filters before database work: %j", async (input) => {
    await expect(getInventoryWorkspace(input)).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    expect(mocks.requirePermission).toHaveBeenCalledExactlyOnceWith("inventory.read");
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("requires verified inventory access before any read", async () => {
    mocks.requirePermission.mockRejectedValue({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    await expect(getInventoryWorkspace()).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("reads one consistent snapshot and binds the verified organization to both ledger queries", async () => {
    expect(await getInventoryWorkspace({ organizationId: "attacker", role: "owner" })).toMatchObject({ balances: [], movements: [], product: null, nextCursor: null, canReadPurchases: true });
    expect(mocks.query.mock.calls[0][0]).toBe("begin isolation level repeatable read read only");
    const queries = mocks.query.mock.calls.filter(([query]) => typeof query === "object" && query.text.includes('from "inventory_movements"'));
    expect(queries).toHaveLength(2);
    for (const [query, params] of queries) {
      expect(query.text).toContain('"inventory_movements"."organization_id" =');
      expect(params).toContain(organizationId); expect(params).not.toContain("attacker");
    }
    expect(queries[0][0].text).toContain("sum("); expect(queries[0][0].text).toContain("::text");
    expect(queries[1][1]).toContain(21);
  });
  it("rechecks the membership-bound local grant on the read connection", async () => {
    mocks.query.mockResolvedValue({ rows: [] });
    await expect(getInventoryWorkspace()).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    const [, params] = mocks.query.mock.calls.find(([query]) => typeof query === "object" && query.text.includes('from "organization_role_assignments"'))!;
    expect(params).toEqual([organizationId, tenant.membershipId, tenant.userId]);
    expect(mocks.query.mock.calls.some(([query]) => typeof query === "object" && query.text.includes('from "inventory_movements"'))).toBe(false);
  });
  it.each([{ productId: id }, { after: id }])("rejects unavailable or foreign references: %j", async (input) => {
    await expect(getInventoryWorkspace(input)).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
  });
  it("hides database details while preserving framework denial", async () => {
    mocks.query.mockRejectedValue(new Error("private connection password and SQL"));
    await expect(getInventoryWorkspace()).rejects.toThrow(/^Inventory unavailable\.$/);
  });
});
