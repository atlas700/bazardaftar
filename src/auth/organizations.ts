import "server-only";
import { safeServerError } from "@/diagnostics/server";

import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { unstable_rethrow } from "next/navigation";

export type ActiveOrganizationMembership = {
  userId: string;
  clerkOrganizationId: string;
  membershipId: string;
};

export async function getActiveOrganizationMembership(): Promise<ActiveOrganizationMembership | null> {
  try {
    const { isAuthenticated, userId, orgId } = await auth();
    if (!isAuthenticated || !orgId) return null;

    const client = await clerkClient();
    const { data } = await client.organizations.getOrganizationMembershipList({
      organizationId: orgId,
      userId: [userId],
      limit: 1,
    });
    const membership = data[0];
    if (
      membership?.organization.id !== orgId ||
      membership.publicUserData?.userId !== userId
    ) {
      return null;
    }

    return { userId, clerkOrganizationId: orgId, membershipId: membership.id };
  } catch (error) {
    unstable_rethrow(error);
    if (isClerkAPIResponseError(error) && error.status === 404) return null;
    throw safeServerError("Unable to verify organization membership.", error);
  }
}
