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
import { getSupplier, getSuppliersWorkspace, manageSupplier } from "./suppliers";
import { db } from "./index";
import { cleanupAuditFixtures } from "./audit-fixtures.test-support";
import { organizationRoleAssignments, organizations, suppliers } from "./schema";

type Actor = { userId: string; membershipId: string; clerkOrganizationId: string };
const context = new AsyncLocalStorage<Actor>();
const organizationIds: string[] = [];
async function fixture(role: BusinessRole = "owner") {
  const clerkOrganizationId = `task15_org_${randomUUID()}`;
  const [organization] = await db.insert(organizations).values({ clerkOrganizationId }).returning();
  organizationIds.push(organization.id);
  const actor = { clerkOrganizationId, userId: `user_${randomUUID()}`, membershipId: `member_${randomUUID()}` };
  await db.insert(organizationRoleAssignments).values({ organizationId: organization.id, membershipId: actor.membershipId, userId: actor.userId, role });
  return { organization, actor, command: { operation: "create-supplier", name: "Helmand Grain" },
    as: <T>(work: () => Promise<T>) => context.run(actor, work) };
}

describe.skipIf(!process.env.AFCS_TEST_DATABASE_URL)("suppliers against isolated PostgreSQL", () => {
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
      await db.delete(suppliers).where(inArray(suppliers.organizationId, organizationIds));
      await db.delete(organizationRoleAssignments).where(inArray(organizationRoleAssignments.organizationId, organizationIds));
      await db.delete(organizations).where(inArray(organizations.id, organizationIds));
    }
  });
  it("creates, edits, clears optional details and deactivates without deletion or revival", async () => {
    const f = await fixture();
    await f.as(async () => {
      expect(await manageSupplier({ ...f.command, name: " Helmand Grain ", phone: " ۰۷۰۰۱۲۳۴۵۶ ", location: " Lashkar Gah ",
        type: "business", notes: " Call first ", paymentTerms: " On delivery " })).toEqual({ status: "success" });
      const { suppliers: [saved], canManage } = await getSuppliersWorkspace();
      expect(canManage).toBe(true);
      expect(saved).toMatchObject({ name: "Helmand Grain", phone: "۰۷۰۰۱۲۳۴۵۶", location: "Lashkar Gah", type: "business", notes: "Call first", paymentTerms: "On delivery", isActive: true });
      expect(await getSupplier(saved.id)).toEqual(saved);
      expect(await manageSupplier({ ...f.command, operation: "update-supplier", id: saved.id, name: "Helmand Contact", type: "individual", notes: " " })).toEqual({ status: "success" });
      expect(await getSupplier(saved.id)).toMatchObject({ name: "Helmand Contact", type: "individual", phone: null, location: null, notes: null, paymentTerms: null });
      expect(await manageSupplier({ operation: "deactivate-supplier", id: saved.id })).toEqual({ status: "success" });
      expect(await manageSupplier({ ...f.command, operation: "update-supplier", id: saved.id })).toEqual({ status: "conflict" });
      expect(await manageSupplier({ operation: "deactivate-supplier", id: saved.id })).toEqual({ status: "conflict" });
      expect(await getSupplier(saved.id)).toMatchObject({ name: "Helmand Contact", isActive: false });
      expect((await getSuppliersWorkspace()).suppliers).toHaveLength(1);
    });
  });
  it.each(businessRoles)("enforces suppliers.read/manage for %s", async (role) => {
    const f = await fixture(role);
    const [saved] = await db.insert(suppliers).values({ organizationId: f.organization.id, name: "Existing" }).returning();
    await f.as(async () => {
      for (const work of [getSuppliersWorkspace, () => getSupplier(saved.id)]) {
        if (hasPermission(role, "suppliers.read")) {
          const result = await work();
          if ("canManage" in result) expect(result.canManage).toBe(hasPermission(role, "suppliers.manage"));
        } else await expect(work()).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
      }
      if (hasPermission(role, "suppliers.manage")) expect(await manageSupplier(f.command)).toEqual({ status: "success" });
      else await expect(manageSupplier(f.command)).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    });
  });
  it("isolates reads, edits, deactivation and spoofed authority across businesses", async () => {
    const a = await fixture(); const b = await fixture();
    await b.as(() => manageSupplier(b.command));
    const { suppliers: [foreign] } = await b.as(getSuppliersWorkspace);
    await a.as(async () => {
      expect((await getSuppliersWorkspace()).suppliers).toEqual([]);
      await expect(getSupplier(foreign.id)).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
      expect(await manageSupplier({ ...a.command, operation: "update-supplier", id: foreign.id, organizationId: b.organization.id })).toEqual({ status: "conflict" });
      expect(await manageSupplier({ operation: "deactivate-supplier", id: foreign.id })).toEqual({ status: "conflict" });
      expect(await manageSupplier({ ...a.command, organizationId: b.organization.id, balance: "1000" })).toEqual({ status: "success" });
    });
    expect(await b.as(() => getSupplier(foreign.id))).toEqual(foreign);
  });
  it("reserves names per business including inactive records and serializes duplicate creates", async () => {
    const a = await fixture(); const b = await fixture();
    await a.as(async () => {
      const results = await Promise.all(["Helmand Grain", " helmand grain "].map((name) => manageSupplier({ ...a.command, name })));
      expect(results.map(({ status }) => status).sort()).toEqual(["duplicate", "success"]);
      const { suppliers: [saved] } = await getSuppliersWorkspace();
      await manageSupplier({ operation: "deactivate-supplier", id: saved.id });
      expect(await manageSupplier(a.command)).toEqual({ status: "duplicate" });
    });
    expect(await b.as(() => manageSupplier(b.command))).toEqual({ status: "success" });
  });
  it("rolls back a duplicate rename without changing contact details", async () => {
    const f = await fixture();
    await f.as(async () => {
      await manageSupplier(f.command);
      await manageSupplier({ ...f.command, name: "Second", phone: "0700123456" });
      const saved = (await getSuppliersWorkspace()).suppliers.find(({ name }) => name === "Second")!;
      expect(await manageSupplier({ ...f.command, operation: "update-supplier", id: saved.id, phone: "0799999999" })).toEqual({ status: "duplicate" });
      expect(await getSupplier(saved.id)).toEqual(saved);
    });
  });
  it("enforces optional fields, allowed types and tenant references in PostgreSQL itself", async () => {
    const f = await fixture();
    const valid = { organizationId: f.organization.id, name: "Valid" };
    for (const values of [{ ...valid, name: " " }, { ...valid, name: " Name " }, { ...valid, name: "x".repeat(81) },
      { ...valid, phone: "abc" }, { ...valid, phone: "..." }, { ...valid, phone: "1" }, { ...valid, phone: "1".repeat(41) },
      { ...valid, location: "x".repeat(201) }, { ...valid, location: "" }, { ...valid, notes: "x".repeat(2001) },
      { ...valid, paymentTerms: "x".repeat(501) }, { ...valid, organizationId: randomUUID() },
    ]) await expect(db.insert(suppliers).values(values)).rejects.toThrow();
    await expect(db.execute(sql`insert into suppliers (organization_id, name, type) values (${f.organization.id}, 'Bad type', 'farmer')`)).rejects.toThrow();
    await db.insert(suppliers).values({ ...valid, phone: "+93 (0) 700-123-456", type: "individual" });
    await expect(db.insert(suppliers).values({ ...valid, name: "valid" })).rejects.toThrow();
  });
  it("denies a grant revoked while the write waits for the organization lock", async () => {
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
      const queued = f.as(() => manageSupplier(f.command));
      await entered; releaseLock(); await blocker;
      await expect(queued).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
      expect((await f.as(getSuppliersWorkspace)).suppliers).toEqual([]);
    } finally { releaseLock(); spy.mockRestore(); }
  });
});
