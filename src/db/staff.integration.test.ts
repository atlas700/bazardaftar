import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireSession: vi.fn(), getActiveOrganizationMembership: vi.fn(),
  getStaffMemberships: vi.fn(), getStaffInvitations: vi.fn(), inviteStaff: vi.fn(), addStaff: vi.fn(), removeStaff: vi.fn(), revokeStaffInvitation: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/auth/server", () => mocks);
vi.mock("@/auth/organizations", () => mocks);
vi.mock("@/auth/staff", () => mocks);
vi.mock("@/env", () => ({ env: {
  databaseUrl: process.env.AFCS_TEST_DATABASE_URL ?? "postgresql://unused:unused@127.0.0.1:1/unused",
  nodeEnvironment: "test",
} }));

import { requirePermission } from "./authorization";
import { db } from "./index";
import { cleanupAuditFixtures } from "./audit-fixtures.test-support";
import { organizationRoleAssignments, organizations } from "./schema";
import { getStaffWorkspace, manageStaff } from "./staff";

type Member = { membershipId: string; userId: string; identifier: string };
type Actor = Member & { clerkOrganizationId: string };
const context = new AsyncLocalStorage<Actor>();
const remoteMembers = new Map<string, Member[]>();
const organizationIds: string[] = [];

async function fixture() {
  const remoteId = `task11_org_${randomUUID()}`;
  const [organization] = await db.insert(organizations).values({ clerkOrganizationId: remoteId }).returning();
  organizationIds.push(organization.id);
  const members = ["a", "b", "c"].map((suffix) => ({
    membershipId: `member_${organization.id}_${suffix}`, userId: `user_${organization.id.replaceAll("-", "")}_${suffix}`, identifier: suffix,
  }));
  remoteMembers.set(remoteId, members);
  await db.insert(organizationRoleAssignments).values(members.map((member, index) => ({
    organizationId: organization.id, membershipId: member.membershipId, userId: member.userId,
    role: index < 2 ? "owner" as const : "viewer" as const,
  })));
  return { organization, remoteId, members, as: <T>(index: number, work: () => Promise<T>) => context.run({ ...members[index], clerkOrganizationId: remoteId }, work) };
}

