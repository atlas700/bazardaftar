import "server-only";

import { clerkClient } from "@clerk/nextjs/server";
import { unstable_rethrow } from "next/navigation";

export async function getStaffMemberships(organizationId: string) {
  const client = await clerkClient();
  const { data, totalCount } = await client.organizations.getOrganizationMembershipList({ organizationId, limit: 100 });
  // shortcut: the pilot uses Clerk's included member cap; fail closed if a full list needs pagination.
  if (data.length !== totalCount || new Set(data.map((member) => member.id)).size !== data.length) {
    throw new Error("Incomplete membership list.");
  }
  return data.map((member) => {
    if (member.organization.id !== organizationId || !member.publicUserData?.userId || !member.id) {
      throw new Error("Invalid membership.");
    }
    return { membershipId: member.id, userId: member.publicUserData.userId,
      identifier: member.publicUserData.identifier };
  });
}

export async function getStaffInvitations(organizationId: string) {
  const client = await clerkClient();
  const { data, totalCount } = await client.organizations.getOrganizationInvitationList({
    organizationId, status: ["pending"], limit: 100,
  });
  if (data.length !== totalCount || data.some((invitation) => invitation.organizationId !== organizationId)) {
    throw new Error("Incomplete invitation list.");
  }
  return data.map((invitation) => ({ id: invitation.id, emailAddress: invitation.emailAddress,
    expiresAt: new Date(invitation.expiresAt).toISOString() }));
}

export async function inviteStaff(organizationId: string, emailAddress: string) {
  const client = await clerkClient();
  const invitation = await client.organizations.createOrganizationInvitation({
    organizationId, emailAddress, role: "org:member", expiresInDays: 30,
  });
  return invitation.id;
}

export async function addStaff(organizationId: string, userId: string) {
  const client = await clerkClient();
  const lookup = async () => {
    const { data } = await client.organizations.getOrganizationMembershipList({ organizationId, userId: [userId], limit: 1 });
    return data.some((member) => member.organization.id === organizationId && member.publicUserData?.userId === userId);
  };
  if (await lookup()) return;
  try {
    await client.organizations.createOrganizationMembership({ organizationId, userId, role: "org:member" });
  } catch (error) {
    unstable_rethrow(error);
    // Recover an ambiguous create without granting any local business role.
    if (!await lookup()) throw error;
  }
}

export async function removeStaff(organizationId: string, userId: string) {
  const client = await clerkClient();
  await client.organizations.deleteOrganizationMembership({ organizationId, userId });
}

export async function revokeStaffInvitation(organizationId: string, invitationId: string) {
  const client = await clerkClient();
  await client.organizations.revokeOrganizationInvitation({ organizationId, invitationId });
}

export async function getStaffAccessOrganizations(userId: string) {
  const client = await clerkClient();
  const { data, totalCount } = await client.users.getOrganizationMembershipList({ userId, limit: 100 });
  if (data.length !== totalCount || data.some((member) => member.publicUserData?.userId !== userId)) {
    throw new Error("Incomplete membership list.");
  }
  return data.map((member) => ({ id: member.organization.id, name: member.organization.name }));
}
