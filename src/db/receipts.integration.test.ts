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
import { createPurchaseDraft, getPurchase, mutatePurchase } from "./purchases";
import { acceptReceipt } from "./receipts";
import { catalogUnits, goodsReceiptItems, goodsReceipts, inventoryMovements, organizationRoleAssignments, organizations, products, purchaseOrderItems, purchaseOrders, supplierPayables, suppliers, warehouses } from "./schema";

type Actor = { userId: string; membershipId: string; clerkOrganizationId: string };
const context = new AsyncLocalStorage<Actor>();
const organizationIds: string[] = [];
async function fixture() {
  const clerkOrganizationId = `task20_org_${randomUUID()}`;
  const [organization] = await db.insert(organizations).values({ clerkOrganizationId }).returning();
  organizationIds.push(organization.id);
  const organizationId = organization.id;
  const actor = { clerkOrganizationId, userId: `user_${randomUUID()}`, membershipId: `member_${randomUUID()}` };
  await db.insert(organizationRoleAssignments).values({ organizationId, membershipId: actor.membershipId, userId: actor.userId, role: "owner" });
  const [supplier] = await db.insert(suppliers).values({ organizationId, name: "Helmand Grain" }).returning();
  const [warehouse] = await db.insert(warehouses).values({ organizationId, name: "Main" }).returning();
  const [kg, pack, bag] = await db.insert(catalogUnits).values([
    { organizationId, name: "kg", kind: "fixed", kilogramsPerUnit: "1.000" },
    { organizationId, name: "3 kg pack", kind: "fixed", kilogramsPerUnit: "3.000" },
    { organizationId, name: "bag", kind: "bag" },
  ]).returning();
  const [product] = await db.insert(products).values({ organizationId, name: "Wheat", unitId: kg.id }).returning();
  const as = <T>(work: () => Promise<T>) => context.run(actor, work);
  const draft = await as(() => createPurchaseDraft({ requestId: randomUUID(), supplierId: supplier.id, warehouseId: warehouse.id, currency: "AFN",
    items: [{ productId: product.id, quantity: "3", quantityUnitId: kg.id, unitPrice: "100", priceUnitId: pack.id }] }));
  if (draft.status !== "success") throw new Error("Fixture draft failed.");
  await as(() => mutatePurchase({ id: draft.purchaseId, revision: 1, requestId: randomUUID(), action: "order" }));
  const purchase = await as(() => getPurchase(draft.purchaseId));
  const command = { purchaseId: purchase.id, revision: purchase.revision, requestId: randomUUID(), complete: false, approveVariance: false, reason: "",
    items: [{ purchaseItemId: purchase.items[0].id, quantity: "1", quantityUnitId: kg.id, bagWeightKg: null as string | null }] };
  const role = (role: BusinessRole) => db.update(organizationRoleAssignments).set({ role }).where(eq(organizationRoleAssignments.organizationId, organizationId));
  return { organizationId, actor, supplier, warehouse, product, kg, pack, bag, purchase, command, role, as };
}
async function rows(organizationId: string) {
  return Promise.all([goodsReceipts, goodsReceiptItems, inventoryMovements, supplierPayables].map((table) => db.select().from(table).where(eq(table.organizationId, organizationId))));
}

