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
import { createPurchaseDraft, getPurchase, getPurchasesWorkspace, mutatePurchase } from "./purchases";
import { db } from "./index";
import { cleanupAuditFixtures } from "./audit-fixtures.test-support";
import { catalogUnits, organizationRoleAssignments, organizations, products, purchaseOrderItems, purchaseOrders, suppliers, warehouses } from "./schema";

type Actor = { userId: string; membershipId: string; clerkOrganizationId: string };
const context = new AsyncLocalStorage<Actor>();
const organizationIds: string[] = [];
async function fixture(role: BusinessRole = "owner") {
  const clerkOrganizationId = `task18_org_${randomUUID()}`;
  const [organization] = await db.insert(organizations).values({ clerkOrganizationId }).returning();
  organizationIds.push(organization.id);
  const actor = { clerkOrganizationId, userId: `user_${randomUUID()}`, membershipId: `member_${randomUUID()}` };
  const organizationId = organization.id;
  await db.insert(organizationRoleAssignments).values({ organizationId, membershipId: actor.membershipId, userId: actor.userId, role });
  const [supplier] = await db.insert(suppliers).values({ organizationId, name: "Helmand Grain" }).returning();
  const [warehouse] = await db.insert(warehouses).values({ organizationId, name: "Main warehouse" }).returning();
  const [kg, maan, bag] = await db.insert(catalogUnits).values([
    { organizationId, name: "kg", kind: "fixed", kilogramsPerUnit: "1.000" },
    { organizationId, name: "maan", kind: "fixed", kilogramsPerUnit: "4.400" },
    { organizationId, name: "bag", kind: "bag", kilogramsPerUnit: null },
  ]).returning();
  const [product] = await db.insert(products).values({ organizationId, name: "Wheat", sku: "W-1", unitId: kg.id }).returning();
  const item: { productId: string; quantity: string; quantityUnitId: string; quantityBagWeightKg: string | null; unitPrice: string; priceUnitId: string; priceBagWeightKg: string | null } =
    { productId: product.id, quantity: "2", quantityUnitId: bag.id, quantityBagWeightKg: "44", unitPrice: "100", priceUnitId: maan.id, priceBagWeightKg: null };
  return { organization, actor, supplier, warehouse, product, kg, maan, bag, item,
    command: { requestId: randomUUID(), supplierId: supplier.id, warehouseId: warehouse.id, currency: "AFN", items: [item] },
    as: <T>(work: () => Promise<T>) => context.run(actor, work) };
}
async function saved(f: Awaited<ReturnType<typeof fixture>>) {
  const result = await f.as(() => createPurchaseDraft(f.command));
  expect(result.status).toBe("success");
  if (result.status !== "success") throw new Error("Fixture draft failed.");
  return f.as(() => getPurchase(result.purchaseId));
}

