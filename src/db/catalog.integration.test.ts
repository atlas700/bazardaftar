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

import { getCatalogWorkspace, getUnitSnapshot, manageCatalog } from "./catalog";
import { db } from "./index";
import { cleanupAuditFixtures } from "./audit-fixtures.test-support";
import { catalogUnits, organizationRoleAssignments, organizations, productCategories } from "./schema";

type Actor = { userId: string; membershipId: string; clerkOrganizationId: string };
const context = new AsyncLocalStorage<Actor>();
const organizationIds: string[] = [];
async function fixture(role: BusinessRole = "owner") {
  const clerkOrganizationId = `task13_org_${randomUUID()}`;
  const [organization] = await db.insert(organizations).values({ clerkOrganizationId }).returning();
  organizationIds.push(organization.id);
  const actor = { clerkOrganizationId, userId: `user_${randomUUID()}`, membershipId: `member_${randomUUID()}` };
  await db.insert(organizationRoleAssignments).values({ organizationId: organization.id, membershipId: actor.membershipId, userId: actor.userId, role });
  return { organization, actor, as: <T>(work: () => Promise<T>) => context.run(actor, work) };
}

describe.skipIf(!process.env.AFCS_TEST_DATABASE_URL)("catalogue against isolated PostgreSQL", () => {
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
      await db.delete(catalogUnits).where(inArray(catalogUnits.organizationId, organizationIds));
      await db.delete(productCategories).where(inArray(productCategories.organizationId, organizationIds));
      await db.delete(organizationRoleAssignments).where(inArray(organizationRoleAssignments.organizationId, organizationIds));
      await db.delete(organizations).where(inArray(organizations.id, organizationIds));
    }
  });

  it("seeds only approved units and preserves edits/deactivation on concurrent retries", async () => {
    const f = await fixture();
    await f.as(async () => {
      expect(await Promise.all(Array.from({ length: 12 }, () => manageCatalog({ operation: "seed-units" }))))
        .toEqual(Array(12).fill({ status: "success" }));
      const data = await getCatalogWorkspace();
      expect(data.units.map((unit) => [unit.name, unit.kilogramsPerUnit])).toEqual([["bag", null], ["kg", "1.000"], ["khorwar", "440.000"], ["maan", "4.400"]]);
      expect(data.categories).toEqual([]);
      const maan = data.units.find((unit) => unit.name === "maan")!;
      await manageCatalog({ operation: "update-unit", id: maan.id, name: "maan", unit: { kind: "fixed", kilogramsPerUnit: "5" } });
      await manageCatalog({ operation: "deactivate-unit", id: maan.id });
      await manageCatalog({ operation: "seed-units" });
      expect((await getCatalogWorkspace()).units.find((unit) => unit.id === maan.id)).toMatchObject({ kilogramsPerUnit: "5.000", isActive: false });
    });
  });

  it("keeps lists and mutations tenant-scoped even with a spoofed organization", async () => {
    const a = await fixture(); const b = await fixture();
    await b.as(() => manageCatalog({ operation: "seed-units" }));
    const otherUnit = (await b.as(getCatalogWorkspace)).units[0];
    await a.as(async () => {
      expect((await getCatalogWorkspace()).units).toEqual([]);
      expect(await manageCatalog({ operation: "deactivate-unit", id: otherUnit.id, organizationId: b.organization.id })).toEqual({ status: "conflict" });
      await expect(getUnitSnapshot({ id: otherUnit.id, quantity: "1", bagWeightKg: "44" })).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
      await manageCatalog({ operation: "create-category", name: "Fruit", organizationId: b.organization.id });
    });
    expect((await a.as(getCatalogWorkspace)).categories.map((category) => category.name)).toEqual(["Fruit"]);
    expect((await b.as(getCatalogWorkspace)).categories).toEqual([]);
    expect((await b.as(getCatalogWorkspace)).units[0].isActive).toBe(true);
  });

  it.each(businessRoles)("enforces catalogue permissions for %s", async (role) => {
    const f = await fixture(role);
    expect((await f.as(getCatalogWorkspace)).canManage).toBe(hasPermission(role, "catalog.manage"));
    const result = f.as(() => manageCatalog({ operation: "create-category", name: "Fruit" }));
    if (hasPermission(role, "catalog.manage")) expect(await result).toEqual({ status: "success" });
    else await expect(result).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
  });

  it("enforces case-insensitive names per tenant including inactive names and concurrent creates", async () => {
    const a = await fixture(); const b = await fixture();
    await a.as(async () => {
      const results = await Promise.all([" Fruit ", "fruit"].map((name) => manageCatalog({ operation: "create-category", name })));
      expect(results.map((result) => result.status).sort()).toEqual(["duplicate", "success"]);
      const category = (await getCatalogWorkspace()).categories[0];
      expect(await manageCatalog({ operation: "update-category", id: category.id, name: "Nuts" })).toEqual({ status: "success" });
      expect(await manageCatalog({ operation: "deactivate-category", id: category.id })).toEqual({ status: "success" });
      expect(await manageCatalog({ operation: "update-category", id: category.id, name: "Changed" })).toEqual({ status: "conflict" });
      expect(await manageCatalog({ operation: "create-category", name: "NUTS" })).toEqual({ status: "duplicate" });
      expect((await getCatalogWorkspace()).categories[0]).toMatchObject({ name: "Nuts", isActive: false });
    });
    expect(await b.as(() => manageCatalog({ operation: "create-category", name: "Nuts" }))).toEqual({ status: "success" });
  });

  it("converts local/fractional/custom weights exactly and keeps prior snapshots after edits", async () => {
    const f = await fixture();
    await f.as(async () => {
      await manageCatalog({ operation: "seed-units" });
      const units = (await getCatalogWorkspace()).units;
      const maan = units.find((unit) => unit.name === "maan")!;
      const khorwar = units.find((unit) => unit.name === "khorwar")!;
      const bag = units.find((unit) => unit.name === "bag")!;
      expect((await getUnitSnapshot({ id: maan.id, quantity: "100" })).quantityKg).toBe("440.000");
      expect((await getUnitSnapshot({ id: khorwar.id, quantity: "1" })).quantityKg).toBe("440.000");
      const old = await getUnitSnapshot({ id: maan.id, quantity: "0.5" });
      expect(old).toMatchObject({ quantity: "0.5", kilogramsPerUnit: "4.400", quantityKg: "2.200" });
      for (const weight of ["44", "48.4"]) {
        expect((await getUnitSnapshot({ id: bag.id, quantity: "2", bagWeightKg: weight })).quantityKg).toBe(weight === "44" ? "88.000" : "96.800");
      }
      await expect(getUnitSnapshot({ id: bag.id, quantity: "1" })).rejects.toThrow("actual weight");
      await expect(getUnitSnapshot({ id: maan.id, quantity: "1", bagWeightKg: "44" })).rejects.toThrow("fixed units");
      await expect(getUnitSnapshot({ id: maan.id, quantity: "0.0001" })).rejects.toThrow("whole gram");
      await manageCatalog({ operation: "update-unit", id: maan.id, name: "Changed", unit: { kind: "fixed", kilogramsPerUnit: "3" } });
      expect((await getUnitSnapshot({ id: maan.id, quantity: "0.125" })).quantityKg).toBe("0.375");
      await manageCatalog({ operation: "deactivate-unit", id: maan.id });
      await expect(getUnitSnapshot({ id: maan.id, quantity: "1" })).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
      expect(old).toMatchObject({ name: "maan", kilogramsPerUnit: "4.400", quantityKg: "2.200" });
    });
  });

  it("creates tenant-owned custom weights and rejects duplicate names on creation and edits", async () => {
    const a = await fixture(); const b = await fixture();
    const command = { operation: "create-unit", name: "Small pack", unit: { kind: "fixed", kilogramsPerUnit: "0.125" } };
    await a.as(async () => {
      expect(await manageCatalog(command)).toEqual({ status: "success" });
      expect(await manageCatalog({ ...command, name: "SMALL PACK" })).toEqual({ status: "duplicate" });
      const pack = (await getCatalogWorkspace()).units[0];
      expect((await getUnitSnapshot({ id: pack.id, quantity: "2" })).quantityKg).toBe("0.250");
      await expect(getUnitSnapshot({ id: pack.id, quantity: "0.5" })).rejects.toThrow("whole gram");
      await manageCatalog({ ...command, name: "Other pack" });
      const other = (await getCatalogWorkspace()).units.find((unit) => unit.name === "Other pack")!;
      expect(await manageCatalog({ operation: "update-unit", id: other.id, name: "small pack", unit: { kind: "fixed", kilogramsPerUnit: "2" } })).toEqual({ status: "duplicate" });
      expect((await getUnitSnapshot({ id: other.id, quantity: "1" })).kilogramsPerUnit).toBe("0.125");
    });
    expect(await b.as(() => manageCatalog(command))).toEqual({ status: "success" });
  });

  it("rejects invalid weights in PostgreSQL without silently rounding them", async () => {
    const f = await fixture();
    for (const kilogramsPerUnit of ["0", "-1", "0.0001", "1.0000", "NaN", "Infinity", "1000000000000000000"]) {
      await expect(db.insert(catalogUnits).values({ organizationId: f.organization.id, name: `Invalid ${kilogramsPerUnit}`, kind: "fixed", kilogramsPerUnit })).rejects.toThrow();
    }
    await expect(db.insert(catalogUnits).values({ organizationId: f.organization.id, name: "Missing", kind: "fixed" })).rejects.toThrow();
    await expect(db.insert(catalogUnits).values({ organizationId: f.organization.id, name: "Bag", kind: "bag", kilogramsPerUnit: "44" })).rejects.toThrow();
    await expect(db.insert(productCategories).values({ organizationId: f.organization.id, name: " " })).rejects.toThrow();
    await expect(db.insert(productCategories).values({ organizationId: randomUUID(), name: "Missing business" })).rejects.toThrow();
  });

  it("rechecks a role revoked while waiting for a staff mutation's organization lock", async () => {
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
    const queued = f.as(() => manageCatalog({ operation: "seed-units" }));
    await entered; releaseLock(); await blocker;
    await expect(queued).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    spy.mockRestore();
    expect((await f.as(getCatalogWorkspace)).units).toEqual([]);
  });
});
