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
import { cleanupAuditFixtures } from "./audit-fixtures.test-support";
import { createPurchaseDraft, getPurchase, mutatePurchase } from "./purchases";
import { acceptReceipt } from "./receipts";
import { getPaymentsWorkspace, recordSupplierPayment, reduceSupplierPayable } from "./supplier-payments";
import { catalogUnits, goodsReceiptItems, goodsReceipts, inventoryMovements, organizationRoleAssignments, organizations, products, purchaseOrderItems, purchaseOrders, supplierPayables, supplierPaymentAllocations, supplierPaymentReductions, supplierPayments, suppliers, warehouses } from "./schema";

type Actor = { userId: string; membershipId: string; clerkOrganizationId: string };
const context = new AsyncLocalStorage<Actor>();
const organizationIds: string[] = [];
async function fixture() {
  const actor = { clerkOrganizationId: `task25_org_${randomUUID()}`, userId: `user_${randomUUID()}`, membershipId: `member_${randomUUID()}` };
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
async function postings(organizationId: string) {
  return Promise.all([
    db.select().from(supplierPayments).where(eq(supplierPayments.organizationId, organizationId)),
    db.select().from(supplierPaymentAllocations).where(eq(supplierPaymentAllocations.organizationId, organizationId)),
    db.select().from(supplierPaymentReductions).where(eq(supplierPaymentReductions.organizationId, organizationId)),
  ]);
}

describe.skipIf(!process.env.AFCS_TEST_DATABASE_URL)("supplier settlements against isolated PostgreSQL", () => {
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
  it("settles oldest receipt debt across rows and preserves original cash and debt", async () => {
    const f = await fixture(); const a = await f.payable("60"); const b = await f.payable("40");
    const result = await f.as(() => recordSupplierPayment({ ...f.command(), organizationId: "spoof", role: "owner", createdByUserId: "spoof" }));
    expect(result).toMatchObject({ status: "success", supplierId: f.supplier.id, currency: "AFN" });
    const [payments, allocations] = await postings(f.organizationId);
    expect(payments).toHaveLength(1); expect(payments[0]).toMatchObject({ amount: "75.00", afnCash: "75", pkrCash: "0", pkrPerAfn: null, recordedByUserId: f.actor.userId });
    expect(allocations).toEqual(expect.arrayContaining([expect.objectContaining({ payableId: a.id, amount: "60.00" }), expect.objectContaining({ payableId: b.id, amount: "15.00" })]));
    expect((await f.workspace()).outstanding).toBe("25.00");
    expect((await db.select().from(supplierPayables).where(eq(supplierPayables.id, a.id)))[0].amount).toBe("60.00");
  });
  it("orders timestamp ties by UUID and retains sub-millisecond ordering", async () => {
    const f = await fixture(); const a = await f.payable("10"); const b = await f.payable("10"); const c = await f.payable("10");
    await db.update(supplierPayables).set({ createdAt: sql`'2026-11-05T00:00:00.000001Z'::timestamptz` }).where(inArray(supplierPayables.id, [a.id, b.id]));
    await db.update(supplierPayables).set({ createdAt: sql`'2026-11-05T00:00:00.000002Z'::timestamptz` }).where(eq(supplierPayables.id, c.id));
    await f.as(() => recordSupplierPayment(f.command("15")));
    const rows = (await postings(f.organizationId))[1]; const firstId = [a.id, b.id].sort()[0];
    expect(rows.find((r) => r.payableId === firstId)?.amount).toBe("10.00");
    expect(rows.find((r) => r.payableId !== firstId)?.amount).toBe("5.00");
    expect(rows.some((r) => r.payableId === c.id)).toBe(false);
  });
  it.each([
    { currency: "AFN", cash: { afnCash: "0", pkrCash: "1", pkrPerAfn: "3" }, expected: "0.33" },
    { currency: "PKR", cash: { afnCash: "1", pkrCash: "1", pkrPerAfn: "2.345" }, expected: "3.35" },
    { currency: "AFN", cash: { afnCash: "62", pkrCash: "1", pkrPerAfn: "2" }, expected: "62.50" },
  ] as const)("converts combined cash once for $currency and snapshots the rate", async ({ currency, cash, expected }) => {
    const f = await fixture(); await f.payable("0.10", currency); await f.payable("100", currency);
    await f.as(() => recordSupplierPayment({ ...f.command(), debtCurrency: currency, ...cash }));
    const [payments, allocations] = await postings(f.organizationId);
    const [whole, fraction = ""] = cash.pkrPerAfn.split(".");
    expect(payments[0]).toMatchObject({ amount: expected, pkrPerAfn: `${whole}.${fraction.padEnd(6, "0")}` });
    expect(allocations.reduce((sum, row) => sum + BigInt(row.amount.replace(".", "")), BigInt(0))).toBe(BigInt(expected.replace(".", "")));
  });
  it("rejects zero-balance and overpayment attempts without retaining cash", async () => {
    const f = await fixture();
    expect(await f.as(() => recordSupplierPayment(f.command()))).toMatchObject({ status: "insufficient_balance" });
    await f.payable("100");
    expect(await f.as(() => recordSupplierPayment(f.command("101")))).toMatchObject({ status: "insufficient_balance" });
    expect((await postings(f.organizationId)).map((rows) => rows.length)).toEqual([0, 0, 0]);
    await f.as(() => recordSupplierPayment(f.command("100"))); expect((await f.workspace()).outstanding).toBe("0.00");
  });
  it("retains exact half-cent decisions with large cash and six-decimal rates", async () => {
    const f = await fixture(); await f.payable("100");
    expect((await f.as(() => recordSupplierPayment({ ...f.command("1"), pkrCash: "1000000000000", pkrPerAfn: "200000000000000.000001" }))).status).toBe("success");
    expect((await postings(f.organizationId))[0][0].amount).toBe("1.00");
  });
  it("serializes competing payments against the supplier's remaining balance", async () => {
    const f = await fixture(); await f.payable("100");
    const results = await Promise.all([f.as(() => recordSupplierPayment(f.command("80"))), f.as(() => recordSupplierPayment(f.command("80")))]);
    expect(results.map((r) => r.status).sort()).toEqual(["insufficient_balance", "success"]);
    expect((await f.workspace()).outstanding).toBe("20.00");
  });
  it("replays normalized requests once, rejects conflicts, and still authorizes replays", async () => {
    const f = await fixture(); await f.payable("100"); const input = f.command();
    const [a, b] = await Promise.all([f.as(() => recordSupplierPayment(input)), f.as(() => recordSupplierPayment({ ...input, afnCash: "075", note: " Supplier counted cash " }))]);
    expect(a.status).toBe("success"); expect(b).toEqual(a);
    expect(await f.as(() => recordSupplierPayment({ ...input, afnCash: "74" }))).toEqual({ status: "conflict" });
    expect((await postings(f.organizationId))[0]).toHaveLength(1);
    await f.role("viewer"); await expect(f.as(() => recordSupplierPayment(input))).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
  });
  it.each(businessRoles)("enforces payment/read/reduction permissions for %s", async (role) => {
    const f = await fixture(); const payable = await f.payable("100.79");
    const initial = await f.as(() => recordSupplierPayment(f.command("1")));
    if (initial.status !== "success") throw new Error("Fixture payment failed.");
    await f.role(role);
    const write = () => f.as(() => recordSupplierPayment(f.command("1")));
    if (hasPermission(role, "supplier_payments.record")) expect((await write()).status).toBe("success");
    else await expect(write()).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    if (hasPermission(role, "supplier_payments.read")) expect((await f.workspace()).canRecord).toBe(hasPermission(role, "supplier_payments.record"));
    else await expect(f.workspace()).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    const reduce = () => f.as(() => reduceSupplierPayable({ requestId: randomUUID(), paymentId: initial.paymentId, payableId: payable.id, amount: "0.01", reason: "Agreed", approved: true }));
    if (role === "owner") expect((await reduce()).status).toBe("success");
    else await expect(reduce()).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
  });
  it("keeps tenants, suppliers and debt currencies isolated and permits settling inactive suppliers", async () => {
    const a = await fixture(); const b = await fixture(); await a.payable("10"); await a.payable("30", "PKR"); await b.payable("100");
    expect(await a.as(() => recordSupplierPayment({ ...a.command("1"), supplierId: b.supplier.id }))).toMatchObject({ status: "invalid" });
    await expect(a.as(() => getPaymentsWorkspace({ supplierId: b.supplier.id, currency: "AFN" }))).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    await db.update(suppliers).set({ isActive: false }).where(eq(suppliers.id, a.supplier.id));
    expect((await a.as(() => recordSupplierPayment(a.command("5")))).status).toBe("success");
    expect((await a.workspace()).outstanding).toBe("5.00");
    expect((await a.as(() => getPaymentsWorkspace({ supplierId: a.supplier.id, currency: "PKR" }))).outstanding).toBe("30.00");
    expect((await postings(b.organizationId))[0]).toHaveLength(0);
  });
  it("records a later owner-approved reduction as separate durable provenance", async () => {
    const f = await fixture(); const payable = await f.payable("62.79");
    const payment = await f.as(() => recordSupplierPayment(f.command("62")));
    if (payment.status !== "success") throw new Error("Fixture payment failed.");
    expect((await f.workspace()).outstanding).toBe("0.79");
    const input = { requestId: randomUUID(), paymentId: payment.paymentId, payableId: payable.id, amount: "0.79", reason: "Supplier explicitly agreed", approved: true };
    const results = await Promise.all([f.as(() => reduceSupplierPayable(input)), f.as(() => reduceSupplierPayable({ ...input, amount: "00.79" }))]);
    expect(results[0].status).toBe("success"); expect(results[1]).toEqual(results[0]);
    const [payments, allocations, reductions] = await postings(f.organizationId);
    expect(payments[0].afnCash).toBe("62"); expect(allocations[0].amount).toBe("62.00");
    expect(reductions).toHaveLength(1); expect(reductions[0]).toMatchObject({ amount: "0.79", currency: "AFN", paymentId: payment.paymentId, payableId: payable.id, reason: input.reason, approvedByUserId: f.actor.userId, approvedByMembershipId: f.actor.membershipId });
    expect((await f.workspace()).outstanding).toBe("0.00");
    expect(await f.as(() => reduceSupplierPayable({ ...input, reason: "Changed" }))).toEqual({ status: "conflict" });
  });
  it("serializes lifetime cap checks across requests and payments without pooling caps", async () => {
    const f = await fixture(); const payable = await f.payable("20");
    const payment = await f.as(() => recordSupplierPayment(f.command("1")));
    if (payment.status !== "success") throw new Error("Fixture payment failed.");
    const command = () => ({ requestId: randomUUID(), paymentId: payment.paymentId, payableId: payable.id, amount: "0.60", reason: "Supplier agreed", approved: true });
    const results = await Promise.all([f.as(() => reduceSupplierPayable(command())), f.as(() => reduceSupplierPayable(command()))]);
    expect(results.map((r) => r.status).sort()).toEqual(["invalid", "success"]);
    const second = await f.as(() => recordSupplierPayment(f.command("1")));
    if (second.status !== "success") throw new Error("Fixture payment failed.");
    expect(await f.as(() => reduceSupplierPayable({ ...command(), paymentId: second.paymentId, amount: "0.40" }))).toMatchObject({ status: "invalid" });
    expect((await f.as(() => reduceSupplierPayable({ ...command(), paymentId: second.paymentId, amount: "0.39" }))).status).toBe("success");
    expect((await f.workspace()).outstanding).toBe("17.01");
  });
  it("requires an actual allocation to the payable and refuses reductions above remaining debt", async () => {
    const a = await fixture(); const b = await fixture(); const pa = await a.payable("1.01"); const pb = await b.payable("10");
    const payment = await a.as(() => recordSupplierPayment(a.command("1")));
    if (payment.status !== "success") throw new Error("Fixture payment failed.");
    const command = { requestId: randomUUID(), paymentId: payment.paymentId, payableId: pa.id, amount: "0.02", reason: "Agreed", approved: true };
    for (const patch of [{}, { payableId: pb.id }, { paymentId: randomUUID() }]) {
      expect(await a.as(() => reduceSupplierPayable({ ...command, ...patch }))).toMatchObject({ status: "invalid" });
    }
    expect((await postings(a.organizationId))[2]).toHaveLength(0);
  });
  it.each(["payment", "allocation"])("rolls back cash and allocations on a failed %s posting", async (stage) => {
    const table = stage === "payment" ? supplierPayments : supplierPaymentAllocations;
    const f = await fixture(); await f.payable("100"); const original = db.transaction.bind(db);
    const spy = vi.spyOn(db, "transaction").mockImplementation(function <T>(...args: Parameters<typeof db.transaction<T>>) {
      return original<T>(async (tx) => { const insert = tx.insert.bind(tx);
        vi.spyOn(tx, "insert").mockImplementation((target) => { if (target === table) throw new Error("Injected failure"); return insert(target); });
        return args[0](tx);
      });
    });
    try { await expect(f.as(() => recordSupplierPayment(f.command()))).rejects.toThrow("Injected failure"); } finally { spy.mockRestore(); }
    expect((await postings(f.organizationId)).map((rows) => rows.length)).toEqual([0, 0, 0]);
    expect((await f.workspace()).outstanding).toBe("100.00");
  });
  it("rechecks local authority after waiting for the organization lock", async () => {
    const f = await fixture(); await f.payable("100"); let release = () => {}; let locked = () => {};
    const ready = new Promise<void>((resolve) => { locked = resolve; }); const gate = new Promise<void>((resolve) => { release = resolve; });
    const blocker = db.transaction(async (tx) => {
      await tx.select().from(organizations).where(eq(organizations.id, f.organizationId)).for("update"); locked(); await gate;
      await tx.update(organizationRoleAssignments).set({ role: "viewer" }).where(eq(organizationRoleAssignments.organizationId, f.organizationId));
    });
    await ready; let entered = () => {}; const entering = new Promise<void>((resolve) => { entered = resolve; });
    const original = db.transaction.bind(db);
    const spy = vi.spyOn(db, "transaction").mockImplementation(function <T>(...args: Parameters<typeof db.transaction<T>>) { entered(); return original<T>(...args); });
    try {
      const queued = f.as(() => recordSupplierPayment(f.command())); const denied = expect(queued).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
      await entering; release(); await blocker; await denied;
    } finally { release(); spy.mockRestore(); }
    expect((await postings(f.organizationId))[0]).toHaveLength(0);
  });
  it("denies provider identity changes between initial authorization and posting", async () => {
    const f = await fixture(); await f.payable("100");
    mocks.getActiveOrganizationMembership.mockResolvedValueOnce(f.actor).mockResolvedValueOnce({ ...f.actor, membershipId: "rejoined" });
    await expect(f.as(() => recordSupplierPayment(f.command()))).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    expect((await postings(f.organizationId))[0]).toHaveLength(0);
  });
  it("pages payment history with scoped microsecond cursors and complete debt totals", async () => {
    const f = await fixture(); await f.payable("100");
    for (let i = 0; i < 23; i++) await f.as(() => recordSupplierPayment(f.command("1")));
    await db.update(supplierPayments).set({ createdAt: sql`'2026-11-05T00:00:00.000001Z'::timestamptz` }).where(eq(supplierPayments.organizationId, f.organizationId));
    const first = await f.workspace();
    const second = await f.as(() => getPaymentsWorkspace({ supplierId: f.supplier.id, currency: "AFN", after: first.nextCursor }));
    expect(first.payments).toHaveLength(20); expect(second.payments).toHaveLength(3);
    expect(new Set([...first.payments, ...second.payments].map((row) => row.id)).size).toBe(23);
    expect(first.outstanding).toBe("77.00"); expect(second.outstanding).toBe(first.outstanding);
    expect(first.allocations).toHaveLength(20); expect(second.allocations).toHaveLength(3);
    await expect(f.as(() => getPaymentsWorkspace({ supplierId: f.supplier.id, currency: "PKR", after: first.nextCursor }))).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    const foreign = await fixture();
    await expect(foreign.as(() => getPaymentsWorkspace({ after: first.nextCursor }))).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
  });
  it("keeps supplier aggregate debt exact beyond an individual payable's bound", async () => {
    const f = await fixture(); await f.payable("999999999999999999.99"); await f.payable("999999999999999999.99");
    expect((await f.workspace()).outstanding).toBe("1999999999999999999.98");
    expect((await f.as(() => recordSupplierPayment(f.command("1")))).status).toBe("success");
    expect((await f.workspace()).outstanding).toBe("1999999999999999998.98");
  });
  it("enforces database cash, rate, precision, provenance and settlement-context constraints", async () => {
    const a = await fixture(); const b = await fixture(); const payable = await a.payable("10.79"); const foreign = await b.payable("10");
    const result = await a.as(() => recordSupplierPayment(a.command("1")));
    if (result.status !== "success") throw new Error("Fixture payment failed.");
    await a.as(() => reduceSupplierPayable({ requestId: randomUUID(), paymentId: result.paymentId, payableId: payable.id, amount: "0.01", reason: "Supplier agreed", approved: true }));
    const [payments, allocations, reductions] = await postings(a.organizationId);
    for (const patch of [{ afnCash: "1.1" }, { afnCash: "-1" }, { amount: "0" }, { amount: "0.001" }, { amount: "2" }, { pkrPerAfn: "0" }, { pkrPerAfn: "2.1234567" }, { requestFingerprint: "bad" }, { recordedByUserId: " " }, { supplierId: b.supplier.id }, { pkrCash: "1", pkrPerAfn: null }]) {
      await expect(db.insert(supplierPayments).values({ ...payments[0], id: randomUUID(), requestId: randomUUID(), ...patch })).rejects.toThrow();
    }
    for (const patch of [{ amount: "0" }, { amount: "0.001" }, { paymentId: randomUUID() }, { payableId: foreign.id }, { supplierId: b.supplier.id }, { currency: "PKR" as const }, { organizationId: b.organizationId }]) {
      await expect(db.insert(supplierPaymentAllocations).values({ ...allocations[0], ...patch })).rejects.toThrow();
    }
    for (const patch of [{ amount: "1" }, { amount: "0" }, { amount: "0.001" }, { reason: " " }, { approvedByUserId: " " }, { requestFingerprint: "bad" }, { payableId: foreign.id }, { paymentId: randomUUID() }, { currency: "PKR" as const }]) {
      await expect(db.insert(supplierPaymentReductions).values({ ...reductions[0], id: randomUUID(), requestId: randomUUID(), ...patch })).rejects.toThrow();
    }
  });
  it("rolls back a failed owner reduction without changing debt or cash", async () => {
    const f = await fixture(); const payable = await f.payable("10.79");
    const result = await f.as(() => recordSupplierPayment(f.command("10")));
    if (result.status !== "success") throw new Error("Fixture payment failed.");
    const original = db.transaction.bind(db);
    const spy = vi.spyOn(db, "transaction").mockImplementation(function <T>(...args: Parameters<typeof db.transaction<T>>) {
      return original<T>(async (tx) => { const insert = tx.insert.bind(tx);
        vi.spyOn(tx, "insert").mockImplementation((target) => { if (target === supplierPaymentReductions) throw new Error("Injected failure"); return insert(target); });
        return args[0](tx);
      });
    });
    try { await expect(f.as(() => reduceSupplierPayable({ requestId: randomUUID(), paymentId: result.paymentId, payableId: payable.id, amount: "0.79", reason: "Agreed", approved: true }))).rejects.toThrow("Injected failure"); }
    finally { spy.mockRestore(); }
    expect((await f.workspace()).outstanding).toBe("0.79");
    expect((await postings(f.organizationId))[2]).toHaveLength(0);
  });
});