describe.skipIf(!process.env.AFCS_TEST_DATABASE_URL)("purchase drafts against isolated PostgreSQL", () => {
  beforeAll(async () => {
    const result = await db.execute<{ database: string }>(sql`select current_database() as database`);
    if (result.rows[0]?.database !== "afcs_task07_verify") throw new Error("Use only the isolated afcs_task07_verify database.");
  });
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireSession.mockImplementation(async () => ({ userId: context.getStore()?.userId }));
    mocks.getActiveOrganizationMembership.mockImplementation(async () => context.getStore() ?? null);
  });
  afterAll(async () => {
    await cleanupAuditFixtures(organizationIds);
    if (organizationIds.length) {
      for (const table of [purchaseOrderItems, purchaseOrders, products, catalogUnits, suppliers, warehouses, organizationRoleAssignments]) {
        await db.delete(table).where(inArray(table.organizationId, organizationIds));
      }
      await db.delete(organizations).where(inArray(organizations.id, organizationIds));
    }
  });
  it("creates exact weight/pricing snapshots with server-owned totals, status and authority", async () => {
    const f = await fixture();
    f.command = { ...f.command, ...{ total: "0.01", status: "received", organizationId: "attacker" } };
    const purchase = await saved(f);
    expect(purchase).toMatchObject({ status: "draft", currency: "AFN", total: "2000.00", supplierName: "Helmand Grain", warehouseName: "Main warehouse" });
    expect(purchase.items).toHaveLength(1);
    expect(purchase.items[0]).toMatchObject({ productName: "Wheat", productSku: "W-1", quantity: "2.000000000000000000", quantityUnitKind: "bag", quantityUnitName: "bag", quantityMeasureKg: "44.000", quantityKg: "88.000", priceUnitName: "maan", priceMeasureKg: "4.400", unitPrice: "100.00", lineTotal: "2000.00" });
    const { purchases } = await f.as(getPurchasesWorkspace);
    expect(purchases.map(({ id }) => id)).toEqual([purchase.id]);
    await db.update(catalogUnits).set({ kilogramsPerUnit: "5.000" }).where(eq(catalogUnits.id, f.maan.id));
    await db.update(products).set({ name: "Renamed", isActive: false }).where(eq(products.id, f.product.id));
    await db.update(suppliers).set({ name: "Renamed supplier", isActive: false }).where(eq(suppliers.id, f.supplier.id));
    expect(await f.as(() => getPurchase(purchase.id))).toEqual(purchase);
  });
  it("rounds each line half-up before summing, supports PKR and zero prices", async () => {
    const f = await fixture();
    const item = { ...f.item, quantity: "0.001", quantityUnitId: f.kg.id, quantityBagWeightKg: null, priceUnitId: f.kg.id, unitPrice: "5.00" };
    f.command = { ...f.command, currency: "PKR", items: [item, item, { ...item, unitPrice: "0" }] };
    const purchase = await saved(f);
    expect(purchase.total).toBe("0.02");
    expect(purchase.items.map(({ lineTotal }) => lineTotal)).toEqual(["0.01", "0.01", "0.00"]);
  });
  it("keeps near-half-cent ratios exact even at the supported numeric bounds", async () => {
    const f = await fixture();
    await db.update(catalogUnits).set({ kilogramsPerUnit: "999999999999999999.999" }).where(eq(catalogUnits.id, f.maan.id));
    f.command.items = [{ ...f.item, quantity: "499999999999999999.999", quantityUnitId: f.kg.id, quantityBagWeightKg: null, unitPrice: "0.01" }];
    expect((await saved(f)).total).toBe("0.00");
  });
  it("stores a separate actual bag weight for the agreed price", async () => {
    const f = await fixture();
    f.command.items = [{ ...f.item, priceUnitId: f.bag.id, priceBagWeightKg: "48.4" }];
    const purchase = await saved(f);
    expect(purchase.total).toBe("181.82");
    expect(purchase.items[0]).toMatchObject({ quantityMeasureKg: "44.000", priceMeasureKg: "48.400", priceUnitKind: "bag", priceUnitName: "bag" });
  });
  it("rejects an overflowing order total even when individual lines fit", async () => {
    const f = await fixture();
    const item = { ...f.item, quantity: "1", quantityUnitId: f.kg.id, quantityBagWeightKg: null,
      unitPrice: "500000000000000000.00", priceUnitId: f.kg.id };
    expect(await f.as(() => createPurchaseDraft({ ...f.command, items: [item, item] }))).toEqual({ status: "invalid", fields: ["items"] });
    expect((await f.as(getPurchasesWorkspace)).purchases).toEqual([]);
    expect(await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.organizationId, f.organization.id))).toEqual([]);
  });
  it("rolls back the order if inserting its items fails, then allows the same retry", async () => {
    const f = await fixture();
    const original = db.transaction.bind(db);
    const spy = vi.spyOn(db, "transaction").mockImplementation(function <T>(...args: Parameters<typeof db.transaction<T>>) {
      return original<T>(async (tx) => {
        const insert = tx.insert.bind(tx);
        vi.spyOn(tx, "insert").mockImplementation((table) => {
          if (table === purchaseOrderItems) throw new Error("Injected item-write failure.");
          return insert(table);
        });
        return args[0](tx);
      });
    });
    try { await expect(f.as(() => createPurchaseDraft(f.command))).rejects.toThrow("Injected item-write failure."); }
    finally { spy.mockRestore(); }
    expect((await f.as(getPurchasesWorkspace)).purchases).toEqual([]);
    await saved(f);
  });
  it("enforces tenant references, supported draft state and exact numeric constraints in PostgreSQL", async () => {
    const f = await fixture(); const foreign = await fixture(); const purchase = await saved(f);
    const [order] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, purchase.id));
    const [line] = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, purchase.id));
    for (const values of [{ ...order, supplierId: foreign.supplier.id }, { ...order, warehouseId: foreign.warehouse.id }, { ...order, total: "0.001" }, { ...order, total: "NaN" }]) {
      await expect(db.insert(purchaseOrders).values({ ...values, id: randomUUID(), requestId: randomUUID() })).rejects.toThrow();
    }
    for (const extra of [{ productId: foreign.product.id }, { quantityUnitId: foreign.bag.id }, { priceUnitId: foreign.maan.id },
      { quantity: "0" }, { quantityKg: "0.0001" }, { unitPrice: "1.001" }, { lineTotal: "1.00" }, { quantityMeasureKg: "NaN" },
    ]) await expect(db.insert(purchaseOrderItems).values({ ...line, ...extra, id: randomUUID(), lineNumber: 2 })).rejects.toThrow();
    await expect(db.execute(sql`update purchase_orders set status = 'received' where id = ${purchase.id}`)).rejects.toThrow();
    await expect(db.execute(sql`update purchase_orders set currency = 'USD' where id = ${purchase.id}`)).rejects.toThrow();
  });
  it("atomically rejects invalid references, sub-gram weights and overflow in later items", async () => {
    const f = await fixture();
    for (const bad of [
      { ...f.item, productId: randomUUID() }, { ...f.item, quantity: "0.0001", quantityUnitId: f.kg.id, quantityBagWeightKg: null },
      { ...f.item, quantityBagWeightKg: null }, { ...f.item, priceUnitId: f.kg.id, priceBagWeightKg: "44" },
      { ...f.item, quantity: "999999999999999999", unitPrice: "999999999999999999" },
    ]) expect(await f.as(() => createPurchaseDraft({ ...f.command, items: [f.item, bad] }))).toMatchObject({ status: "invalid" });
    expect((await f.as(getPurchasesWorkspace)).purchases).toEqual([]);
    expect(await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.organizationId, f.organization.id))).toEqual([]);
  });
  it("identifies price overflow separately from an invalid quantity", async () => {
    const f = await fixture();
    expect(await f.as(() => createPurchaseDraft({ ...f.command, items: [{ ...f.item, quantity: "2", quantityUnitId: f.kg.id,
      quantityBagWeightKg: null, priceUnitId: f.kg.id, unitPrice: "999999999999999999.99" }] }))).toEqual({ status: "invalid", fields: ["items.0.unitPrice"] });
    expect((await f.as(getPurchasesWorkspace)).purchases).toEqual([]);
  });
  it.each(businessRoles)("enforces purchase read/manage permissions for %s", async (role) => {
    const f = await fixture(role);
    if (hasPermission(role, "purchases.read")) {
      expect((await f.as(getPurchasesWorkspace)).canManage).toBe(hasPermission(role, "purchases.manage"));
    } else await expect(f.as(getPurchasesWorkspace)).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    if (hasPermission(role, "purchases.manage")) await saved(f);
    else await expect(f.as(() => createPurchaseDraft(f.command))).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
  });
  it("isolates reads and every foreign selector, ignoring spoofed organization and role", async () => {
    const a = await fixture(); const b = await fixture(); const foreign = await saved(b);
    await a.as(async () => {
      expect((await getPurchasesWorkspace()).purchases).toEqual([]);
      for (const id of [foreign.id, randomUUID(), "bad"]) await expect(getPurchase(id)).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
      for (const extra of [{ supplierId: b.supplier.id }, { warehouseId: b.warehouse.id },
        { items: [{ ...a.item, productId: b.product.id }] }, { items: [{ ...a.item, quantityUnitId: b.bag.id }] },
        { items: [{ ...a.item, priceUnitId: b.maan.id }] }]) {
        expect(await createPurchaseDraft({ ...a.command, ...extra, organizationId: b.organization.id, role: "owner" })).toMatchObject({ status: "invalid" });
      }
    });
    expect(await b.as(() => getPurchase(foreign.id))).toEqual(foreign);
  });
  it("rejects references deactivated after selection, including the product's default unit", async () => {
    const f = await fixture();
    for (const [table, id] of [[suppliers, f.supplier.id], [warehouses, f.warehouse.id], [products, f.product.id], [catalogUnits, f.kg.id], [catalogUnits, f.maan.id], [catalogUnits, f.bag.id]] as const) {
      await db.update(table).set({ isActive: false }).where(eq(table.id, id));
      expect(await f.as(() => createPurchaseDraft(f.command))).toMatchObject({ status: "invalid" });
      await db.update(table).set({ isActive: true }).where(eq(table.id, id));
    }
    expect((await f.as(getPurchasesWorkspace)).purchases).toEqual([]);
  });
  it("retries concurrently as one draft, rejects changed contents and permits a new request", async () => {
    const f = await fixture();
    const results = await f.as(() => Promise.all([createPurchaseDraft(f.command), createPurchaseDraft(f.command)]));
    expect(results[0]).toEqual(results[1]);
    expect(results[0].status).toBe("success");
    expect(await f.as(() => createPurchaseDraft({ ...f.command, currency: "PKR" }))).toEqual({ status: "conflict" });
    await db.update(catalogUnits).set({ isActive: false }).where(eq(catalogUnits.id, f.maan.id));
    expect(await f.as(() => createPurchaseDraft(f.command))).toEqual(results[0]);
    expect((await f.as(getPurchasesWorkspace)).purchases).toHaveLength(1);
    await db.update(catalogUnits).set({ isActive: true }).where(eq(catalogUnits.id, f.maan.id));
    expect(await f.as(() => createPurchaseDraft({ ...f.command, requestId: randomUUID() }))).toMatchObject({ status: "success" });
    expect((await f.as(getPurchasesWorkspace)).purchases).toHaveLength(2);
  });
  it("denies changed provider identity after acquiring the organization lock", async () => {
    const f = await fixture();
    let calls = 0;
    mocks.getActiveOrganizationMembership.mockImplementation(async () => ++calls === 1 ? f.actor : { ...f.actor, membershipId: "removed" });
    await expect(f.as(() => createPurchaseDraft(f.command))).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    expect(await db.select().from(purchaseOrders).where(eq(purchaseOrders.organizationId, f.organization.id))).toEqual([]);
  });
  it("edits drafts exactly, retains original creation identity, and replays without overwriting later changes", async () => {
    const f = await fixture(); const purchase = await saved(f);
    const command = { ...f.command, action: "edit", id: purchase.id, revision: 1, requestId: randomUUID(), currency: "PKR",
      items: [{ ...f.item, savedItemId: purchase.items[0].id, quantity: "3" }] };
    expect(await f.as(() => mutatePurchase(command))).toEqual({ status: "success", purchaseId: purchase.id });
    const edited = await f.as(() => getPurchase(purchase.id));
    expect(edited).toMatchObject({ revision: 2, status: "draft", total: "3000.00", currency: "PKR", createdAt: purchase.createdAt });
    expect(edited.items[0]).toMatchObject({ quantityKg: "132.000", lineTotal: "3000.00" });
    expect(await f.as(() => mutatePurchase(command))).toMatchObject({ status: "success" });
    expect(await f.as(() => mutatePurchase({ ...command, currency: "AFN" }))).toEqual({ status: "conflict" });
    expect(await f.as(() => createPurchaseDraft(f.command))).toMatchObject({ status: "success", purchaseId: purchase.id });
    expect(await f.as(() => getPurchase(purchase.id))).toEqual(edited);
  });
  it("preserves selected historical names and weights through editing and ordering after catalogue changes", async () => {
    const f = await fixture(); const purchase = await saved(f);
    await db.update(catalogUnits).set({ name: "new maan", kilogramsPerUnit: "5.000" }).where(eq(catalogUnits.id, f.maan.id));
    await db.update(products).set({ name: "New wheat" }).where(eq(products.id, f.product.id));
    await db.update(suppliers).set({ name: "New supplier" }).where(eq(suppliers.id, f.supplier.id));
    expect(await f.as(() => mutatePurchase({ ...f.command, action: "edit", id: purchase.id, revision: 1, requestId: randomUUID(),
      items: [{ ...f.item, savedItemId: purchase.items[0].id, quantity: "3" }] }))).toMatchObject({ status: "success" });
    expect(await f.as(() => mutatePurchase({ action: "order", id: purchase.id, revision: 2, requestId: randomUUID() }))).toMatchObject({ status: "success" });
    const ordered = await f.as(() => getPurchase(purchase.id));
    expect(ordered).toMatchObject({ status: "ordered", revision: 3, supplierName: "Helmand Grain", total: "3000.00" });
    expect(ordered.items[0]).toMatchObject({ productName: "Wheat", priceUnitName: "maan", priceMeasureKg: "4.400" });
  });
  it("cancels drafts and ordered purchases with durable owner approval and no item deletion", async () => {
    for (const orderFirst of [false, true]) {
      const f = await fixture(); const purchase = await saved(f);
      if (orderFirst) await f.as(() => mutatePurchase({ action: "order", id: purchase.id, revision: 1, requestId: randomUUID() }));
      const command = { action: "cancel", id: purchase.id, revision: orderFirst ? 2 : 1, requestId: randomUUID(), reason: " Supplier cannot deliver. " };
      expect(await f.as(() => mutatePurchase(command))).toMatchObject({ status: "success" });
      const cancelled = await f.as(() => getPurchase(purchase.id));
      expect(cancelled).toMatchObject({ status: "cancelled", cancellationReason: "Supplier cannot deliver.",
        cancelledByUserId: f.actor.userId, cancelledByMembershipId: f.actor.membershipId });
      expect(cancelled.cancelledAt).toBeInstanceOf(Date);
      expect(cancelled.items).toEqual(purchase.items);
      expect(await f.as(() => mutatePurchase(command))).toMatchObject({ status: "success" });
      for (const action of ["order", "edit", "cancel"]) {
        expect(await f.as(() => mutatePurchase({ ...f.command, action, id: purchase.id, revision: cancelled.revision,
          requestId: randomUUID(), reason: "Again" }))).toEqual({ status: "conflict" });
      }
    }
  });
  it.each(businessRoles)("enforces editing, ordering and owner-only cancellation for %s", async (role) => {
    for (const action of ["edit", "order", "cancel"]) {
      const f = await fixture(); const purchase = await saved(f);
      await db.update(organizationRoleAssignments).set({ role }).where(eq(organizationRoleAssignments.membershipId, f.actor.membershipId));
      const command = { ...f.command, action, id: purchase.id, revision: 1, requestId: randomUUID(), reason: "Owner approval" };
      if (hasPermission(role, action === "cancel" ? "transactions.cancel" : "purchases.manage")) {
        expect(await f.as(() => mutatePurchase(command))).toMatchObject({ status: "success" });
      } else await expect(f.as(() => mutatePurchase(command))).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    }
  });
  it("rejects stale competing edits and transitions without losing either saved items or the winning state", async () => {
    const f = await fixture(); const purchase = await saved(f);
    const base = { ...f.command, id: purchase.id, revision: 1 };
    const results = await f.as(() => Promise.all([
      mutatePurchase({ ...base, action: "edit", requestId: randomUUID(), items: [{ ...f.item, quantity: "3" }] }),
      mutatePurchase({ ...base, action: "order", requestId: randomUUID() }),
      mutatePurchase({ ...base, action: "cancel", requestId: randomUUID(), reason: "Cancelled by owner" }),
    ]));
    expect(results.filter(({ status }) => status === "success")).toHaveLength(1);
    expect(results.filter(({ status }) => status === "conflict")).toHaveLength(2);
    const current = await f.as(() => getPurchase(purchase.id));
    expect(current.revision).toBe(2); expect(current.items).toHaveLength(1);
    if (current.status === "draft") expect(current.total).toBe("3000.00");
    else expect(current.total).toBe("2000.00");
  });
  it("denies cross-tenant targets and line identities, and atomically retains a draft on invalid edits", async () => {
    const f = await fixture(); const foreign = await fixture(); const purchase = await saved(f); const other = await saved(foreign);
    for (const action of ["edit", "order", "cancel"]) await expect(f.as(() => mutatePurchase({ ...f.command, action, id: other.id,
      revision: 1, requestId: randomUUID(), reason: "Cannot cross tenants" }))).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    for (const items of [[{ ...f.item, savedItemId: other.items[0].id }], [f.item, { ...f.item, quantity: "0.00001", quantityUnitId: f.kg.id, quantityBagWeightKg: null }]]) {
      expect(await f.as(() => mutatePurchase({ ...f.command, action: "edit", id: purchase.id, revision: 1, requestId: randomUUID(), items }))).toMatchObject({ status: "invalid" });
      expect(await f.as(() => getPurchase(purchase.id))).toEqual(purchase);
    }
  });
  it("rolls back edited header and deleted lines when replacement insertion fails", async () => {
    const f = await fixture(); const purchase = await saved(f);
    const original = db.transaction.bind(db);
    const spy = vi.spyOn(db, "transaction").mockImplementation(function <T>(...args: Parameters<typeof db.transaction<T>>) {
      return original<T>(async (tx) => {
        const insert = tx.insert.bind(tx);
        vi.spyOn(tx, "insert").mockImplementation((table) => { if (table === purchaseOrderItems) throw new Error("Injected edit failure."); return insert(table); });
        return args[0](tx);
      });
    });
    try { await expect(f.as(() => mutatePurchase({ ...f.command, action: "edit", id: purchase.id, revision: 1,
      requestId: randomUUID(), currency: "PKR" }))).rejects.toThrow("Injected edit failure."); }
    finally { spy.mockRestore(); }
    expect(await f.as(() => getPurchase(purchase.id))).toEqual(purchase);
  });
  it("rejects inactive references at ordering but still permits owner cancellation", async () => {
    const f = await fixture(); const purchase = await saved(f);
    await db.update(products).set({ isActive: false }).where(eq(products.id, f.product.id));
    expect(await f.as(() => mutatePurchase({ action: "order", id: purchase.id, revision: 1, requestId: randomUUID() }))).toMatchObject({ status: "invalid" });
    expect(await f.as(() => getPurchase(purchase.id))).toEqual(purchase);
    expect(await f.as(() => mutatePurchase({ action: "cancel", id: purchase.id, revision: 1, requestId: randomUUID(), reason: "Product unavailable" }))).toMatchObject({ status: "success" });
  });
  it("makes ordered agreements immutable, deduplicates concurrent order retries, and preserves ordering approval on cancellation", async () => {
    const f = await fixture(); const purchase = await saved(f);
    const command = { action: "order", id: purchase.id, revision: 1, requestId: randomUUID() };
    const results = await f.as(() => Promise.all([mutatePurchase(command), mutatePurchase(command)]));
    expect(results[0]).toEqual(results[1]); expect(results[0].status).toBe("success");
    const ordered = await f.as(() => getPurchase(purchase.id));
    expect(ordered).toMatchObject({ revision: 2, status: "ordered", orderedByUserId: f.actor.userId, orderedByMembershipId: f.actor.membershipId });
    expect(ordered.orderedAt).toBeInstanceOf(Date); expect(ordered.items).toEqual(purchase.items);
    for (const action of ["edit", "order"]) expect(await f.as(() => mutatePurchase({ ...f.command, action, id: purchase.id,
      revision: 2, requestId: randomUUID() }))).toEqual({ status: "conflict" });
    await f.as(() => mutatePurchase({ action: "cancel", id: purchase.id, revision: 2, requestId: randomUUID(), reason: "Cannot deliver" }));
    expect((await f.as(() => getPurchase(purchase.id))).orderedAt).toEqual(ordered.orderedAt);
    expect(await f.as(() => mutatePurchase(command))).toEqual({ status: "conflict" });
  });
  it("checks every active reference at ordering and retains snapshots through unit kind changes", async () => {
    const f = await fixture(); const purchase = await saved(f);
    for (const [table, id] of [[suppliers, f.supplier.id], [warehouses, f.warehouse.id], [products, f.product.id], [catalogUnits, f.kg.id], [catalogUnits, f.maan.id], [catalogUnits, f.bag.id]] as const) {
      await db.update(table).set({ isActive: false }).where(eq(table.id, id));
      expect(await f.as(() => mutatePurchase({ action: "order", id: purchase.id, revision: 1, requestId: randomUUID() }))).toMatchObject({ status: "invalid" });
      await db.update(table).set({ isActive: true }).where(eq(table.id, id));
    }
    await db.update(catalogUnits).set({ kind: "bag", kilogramsPerUnit: null }).where(eq(catalogUnits.id, f.maan.id));
    expect(await f.as(() => mutatePurchase({ action: "order", id: purchase.id, revision: 1, requestId: randomUUID() }))).toMatchObject({ status: "success" });
    expect((await f.as(() => getPurchase(purchase.id))).items).toEqual(purchase.items);
  });
  it("enforces lifecycle metadata checks in PostgreSQL", async () => {
    const f = await fixture(); const purchase = await saved(f);
    for (const values of [{ revision: 0 }, { revision: 2 }, { status: "ordered" as const }, { status: "cancelled" as const },
      { cancelledAt: new Date() }, { orderedAt: new Date() }, { lastMutationId: randomUUID() }]) {
      await expect(db.update(purchaseOrders).set(values).where(eq(purchaseOrders.id, purchase.id))).rejects.toThrow();
    }
    expect(await f.as(() => getPurchase(purchase.id))).toEqual(purchase);
  });
  it.each(["edit", "order", "cancel"])("rechecks revoked authority after a queued %s acquires the organization lock", async (action) => {
    const f = await fixture(); const purchase = await saved(f); let announceLock = () => {}; let releaseLock = () => {};
    const locked = new Promise<void>((resolve) => { announceLock = resolve; });
    const released = new Promise<void>((resolve) => { releaseLock = resolve; });
    const blocker = db.transaction(async (tx) => {
      await tx.select().from(organizations).where(eq(organizations.id, f.organization.id)).for("update");
      await tx.update(organizationRoleAssignments).set({ role: "viewer" }).where(eq(organizationRoleAssignments.membershipId, f.actor.membershipId));
      announceLock(); await released;
    });
    await locked; let announceTransaction = () => {};
    const entered = new Promise<void>((resolve) => { announceTransaction = resolve; });
    const original = db.transaction.bind(db);
    const spy = vi.spyOn(db, "transaction").mockImplementation(function <T>(...args: Parameters<typeof db.transaction<T>>) { announceTransaction(); return original<T>(...args); });
    try {
      const queued = f.as(() => mutatePurchase({ ...f.command, action, id: purchase.id, revision: 1, requestId: randomUUID(), reason: "Owner approval" }));
      await entered; releaseLock(); await blocker;
      await expect(queued).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
      const [unchanged] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, purchase.id));
      expect(unchanged).toMatchObject({ status: "draft", revision: 1, cancelledAt: null, orderedAt: null });
    } finally { releaseLock(); spy.mockRestore(); }
  });
  it("denies a grant revoked while a draft waits for the organization lock", async () => {
    const f = await fixture(); let announceLock = () => {}; let releaseLock = () => {};
    const locked = new Promise<void>((resolve) => { announceLock = resolve; });
    const released = new Promise<void>((resolve) => { releaseLock = resolve; });
    const blocker = db.transaction(async (tx) => {
      await tx.select().from(organizations).where(eq(organizations.id, f.organization.id)).for("update");
      await tx.update(organizationRoleAssignments).set({ role: "viewer" }).where(eq(organizationRoleAssignments.membershipId, f.actor.membershipId));
      announceLock(); await released;
    });
    await locked;
    let announceTransaction = () => {};
    const entered = new Promise<void>((resolve) => { announceTransaction = resolve; });
    const original = db.transaction.bind(db);
    const spy = vi.spyOn(db, "transaction").mockImplementation(function <T>(...args: Parameters<typeof db.transaction<T>>) { announceTransaction(); return original<T>(...args); });
    try {
      const queued = f.as(() => createPurchaseDraft(f.command));
      await entered; releaseLock(); await blocker;
      await expect(queued).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
      expect((await f.as(getPurchasesWorkspace)).purchases).toEqual([]);
    } finally { releaseLock(); spy.mockRestore(); }
  });
});
