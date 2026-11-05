import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { businessRoles, type BusinessRole } from "@/auth/permissions";

const mocks = vi.hoisted(() => ({ requireSession: vi.fn(), getActiveOrganizationMembership: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/auth/server", () => mocks);
vi.mock("@/auth/organizations", () => mocks);
vi.mock("@/env", () => ({ env: { databaseUrl: process.env.AFCS_TEST_DATABASE_URL ?? "postgresql://unused:unused@127.0.0.1:1/unused", nodeEnvironment: "test" } }));
import { db } from "./index";
import { adjustInventory, getAdjustmentOptions } from "./inventory-adjustments";
import { getInventoryWorkspace } from "./inventory";
import { catalogUnits, inventoryMovements, organizationRoleAssignments, organizations, products, supplierPayables, warehouses } from "./schema";

type Actor = { userId: string; membershipId: string; clerkOrganizationId: string };
const context = new AsyncLocalStorage<Actor>();
const organizationIds: string[] = [];
async function fixture() {
  const actor = { clerkOrganizationId: `task22_org_${randomUUID()}`, userId: `user_${randomUUID()}`, membershipId: `member_${randomUUID()}` };
  const [organization] = await db.insert(organizations).values({ clerkOrganizationId: actor.clerkOrganizationId }).returning();
  const organizationId = organization.id; organizationIds.push(organizationId);
  await db.insert(organizationRoleAssignments).values({ organizationId, membershipId: actor.membershipId, userId: actor.userId, role: "owner" });
  const [warehouse] = await db.insert(warehouses).values({ organizationId, name: "Main" }).returning();
  const [unit] = await db.insert(catalogUnits).values({ organizationId, name: "kg", kind: "fixed", kilogramsPerUnit: "1.000" }).returning();
  const [product] = await db.insert(products).values({ organizationId, name: "Wheat", unitId: unit.id }).returning();
  const as = <T>(work: () => Promise<T>) => context.run(actor, work);
  const command = (quantityKg = "10", reasonCode = "opening_stock") => ({ requestId: randomUUID(), productId: product.id, warehouseId: warehouse.id, quantityKg, reasonCode, reason: "Physical count checked by owner", reference: "Count 14", approved: true });
  const role = (role: BusinessRole) => db.update(organizationRoleAssignments).set({ role }).where(eq(organizationRoleAssignments.organizationId, organizationId));
  return { organizationId, actor, product, warehouse, unit, as, command, role };
}

describe.skipIf(!process.env.AFCS_TEST_DATABASE_URL)("inventory adjustments against isolated PostgreSQL", () => {
  beforeAll(async () => {
    const result = await db.execute<{ database: string }>(sql`select current_database() as database`);
    if (result.rows[0]?.database !== "afcs_task07_verify") throw new Error("Use only isolated afcs_task07_verify.");
  });
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireSession.mockImplementation(async () => ({ userId: context.getStore()?.userId }));
    mocks.getActiveOrganizationMembership.mockImplementation(async () => context.getStore() ?? null);
  });
  afterAll(async () => {
    for (const table of [inventoryMovements, products, catalogUnits, warehouses, organizationRoleAssignments]) {
      if (organizationIds.length) await db.delete(table).where(inArray(table.organizationId, organizationIds));
    }
    if (organizationIds.length) await db.delete(organizations).where(inArray(organizations.id, organizationIds));
  });
  it("records opening stock and an exact signed correction with provenance and no payable", async () => {
    const f = await fixture();
    expect((await f.as(() => adjustInventory({ ...f.command(), organizationId: "attacker", role: "owner", performedByUserId: "spoof" }))).status).toBe("success");
    expect((await f.as(() => adjustInventory(f.command("-0.001", "loss")))).status).toBe("success");
    const result = await f.as(() => getInventoryWorkspace());
    expect(result.balances[0].quantityKg).toBe("9.999");
    expect(result.movements).toHaveLength(2);
    expect(result.movements[0]).toMatchObject({ kind: "adjustment", quantityKg: "-0.001", reasonCode: "loss", reason: "Physical count checked by owner", reference: "Count 14", performedByUserId: f.actor.userId, receiptId: null, productName: "Wheat", warehouseName: "Main" });
    expect(await db.select().from(supplierPayables).where(eq(supplierPayables.organizationId, f.organizationId))).toHaveLength(0);
  });
  it("allows exact zero and rejects even a one-gram overdraft without writing", async () => {
    const f = await fixture();
    expect(await f.as(() => adjustInventory(f.command("-0.001", "loss")))).toMatchObject({ status: "insufficient_stock" });
    await f.as(() => adjustInventory(f.command("1")));
    expect(await f.as(() => adjustInventory(f.command("-1.001", "count_correction")))).toMatchObject({ status: "insufficient_stock" });
    expect((await f.as(() => getInventoryWorkspace())).movements).toHaveLength(1);
    expect((await f.as(() => adjustInventory(f.command("-1", "spoilage")))).status).toBe("success");
    expect((await f.as(() => getInventoryWorkspace())).balances[0].quantityKg).toBe("0.000");
  });
  it("serializes concurrent deductions so only one can consume available stock", async () => {
    const f = await fixture(); await f.as(() => adjustInventory(f.command()));
    const results = await Promise.all([f.as(() => adjustInventory(f.command("-6", "loss"))), f.as(() => adjustInventory(f.command("-6", "spoilage")))]);
    expect(results.map((r) => r.status).sort()).toEqual(["insufficient_stock", "success"]);
    expect((await f.as(() => getInventoryWorkspace())).balances[0].quantityKg).toBe("4.000");
  });
  it("replays a normalized request once and rejects a changed payload", async () => {
    const f = await fixture(); const input = f.command();
    const [a, b] = await Promise.all([f.as(() => adjustInventory(input)), f.as(() => adjustInventory({ ...input, quantityKg: "10.000" }))]);
    expect(a).toEqual(b); expect(a.status).toBe("success");
    expect(await f.as(() => adjustInventory({ ...input, reason: "Changed" }))).toEqual({ status: "conflict" });
    await db.update(products).set({ isActive: false }).where(eq(products.id, f.product.id));
    expect(await f.as(() => adjustInventory(input))).toEqual(a);
    expect((await f.as(() => getInventoryWorkspace())).movements).toHaveLength(1);
  });
  it.each(businessRoles.filter((r) => r !== "owner"))("denies correction and options for %s", async (role) => {
    const f = await fixture(); await f.role(role);
    await expect(f.as(() => adjustInventory(f.command()))).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    await expect(f.as(() => getAdjustmentOptions())).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    expect((await f.as(() => getInventoryWorkspace())).canCorrect).toBe(false);
  });
  it("rejects foreign, missing and inactive references; options use verified tenant", async () => {
    const a = await fixture(); const b = await fixture();
    for (const patch of [{ productId: b.product.id }, { warehouseId: b.warehouse.id }, { productId: randomUUID() }]) {
      expect(await a.as(() => adjustInventory({ ...a.command(), ...patch }))).toMatchObject({ status: "invalid" });
    }
    const options = await a.as(() => getAdjustmentOptions());
    expect(options.organizationId).toBe(a.organizationId); expect(options.products.map((p) => p.id)).toEqual([a.product.id]);
    await db.update(products).set({ isActive: false }).where(eq(products.id, a.product.id));
    expect(await a.as(() => adjustInventory(a.command()))).toMatchObject({ status: "invalid" });
    await db.update(products).set({ isActive: true }).where(eq(products.id, a.product.id));
    await db.update(warehouses).set({ isActive: false }).where(eq(warehouses.id, a.warehouse.id));
    expect(await a.as(() => adjustInventory(a.command()))).toMatchObject({ status: "invalid" });
  });
  it("preserves historical names and paginates adjustments without losing the balance", async () => {
    const f = await fixture();
    for (let i = 0; i < 23; i++) await f.as(() => adjustInventory(f.command("1", "count_correction")));
    await db.update(products).set({ name: "Renamed", isActive: false }).where(eq(products.id, f.product.id));
    await db.update(warehouses).set({ name: "Renamed", isActive: false }).where(eq(warehouses.id, f.warehouse.id));
    const first = await f.as(() => getInventoryWorkspace({ productId: f.product.id }));
    const second = await f.as(() => getInventoryWorkspace({ productId: f.product.id, after: first.nextCursor }));
    expect(first.movements).toHaveLength(20); expect(second.movements).toHaveLength(3);
    expect(new Set([...first.movements, ...second.movements].map((m) => m.id)).size).toBe(23);
    expect(first.movements[0]).toMatchObject({ productName: "Wheat", warehouseName: "Main" });
    expect(first.balances).toEqual(second.balances); expect(first.balances[0].quantityKg).toBe("23.000");
  });
  it("checks an aggregate exceeding the individual-entry decimal bound exactly", async () => {
    const f = await fixture();
    await f.as(() => adjustInventory(f.command("999999999999999999.999")));
    await f.as(() => adjustInventory(f.command("999999999999999999.999")));
    expect((await f.as(() => adjustInventory(f.command("-0.001", "loss")))).status).toBe("success");
    expect((await f.as(() => getInventoryWorkspace())).balances[0].quantityKg).toBe("1999999999999999999.997");
  });
  it("rechecks owner authority after waiting for the organization lock", async () => {
    const f = await fixture(); let release: () => void = () => {}; let locked: () => void = () => {};
    const ready = new Promise<void>((resolve) => { locked = resolve; });
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const blocker = db.transaction(async (tx) => {
      await tx.select().from(organizations).where(eq(organizations.id, f.organizationId)).for("update");
      locked(); await gate;
      await tx.update(organizationRoleAssignments).set({ role: "viewer" }).where(eq(organizationRoleAssignments.organizationId, f.organizationId));
    });
    await ready;
    let checked: () => void = () => {};
    const initialCheck = new Promise<void>((resolve) => { checked = resolve; });
    mocks.getActiveOrganizationMembership.mockImplementation(async () => { checked(); return context.getStore() ?? null; });
    const pending = f.as(() => adjustInventory(f.command()));
    const denied = expect(pending).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    await initialCheck; release(); await blocker; await denied;
    expect((await f.as(() => getInventoryWorkspace())).movements).toHaveLength(0);
  });
  it("database constraints reject invalid provenance and missing reason metadata", async () => {
    const f = await fixture(); const foreign = await fixture(); await f.as(() => adjustInventory(f.command()));
    const [row] = await db.select().from(inventoryMovements).where(eq(inventoryMovements.organizationId, f.organizationId));
    const invalidRows: Partial<typeof inventoryMovements.$inferInsert>[] = [{ reason: null }, { reasonCode: null }, { requestId: null },
      { requestFingerprint: null }, { requestFingerprint: "bad" }, { productName: null }, { warehouseName: null }, { performedByMembershipId: " " },
      { productId: foreign.product.id }, { warehouseId: foreign.warehouse.id }, { receiptItemId: randomUUID() },
      { reasonCode: "loss", quantityKg: "1.000" }, { quantityKg: "0.0001" }, { kind: "receipt" }];
    for (const patch of invalidRows) {
      await expect(db.insert(inventoryMovements).values({ ...row, id: randomUUID(), requestId: randomUUID(), ...patch })).rejects.toThrow();
    }
  });
  it("rejects a changed provider identity on the transaction connection", async () => {
    const f = await fixture();
    mocks.getActiveOrganizationMembership.mockResolvedValueOnce(f.actor).mockResolvedValueOnce({ ...f.actor, membershipId: "rejoined" });
    await expect(f.as(() => adjustInventory(f.command()))).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    expect(await db.select().from(inventoryMovements).where(eq(inventoryMovements.organizationId, f.organizationId))).toHaveLength(0);
  });
});
