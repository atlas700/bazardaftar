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
import { getDashboard } from "./dashboard";
import { adjustInventory } from "./inventory-adjustments";
import { getSupplierAccount } from "./supplier-statements";
import { db } from "./index";
import { cleanupAuditFixtures } from "./audit-fixtures.test-support";
import { createPurchaseDraft, getPurchase, mutatePurchase } from "./purchases";
import { acceptReceipt } from "./receipts";
import { recordSupplierPayment, reduceSupplierPayable } from "./supplier-payments";
import { catalogUnits, goodsReceiptItems, goodsReceipts, inventoryMovements, organizationRoleAssignments, organizations, products, purchaseOrderItems, purchaseOrders, supplierPayables, supplierPaymentAllocations, supplierPaymentReductions, supplierPayments, suppliers, warehouses } from "./schema";

type Actor = { userId: string; membershipId: string; clerkOrganizationId: string };
const context = new AsyncLocalStorage<Actor>();
const organizationIds: string[] = [];
async function fixture() {
  const actor = { clerkOrganizationId: `task28_org_${randomUUID()}`, userId: `user_${randomUUID()}`, membershipId: `member_${randomUUID()}` };
  const [organization] = await db.insert(organizations).values({ clerkOrganizationId: actor.clerkOrganizationId }).returning();
  const organizationId = organization.id; organizationIds.push(organizationId);
  await db.insert(organizationRoleAssignments).values({ organizationId, membershipId: actor.membershipId, userId: actor.userId, role: "owner" });
  const [supplier] = await db.insert(suppliers).values({ organizationId, name: "Helmand Grain" }).returning();
  const [warehouse] = await db.insert(warehouses).values({ organizationId, name: "Main" }).returning();
  const [kg] = await db.insert(catalogUnits).values({ organizationId, name: "kg", kind: "fixed", kilogramsPerUnit: "1.000" }).returning();
  const [product] = await db.insert(products).values({ organizationId, name: "Wheat", unitId: kg.id }).returning();
  const as = <T>(work: () => Promise<T>) => context.run(actor, work);
  const payable = async (amount: string, currency: "AFN" | "PKR" = "AFN") => {
    const draft = await as(() => createPurchaseDraft({ requestId: randomUUID(), supplierId: supplier.id, warehouseId: warehouse.id, currency,
      items: [{ productId: product.id, quantity: "1", quantityUnitId: kg.id, unitPrice: amount, priceUnitId: kg.id }] }));
    if (draft.status !== "success") throw new Error("Fixture draft failed.");
    await as(() => mutatePurchase({ id: draft.purchaseId, revision: 1, requestId: randomUUID(), action: "order" }));
    const purchase = await as(() => getPurchase(draft.purchaseId));
    const receipt = await as(() => acceptReceipt({ purchaseId: purchase.id, revision: purchase.revision, requestId: randomUUID(), complete: false, approveVariance: false, reason: "",
      items: [{ purchaseItemId: purchase.items[0].id, quantity: "1", quantityUnitId: kg.id, bagWeightKg: null }] }));
    if (receipt.status !== "success") throw new Error("Fixture receipt failed.");
    const [row] = await db.select().from(supplierPayables).where(eq(supplierPayables.receiptId, receipt.receiptId));
    return row;
  };
  const command = (afnCash = "75") => ({ requestId: randomUUID(), supplierId: supplier.id, debtCurrency: "AFN", paidOn: "2026-11-05", afnCash, pkrCash: "0", pkrPerAfn: "", reference: "Cash 14", note: "Supplier counted cash" });
  const role = (role: BusinessRole) => db.update(organizationRoleAssignments).set({ role }).where(eq(organizationRoleAssignments.organizationId, organizationId));
  return { organizationId, actor, supplier, product, warehouse, kg, as, payable, command, role };
}
describe.skipIf(!process.env.AFCS_TEST_DATABASE_URL)("pilot dashboard against isolated PostgreSQL", () => {
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
    await cleanupAuditFixtures(organizationIds);
    for (const table of [supplierPaymentReductions, supplierPaymentAllocations, supplierPayments, inventoryMovements, supplierPayables, goodsReceiptItems, goodsReceipts, purchaseOrderItems, purchaseOrders, products, catalogUnits, suppliers, warehouses, organizationRoleAssignments]) {
      if (organizationIds.length) await db.delete(table).where(inArray(table.organizationId, organizationIds));
    }
    if (organizationIds.length) await db.delete(organizations).where(inArray(organizations.id, organizationIds));
  });
  it("returns real zero metrics and empty lists for a new business", async () => {
    const f = await fixture(); const data = await f.as(() => getDashboard());
    expect(data.purchases).toEqual({ total: "0", draft: "0", awaiting: "0", received: "0", cancelled: "0", receipts: "0" });
    expect(data.stock).toEqual([]); expect(data.transactions).toEqual([]);
    expect(data.balances).toEqual([{ currency: "AFN", outstanding: "0.00" }, { currency: "PKR", outstanding: "0.00" }]);
  });
  it("reconciles receipt debt, multi-receipt payments, reductions and signed stock without fanout", async () => {
    const f = await fixture(); await f.payable("60"); const residual = await f.payable("40.79"); await f.payable("12", "PKR");
    const payment = await f.as(() => recordSupplierPayment(f.command("100")));
    if (payment.status !== "success") throw new Error("Fixture payment failed.");
    expect((await f.as(() => reduceSupplierPayable({ requestId: randomUUID(), paymentId: payment.paymentId, payableId: residual.id, amount: "0.79", approved: true, reason: "Agreed residual" }))).status).toBe("success");
    expect((await f.as(() => adjustInventory({ requestId: randomUUID(), productId: f.product.id, warehouseId: f.warehouse.id, quantityKg: "-0.001", reasonCode: "loss", reason: "Count checked", reference: "Count 1", approved: true }))).status).toBe("success");
    const data = await f.as(() => getDashboard());
    expect(data.purchases).toEqual({ total: "3", draft: "0", awaiting: "0", received: "3", cancelled: "0", receipts: "3" });
    expect(data.stock?.[0].quantityKg).toBe("2.999");
    expect(data.balances).toEqual([{ currency: "AFN", outstanding: "0.00" }, { currency: "PKR", outstanding: "12.00" }]);
    for (const currency of ["AFN", "PKR"] as const) {
      const account = await f.as(() => getSupplierAccount({ supplierId: f.supplier.id, currency }));
      expect(data.balances?.find((b) => b.currency === currency)?.outstanding).toBe(account.balances.find((b) => b.currency === currency)?.outstanding);
    }
    expect(data.transactions.filter((e) => e.kind === "payment")).toHaveLength(1);
    expect(data.transactions.find((e) => e.kind === "reduction")?.amount).toBe("0.79");
    expect(data.transactions.find((e) => e.kind === "adjustment")?.amount).toBe("-0.001");
  });
  it("counts drafts, awaiting partial deliveries, received and cancelled purchases independently of receipts", async () => {
    const f = await fixture();
    const draft = async () => {
      const result = await f.as(() => createPurchaseDraft({ requestId: randomUUID(), supplierId: f.supplier.id, warehouseId: f.warehouse.id, currency: "AFN",
        items: [{ productId: f.product.id, quantity: "2", quantityUnitId: f.kg.id, unitPrice: "10", priceUnitId: f.kg.id }] }));
      if (result.status !== "success") throw new Error("Fixture draft failed.");
      return result.purchaseId;
    };
    await draft(); const ordered = await draft(); const partial = await draft(); const cancelled = await draft();
    for (const id of [ordered, partial]) await f.as(() => mutatePurchase({ id, revision: 1, requestId: randomUUID(), action: "order" }));
    await f.as(() => mutatePurchase({ id: cancelled, revision: 1, requestId: randomUUID(), action: "cancel", reason: "Entered twice", approved: true }));
    const purchase = await f.as(() => getPurchase(partial));
    expect((await f.as(() => acceptReceipt({ purchaseId: partial, revision: purchase.revision, requestId: randomUUID(), complete: false, approveVariance: false, reason: "",
      items: [{ purchaseItemId: purchase.items[0].id, quantity: "1", quantityUnitId: f.kg.id, bagWeightKg: null }] }))).status).toBe("success");
    await f.payable("0");
    expect((await f.as(() => getDashboard())).purchases).toEqual({ total: "5", draft: "1", awaiting: "2", received: "1", cancelled: "1", receipts: "2" });
  });
  it("keeps inactive and settled history, zero stock and aggregate digits above one obligation's bound", async () => {
    const f = await fixture(); await f.payable("999999999999999999.99"); await f.payable("999999999999999999.99");
    await f.as(() => adjustInventory({ requestId: randomUUID(), productId: f.product.id, warehouseId: f.warehouse.id, quantityKg: "-2", reasonCode: "count_correction", reason: "Count checked", reference: "", approved: true }));
    await db.update(products).set({ isActive: false }).where(eq(products.id, f.product.id));
    await db.update(suppliers).set({ isActive: false }).where(eq(suppliers.id, f.supplier.id));
    const data = await f.as(() => getDashboard());
    expect(data.balances?.[0].outstanding).toBe("1999999999999999999.98");
    expect(data.stock?.[0]).toMatchObject({ quantityKg: "0.000", productActive: false });
    expect(data.transactions.some((e) => e.kind === "receipt")).toBe(true);
  });
  it("keeps every dataset tenant-scoped", async () => {
    const a = await fixture(); const b = await fixture(); await b.payable("234");
    const data = await a.as(() => getDashboard());
    expect(data.purchases?.total).toBe("0"); expect(data.stock).toEqual([]); expect(data.transactions).toEqual([]);
    expect(data.balances?.every((row) => row.outstanding === "0.00")).toBe(true);
  });
  it.each(businessRoles)("enforces dataset permissions for %s without leaking money through recent activity", async (role) => {
    const f = await fixture(); await f.payable("60"); await f.as(() => recordSupplierPayment(f.command("10")));
    await f.role(role); const data = await f.as(() => getDashboard());
    expect(data.purchases === null).toBe(!hasPermission(role, "purchases.read"));
    expect(data.balances === null).toBe(!hasPermission(role, "supplier_balances.read"));
    expect(data.stock).toHaveLength(1);
    expect(data.transactions.some((e) => e.kind === "payment")).toBe(hasPermission(role, "supplier_payments.read"));
    if (role === "sales") expect(data.transactions).toEqual([]);
  });
  it("caps recent records and stock rows with stable ordering at timestamp ties", async () => {
    const f = await fixture(); for (let i = 0; i < 5; i++) await f.payable("0");
    await db.update(goodsReceipts).set({ acceptedAt: sql`'2026-11-07T00:00:00.000001Z'::timestamptz` }).where(eq(goodsReceipts.organizationId, f.organizationId));
    await db.update(purchaseOrders).set({ createdAt: sql`'2026-11-07T00:00:00.000001Z'::timestamptz` }).where(eq(purchaseOrders.organizationId, f.organizationId));
    const tied = await f.as(() => getDashboard());
    expect(tied.transactions).toHaveLength(6);
    expect(tied.transactions.slice(0, 5).every((e) => e.kind === "receipt" && e.postedAt.endsWith("000001Z"))).toBe(true);
    expect(tied.transactions[5].kind).toBe("purchase");
    expect(tied.transactions.every((e) => e.amount === "0.00")).toBe(true);
    for (let i = 0; i < 6; i++) {
      const [product] = await db.insert(products).values({ organizationId: f.organizationId, name: `Barley ${i}`, unitId: f.kg.id }).returning();
      await f.as(() => adjustInventory({ requestId: randomUUID(), productId: product.id, warehouseId: f.warehouse.id, quantityKg: "1", reasonCode: "opening_stock", reason: "Count checked", reference: "", approved: true }));
    }
    const a = await f.as(() => getDashboard()); const b = await f.as(() => getDashboard());
    expect(a.transactions).toHaveLength(6); expect(a.transactions).toEqual(b.transactions);
    expect(new Set(a.transactions.map((e) => `${e.kind}:${e.id}`)).size).toBe(6);
    expect(a.stock).toHaveLength(5); expect(a.stock?.map((row) => row.productName)).toEqual(["Barley 0", "Barley 1", "Barley 2", "Barley 3", "Barley 4"]);
  });
});
