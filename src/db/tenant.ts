import "server-only";
import { safeServerError } from "@/diagnostics/server";

import { eq } from "drizzle-orm";
import { getActiveOrganizationMembership } from "@/auth/organizations";
import { db } from "./index";
import { organizations } from "./schema";

export type TenantContext = {
  userId: string;
  organizationId: string;
  membershipId: string;
};

export async function getTenantContext(): Promise<TenantContext | null> {
  const membership = await getActiveOrganizationMembership();
  if (!membership) return null;

  try {
    const [organization] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.clerkOrganizationId, membership.clerkOrganizationId))
      .limit(1);

    if (!organization) return null;
    return {
      userId: membership.userId,
      organizationId: organization.id,
      membershipId: membership.membershipId,
    };
  } catch (error) {
    throw safeServerError("Unable to resolve organization context.", error);
  }
}
