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
import { createPurchaseDraft, getPurchase, getPurchasesWorkspace } from "./purchases";
import { db } from "./index";
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
  const item = { productId: product.id, quantity: "2", quantityUnitId: bag.id, quantityBagWeightKg: "44", unitPrice: "100", priceUnitId: maan.id, priceBagWeightKg: null };
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
  });
  it("denies changed provider identity after acquiring the organization lock", async () => {
    const f = await fixture();
    let calls = 0;
    mocks.getActiveOrganizationMembership.mockImplementation(async () => ++calls === 1 ? f.actor : { ...f.actor, membershipId: "removed" });
    await expect(f.as(() => createPurchaseDraft(f.command))).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    expect(await db.select().from(purchaseOrders).where(eq(purchaseOrders.organizationId, f.organization.id))).toEqual([]);
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
