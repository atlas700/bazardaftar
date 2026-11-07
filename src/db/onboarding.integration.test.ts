import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ requireSession: vi.fn(), getActiveOrganizationMembership: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/auth/server", () => auth);
vi.mock("@/auth/organizations", () => auth);
vi.mock("@/env", () => ({ env: {
  databaseUrl: process.env.AFCS_TEST_DATABASE_URL ?? "postgresql://unused:unused@127.0.0.1:1/unused",
  nodeEnvironment: "test",
} }));

import { db } from "./index";
import { cleanupAuditFixtures } from "./audit-fixtures.test-support";
import { requirePermission } from "./authorization";
import { getWorkspaceSummary } from "./workspace";
import { completeOnboarding, getOnboardingRequest, pinOnboardingOrganization, reserveOnboarding, type OnboardingRequest } from "./onboarding";
import { organizationOnboarding, organizationRoleAssignments, organizations, organizationSettings } from "./schema";

const details = { name: "Task 09 fixture", businessType: "Wholesaler", timezone: "Asia/Kabul", baseCurrency: "AFN", locale: "en-US" };
const userIds: string[] = [];
const remoteIds: string[] = [];
function fixture() {
  const token = randomUUID();
  const userId = `task09_user_${token}`;
  const remoteId = `task09_org_${token}`;
  userIds.push(userId);
  remoteIds.push(remoteId);
  return { userId, remoteId };
}

function membership(request: OnboardingRequest) {
  return { userId: request.userId, clerkOrganizationId: request.clerkOrganizationId ?? "missing", membershipId: `member_${request.id}` };
}

