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
import { getSupplierAccount } from "./supplier-statements";
import { db } from "./index";
import { cleanupAuditFixtures } from "./audit-fixtures.test-support";
import { createPurchaseDraft, getPurchase, mutatePurchase } from "./purchases";
import { acceptReceipt } from "./receipts";
import { getPaymentsWorkspace, recordSupplierPayment, reduceSupplierPayable } from "./supplier-payments";
import { catalogUnits, goodsReceiptItems, goodsReceipts, inventoryMovements, organizationRoleAssignments, organizations, products, purchaseOrderItems, purchaseOrders, supplierPayables, supplierPaymentAllocations, supplierPaymentReductions, supplierPayments, suppliers, warehouses } from "./schema";

type Actor = { userId: string; membershipId: string; clerkOrganizationId: string };
const context = new AsyncLocalStorage<Actor>();
const organizationIds: string[] = [];
async function fixture() {
  const actor = { clerkOrganizationId: `task26_org_${randomUUID()}`, userId: `user_${randomUUID()}`, membershipId: `member_${randomUUID()}` };
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
  const workspace = () => as(() => getPaymentsWorkspace({ supplierId: supplier.id, currency: "AFN" }));
  return { organizationId, actor, supplier, as, payable, command, role, workspace };
}
describe.skipIf(!process.env.AFCS_TEST_DATABASE_URL)("supplier accounts against isolated PostgreSQL", () => {
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
  it("shows zero balances for both currencies without inventing transactions", async () => {
    const f = await fixture(); const data = await f.as(() => getSupplierAccount({ supplierId: f.supplier.id }));
    expect(data.entries).toEqual([]);
    expect(data.balances).toEqual(["AFN", "PKR"].map((currency) => ({ currency, debt: "0.00", allocated: "0.00", reductions: "0.00", outstanding: "0.00" })));
  });
  it("reconciles unpaid, partial and fully settled debt with each multi-receipt payment once", async () => {
    const f = await fixture(); await f.payable("60"); await f.payable("40"); await f.payable("0"); await f.payable("12", "PKR");
    const read = () => f.as(() => getSupplierAccount({ supplierId: f.supplier.id }));
    expect((await read()).balances[0].outstanding).toBe("100.00");
    await f.as(() => recordSupplierPayment(f.command("75")));
    const partial = await read();
    expect(partial.balances).toEqual([
      { currency: "AFN", debt: "100.00", allocated: "75.00", reductions: "0.00", outstanding: "25.00" },
      { currency: "PKR", debt: "12.00", allocated: "0.00", reductions: "0.00", outstanding: "12.00" },
    ]);
    expect(partial.entries.filter((e) => e.kind === "receipt")).toHaveLength(3);
    expect(partial.entries.filter((e) => e.kind === "payment")).toHaveLength(1);
    expect(partial.allocations.map((a) => a.amount).sort()).toEqual(["15.00", "60.00"]);
    expect(partial.entries[0].runningBalance).toBe("25.00");
    await f.as(() => recordSupplierPayment(f.command("25")));
    expect((await read()).balances[0].outstanding).toBe("0.00");
    expect((await read()).entries).toHaveLength(5);
  });
  it("keeps historical conversion and later owner reduction separate from cash", async () => {
    const f = await fixture(); const payable = await f.payable("62.79");
    const payment = await f.as(() => recordSupplierPayment({ ...f.command("61"), pkrCash: "2", pkrPerAfn: "2" }));
    if (payment.status !== "success") throw new Error("Fixture payment failed.");
    await f.as(() => reduceSupplierPayable({ requestId: randomUUID(), paymentId: payment.paymentId, payableId: payable.id, amount: "0.79", approved: true, reason: "Supplier approved residual" }));
    const data = await f.as(() => getSupplierAccount({ supplierId: f.supplier.id }));
    expect(data.balances[0]).toMatchObject({ debt: "62.79", allocated: "62.00", reductions: "0.79", outstanding: "0.00" });
    expect(data.entries.find((e) => e.kind === "payment")).toMatchObject({ afnCash: "61", pkrCash: "2", pkrPerAfn: "2.000000", amount: "62.00", paidOn: "2026-11-05" });
    expect(data.entries[0]).toMatchObject({ kind: "reduction", amount: "0.79", runningBalance: "0.00", reason: "Supplier approved residual", approvedByUserId: f.actor.userId });
  });
  it("retains inactive suppliers, settled receipts and exact aggregate digits beyond one obligation's bound", async () => {
    const f = await fixture(); await f.payable("999999999999999999.99"); await f.payable("999999999999999999.99");
    await db.update(suppliers).set({ isActive: false }).where(eq(suppliers.id, f.supplier.id));
    const data = await f.as(() => getSupplierAccount({ supplierId: f.supplier.id }));
    expect(data.supplier.isActive).toBe(false); expect(data.balances[0].outstanding).toBe("1999999999999999999.98");
  });
  it("paginates tied event types and PostgreSQL microseconds without losing rows or restarting balances", async () => {
    const f = await fixture(); const payable = await f.payable("50");
    for (let i = 0; i < 20; i++) await f.payable("0");
    const payment = await f.as(() => recordSupplierPayment(f.command("10")));
    if (payment.status !== "success") throw new Error("Fixture payment failed.");
    const reduction = await f.as(() => reduceSupplierPayable({ requestId: randomUUID(), paymentId: payment.paymentId, payableId: payable.id, amount: "0.50", approved: true, reason: "Agreed" }));
    if (reduction.status !== "success") throw new Error("Fixture reduction failed.");
    await db.update(supplierPayables).set({ createdAt: sql`'2026-11-07T00:00:00.000001Z'::timestamptz` }).where(eq(supplierPayables.organizationId, f.organizationId));
    await db.update(supplierPayments).set({ createdAt: sql`'2026-11-07T00:00:00.000002Z'::timestamptz` }).where(eq(supplierPayments.id, payment.paymentId));
    await db.update(supplierPaymentReductions).set({ id: payable.id, createdAt: sql`'2026-11-07T00:00:00.000002Z'::timestamptz` }).where(eq(supplierPaymentReductions.id, reduction.reductionId!));
    const first = await f.as(() => getSupplierAccount({ supplierId: f.supplier.id }));
    const second = await f.as(() => getSupplierAccount({ supplierId: f.supplier.id, after: first.nextCursor }));
    expect(first.entries).toHaveLength(20); expect(second.entries).toHaveLength(3); expect(second.nextCursor).toBeNull();
    const all = [...first.entries, ...second.entries];
    expect(new Set(all.map((e) => `${e.kind}:${e.id}`)).size).toBe(23);
    expect(first.entries[0]).toMatchObject({ kind: "reduction", runningBalance: "39.50" });
    expect(second.balances).toEqual(first.balances);
    expect(all.filter((e) => e.kind === "receipt").every((e) => e.postedAt.includes("000001"))).toBe(true);
    await expect(f.as(() => getSupplierAccount({ supplierId: f.supplier.id, currency: "PKR", after: first.nextCursor }))).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
  });
  it("denies foreign suppliers and cursor references", async () => {
    const a = await fixture(); const b = await fixture(); const foreign = await b.payable("10");
    await expect(a.as(() => getSupplierAccount({ supplierId: b.supplier.id }))).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    await expect(a.as(() => getSupplierAccount({ supplierId: a.supplier.id, after: `receipt:${foreign.id}` }))).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    const data = await a.as(() => getSupplierAccount({ supplierId: a.supplier.id, organizationId: b.organizationId }));
    expect(data.entries).toHaveLength(0); expect(data.balances[0].outstanding).toBe("0.00");
    const [otherSupplier] = await db.insert(suppliers).values({ organizationId: b.organizationId, name: "Rice supplier" }).returning();
    await expect(b.as(() => getSupplierAccount({ supplierId: otherSupplier.id, after: `receipt:${foreign.id}` }))).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
  });
  it("reconciles converted PKR payments separately from AFN debt", async () => {
    const f = await fixture(); await f.payable("100", "PKR"); await f.payable("20", "AFN");
    await f.as(() => recordSupplierPayment({ ...f.command("1"), debtCurrency: "PKR", pkrCash: "1", pkrPerAfn: "2.345" }));
    const data = await f.as(() => getSupplierAccount({ supplierId: f.supplier.id, currency: "PKR" }));
    expect(data.balances[0].outstanding).toBe("20.00"); expect(data.balances[1].outstanding).toBe("96.65");
    expect(data.entries[0]).toMatchObject({ kind: "payment", amount: "3.35", runningBalance: "96.65", afnCash: "1", pkrCash: "1", pkrPerAfn: "2.345000" });
  });
  it.each(businessRoles)("enforces account read permission for %s", async (role) => {
    const f = await fixture(); await f.role(role);
    const read = f.as(() => getSupplierAccount({ supplierId: f.supplier.id }));
    if (hasPermission(role, "supplier_balances.read")) expect(await read).toHaveProperty("supplier.id", f.supplier.id);
    else await expect(read).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
  });
  it("resolves an older payment directly and rejects foreign scoped payment links", async () => {
    const f = await fixture(); await f.payable("100");
    const payment = await f.as(() => recordSupplierPayment(f.command("1")));
    if (payment.status !== "success") throw new Error("Fixture payment failed.");
    for (let i = 0; i < 20; i++) await f.as(() => recordSupplierPayment(f.command("1")));
    const data = await f.as(() => getPaymentsWorkspace({ supplierId: f.supplier.id, currency: "AFN", paymentId: payment.paymentId }));
    expect(data.payments).toHaveLength(1); expect(data.payments[0].id).toBe(payment.paymentId); expect(data.nextCursor).toBeNull();
    await expect(f.as(() => getPaymentsWorkspace({ supplierId: f.supplier.id, currency: "PKR", paymentId: payment.paymentId }))).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
  });
});
