import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { businessRoles, hasPermission, type BusinessRole } from "@/auth/permissions";

const mocks = vi.hoisted(() => ({ requireSession: vi.fn(), getActiveOrganizationMembership: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/auth/server", () => mocks);
vi.mock("@/auth/organizations", () => mocks);
vi.mock("@/env", () => ({ env: { databaseUrl: process.env.AFCS_TEST_DATABASE_URL ?? "postgresql://unused:unused@127.0.0.1:1/unused", nodeEnvironment: "test" } }));
import { db } from "./index";
import { getInventoryWorkspace } from "./inventory";
import { adjustInventory } from "./inventory-adjustments";
import { createPurchaseDraft, getPurchase, mutatePurchase } from "./purchases";
import { acceptReceipt } from "./receipts";
import { catalogUnits, goodsReceiptItems, goodsReceipts, inventoryMovements, organizationRoleAssignments, organizations, products, purchaseOrderItems, purchaseOrders, supplierPayables, suppliers, warehouses } from "./schema";

type Actor = { userId: string; membershipId: string; clerkOrganizationId: string };
const context = new AsyncLocalStorage<Actor>();
const organizationIds: string[] = [];
async function fixture(lineCount = 1, quantity = "1000", unitPrice = "1") {
  const actor = { clerkOrganizationId: `task21_org_${randomUUID()}`, userId: `user_${randomUUID()}`, membershipId: `member_${randomUUID()}` };
  const [organization] = await db.insert(organizations).values({ clerkOrganizationId: actor.clerkOrganizationId }).returning();
  const organizationId = organization.id; organizationIds.push(organizationId);
  await db.insert(organizationRoleAssignments).values({ organizationId, membershipId: actor.membershipId, userId: actor.userId, role: "owner" });
  const [supplier] = await db.insert(suppliers).values({ organizationId, name: "Helmand Grain" }).returning();
  const [warehouse] = await db.insert(warehouses).values({ organizationId, name: "Main" }).returning();
  const [kg, bag] = await db.insert(catalogUnits).values([
    { organizationId, name: "kg", kind: "fixed", kilogramsPerUnit: "1.000" }, { organizationId, name: "bag", kind: "bag" },
  ]).returning();
  const [product] = await db.insert(products).values({ organizationId, name: "Wheat", unitId: kg.id }).returning();
  const [other] = await db.insert(products).values({ organizationId, name: "Rice", unitId: kg.id }).returning();
  const as = <T>(work: () => Promise<T>) => context.run(actor, work);
  const draft = await as(() => createPurchaseDraft({ requestId: randomUUID(), supplierId: supplier.id, warehouseId: warehouse.id, currency: "AFN",
    items: Array.from({ length: lineCount }, (_, i) => ({ productId: i % 2 ? other.id : product.id, quantity, quantityUnitId: kg.id, unitPrice, priceUnitId: kg.id })) }));
  if (draft.status !== "success") throw new Error("Fixture draft failed.");
  await as(() => mutatePurchase({ id: draft.purchaseId, revision: 1, requestId: randomUUID(), action: "order" }));
  const purchase = await as(() => getPurchase(draft.purchaseId));
  const receive = async (quantity: string, bagWeightKg: string | null = null) => {
    const current = await as(() => getPurchase(purchase.id));
    const result = await as(() => acceptReceipt({ purchaseId: purchase.id, revision: current.revision, requestId: randomUUID(), complete: false, approveVariance: false, reason: "",
      items: current.items.map((line) => ({ purchaseItemId: line.id, quantity, quantityUnitId: bagWeightKg ? bag.id : kg.id, bagWeightKg })) }));
    expect(result.status).toBe("success");
    return result;
  };
  const role = (role: BusinessRole) => db.update(organizationRoleAssignments).set({ role }).where(eq(organizationRoleAssignments.organizationId, organizationId));
  return { organizationId, actor, warehouse, product, other, purchase, receive, role, as };
}

describe.skipIf(!process.env.AFCS_TEST_DATABASE_URL)("inventory reads against isolated PostgreSQL", () => {
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
    for (const table of [inventoryMovements, supplierPayables, goodsReceiptItems, goodsReceipts, purchaseOrderItems, purchaseOrders, products, catalogUnits, suppliers, warehouses, organizationRoleAssignments]) {
      if (organizationIds.length) await db.delete(table).where(inArray(table.organizationId, organizationIds));
    }
    if (organizationIds.length) await db.delete(organizations).where(inArray(organizations.id, organizationIds));
  });
  it("shows no stock from drafts or ordered agreements before acceptance", async () => {
    const f = await fixture();
    expect(await f.as(() => getInventoryWorkspace())).toMatchObject({ balances: [], movements: [], nextCursor: null });
  });
  it("aggregates different bag weights and grams exactly by product and warehouse", async () => {
    const f = await fixture(2);
    await f.receive("1", "44"); await f.receive("1", "48.4"); await f.receive("0.001");
    const result = await f.as(() => getInventoryWorkspace());
    expect(result.balances).toHaveLength(2);
    for (const row of result.balances) expect(row).toMatchObject({ warehouseId: f.warehouse.id, quantityKg: "92.401" });
    expect(result.movements).toHaveLength(6);
    expect(result.movements.map((row) => row.quantityKg).sort()).toEqual(["0.001", "0.001", "44.000", "44.000", "48.400", "48.400"]);
  });
  it("retains stock for inactive references and history snapshots after renaming", async () => {
    const f = await fixture(); await f.receive("2");
    await db.update(products).set({ name: "Renamed wheat", isActive: false }).where(eq(products.id, f.product.id));
    await db.update(warehouses).set({ name: "Renamed warehouse", isActive: false }).where(eq(warehouses.id, f.warehouse.id));
    const result = await f.as(() => getInventoryWorkspace());
    expect(result.balances[0]).toMatchObject({ productName: "Renamed wheat", productActive: false, warehouseName: "Renamed warehouse", warehouseActive: false, quantityKg: "2.000" });
    expect(result.movements[0]).toMatchObject({ productName: "Wheat", warehouseName: "Main", purchaseId: f.purchase.id });
  });
  it("keeps aggregate stock exact even beyond the per-line quantity bound", async () => {
    const f = await fixture(3, "999999999999999999.999", "0");
    await f.receive("999999999999999999.999");
    const result = await f.as(() => getInventoryWorkspace());
    expect(result.balances.find((row) => row.productId === f.product.id)?.quantityKg).toBe("1999999999999999999.998");
  });
  it.each(businessRoles)("allows inventory reads for %s and respects purchase-detail permissions", async (role) => {
    const f = await fixture(); await f.receive("1"); await f.role(role);
    const result = await f.as(() => getInventoryWorkspace());
    expect(result.balances).toHaveLength(1);
    expect(result.canReadPurchases).toBe(hasPermission(role, "purchases.read"));
    expect(result.movements[0].purchaseId).toBe(hasPermission(role, "purchases.read") ? f.purchase.id : null);
    expect(result.movements[0]).not.toHaveProperty("unitPrice");
    expect(result.movements[0]).not.toHaveProperty("supplierId");
  });
  it("isolates balances, product filters and cursor anchors between businesses", async () => {
    const a = await fixture(); const b = await fixture(); await a.receive("1"); await b.receive("2");
    const mine = await a.as(() => getInventoryWorkspace()); const theirs = await b.as(() => getInventoryWorkspace());
    expect(mine.balances.map((row) => row.productId)).toEqual([a.product.id]);
    for (const input of [{ productId: b.product.id }, { after: theirs.movements[0].id }]) {
      await expect(a.as(() => getInventoryWorkspace(input))).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    }
  });
  it("paginates timestamp ties without duplicates or omissions and keeps balances independent of the cursor", async () => {
    const f = await fixture(24); await f.receive("1");
    await db.execute(sql`update ${inventoryMovements} set created_at = '2026-11-03 12:00:00.123456+00' where organization_id = ${f.organizationId}`);
    const first = await f.as(() => getInventoryWorkspace());
    expect(first.movements).toHaveLength(20); expect(first.nextCursor).toBe(first.movements[19].id);
    const second = await f.as(() => getInventoryWorkspace({ after: first.nextCursor }));
    expect(second.movements).toHaveLength(4); expect(second.nextCursor).toBeNull(); expect(second.balances).toEqual(first.balances);
    expect(new Set([...first.movements, ...second.movements].map((row) => row.id)).size).toBe(24);
    const filtered = await f.as(() => getInventoryWorkspace({ productId: f.product.id }));
    expect(filtered.movements).toHaveLength(12); expect(filtered.movements.every((row) => row.productId === f.product.id)).toBe(true);
    await expect(f.as(() => getInventoryWorkspace({ productId: f.other.id, after: filtered.movements[0].id }))).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
  });
  it("returns a readable empty history for a tenant product without movements", async () => {
    const f = await fixture();
    expect(await f.as(() => getInventoryWorkspace({ productId: f.other.id }))).toMatchObject({ product: { id: f.other.id, name: "Rice" }, balances: [], movements: [], nextCursor: null });
  });
  it("includes receipts and signed adjustments in the same exact stock history", async () => {
    const f = await fixture(); await f.receive("2");
    const result = await f.as(() => adjustInventory({ requestId: randomUUID(), productId: f.product.id, warehouseId: f.warehouse.id,
      quantityKg: "-0.001", reasonCode: "count_correction", reason: "Physical count", reference: "", approved: true }));
    expect(result.status).toBe("success");
    const inventory = await f.as(() => getInventoryWorkspace());
    expect(inventory.balances[0].quantityKg).toBe("1.999");
    expect(inventory.movements.map((m) => m.kind)).toEqual(["adjustment", "receipt"]);
    expect(inventory.movements[1]).toMatchObject({ receiptId: expect.any(String), quantity: "2.000000000000000000", purchaseId: f.purchase.id });
  });
  it("denies revoked grants and missing or mismatched provider identity", async () => {
    const f = await fixture();
    mocks.requireSession.mockResolvedValueOnce({ userId: "different_user" });
    await expect(f.as(() => getInventoryWorkspace())).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    await db.delete(organizationRoleAssignments).where(eq(organizationRoleAssignments.organizationId, f.organizationId));
    await expect(f.as(() => getInventoryWorkspace())).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    await expect(getInventoryWorkspace()).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
  });
});