describe.skipIf(!process.env.AFCS_TEST_DATABASE_URL)("staff management against isolated PostgreSQL", () => {
  beforeAll(async () => {
    const result = await db.execute<{ database: string }>(sql`select current_database() as database`);
    if (result.rows[0]?.database !== "afcs_task07_verify") throw new Error("Use only the isolated afcs_task07_verify database.");
  });
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireSession.mockImplementation(async () => ({ userId: context.getStore()?.userId }));
    mocks.getActiveOrganizationMembership.mockImplementation(async () => {
      const actor = context.getStore();
      return actor && remoteMembers.get(actor.clerkOrganizationId)?.some((member) => member.membershipId === actor.membershipId && member.userId === actor.userId) ? actor : null;
    });
    mocks.getStaffMemberships.mockImplementation(async (remoteId: string) => [...(remoteMembers.get(remoteId) ?? [])]);
    mocks.getStaffInvitations.mockResolvedValue([]);
    mocks.removeStaff.mockImplementation(async (remoteId: string, userId: string) => {
      remoteMembers.set(remoteId, (remoteMembers.get(remoteId) ?? []).filter((member) => member.userId !== userId));
    });
  });
  afterAll(async () => {
    await cleanupAuditFixtures(organizationIds);
    if (organizationIds.length) {
      await db.delete(organizationRoleAssignments).where(inArray(organizationRoleAssignments.organizationId, organizationIds));
      await db.delete(organizations).where(inArray(organizations.id, organizationIds));
    }
  });

  it("serializes competing owner demotions and retains exactly one active owner", async () => {
    const f = await fixture();
    const outcomes = await Promise.all([0, 1].map((index) => f.as(index, () => manageStaff({
      operation: "role", membershipId: f.members[index].membershipId, role: "viewer",
    }))));
    expect(outcomes.map((result) => result.status).sort()).toEqual(["last-owner", "success"]);
    const roles = await db.select().from(organizationRoleAssignments).where(eq(organizationRoleAssignments.organizationId, f.organization.id));
    expect(roles.filter((row) => row.role === "owner")).toHaveLength(1);
  });

  it("serializes competing owner removals without counting retained stale grants", async () => {
    const f = await fixture();
    const outcomes = await Promise.all([0, 1].map((index) => f.as(index, () => manageStaff({ operation: "deactivate", membershipId: f.members[index].membershipId }))));
    expect(outcomes.map((result) => result.status).sort()).toEqual(["last-owner", "success"]);
    expect(remoteMembers.get(f.remoteId)?.filter((member) => member.membershipId !== f.members[2].membershipId)).toHaveLength(1);
    expect(await db.select().from(organizationRoleAssignments).where(eq(organizationRoleAssignments.organizationId, f.organization.id))).toHaveLength(3);
  });

  it("rechecks an actor's role after waiting behind an in-flight demotion", async () => {
    const f = await fixture();
    let announceLock: () => void = () => {};
    let releaseLock: () => void = () => {};
    const locked = new Promise<void>((resolve) => { announceLock = resolve; });
    const released = new Promise<void>((resolve) => { releaseLock = resolve; });
    const blocker = db.transaction(async (tx) => {
      await tx.select().from(organizations).where(eq(organizations.id, f.organization.id)).for("update");
      await tx.update(organizationRoleAssignments).set({ role: "viewer" }).where(eq(organizationRoleAssignments.membershipId, f.members[0].membershipId));
      announceLock();
      await released;
    });
    await locked;
    let announceTransaction: () => void = () => {};
    const entered = new Promise<void>((resolve) => { announceTransaction = resolve; });
    const originalTransaction = db.transaction.bind(db);
    const transactionSpy = vi.spyOn(db, "transaction").mockImplementation(function <T>(...args: Parameters<typeof db.transaction<T>>) {
      announceTransaction();
      return originalTransaction<T>(...args);
    });
    const queued = f.as(0, () => manageStaff({ operation: "add", userId: "user_new" }));
    await entered;
    releaseLock();
    await blocker;
    await expect(queued).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    transactionSpy.mockRestore();
    expect(mocks.addStaff).not.toHaveBeenCalled();
  });

  it("denies cross-tenant targets and applies a role only to the verified membership", async () => {
    const a = await fixture();
    const b = await fixture();
    expect(await a.as(0, () => manageStaff({ operation: "role", membershipId: b.members[2].membershipId, role: "admin", organizationId: b.organization.id }))).toEqual({ status: "conflict" });
    expect(await a.as(0, () => manageStaff({ operation: "role", membershipId: a.members[2].membershipId, role: "admin" }))).toEqual({ status: "success" });
    const [other] = await db.select().from(organizationRoleAssignments).where(eq(organizationRoleAssignments.membershipId, b.members[2].membershipId));
    expect(other.role).toBe("viewer");
  });

  it("revokes stale-session access immediately and does not restore grants after rejoin", async () => {
    const f = await fixture();
    expect(await f.as(0, () => manageStaff({ operation: "deactivate", membershipId: f.members[2].membershipId }))).toEqual({ status: "success" });
    await expect(f.as(2, () => requirePermission("organization.read"))).rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    const rejoined = { ...f.members[2], membershipId: `member_rejoined_${randomUUID()}` };
    remoteMembers.set(f.remoteId, [...(remoteMembers.get(f.remoteId) ?? []), rejoined]);
    await expect(context.run({ ...rejoined, clerkOrganizationId: f.remoteId }, () => requirePermission("organization.read")))
      .rejects.toHaveProperty("digest", "NEXT_HTTP_ERROR_FALLBACK;404");
    expect((await f.as(0, getStaffWorkspace)).members.find((member) => member.membershipId === rejoined.membershipId)?.role).toBeNull();
    expect(await f.as(0, () => manageStaff({ operation: "role", membershipId: rejoined.membershipId, role: "viewer" }))).toEqual({ status: "success" });
    expect(await context.run({ ...rejoined, clerkOrganizationId: f.remoteId }, () => requirePermission("organization.read"))).toMatchObject({ membershipId: rejoined.membershipId });
  });

  it("leaves grants unchanged after a failed remote removal and permits safe retry", async () => {
    const f = await fixture();
    mocks.removeStaff.mockRejectedValueOnce(new Error("timeout"));
    await expect(f.as(0, () => manageStaff({ operation: "deactivate", membershipId: f.members[2].membershipId }))).rejects.toThrow("timeout");
    expect(await f.as(2, () => requirePermission("organization.read"))).toBeTruthy();
    expect(await f.as(0, () => manageStaff({ operation: "deactivate", membershipId: f.members[2].membershipId }))).toEqual({ status: "success" });
  });
});
