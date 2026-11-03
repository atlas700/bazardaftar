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
async function fixture(lineCount = 1) {
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
    items: Array.from({ length: lineCount }, () => ({ productId: product.id, quantity: "3", quantityUnitId: kg.id, unitPrice: "100", priceUnitId: pack.id })) }));
  if (draft.status !== "success") throw new Error("Fixture draft failed.");
  await as(() => mutatePurchase({ id: draft.purchaseId, revision: 1, requestId: randomUUID(), action: "order" }));
  const purchase = await as(() => getPurchase(draft.purchaseId));
  const command = { purchaseId: purchase.id, revision: purchase.revision, requestId: randomUUID(), complete: false, approveVariance: false, reason: "",
    items: [{ purchaseItemId: purchase.items[0].id, quantity: "1", quantityUnitId: kg.id, bagWeightKg: null as string | null }] };
  const role = (role: BusinessRole) => db.update(organizationRoleAssignments).set({ role }).where(eq(organizationRoleAssignments.organizationId, organizationId));
  return { organizationId, actor, supplier, warehouse, product, kg, pack, bag, purchase, command, role, as };
}
async function rows(organizationId: string) {
  return Promise.all([
    db.select().from(goodsReceipts).where(eq(goodsReceipts.organizationId, organizationId)),
    db.select().from(goodsReceiptItems).where(eq(goodsReceiptItems.organizationId, organizationId)),
    db.select().from(inventoryMovements).where(eq(inventoryMovements.organizationId, organizationId)),
    db.select().from(supplierPayables).where(eq(supplierPayables.organizationId, organizationId)),
  ]);
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
    const detail = await f.as(() => getPurchase(f.purchase.id));
    expect(detail.receipts.map((receipt) => receipt.total)).toEqual(["33.33", "33.34", "33.33"]);
    expect(detail.receipts.flatMap((receipt) => receipt.items).map((line) => line.quantityKg)).toEqual(["1.000", "1.000", "1.000"]);
  });
  it("reconciles each line before summing the payable for a multi-line receipt", async () => {
    const f = await fixture(2);
    const items = f.purchase.items.map((line) => ({ ...f.command.items[0], purchaseItemId: line.id }));
    expect((await f.as(() => acceptReceipt({ ...f.command, items }))).status).toBe("success");
    expect((await rows(f.organizationId))[3][0].amount).toBe("66.66");
    expect((await f.as(() => acceptReceipt({ ...f.command, revision: 3, requestId: randomUUID(), items: items.map((item) => ({ ...item, quantity: "2" })) }))).status).toBe("success");
    const [receipts, lines, movements, payables] = await rows(f.organizationId);
    expect(receipts).toHaveLength(2); expect(lines).toHaveLength(4); expect(movements).toHaveLength(4);
    expect(payables.map((row) => row.amount).sort()).toEqual(["133.34", "66.66"]);
    expect((await f.as(() => getPurchase(f.purchase.id))).status).toBe("received");
  });
  it("closes an owner-approved short final delivery without fabricating stock for omitted lines", async () => {
    const f = await fixture(2);
    expect((await f.as(() => acceptReceipt({ ...f.command, complete: true, approveVariance: true, reason: "Supplier's final short delivery" }))).status).toBe("success");
    const detail = await f.as(() => getPurchase(f.purchase.id));
    expect(detail.status).toBe("received");
    expect(detail.items.map((line) => line.receivedQuantityKg).sort()).toEqual(["0.000", "1.000"]);
    expect((await rows(f.organizationId)).map((list) => list.length)).toEqual([1, 1, 1, 1]);
    expect(detail.receipts[0]).toMatchObject({ completesPurchase: true, varianceReason: "Supplier's final short delivery", total: "33.33" });
    expect(await f.as(() => mutatePurchase({ action: "cancel", id: detail.id, revision: detail.revision, requestId: randomUUID(), reason: "Attempt after stock posting" }))).toEqual({ status: "conflict" });
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
  it("posts a simultaneous duplicate request only once", async () => {
    const f = await fixture();
    const results = await Promise.all([f.as(() => acceptReceipt(f.command)), f.as(() => acceptReceipt(f.command))]);
    expect(results[0]).toEqual(results[1]); expect(results[0].status).toBe("success");
    expect((await rows(f.organizationId)).map((list) => list.length)).toEqual([1, 1, 1, 1]);
  });
  it("rejects draft, cancelled and completed purchases without posting", async () => {
    for (const status of ["draft", "cancelled", "received"] as const) {
      const f = await fixture();
      if (status === "received") await f.as(() => acceptReceipt({ ...f.command, items: [{ ...f.command.items[0], quantity: "3" }] }));
      else if (status === "cancelled") await f.as(() => mutatePurchase({ action: "cancel", id: f.purchase.id, revision: 2, requestId: randomUUID(), reason: "Cancel before receipt" }));
      else await db.update(purchaseOrders).set({ status: "draft", orderedAt: null, orderedByUserId: null, orderedByMembershipId: null }).where(eq(purchaseOrders.id, f.purchase.id));
      const before = await rows(f.organizationId);
      expect(await f.as(() => acceptReceipt({ ...f.command, requestId: randomUUID(), revision: status === "received" ? 3 : 2 }))).toEqual({ status: "conflict" });
      expect(await rows(f.organizationId)).toEqual(before);
    }
  });
  it.each(["supplier", "warehouse", "product", "quantity unit", "price unit", "stock unit"])("rejects an inactive %s inside the posting transaction", async (reference) => {
    const f = await fixture();
    if (reference === "supplier") await db.update(suppliers).set({ isActive: false }).where(eq(suppliers.id, f.supplier.id));
    if (reference === "warehouse") await db.update(warehouses).set({ isActive: false }).where(eq(warehouses.id, f.warehouse.id));
    if (reference === "product") await db.update(products).set({ isActive: false }).where(eq(products.id, f.product.id));
    if (reference === "quantity unit") await db.update(catalogUnits).set({ isActive: false }).where(eq(catalogUnits.id, f.kg.id));
    if (reference === "price unit") await db.update(catalogUnits).set({ isActive: false }).where(eq(catalogUnits.id, f.pack.id));
    if (reference === "stock unit") {
      await db.update(products).set({ unitId: f.pack.id }).where(eq(products.id, f.product.id));
      await db.update(catalogUnits).set({ isActive: false }).where(eq(catalogUnits.id, f.pack.id));
    }
    expect(await f.as(() => acceptReceipt(f.command))).toEqual({ status: "invalid", fields: ["references"] });
    expect((await rows(f.organizationId)).map((list) => list.length)).toEqual([0, 0, 0, 0]);
  });
  it("retains ordered measure/price/name snapshots after catalogue edits", async () => {
    const f = await fixture();
    await db.update(catalogUnits).set({ kilogramsPerUnit: "2.000", name: "Renamed kg" }).where(eq(catalogUnits.id, f.kg.id));
    await db.update(catalogUnits).set({ kilogramsPerUnit: "5.000" }).where(eq(catalogUnits.id, f.pack.id));
    await db.update(products).set({ name: "Renamed Wheat" }).where(eq(products.id, f.product.id));
    expect((await f.as(() => acceptReceipt(f.command))).status).toBe("success");
    const [, lines, , payables] = await rows(f.organizationId);
    expect(lines[0]).toMatchObject({ productName: "Wheat", quantityUnitName: "kg", quantityMeasureKg: "1.000", quantityKg: "1.000", unitPrice: "100.00", priceMeasureKg: "3.000" });
    expect(payables[0].amount).toBe("33.33");
  });
  it("rejects sub-gram conversions and unsupported bag weights before writing", async () => {
    const f = await fixture();
    for (const extra of [{ quantity: "0.0001" }, { bagWeightKg: "1" }, { quantityUnitId: f.bag.id, bagWeightKg: null }]) {
      expect(await f.as(() => acceptReceipt({ ...f.command, items: [{ ...f.command.items[0], ...extra }] }))).toMatchObject({ status: "invalid" });
    }
    expect((await rows(f.organizationId)).map((list) => list.length)).toEqual([0, 0, 0, 0]);
  });
  it("keeps PKR and zero-valued receipts exact", async () => {
    const f = await fixture();
    await db.update(purchaseOrders).set({ currency: "PKR", total: "0.00" }).where(eq(purchaseOrders.id, f.purchase.id));
    await db.update(purchaseOrderItems).set({ unitPrice: "0.00", lineTotal: "0.00" }).where(eq(purchaseOrderItems.id, f.purchase.items[0].id));
    expect((await f.as(() => acceptReceipt(f.command))).status).toBe("success");
    expect((await rows(f.organizationId))[3][0]).toMatchObject({ currency: "PKR", amount: "0.00" });
  });
  it("denies changed provider identities and revoked approval on a replay", async () => {
    const f = await fixture();
    const command = { ...f.command, complete: true, approveVariance: true, reason: "Short final receipt" };
    expect((await f.as(() => acceptReceipt(command))).status).toBe("success");
    await f.role("manager");
    expect(await f.as(() => acceptReceipt(command))).toMatchObject({ status: "invalid", fields: ["approveVariance"] });
    mocks.getActiveOrganizationMembership.mockImplementation(async () => ({ ...context.getStore(), membershipId: "rejoined_member" }));
    await expect(f.as(() => acceptReceipt(command))).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
  });
  it("rechecks provider identity after the initial permission lookup", async () => {
    const f = await fixture(); let lookups = 0;
    mocks.getActiveOrganizationMembership.mockImplementation(async () => ++lookups === 1 ? context.getStore() : { ...context.getStore(), membershipId: "replacement_membership" });
    await expect(f.as(() => acceptReceipt(f.command))).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    expect(lookups).toBe(2); expect((await rows(f.organizationId)).map((list) => list.length)).toEqual([0, 0, 0, 0]);
  });
  it("rechecks a grant revoked while waiting for the organization lock", async () => {
    const f = await fixture(); let announceLock = () => {}; let releaseLock = () => {};
    const locked = new Promise<void>((resolve) => { announceLock = resolve; });
    const release = new Promise<void>((resolve) => { releaseLock = resolve; });
    const blocker = db.transaction(async (tx) => {
      await tx.select().from(organizations).where(eq(organizations.id, f.organizationId)).for("update");
      announceLock(); await release;
      await tx.update(organizationRoleAssignments).set({ role: "viewer" }).where(eq(organizationRoleAssignments.organizationId, f.organizationId));
    });
    await locked; let announceTransaction = () => {};
    const entered = new Promise<void>((resolve) => { announceTransaction = resolve; });
    const original = db.transaction.bind(db);
    const spy = vi.spyOn(db, "transaction").mockImplementation(function <T>(...args: Parameters<typeof db.transaction<T>>) { announceTransaction(); return original<T>(...args); });
    try {
      const queued = f.as(() => acceptReceipt(f.command));
      await entered; releaseLock(); await blocker;
      await expect(queued).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    } finally { releaseLock(); spy.mockRestore(); }
    expect((await rows(f.organizationId)).map((list) => list.length)).toEqual([0, 0, 0, 0]);
  });
  it("enforces tenant links, uniqueness, exact values and quantity caps in PostgreSQL", async () => {
    const f = await fixture(); const other = await fixture(); await f.as(() => acceptReceipt(f.command));
    const [receipts, lines, movements, payables] = await rows(f.organizationId);
    const receipt = receipts[0], line = lines[0], movement = movements[0], payable = payables[0];
    for (const extra of [{ supplierId: other.supplier.id }, { warehouseId: other.warehouse.id }, { currency: "PKR" as const }, { total: "NaN" }]) {
      await expect(db.insert(goodsReceipts).values({ ...receipt, ...extra, id: randomUUID(), requestId: randomUUID() })).rejects.toThrow();
    }
    await expect(db.insert(goodsReceipts).values({ ...receipt, id: randomUUID() })).rejects.toThrow();
    for (const extra of [{ quantityKg: "1.001" }, { recognizedValue: "33.34" }, { purchaseItemId: other.purchase.items[0].id }, { quantityUnitId: other.kg.id }]) {
      await expect(db.insert(goodsReceiptItems).values({ ...line, ...extra, id: randomUUID() })).rejects.toThrow();
    }
    await expect(db.insert(inventoryMovements).values({ ...movement, id: randomUUID() })).rejects.toThrow();
    await expect(db.insert(supplierPayables).values({ ...payable, id: randomUUID() })).rejects.toThrow();
    await expect(db.update(supplierPayables).set({ amount: "33.34" }).where(eq(supplierPayables.id, payable.id))).rejects.toThrow();
    await expect(db.update(inventoryMovements).set({ quantityKg: "2.000" }).where(eq(inventoryMovements.id, movement.id))).rejects.toThrow();
    await expect(db.update(purchaseOrderItems).set({ receivedQuantityKg: "4.000", recognizedValue: "133.33" }).where(eq(purchaseOrderItems.id, f.purchase.items[0].id))).rejects.toThrow();
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
