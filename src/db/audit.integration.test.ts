import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { appendAudit } from "./audit";
import { cleanupAuditFixtures } from "./audit-fixtures.test-support";

const mocks = vi.hoisted(() => ({ requireSession: vi.fn(), getActiveOrganizationMembership: vi.fn(), getStaffMemberships: vi.fn(),
  getStaffInvitations: vi.fn(), inviteStaff: vi.fn(), addStaff: vi.fn(), removeStaff: vi.fn(), revokeStaffInvitation: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/auth/server", () => mocks);
vi.mock("@/auth/organizations", () => mocks);
vi.mock("@/auth/staff", () => mocks);
vi.mock("@/env", () => ({ env: { databaseUrl: process.env.AFCS_TEST_DATABASE_URL ?? "postgresql://unused:unused@127.0.0.1:1/unused", nodeEnvironment: "test" } }));
import { db } from "./index";
import { manageCatalog } from "./catalog";
import { adjustInventory } from "./inventory-adjustments";
import { completeOnboarding, pinOnboardingOrganization, reserveOnboarding } from "./onboarding";
import { createPurchaseDraft, getPurchase, mutatePurchase } from "./purchases";
import { acceptReceipt } from "./receipts";
import { manageStaff } from "./staff";
import { manageSupplier } from "./suppliers";
import { recordSupplierPayment, reduceSupplierPayable } from "./supplier-payments";
import { manageWarehouse } from "./warehouses";
import { auditLogs, catalogUnits, goodsReceiptItems, goodsReceipts, inventoryMovements, organizationOnboarding, organizationRoleAssignments,
  organizations, organizationSettings, productCategories, products, purchaseOrderItems, purchaseOrders, supplierPayables,
  supplierPaymentAllocations, supplierPaymentReductions, supplierPayments, suppliers, warehouses } from "./schema";

type Actor = { userId: string; membershipId: string; clerkOrganizationId: string };
const context = new AsyncLocalStorage<Actor>();
const organizationIds: string[] = [];
const onboardingUsers: string[] = [];
async function fixture() {
  const actor = { userId: `user_${randomUUID()}`, membershipId: `member_${randomUUID()}`, clerkOrganizationId: `task27_org_${randomUUID()}` };
  const [organization] = await db.insert(organizations).values({ clerkOrganizationId: actor.clerkOrganizationId }).returning();
  const organizationId = organization.id;
  organizationIds.push(organizationId);
  await db.insert(organizationRoleAssignments).values({ organizationId, userId: actor.userId, membershipId: actor.membershipId, role: "owner" });
  const [unit] = await db.insert(catalogUnits).values({ organizationId, name: "kg", kind: "fixed", kilogramsPerUnit: "1" }).returning();
  const [product] = await db.insert(products).values({ organizationId, name: "Wheat", unitId: unit.id }).returning();
  const [supplier] = await db.insert(suppliers).values({ organizationId, name: "Private supplier", phone: "+93700123456" }).returning();
  const [warehouse] = await db.insert(warehouses).values({ organizationId, name: "Main", location: "Private location" }).returning();
  const as = <T>(work: () => Promise<T>) => context.run(actor, work);
  const events = () => db.select().from(auditLogs).where(eq(auditLogs.organizationId, organizationId));
  const draftCommand = { requestId: randomUUID(), supplierId: supplier.id, warehouseId: warehouse.id, currency: "AFN",
    items: [{ productId: product.id, quantity: "3", quantityUnitId: unit.id, unitPrice: "10", priceUnitId: unit.id }] };
  async function ordered() {
    const draft = await as(() => createPurchaseDraft(draftCommand));
    if (draft.status !== "success") throw new Error("Draft fixture failed.");
    const command = { action: "order", id: draft.purchaseId, revision: 1, requestId: randomUUID() };
    expect((await as(() => mutatePurchase(command))).status).toBe("success");
    return as(() => getPurchase(draft.purchaseId));
  }
  return { organizationId, actor, unit, product, supplier, warehouse, as, events, draftCommand, ordered };
}

async function failAudit<T>(work: () => Promise<T>) {
  const original = db.transaction.bind(db);
  const spy = vi.spyOn(db, "transaction").mockImplementation(function <R>(...args: Parameters<typeof db.transaction<R>>) {
    return original<R>(async (tx) => {
      const insert = tx.insert.bind(tx);
      vi.spyOn(tx, "insert").mockImplementation((table) => { if (table === auditLogs) throw new Error("Injected audit failure"); return insert(table); });
      return args[0](tx);
    });
  });
  try { return await work(); } finally { spy.mockRestore(); }
}

describe.skipIf(!process.env.AFCS_TEST_DATABASE_URL)("append-only audit against isolated PostgreSQL", () => {
  beforeAll(async () => {
    const result = await db.execute<{ database: string }>(sql`select current_database() as database`);
    if (result.rows[0]?.database !== "afcs_task07_verify") throw new Error("Use only isolated afcs_task07_verify.");
  });
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireSession.mockImplementation(async () => ({ userId: context.getStore()?.userId }));
    mocks.getActiveOrganizationMembership.mockImplementation(async () => context.getStore() ?? null);
    mocks.getStaffMemberships.mockImplementation(async () => [context.getStore(), { userId: "user_target", membershipId: "member_target" }]);
    mocks.getStaffInvitations.mockResolvedValue([]);
  });
  afterAll(async () => {
    await cleanupAuditFixtures(organizationIds);
    for (const table of [supplierPaymentReductions, supplierPaymentAllocations, supplierPayments, inventoryMovements, supplierPayables,
      goodsReceiptItems, goodsReceipts, purchaseOrderItems, purchaseOrders, products, catalogUnits, productCategories, suppliers, warehouses,
      organizationRoleAssignments, organizationSettings]) {
      if (organizationIds.length) await db.delete(table).where(inArray(table.organizationId, organizationIds));
    }
    if (organizationIds.length) await db.delete(organizations).where(inArray(organizations.id, organizationIds));
    if (onboardingUsers.length) await db.delete(organizationOnboarding).where(inArray(organizationOnboarding.userId, onboardingUsers));
  });

  it("persists immutable identity, correlation and UTC time and rejects update/delete/truncate", async () => {
    const f = await fixture(); const requestId = randomUUID();
    await db.transaction((tx) => appendAudit(tx, { ...f.actor, organizationId: f.organizationId }, { entityType: "supplier", entityId: f.supplier.id,
      action: "create", requestId, after: { type: "business", phone: "PRIVATE" } }));
    const [event] = await f.events();
    expect(event).toMatchObject({ organizationId: f.organizationId, actorUserId: f.actor.userId, actorMembershipId: f.actor.membershipId,
      requestId, entityId: f.supplier.id, outcome: "completed", before: null, after: { type: "business" } });
    expect(event.createdAt).toBeInstanceOf(Date);
    await expect(db.update(auditLogs).set({ action: "update" }).where(eq(auditLogs.id, event.id))).rejects.toThrow();
    await expect(db.delete(auditLogs).where(eq(auditLogs.id, event.id))).rejects.toThrow();
    await expect(db.execute(sql`truncate audit_logs`)).rejects.toThrow();
    expect(await f.events()).toEqual([event]);
  });

  it("enforces metadata and bounded object snapshots in PostgreSQL itself", async () => {
    const f = await fixture();
    const valid = { organizationId: f.organizationId, actorUserId: f.actor.userId, actorMembershipId: f.actor.membershipId,
      entityType: "supplier" as const, entityId: f.supplier.id, action: "create" as const, outcome: "completed" as const, requestId: randomUUID() };
    for (const invalid of [{ ...valid, organizationId: randomUUID() }, { ...valid, actorUserId: " " }, { ...valid, actorMembershipId: " " },
      { ...valid, entityId: " " }, { ...valid, entityId: "x".repeat(201) }, { ...valid, before: { name: "x".repeat(8193) } }]) {
      await expect(db.insert(auditLogs).values(invalid)).rejects.toThrow();
    }
    await expect(db.execute(sql`insert into audit_logs (organization_id, actor_user_id, actor_membership_id, entity_type, entity_id, action, outcome, request_id, "after")
      values (${f.organizationId}, 'user_a', 'member_a', 'supplier', ${f.supplier.id}, 'create', 'completed', ${randomUUID()}, '[]'::jsonb)`)).rejects.toThrow();
    expect(await f.events()).toEqual([]);
  });

  it("audits every master-data family, real seed inserts, status changes and redacted contact edits", async () => {
    const f = await fixture();
    await f.as(async () => {
      await manageCatalog({ operation: "seed-units" });
      const seeded = (await f.events()).length;
      expect(seeded).toBeGreaterThan(0);
      await manageCatalog({ operation: "seed-units" });
      expect(await f.events()).toHaveLength(seeded);
      await manageCatalog({ operation: "create-unit", name: "Pack", unit: { kind: "fixed", kilogramsPerUnit: "3" } });
      await manageCatalog({ operation: "update-unit", id: f.unit.id, name: "Kilogram", unit: { kind: "fixed", kilogramsPerUnit: "1" } });
      await manageCatalog({ operation: "create-category", name: "Grain" });
      const [category] = await db.select().from(productCategories).where(eq(productCategories.organizationId, f.organizationId));
      await manageCatalog({ operation: "update-category", id: category.id, name: "Dry grain" });
      await manageCatalog({ operation: "create-product", name: "Rice", unitId: f.unit.id, categoryId: category.id });
      await manageCatalog({ operation: "update-product", id: f.product.id, name: "Fine wheat", unitId: f.unit.id });
      await manageCatalog({ operation: "deactivate-product", id: f.product.id });
      await manageCatalog({ operation: "deactivate-category", id: category.id });
      await manageCatalog({ operation: "deactivate-unit", id: f.unit.id });
      await manageSupplier({ operation: "update-supplier", id: f.supplier.id, name: "Private new name", phone: "+93700999999", notes: "Private note", type: "business" });
      await manageSupplier({ operation: "deactivate-supplier", id: f.supplier.id });
      await manageWarehouse({ operation: "update-warehouse", id: f.warehouse.id, name: "West", location: "Private address" });
      await manageWarehouse({ operation: "deactivate-warehouse", id: f.warehouse.id });
      await manageWarehouse({ operation: "activate-warehouse", id: f.warehouse.id });
    });
    const events = await f.events();
    expect(new Set(events.map((event) => event.entityType))).toEqual(new Set(["catalog_unit", "product_category", "product", "supplier", "warehouse"]));
    const edited = events.find((event) => event.entityType === "supplier" && event.action === "update");
    expect(edited).toMatchObject({ before: { type: null, isActive: true }, after: { type: "business", isActive: true } });
    expect(edited?.after?.changedFields).toEqual(expect.arrayContaining(["name", "phone", "notes", "type"]));
    expect(JSON.stringify(events)).not.toMatch(/Private|93700/);
    expect(events.find((event) => event.entityType === "product" && event.action === "update")).toMatchObject({ before: { name: "Wheat" }, after: { name: "Fine wheat" } });
    expect(events.every((event) => event.actorUserId === f.actor.userId && event.actorMembershipId === f.actor.membershipId)).toBe(true);
  });

  it("links purchase, receipt/debt, adjustment, payment and reduction events without duplicate replay events", async () => {
    const f = await fixture(); const purchase = await f.ordered();
    expect(await f.as(() => createPurchaseDraft(f.draftCommand))).toMatchObject({ status: "success", purchaseId: purchase.id });
    const receiptCommand = { requestId: randomUUID(), purchaseId: purchase.id, revision: purchase.revision, complete: false, approveVariance: false, reason: "",
      items: [{ purchaseItemId: purchase.items[0].id, quantity: "1", quantityUnitId: f.unit.id, bagWeightKg: null }] };
    const receipt = await f.as(() => acceptReceipt(receiptCommand));
    expect(receipt.status).toBe("success");
    expect(await f.as(() => acceptReceipt(receiptCommand))).toEqual(receipt);
    const adjustment = { requestId: randomUUID(), productId: f.product.id, warehouseId: f.warehouse.id, quantityKg: "-0.500", reasonCode: "loss", reason: "Private reason", reference: "Private ref", approved: true };
    expect((await f.as(() => adjustInventory(adjustment))).status).toBe("success");
    expect((await f.as(() => adjustInventory(adjustment))).status).toBe("success");
    const paymentCommand = { requestId: randomUUID(), supplierId: f.supplier.id, debtCurrency: "AFN", paidOn: "2026-11-07", afnCash: "9", pkrCash: "0", reference: "Private reference", note: "Private note" };
    const payment = await f.as(() => recordSupplierPayment(paymentCommand));
    if (payment.status !== "success") throw new Error("Payment failed.");
    expect(await f.as(() => recordSupplierPayment(paymentCommand))).toEqual(payment);
    const [payable] = await db.select().from(supplierPayables).where(eq(supplierPayables.organizationId, f.organizationId));
    const reductionCommand = { requestId: randomUUID(), paymentId: payment.paymentId, payableId: payable.id, amount: "0.50", reason: "Private rounding reason", approved: true };
    expect((await f.as(() => reduceSupplierPayable(reductionCommand))).status).toBe("success");
    expect((await f.as(() => reduceSupplierPayable(reductionCommand))).status).toBe("success");
    const events = await f.events();
    expect(events).toHaveLength(8);
    expect(events.filter((event) => event.requestId === receiptCommand.requestId).map((event) => event.entityType).sort()).toEqual(["purchase", "receipt", "supplier_payable"]);
    expect(events.find((event) => event.entityType === "purchase" && event.action === "order")).toMatchObject({ before: { status: "draft", revision: 1 }, after: { status: "ordered", revision: 2 } });
    expect(events.find((event) => event.entityType === "supplier_payment")).toMatchObject({ entityId: payment.paymentId, after: { amount: "9.00", allocationCount: 1 } });
    expect(events.find((event) => event.entityType === "payment_reduction")).toMatchObject({ after: { amount: "0.50", payableId: payable.id } });
    expect(JSON.stringify(events)).not.toContain("Private");
  });

  it("records explicit owner variance approval and purchase cancellation", async () => {
    const f = await fixture(); const purchase = await f.ordered(); const requestId = randomUUID();
    const receipt = await f.as(() => acceptReceipt({ requestId, purchaseId: purchase.id, revision: purchase.revision, complete: true,
      approveVariance: true, reason: "Private short delivery reason", items: [{ purchaseItemId: purchase.items[0].id, quantity: "1", quantityUnitId: f.unit.id }] }));
    expect(receipt.status).toBe("success");
    expect((await f.events()).find((event) => event.action === "approve_variance")).toMatchObject({ actorUserId: f.actor.userId, requestId, entityType: "receipt" });
    const draft = await f.as(() => createPurchaseDraft({ ...f.draftCommand, requestId: randomUUID() }));
    if (draft.status !== "success") throw new Error("Draft failed.");
    const cancel = { action: "cancel", requestId: randomUUID(), id: draft.purchaseId, revision: 1, reason: "Private reason" };
    expect((await f.as(() => mutatePurchase(cancel))).status).toBe("success");
    const count = (await f.events()).length;
    expect((await f.as(() => mutatePurchase(cancel))).status).toBe("success");
    expect(await f.events()).toHaveLength(count);
    expect((await f.events()).find((event) => event.action === "cancel")).toMatchObject({ before: { status: "draft" }, after: { status: "cancelled" } });
  });

  it("writes no completed event for invalid, conflicting, denied or foreign mutations", async () => {
    const f = await fixture(); const other = await fixture();
    expect(await f.as(() => manageSupplier({ operation: "update-supplier", id: other.supplier.id, name: "Other" }))).toEqual({ status: "conflict" });
    expect(await f.as(() => manageCatalog({ operation: "create-unit", name: "Bad", unit: { kind: "fixed", kilogramsPerUnit: "0" } }))).toMatchObject({ status: "invalid" });
    await db.update(organizationRoleAssignments).set({ role: "viewer" }).where(eq(organizationRoleAssignments.organizationId, f.organizationId));
    await expect(f.as(() => manageSupplier({ operation: "deactivate-supplier", id: f.supplier.id }))).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    expect(await f.events()).toEqual([]);
    expect(await other.events()).toEqual([]);
  });

  it.each(["supplier", "purchase", "receipt", "adjustment", "payment", "reduction", "role"])("rolls back a %s mutation when its audit write fails", async (kind) => {
    const f = await fixture();
    const purchase = ["receipt", "payment", "reduction"].includes(kind) ? await f.ordered() : null;
    if (purchase && kind !== "receipt") await f.as(() => acceptReceipt({ requestId: randomUUID(), purchaseId: purchase.id, revision: 2, complete: false,
      approveVariance: false, reason: "", items: [{ purchaseItemId: purchase.items[0].id, quantity: "1", quantityUnitId: f.unit.id }] }));
    const cash = { requestId: randomUUID(), supplierId: f.supplier.id, debtCurrency: "AFN", paidOn: "2026-11-07", afnCash: "9", pkrCash: "0", reference: "", note: "" };
    const payment = kind === "reduction" ? await f.as(() => recordSupplierPayment(cash)) : null;
    const [payable] = await db.select().from(supplierPayables).where(eq(supplierPayables.organizationId, f.organizationId));
    const before = await f.events();
    const work = () => f.as(async () => {
      if (kind === "supplier") return manageSupplier({ operation: "deactivate-supplier", id: f.supplier.id });
      if (kind === "purchase") return createPurchaseDraft(f.draftCommand);
      if (kind === "receipt" && purchase) return acceptReceipt({ requestId: randomUUID(), purchaseId: purchase.id, revision: 2, complete: false, approveVariance: false, reason: "",
        items: [{ purchaseItemId: purchase.items[0].id, quantity: "1", quantityUnitId: f.unit.id }] });
      if (kind === "adjustment") return adjustInventory({ requestId: randomUUID(), productId: f.product.id, warehouseId: f.warehouse.id, quantityKg: "1", reasonCode: "opening_stock", reason: "Opening", reference: "", approved: true });
      if (kind === "payment") return recordSupplierPayment(cash);
      if (kind === "reduction" && payment?.status === "success") return reduceSupplierPayable({ requestId: randomUUID(), paymentId: payment.paymentId, payableId: payable.id, amount: "0.50", reason: "Rounding", approved: true });
      return manageStaff({ operation: "role", membershipId: "member_target", role: "manager" });
    });
    await expect(failAudit(work)).rejects.toThrow("Injected audit failure");
    expect(await f.events()).toEqual(before);
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, f.supplier.id));
    expect(supplier.isActive).toBe(true);
    if (kind === "purchase") expect(await db.select().from(purchaseOrders).where(eq(purchaseOrders.organizationId, f.organizationId))).toEqual([]);
    if (kind === "receipt") {
      expect(await db.select().from(goodsReceipts).where(eq(goodsReceipts.organizationId, f.organizationId))).toEqual([]);
      expect(await db.select().from(supplierPayables).where(eq(supplierPayables.organizationId, f.organizationId))).toEqual([]);
      expect((await f.as(() => getPurchase(purchase!.id))).status).toBe("ordered");
    }
    if (kind === "receipt" || kind === "adjustment") expect(await db.select().from(inventoryMovements).where(eq(inventoryMovements.organizationId, f.organizationId))).toEqual([]);
    if (kind === "payment") expect(await db.select().from(supplierPayments).where(eq(supplierPayments.organizationId, f.organizationId))).toEqual([]);
    if (kind === "reduction") expect(await db.select().from(supplierPaymentReductions).where(eq(supplierPaymentReductions.organizationId, f.organizationId))).toEqual([]);
    if (kind === "role") expect(await db.select().from(organizationRoleAssignments).where(and(eq(organizationRoleAssignments.organizationId, f.organizationId), eq(organizationRoleAssignments.membershipId, "member_target")))).toEqual([]);
  });

  it("audits local role changes and provider requests/completions without logging invitation addresses", async () => {
    const f = await fixture();
    await f.as(() => manageStaff({ operation: "role", membershipId: "member_target", role: "manager" }));
    await f.as(() => manageStaff({ operation: "invite", emailAddress: "private@example.test" }));
    const events = await f.events();
    expect(events.find((event) => event.action === "role")).toMatchObject({ entityId: "member_target", before: null, after: { role: "manager", userId: "user_target" } });
    const invitation = events.filter((event) => event.action === "invite");
    expect(invitation.map((event) => event.outcome).sort()).toEqual(["completed", "requested"]);
    expect(new Set(invitation.map((event) => event.requestId)).size).toBe(1);
    expect(JSON.stringify(events)).not.toContain("private@example");
  });

  it("retains a provider request if the remote operation fails and writes no completion", async () => {
    const f = await fixture(); mocks.inviteStaff.mockRejectedValueOnce(new Error("Remote unavailable"));
    await expect(f.as(() => manageStaff({ operation: "invite", emailAddress: "private@example.test" }))).rejects.toThrow();
    expect(await f.events()).toMatchObject([{ entityType: "staff", action: "invite", outcome: "requested" }]);
  });

  it("retains a provider request if remote success is followed by a failed audit transaction", async () => {
    const f = await fixture();
    await expect(failAudit(() => f.as(() => manageStaff({ operation: "invite", emailAddress: "private@example.test" })))).rejects.toThrow("Injected audit failure");
    expect(mocks.inviteStaff).toHaveBeenCalledOnce();
    expect(await f.events()).toMatchObject([{ action: "invite", outcome: "requested" }]);
  });

  it("audits local onboarding/bootstrap once across matching retries", async () => {
    const token = randomUUID(); const userId = `task27_user_${token}`; onboardingUsers.push(userId);
    const request = await reserveOnboarding(userId, { name: "Private business", businessType: "Grain", timezone: "Asia/Kabul", baseCurrency: "AFN", locale: "ps-AF" });
    const pinned = await pinOnboardingOrganization(request, `task27_org_${token}`);
    const membership = { userId, membershipId: `member_${token}`, clerkOrganizationId: `task27_org_${token}` };
    try { expect(await completeOnboarding(pinned, membership)).toBe(true); }
    finally {
      const [organization] = await db.select().from(organizations).where(eq(organizations.clerkOrganizationId, membership.clerkOrganizationId));
      if (organization) organizationIds.push(organization.id);
    }
    expect(await completeOnboarding(pinned, membership)).toBe(true);
    const events = await db.select().from(auditLogs).where(eq(auditLogs.requestId, pinned.id));
    expect(events).toHaveLength(2);
    expect(events.map((event) => event.entityType).sort()).toEqual(["organization", "staff"]);
    expect(JSON.stringify(events)).not.toContain("Private business");
  });
});
