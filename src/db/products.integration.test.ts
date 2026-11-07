import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { businessRoles, hasPermission, type BusinessRole } from "@/auth/permissions";

const mocks = vi.hoisted(() => ({ requireSession: vi.fn(), getActiveOrganizationMembership: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/auth/server", () => mocks);
vi.mock("@/auth/organizations", () => mocks);
vi.mock("@/env", () => ({ env: {
  databaseUrl: process.env.AFCS_TEST_DATABASE_URL ?? "postgresql://unused:unused@127.0.0.1:1/unused", nodeEnvironment: "test",
} }));
import { getProduct, getProducts, manageCatalog } from "./catalog";
import { db } from "./index";
import { cleanupAuditFixtures } from "./audit-fixtures.test-support";
import { catalogUnits, organizationRoleAssignments, organizations, productCategories, products } from "./schema";

type Actor = { userId: string; membershipId: string; clerkOrganizationId: string };
const context = new AsyncLocalStorage<Actor>();
const organizationIds: string[] = [];
async function fixture(role: BusinessRole = "owner") {
  const clerkOrganizationId = `task14_org_${randomUUID()}`;
  const [organization] = await db.insert(organizations).values({ clerkOrganizationId }).returning();
  organizationIds.push(organization.id);
  const actor = { clerkOrganizationId, userId: `user_${randomUUID()}`, membershipId: `member_${randomUUID()}` };
  await db.insert(organizationRoleAssignments).values({ organizationId: organization.id, membershipId: actor.membershipId, userId: actor.userId, role });
  const [unit] = await db.insert(catalogUnits).values({ organizationId: organization.id, name: "kg", kind: "fixed", kilogramsPerUnit: "1.000" }).returning();
  const [category] = await db.insert(productCategories).values({ organizationId: organization.id, name: "Grain" }).returning();
  return { organization, actor, unit, category,
    command: { operation: "create-product", name: "Wheat", sku: null, categoryId: category.id, unitId: unit.id },
    as: <T>(work: () => Promise<T>) => context.run(actor, work) };
}

describe.skipIf(!process.env.AFCS_TEST_DATABASE_URL)("products against isolated PostgreSQL", () => {
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
      await db.delete(products).where(inArray(products.organizationId, organizationIds));
      await db.delete(catalogUnits).where(inArray(catalogUnits.organizationId, organizationIds));
      await db.delete(productCategories).where(inArray(productCategories.organizationId, organizationIds));
      await db.delete(organizationRoleAssignments).where(inArray(organizationRoleAssignments.organizationId, organizationIds));
      await db.delete(organizations).where(inArray(organizations.id, organizationIds));
    }
  });
  it("creates, reads, edits and deactivates without deletion or revival", async () => {
    const f = await fixture();
    await f.as(async () => {
      expect(await manageCatalog({ ...f.command, name: " Wheat ", sku: " W-1 " })).toEqual({ status: "success" });
      const [saved] = await getProducts();
      expect(saved).toMatchObject({ name: "Wheat", sku: "W-1", categoryName: "Grain", unitName: "kg", isActive: true });
      expect(await getProduct(saved.id)).toEqual(saved);
      expect(await manageCatalog({ ...f.command, operation: "update-product", id: saved.id, name: "Maize", sku: " ", categoryId: null })).toEqual({ status: "success" });
      expect(await getProduct(saved.id)).toMatchObject({ name: "Maize", sku: null, categoryId: null, categoryName: null });
      expect(await manageCatalog({ operation: "deactivate-product", id: saved.id })).toEqual({ status: "success" });
      expect(await manageCatalog({ ...f.command, operation: "update-product", id: saved.id })).toEqual({ status: "conflict" });
      expect(await manageCatalog({ operation: "deactivate-product", id: saved.id })).toEqual({ status: "conflict" });
      expect(await getProduct(saved.id)).toMatchObject({ name: "Maize", isActive: false });
      expect((await getProducts()).length).toBe(1);
    });
  });
  it.each(businessRoles)("uses existing read/manage permissions for %s", async (role) => {
    const f = await fixture(role);
    const [product] = await db.insert(products).values({ organizationId: f.organization.id, name: "Existing", unitId: f.unit.id }).returning();
    await f.as(async () => {
      expect((await getProducts()).length).toBe(1);
      expect((await getProduct(product.id)).name).toBe("Existing");
      const result = manageCatalog(f.command);
      if (hasPermission(role, "catalog.manage")) expect(await result).toEqual({ status: "success" });
      else await expect(result).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    });
  });
  it("denies foreign reads, edits, deactivation and catalogue references", async () => {
    const a = await fixture(); const b = await fixture();
    await b.as(() => manageCatalog(b.command));
    const [foreign] = await b.as(getProducts);
    await a.as(async () => {
      expect(await getProducts()).toEqual([]);
      await expect(getProduct(foreign.id)).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
      expect(await manageCatalog({ ...a.command, operation: "update-product", id: foreign.id, organizationId: b.organization.id })).toEqual({ status: "conflict" });
      expect(await manageCatalog({ operation: "deactivate-product", id: foreign.id })).toEqual({ status: "conflict" });
      expect(await manageCatalog({ ...a.command, unitId: b.unit.id })).toEqual({ status: "invalid", fields: ["unitId"] });
      expect(await manageCatalog({ ...a.command, categoryId: b.category.id })).toEqual({ status: "invalid", fields: ["categoryId"] });
      expect(await manageCatalog({ ...a.command, organizationId: b.organization.id })).toEqual({ status: "success" });
    });
    expect(await b.as(() => getProduct(foreign.id))).toMatchObject({ name: "Wheat", isActive: true });
  });
  it("reserves case-insensitive names and optional codes, including inactive products", async () => {
    const a = await fixture(); const b = await fixture();
    await a.as(async () => {
      const result = await Promise.all(["Wheat", "Maize"].map((name) => manageCatalog({ ...a.command, name, sku: "G-1" })));
      expect(result.map((entry) => entry.status).sort()).toEqual(["duplicate", "success"]);
      const [saved] = await getProducts();
      expect(await manageCatalog({ ...a.command, name: saved.name.toLowerCase(), sku: null })).toEqual({ status: "duplicate" });
      await manageCatalog({ operation: "deactivate-product", id: saved.id });
      expect(await manageCatalog({ ...a.command, name: "Other", sku: " g-1 " })).toEqual({ status: "duplicate" });
      expect(await manageCatalog({ ...a.command, name: saved.name.toUpperCase() })).toEqual({ status: "duplicate" });
      expect(await manageCatalog({ ...a.command, name: "No code A", sku: "" })).toEqual({ status: "success" });
      expect(await manageCatalog({ ...a.command, name: "No code B", sku: null })).toEqual({ status: "success" });
    });
    expect(await b.as(() => manageCatalog({ ...b.command, sku: "G-1" }))).toEqual({ status: "success" });
  });
  it("rolls back an edit that would duplicate a code", async () => {
    const f = await fixture();
    await f.as(async () => {
      await manageCatalog({ ...f.command, sku: "W" });
      await manageCatalog({ ...f.command, name: "Maize", sku: "M" });
      const maize = (await getProducts()).find((entry) => entry.name === "Maize")!;
      expect(await manageCatalog({ ...f.command, operation: "update-product", id: maize.id, name: "Changed", sku: "w" })).toEqual({ status: "duplicate" });
      expect(await getProduct(maize.id)).toMatchObject({ name: "Maize", sku: "M" });
    });
  });
  it("retains products when references deactivate and rejects inactive selections on create/edit", async () => {
    const f = await fixture();
    await f.as(async () => {
      await manageCatalog(f.command);
      const [saved] = await getProducts();
      await manageCatalog({ operation: "deactivate-category", id: f.category.id });
      expect(await manageCatalog({ ...f.command, name: "New" })).toEqual({ status: "invalid", fields: ["categoryId"] });
      expect(await manageCatalog({ ...f.command, operation: "update-product", id: saved.id })).toEqual({ status: "invalid", fields: ["categoryId"] });
      await manageCatalog({ operation: "deactivate-unit", id: f.unit.id });
      expect(await manageCatalog({ ...f.command, name: "New", categoryId: null })).toEqual({ status: "invalid", fields: ["unitId"] });
      expect(await getProduct(saved.id)).toMatchObject({ name: "Wheat", unitName: "kg", categoryName: "Grain" });
      expect(await manageCatalog({ operation: "deactivate-product", id: saved.id })).toEqual({ status: "success" });
    });
  });
  it("enforces tenant references, lengths and uniqueness in PostgreSQL itself", async () => {
    const a = await fixture(); const b = await fixture();
    const valid = { organizationId: a.organization.id, name: "Wheat", unitId: a.unit.id, categoryId: a.category.id };
    for (const values of [{ ...valid, unitId: b.unit.id }, { ...valid, categoryId: b.category.id },
      { ...valid, unitId: randomUUID() }, { ...valid, name: " " }, { ...valid, name: " Wheat " },
      { ...valid, name: "x".repeat(81) }, { ...valid, sku: "" }, { ...valid, sku: " W " }, { ...valid, sku: "x".repeat(41) },
    ]) await expect(db.insert(products).values(values)).rejects.toThrow();
    await db.insert(products).values({ ...valid, sku: "W-1" });
    await expect(db.insert(products).values({ ...valid, name: "wheat" })).rejects.toThrow();
    await expect(db.insert(products).values({ ...valid, name: "Maize", sku: "w-1" })).rejects.toThrow();
    await expect(db.delete(catalogUnits).where(eq(catalogUnits.id, a.unit.id))).rejects.toThrow();
  });
  it("denies a role revoked while the product write waits for the organization lock", async () => {
    const f = await fixture();
    let announceLock = () => {}; let releaseLock = () => {};
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
    const spy = vi.spyOn(db, "transaction").mockImplementation(function <T>(...args: Parameters<typeof db.transaction<T>>) {
      announceTransaction(); return original<T>(...args);
    });
    try {
      const queued = f.as(() => manageCatalog(f.command));
      await entered; releaseLock(); await blocker;
      await expect(queued).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
      expect(await f.as(getProducts)).toEqual([]);
    } finally { releaseLock(); spy.mockRestore(); }
  });
});