describe.skipIf(!process.env.AFCS_TEST_DATABASE_URL)("receipt posting against isolated PostgreSQL", () => {
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
  it("reconciles three partial receipts to 100 AFN and exactly 3 kg", async () => {
    const f = await fixture();
    for (let index = 0; index < 3; index++) {
      const result = await f.as(() => acceptReceipt({ ...f.command, revision: 2 + index, requestId: randomUUID() }));
      expect(result.status).toBe("success");
      expect((await f.as(() => getPurchase(f.purchase.id))).status).toBe(index === 2 ? "received" : "partially_received");
    }
    const [receipts, lines, movements, payables] = await rows(f.organizationId);
    expect(receipts).toHaveLength(3); expect(lines).toHaveLength(3); expect(movements).toHaveLength(3);
    expect(payables.map((row) => row.amount).sort()).toEqual(["33.33", "33.33", "33.34"]);
    expect(movements.map((row) => row.quantityKg)).toEqual(["1.000", "1.000", "1.000"]);
    const [line] = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.id, f.purchase.items[0].id));
    expect(line).toMatchObject({ receivedQuantityKg: "3.000", recognizedValue: "100.00" });
  });
  it("replays matching requests after later receipts; changed requests conflict", async () => {
    const f = await fixture(); const first = await f.as(() => acceptReceipt(f.command));
    expect(first.status).toBe("success");
    await f.as(() => acceptReceipt({ ...f.command, revision: 3, requestId: randomUUID() }));
    expect(await f.as(() => acceptReceipt(f.command))).toEqual(first);
    expect(await f.as(() => acceptReceipt({ ...f.command, items: [{ ...f.command.items[0], quantity: "2" }] }))).toEqual({ status: "conflict" });
    expect((await rows(f.organizationId)).map((list) => list.length)).toEqual([2, 2, 2, 2]);
  });
  it("serializes competing receipts and rejects stale remaining quantities", async () => {
    const f = await fixture(); const command = { ...f.command, items: [{ ...f.command.items[0], quantity: "2" }] };
    const results = await Promise.all([f.as(() => acceptReceipt(command)), f.as(() => acceptReceipt({ ...command, requestId: randomUUID() }))]);
    expect(results.map((result) => result.status).sort()).toEqual(["conflict", "success"]);
    expect((await rows(f.organizationId)).map((list) => list.length)).toEqual([1, 1, 1, 1]);
  });
  it.each(businessRoles)("enforces receipt and variance permissions for %s", async (role) => {
    const f = await fixture(); await f.role(role);
    if (!hasPermission(role, "receipts.accept")) {
      await expect(f.as(() => acceptReceipt(f.command))).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
      return;
    }
    expect(await f.as(() => acceptReceipt({ ...f.command, complete: true }))).toMatchObject({ status: "invalid" });
    const result = await f.as(() => acceptReceipt({ ...f.command, complete: true, approveVariance: true, reason: "Final delivery is short" }));
    expect(result.status).toBe(role === "owner" ? "success" : "invalid");
    if (role !== "owner") expect((await f.as(() => acceptReceipt(f.command))).status).toBe("success");
  });
  it("records owner-approved excess at the saved price and preserves actual bag weight", async () => {
    const f = await fixture();
    const items = [{ ...f.command.items[0], quantity: "2", quantityUnitId: f.bag.id, bagWeightKg: "2" }];
    expect(await f.as(() => acceptReceipt({ ...f.command, items }))).toMatchObject({ status: "invalid" });
    expect((await f.as(() => acceptReceipt({ ...f.command, items, approveVariance: true, reason: "Owner accepts extra kilogram" }))).status).toBe("success");
    const [receipts, lines, movements, payables] = await rows(f.organizationId);
    expect(receipts[0]).toMatchObject({ varianceApprovedByUserId: f.actor.userId, varianceReason: "Owner accepts extra kilogram" });
    expect(lines[0]).toMatchObject({ quantity: "2.000000000000000000", quantityMeasureKg: "2.000", quantityKg: "4.000", unitPrice: "100.00", priceMeasureKg: "3.000" });
    expect(movements[0].quantityKg).toBe("4.000"); expect(payables[0].amount).toBe("133.33");
  });
  it("denies foreign purchase/line/unit references and ignores spoofed authority", async () => {
    const f = await fixture(); const other = await fixture();
    await expect(f.as(() => acceptReceipt({ ...f.command, purchaseId: other.purchase.id }))).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    for (const item of [{ ...f.command.items[0], purchaseItemId: other.purchase.items[0].id }, { ...f.command.items[0], quantityUnitId: other.kg.id }]) {
      expect(await f.as(() => acceptReceipt({ ...f.command, items: [item] }))).toMatchObject({ status: "invalid" });
    }
    expect((await f.as(() => acceptReceipt({ ...f.command, organizationId: other.organizationId, total: "0", role: "owner" }))).status).toBe("success");
    expect((await rows(other.organizationId)).map((list) => list.length)).toEqual([0, 0, 0, 0]);
  });
  it.each(["receipt", "line", "movement", "payable", "status"])("rolls back every posting when the %s write fails", async (stage) => {
    const f = await fixture(); const original = db.transaction.bind(db);
    const spy = vi.spyOn(db, "transaction").mockImplementation(function <T>(...args: Parameters<typeof db.transaction<T>>) {
      return original<T>(async (tx) => {
        const insert = tx.insert.bind(tx); const update = tx.update.bind(tx);
        vi.spyOn(tx, "insert").mockImplementation((table) => {
          if (table === ({ receipt: goodsReceipts, line: goodsReceiptItems, movement: inventoryMovements, payable: supplierPayables }[stage])) throw new Error("Injected failure");
          return insert(table);
        });
        vi.spyOn(tx, "update").mockImplementation((table) => { if (stage === "status" && table === purchaseOrders) throw new Error("Injected failure"); return update(table); });
        return args[0](tx);
      });
    });
    try { await expect(f.as(() => acceptReceipt(f.command))).rejects.toThrow("Injected failure"); } finally { spy.mockRestore(); }
    expect((await rows(f.organizationId)).map((list) => list.length)).toEqual([0, 0, 0, 0]);
    expect((await f.as(() => getPurchase(f.purchase.id))).status).toBe("ordered");
    const [line] = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.id, f.purchase.items[0].id));
    expect(line.receivedQuantityKg).toBe("0.000");
    expect((await f.as(() => acceptReceipt(f.command))).status).toBe("success");
  });
});
