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
import { getActiveWarehouse, getWarehouseWorkspace, manageWarehouse } from "./warehouses";
import { db } from "./index";
import { organizationRoleAssignments, organizations, warehouses } from "./schema";

type Actor = { userId: string; membershipId: string; clerkOrganizationId: string };
const context = new AsyncLocalStorage<Actor>();
const organizationIds: string[] = [];
async function fixture(role: BusinessRole = "owner") {
  const clerkOrganizationId = `task17_org_${randomUUID()}`;
  const [organization] = await db.insert(organizations).values({ clerkOrganizationId }).returning();
  organizationIds.push(organization.id);
  const actor = { clerkOrganizationId, userId: `user_${randomUUID()}`, membershipId: `member_${randomUUID()}` };
  await db.insert(organizationRoleAssignments).values({ organizationId: organization.id, membershipId: actor.membershipId, userId: actor.userId, role });
  return { organization, actor, command: { operation: "create-warehouse", name: "Main warehouse" },
    as: <T>(work: () => Promise<T>) => context.run(actor, work) };
}

describe.skipIf(!process.env.AFCS_TEST_DATABASE_URL)("warehouses against isolated PostgreSQL", () => {
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
      await db.delete(warehouses).where(inArray(warehouses.organizationId, organizationIds));
      await db.delete(organizationRoleAssignments).where(inArray(organizationRoleAssignments.organizationId, organizationIds));
      await db.delete(organizations).where(inArray(organizations.id, organizationIds));
    }
  });
  it("creates/edits one warehouse and reactivates the same retained identity", async () => {
    const f = await fixture();
    await f.as(async () => {
      expect(await getActiveWarehouse()).toBeNull();
      expect(await manageWarehouse({ ...f.command, name: " Main warehouse ", location: " Lashkar Gah " })).toEqual({ status: "success" });
      const { warehouse: saved, canManage } = await getWarehouseWorkspace();
      expect(canManage).toBe(true); expect(saved).toMatchObject({ name: "Main warehouse", location: "Lashkar Gah", isActive: true });
      expect(await getActiveWarehouse()).toEqual(saved);
      expect(await manageWarehouse({ operation: "deactivate-warehouse", id: saved!.id })).toEqual({ status: "success" });
      expect(await getActiveWarehouse()).toBeNull();
      expect(await manageWarehouse(f.command)).toEqual({ status: "exists" });
      expect(await manageWarehouse({ ...f.command, operation: "update-warehouse", id: saved!.id, name: "Main store", location: " " })).toEqual({ status: "success" });
      expect(await getActiveWarehouse()).toBeNull();
      expect(await manageWarehouse({ operation: "activate-warehouse", id: saved!.id })).toEqual({ status: "success" });
      expect(await getActiveWarehouse()).toEqual({ ...saved, name: "Main store", location: null });
    });
  });
  it.each(businessRoles)("enforces approved business-setting permissions for %s", async (role) => {
    const f = await fixture(role);
    await f.as(async () => {
      expect(await getWarehouseWorkspace()).toEqual({ warehouse: null, canManage: hasPermission(role, "organization.manage") });
      expect(await getActiveWarehouse()).toBeNull();
      if (hasPermission(role, "organization.manage")) expect(await manageWarehouse(f.command)).toEqual({ status: "success" });
      else await expect(manageWarehouse(f.command)).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    });
  });
  it("isolates setup, edits, activation/deactivation and selection across tenants", async () => {
    const a = await fixture(); const b = await fixture();
    await b.as(() => manageWarehouse(b.command));
    const foreign = await b.as(getActiveWarehouse);
    await a.as(async () => {
      expect((await getWarehouseWorkspace()).warehouse).toBeNull(); expect(await getActiveWarehouse()).toBeNull();
      for (const operation of ["update-warehouse", "deactivate-warehouse", "activate-warehouse"]) {
        expect(await manageWarehouse({ ...a.command, operation, id: foreign!.id, organizationId: b.organization.id })).toEqual({ status: "conflict" });
      }
      expect(await manageWarehouse({ ...a.command, organizationId: b.organization.id, isActive: false })).toEqual({ status: "success" });
      expect(await getActiveWarehouse()).toMatchObject({ isActive: true });
    });
    expect(await b.as(getActiveWarehouse)).toEqual(foreign);
  });
  it("serializes concurrent setup and enforces singleton/fields/FK in PostgreSQL", async () => {
    const f = await fixture();
    await f.as(async () => {
      const results = await Promise.all([manageWarehouse(f.command), manageWarehouse({ ...f.command, name: "Second" })]);
      expect(results.map(({ status }) => status).sort()).toEqual(["exists", "success"]);
    });
    const empty = await fixture();
    for (const values of [{ name: " " }, { name: " Main " }, { name: "x".repeat(81) },
      { name: "Main", location: "" }, { name: "Main", location: "x".repeat(201) }, { name: "Main", organizationId: randomUUID() },
    ]) await expect(db.insert(warehouses).values({ organizationId: empty.organization.id, ...values })).rejects.toThrow();
    await expect(db.insert(warehouses).values({ organizationId: f.organization.id, name: "Second", isActive: false })).rejects.toThrow();
  });
  it("keeps setup unchanged when a write transaction fails", async () => {
    const f = await fixture();
    await f.as(() => manageWarehouse(f.command));
    const saved = await f.as(getActiveWarehouse);
    await expect(db.transaction(async (tx) => {
      await tx.update(warehouses).set({ name: "Changed" }).where(eq(warehouses.organizationId, f.organization.id));
      throw new Error("rollback");
    })).rejects.toThrow("rollback");
    expect(await f.as(getActiveWarehouse)).toEqual(saved);
  });
  it("denies a role revoked while the mutation waits for the organization lock", async () => {
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
      const queued = f.as(() => manageWarehouse(f.command));
      await entered; releaseLock(); await blocker;
      await expect(queued).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
      expect((await f.as(getWarehouseWorkspace)).warehouse).toBeNull();
    } finally { releaseLock(); spy.mockRestore(); }
  });
});
