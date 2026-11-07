import "server-only";

import { and, eq, isNull, or } from "drizzle-orm";
import type { ActiveOrganizationMembership } from "@/auth/organizations";
import { db } from "./index";
import { appendAudit } from "./audit";
import { organizationOnboarding, organizationRoleAssignments, organizations, organizationSettings } from "./schema";

export type OrganizationDetails = Omit<typeof organizationSettings.$inferInsert, "organizationId">;
export type OnboardingRequest = typeof organizationOnboarding.$inferSelect;

export async function getOnboardingRequest(userId: string) {
  const [request] = await db.select().from(organizationOnboarding)
    .where(eq(organizationOnboarding.userId, userId)).limit(1);
  return request ?? null;
}

export async function reserveOnboarding(userId: string, details: OrganizationDetails) {
  await db.insert(organizationOnboarding).values({ userId, ...details })
    .onConflictDoNothing({ target: organizationOnboarding.userId });
  const request = await getOnboardingRequest(userId);
  if (!request) throw new Error("Onboarding reservation unavailable.");
  return request;
}

export async function pinOnboardingOrganization(request: OnboardingRequest, clerkOrganizationId: string) {
  const [pinned] = await db.update(organizationOnboarding).set({ clerkOrganizationId })
    .where(and(
      eq(organizationOnboarding.userId, request.userId),
      eq(organizationOnboarding.id, request.id),
      or(isNull(organizationOnboarding.clerkOrganizationId), eq(organizationOnboarding.clerkOrganizationId, clerkOrganizationId)),
    )).returning();
  if (!pinned) throw new Error("Onboarding organization conflict.");
  return pinned;
}

export async function completeOnboarding(request: OnboardingRequest, membership: ActiveOrganizationMembership): Promise<boolean> {
  const { clerkOrganizationId, name, businessType, timezone, baseCurrency, locale } = request;
  if (!clerkOrganizationId) throw new Error("Onboarding organization unavailable.");
  if (membership.clerkOrganizationId !== clerkOrganizationId || membership.userId !== request.userId || !membership.membershipId) return false;

  return db.transaction(async (tx) => {
    // Serialize bootstrap even when concurrent callers hold the same stale request.
    const [saved] = await tx.select().from(organizationOnboarding).where(and(
      eq(organizationOnboarding.userId, request.userId),
      eq(organizationOnboarding.id, request.id),
      eq(organizationOnboarding.clerkOrganizationId, clerkOrganizationId),
    )).for("update");
    if (!saved || (saved.ownerMembershipId && saved.ownerMembershipId !== membership.membershipId)) return false;

    await tx.insert(organizations).values({ clerkOrganizationId })
      .onConflictDoNothing({ target: organizations.clerkOrganizationId });
    const [organization] = await tx.select({ id: organizations.id }).from(organizations)
      .where(eq(organizations.clerkOrganizationId, clerkOrganizationId)).limit(1);
    if (!organization) throw new Error("Organization mapping unavailable.");

    const [createdSettings] = await tx.insert(organizationSettings)
      .values({ organizationId: organization.id, name, businessType, timezone, baseCurrency, locale })
      .onConflictDoNothing({ target: organizationSettings.organizationId }).returning();
    const [settings] = await tx.select().from(organizationSettings)
      .where(eq(organizationSettings.organizationId, organization.id)).limit(1);
    if (!settings || settings.name !== name || settings.businessType !== businessType ||
      settings.timezone !== timezone || settings.baseCurrency !== baseCurrency || settings.locale !== locale) {
      throw new Error("Organization settings conflict.");
    }
    const actor = { organizationId: organization.id, userId: membership.userId, membershipId: membership.membershipId };
    if (createdSettings) await appendAudit(tx, actor, { entityType: "organization", entityId: organization.id, action: "create", requestId: request.id, after: settings });

    if (!saved.ownerMembershipId) {
      const [grant] = await tx.insert(organizationRoleAssignments).values({
        organizationId: organization.id, membershipId: membership.membershipId, userId: membership.userId, role: "owner",
      }).onConflictDoNothing({ target: [organizationRoleAssignments.organizationId, organizationRoleAssignments.membershipId] }).returning();
      await tx.update(organizationOnboarding).set({ ownerMembershipId: membership.membershipId })
        .where(eq(organizationOnboarding.userId, request.userId));
      if (grant) await appendAudit(tx, actor, { entityType: "staff", entityId: membership.membershipId, action: "role", requestId: request.id, after: grant });
    }
    return true;
  });
}