describe.skipIf(!process.env.AFCS_TEST_DATABASE_URL)("onboarding and authorization against isolated PostgreSQL", () => {
  beforeAll(async () => {
    const result = await db.execute<{ database: string }>(sql`select current_database() as database`);
    if (result.rows[0]?.database !== "afcs_task07_verify") throw new Error("Use only the isolated afcs_task07_verify database.");
  });

  afterAll(async () => {
    if (remoteIds.length) {
      const rows = await db.select({ id: organizations.id }).from(organizations).where(inArray(organizations.clerkOrganizationId, remoteIds));
      if (rows.length) {
        const ids = rows.map((row) => row.id);
        await cleanupAuditFixtures(ids);
        await db.delete(organizationRoleAssignments).where(inArray(organizationRoleAssignments.organizationId, ids));
        await db.delete(organizationSettings).where(inArray(organizationSettings.organizationId, ids));
      }
      await db.delete(organizations).where(inArray(organizations.clerkOrganizationId, remoteIds));
    }
    if (userIds.length) await db.delete(organizationOnboarding).where(inArray(organizationOnboarding.userId, userIds));
  });

  it("switches workspace identity and role using current membership, then denies a revoked grant", async () => {
    const a = fixture();
    const b = fixture();
    const first = await pinOnboardingOrganization(await reserveOnboarding(a.userId, { ...details, name: "Business A" }), a.remoteId);
    const second = await pinOnboardingOrganization(await reserveOnboarding(b.userId, { ...details, name: "Business B" }), b.remoteId);
    await completeOnboarding(first, membership(first));
    await completeOnboarding(second, membership(second));
    const [mapping] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.clerkOrganizationId, b.remoteId));
    const secondMembership = { userId: a.userId, clerkOrganizationId: b.remoteId, membershipId: `staff_${randomUUID()}` };
    await db.insert(organizationRoleAssignments).values({ organizationId: mapping.id, userId: a.userId, membershipId: secondMembership.membershipId, role: "viewer" });
    auth.requireSession.mockResolvedValue({ userId: a.userId });
    auth.getActiveOrganizationMembership.mockResolvedValue(membership(first));
    expect(await getWorkspaceSummary()).toEqual({ name: "Business A", role: "owner" });
    auth.getActiveOrganizationMembership.mockResolvedValue(secondMembership);
    expect(await getWorkspaceSummary()).toEqual({ name: "Business B", role: "viewer" });
    await db.delete(organizationRoleAssignments).where(and(eq(organizationRoleAssignments.organizationId, mapping.id), eq(organizationRoleAssignments.userId, a.userId)));
    await expect(getWorkspaceSummary()).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    auth.getActiveOrganizationMembership.mockResolvedValue(membership(first));
    expect(await getWorkspaceSummary()).toEqual({ name: "Business A", role: "owner" });
  });

  it("reserves one immutable setup across concurrent submissions", async () => {
    const { userId } = fixture();
    const requests = await Promise.all(Array.from({ length: 6 }, () => reserveOnboarding(userId, details)));
    expect(new Set(requests.map((request) => request.id)).size).toBe(1);
    expect(requests[0].createdAt).toBeInstanceOf(Date);
    expect(await reserveOnboarding(userId, { ...details, name: "Changed details" })).toEqual(requests[0]);
  });

  it("reads only the selected creator and never provisions during a read", async () => {
    const a = fixture();
    const b = fixture();
    const request = await reserveOnboarding(a.userId, details);
    expect(await getOnboardingRequest(a.userId)).toEqual(request);
    expect(await getOnboardingRequest(b.userId)).toBeNull();
  });

  it("pins the remote ID once and rejects attempts to replace it", async () => {
    const { userId, remoteId } = fixture();
    const request = await reserveOnboarding(userId, details);
    const pinned = await pinOnboardingOrganization(request, remoteId);
    expect(await pinOnboardingOrganization(request, remoteId)).toEqual(pinned);
    await expect(pinOnboardingOrganization(request, "task09_org_other")).rejects.toThrow("conflict");
    expect((await getOnboardingRequest(userId))?.clerkOrganizationId).toBe(remoteId);
  });

  it("rejects pinning another creator's request and duplicate remote ownership", async () => {
    const a = fixture();
    const b = fixture();
    const requestA = await reserveOnboarding(a.userId, details);
    const requestB = await reserveOnboarding(b.userId, details);
    await expect(pinOnboardingOrganization({ ...requestA, userId: b.userId }, a.remoteId)).rejects.toThrow("conflict");
    await pinOnboardingOrganization(requestA, a.remoteId);
    await expect(pinOnboardingOrganization(requestB, a.remoteId)).rejects.toThrow();
  });

  it("commits one mapping, settings row, and owner grant across concurrent/repeated completion", async () => {
    const { userId, remoteId } = fixture();
    const request = await pinOnboardingOrganization(await reserveOnboarding(userId, details), remoteId);
    expect(await Promise.all(Array.from({ length: 6 }, () => completeOnboarding(request, membership(request))))).toEqual(Array(6).fill(true));
    const mappings = await db.select().from(organizations).where(eq(organizations.clerkOrganizationId, remoteId));
    expect(mappings).toHaveLength(1);
    expect(mappings[0].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await db.select().from(organizationSettings).where(eq(organizationSettings.organizationId, mappings[0].id)))
      .toEqual([{ organizationId: mappings[0].id, ...details }]);
    const grants = await db.select().from(organizationRoleAssignments).where(eq(organizationRoleAssignments.organizationId, mappings[0].id));
    expect(grants).toEqual([{ organizationId: mappings[0].id, membershipId: membership(request).membershipId,
      userId, role: "owner", createdAt: expect.any(Date) }]);
    expect((await getOnboardingRequest(userId))?.ownerMembershipId).toBe(membership(request).membershipId);
  });

  it("rolls back the new mapping when settings fail and can recover with the pinned ID", async () => {
    const { userId, remoteId } = fixture();
    const request = await pinOnboardingOrganization(await reserveOnboarding(userId, details), remoteId);
    await expect(completeOnboarding({ ...request, baseCurrency: "USD" }, membership(request))).rejects.toThrow();
    expect(await db.select().from(organizations).where(eq(organizations.clerkOrganizationId, remoteId))).toHaveLength(0);
    expect((await getOnboardingRequest(userId))?.clerkOrganizationId).toBe(remoteId);
    await completeOnboarding(request, membership(request));
    expect(await db.select().from(organizations).where(eq(organizations.clerkOrganizationId, remoteId))).toHaveLength(1);
  });

  it("does not overwrite existing business settings on a retry", async () => {
    const { userId, remoteId } = fixture();
    const request = await pinOnboardingOrganization(await reserveOnboarding(userId, details), remoteId);
    await completeOnboarding(request, membership(request));
    await expect(completeOnboarding({ ...request, name: "Overwrite attempted" }, membership(request))).rejects.toThrow("conflict");
    const [mapping] = await db.select().from(organizations).where(eq(organizations.clerkOrganizationId, remoteId));
    const [settings] = await db.select().from(organizationSettings).where(eq(organizationSettings.organizationId, mapping.id));
    expect(settings.name).toBe(details.name);
  });

  it("does not create a local business without a pinned remote organization", async () => {
    const { userId } = fixture();
    const request = await reserveOnboarding(userId, details);
    await expect(completeOnboarding(request, membership(request))).rejects.toThrow("unavailable");
  });

  it("rolls back settings, mapping, and bootstrap marker when the role insert fails", async () => {
    const { userId, remoteId } = fixture();
    const request = await pinOnboardingOrganization(await reserveOnboarding(userId, details), remoteId);
    await expect(completeOnboarding(request, { ...membership(request), membershipId: " " })).rejects.toThrow();
    expect(await db.select().from(organizations).where(eq(organizations.clerkOrganizationId, remoteId))).toHaveLength(0);
    expect((await getOnboardingRequest(userId))?.ownerMembershipId).toBeNull();
    expect(await completeOnboarding(request, membership(request))).toBe(true);
  });

  it("keeps a Task 09 business denied until explicit verified setup resume bootstraps its owner", async () => {
    const { userId, remoteId } = fixture();
    const request = await pinOnboardingOrganization(await reserveOnboarding(userId, details), remoteId);
    const [mapping] = await db.insert(organizations).values({ clerkOrganizationId: remoteId }).returning();
    await db.insert(organizationSettings).values({ organizationId: mapping.id, ...details });
    auth.requireSession.mockResolvedValue({ userId });
    auth.getActiveOrganizationMembership.mockResolvedValue(membership(request));
    await expect(requirePermission("organization.read")).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    expect((await getOnboardingRequest(userId))?.ownerMembershipId).toBeNull();
    expect(await completeOnboarding(request, membership(request))).toBe(true);
    expect(await requirePermission("ownership.manage")).toEqual({ organizationId: mapping.id,
      userId, membershipId: membership(request).membershipId });
  });

  it("never restores removed/downgraded grants or promotes a rejoined creator using a stale setup", async () => {
    const { userId, remoteId } = fixture();
    const request = await pinOnboardingOrganization(await reserveOnboarding(userId, details), remoteId);
    await completeOnboarding(request, membership(request));
    const grant = eq(organizationRoleAssignments.membershipId, membership(request).membershipId);
    await db.update(organizationRoleAssignments).set({ role: "viewer" }).where(grant);
    expect(await completeOnboarding(request, membership(request))).toBe(true);
    expect((await db.select().from(organizationRoleAssignments).where(grant))[0].role).toBe("viewer");
    await db.delete(organizationRoleAssignments).where(grant);
    expect(await completeOnboarding(request, membership(request))).toBe(true);
    expect(await db.select().from(organizationRoleAssignments).where(grant)).toHaveLength(0);
    expect(await completeOnboarding(request, { ...membership(request), membershipId: "member_rejoined" })).toBe(false);
    expect((await getOnboardingRequest(userId))?.ownerMembershipId).toBe(membership(request).membershipId);
  });

  it("allows only one membership to win concurrent first-owner bootstrap", async () => {
    const { userId, remoteId } = fixture();
    const request = await pinOnboardingOrganization(await reserveOnboarding(userId, details), remoteId);
    const outcomes = await Promise.all([
      completeOnboarding(request, membership(request)),
      completeOnboarding(request, { ...membership(request), membershipId: "member_other" }),
    ]);
    expect(outcomes.filter(Boolean)).toHaveLength(1);
    const [mapping] = await db.select().from(organizations).where(eq(organizations.clerkOrganizationId, remoteId));
    const grants = await db.select().from(organizationRoleAssignments).where(eq(organizationRoleAssignments.organizationId, mapping.id));
    expect(grants).toHaveLength(1);
    expect((await getOnboardingRequest(userId))?.ownerMembershipId).toBe(grants[0].membershipId);
  });

  it("rejects mismatched bootstrap identities before provisioning local data", async () => {
    const { userId, remoteId } = fixture();
    const request = await pinOnboardingOrganization(await reserveOnboarding(userId, details), remoteId);
    expect(await completeOnboarding(request, { ...membership(request), userId: "another_user" })).toBe(false);
    expect(await completeOnboarding(request, { ...membership(request), clerkOrganizationId: "another_org" })).toBe(false);
    expect(await completeOnboarding({ ...request, id: randomUUID() }, membership(request))).toBe(false);
    expect(await db.select().from(organizations).where(eq(organizations.clerkOrganizationId, remoteId))).toHaveLength(0);
  });

  it("enforces role, identity, uniqueness, and organization constraints", async () => {
    const { userId, remoteId } = fixture();
    const request = await pinOnboardingOrganization(await reserveOnboarding(userId, details), remoteId);
    await completeOnboarding(request, membership(request));
    const [mapping] = await db.select().from(organizations).where(eq(organizations.clerkOrganizationId, remoteId));
    await expect(db.insert(organizationRoleAssignments).values({ organizationId: mapping.id, userId,
      membershipId: membership(request).membershipId, role: "admin" })).rejects.toThrow();
    await expect(db.execute(sql`insert into organization_role_assignments (organization_id, membership_id, user_id, role)
      values (${mapping.id}, ${"member_invalid"}, ${userId}, ${"superuser"})`)).rejects.toThrow();
    await expect(db.insert(organizationRoleAssignments).values({ organizationId: randomUUID(), userId,
      membershipId: "member_orphan", role: "viewer" })).rejects.toThrow();
  });

  it("scopes actual guard reads to all three verified identities, including after removal and rejoin", async () => {
    const a = fixture();
    const b = fixture();
    const request = await pinOnboardingOrganization(await reserveOnboarding(a.userId, details), a.remoteId);
    const other = await pinOnboardingOrganization(await reserveOnboarding(b.userId, details), b.remoteId);
    await completeOnboarding(request, membership(request));
    await completeOnboarding(other, membership(other));
    const [mapping] = await db.select().from(organizations).where(eq(organizations.clerkOrganizationId, a.remoteId));
    auth.requireSession.mockResolvedValue({ userId: a.userId });
    auth.getActiveOrganizationMembership.mockResolvedValue(membership(request));
    expect(await requirePermission("ownership.manage")).toEqual({ userId: a.userId,
      membershipId: membership(request).membershipId, organizationId: mapping.id });
    const deny = { digest: "NEXT_HTTP_ERROR_FALLBACK;404" };
    auth.getActiveOrganizationMembership.mockResolvedValue({ ...membership(request), clerkOrganizationId: b.remoteId });
    await expect(requirePermission("ownership.manage")).rejects.toMatchObject(deny);
    auth.requireSession.mockResolvedValue({ userId: b.userId });
    auth.getActiveOrganizationMembership.mockResolvedValue({ ...membership(request), userId: b.userId });
    await expect(requirePermission("ownership.manage")).rejects.toMatchObject(deny);
    auth.requireSession.mockResolvedValue({ userId: a.userId });
    auth.getActiveOrganizationMembership.mockResolvedValue({ ...membership(request), membershipId: "member_rejoined" });
    await expect(requirePermission("ownership.manage")).rejects.toMatchObject(deny);
    auth.getActiveOrganizationMembership.mockResolvedValue(null);
    await expect(requirePermission("ownership.manage")).rejects.toMatchObject(deny);
  });
});
