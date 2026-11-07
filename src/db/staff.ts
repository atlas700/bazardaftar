import "server-only";
import { safeServerError } from "@/diagnostics/server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { z } from "zod";
import { businessRoles, hasPermission } from "@/auth/permissions";
import { addStaff, getStaffInvitations, getStaffMemberships, inviteStaff, removeStaff, revokeStaffInvitation } from "@/auth/staff";
import { requirePermission } from "./authorization";
import { db } from "./index";
import { appendAudit } from "./audit";
import { organizationRoleAssignments, organizations } from "./schema";

export type StaffState =
  | { status: "idle" | "success" | "conflict" | "last-owner" | "owner-required" }
  | { status: "invalid"; fields: string[] }
  | { status: "error"; correlationId: string };

const resourceId = z.string().trim().min(1).max(200);
const commandSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("invite"), emailAddress: z.email().max(254) }),
  z.object({ operation: z.literal("add"), userId: z.string().regex(/^user_[A-Za-z0-9_]+$/).max(200) }),
  z.object({ operation: z.literal("role"), membershipId: resourceId, role: z.enum(businessRoles) }),
  z.object({ operation: z.literal("deactivate"), membershipId: resourceId }),
  z.object({ operation: z.literal("revoke"), invitationId: resourceId }),
]);

export async function getStaffWorkspace() {
  try {
    const tenant = await requirePermission("staff.read");
    const [organization] = await db.select().from(organizations).where(eq(organizations.id, tenant.organizationId)).limit(1);
    if (!organization) notFound();
    const [members, invitations, assignments] = await Promise.all([
      getStaffMemberships(organization.clerkOrganizationId),
      getStaffInvitations(organization.clerkOrganizationId),
      db.select().from(organizationRoleAssignments).where(eq(organizationRoleAssignments.organizationId, tenant.organizationId)),
    ]);
    const actor = assignments.find((row) => row.membershipId === tenant.membershipId && row.userId === tenant.userId);
    if (!members.some((member) => member.membershipId === tenant.membershipId && member.userId === tenant.userId) ||
      !actor || !hasPermission(actor.role, "staff.read")) notFound();
    return { canManageOwners: hasPermission(actor.role, "ownership.manage"), members: members.map((member) => ({
      ...member, role: assignments.find((row) => row.membershipId === member.membershipId && row.userId === member.userId)?.role ?? null,
    })), invitations };
  } catch (error) {
    throw safeServerError("Staff access unavailable.", error);
  }
}

export async function manageStaff(input: unknown): Promise<StaffState> {
  const tenant = await requirePermission("staff.manage");
  const parsed = commandSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid", fields: [...new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? "operation")))] };
  const command = parsed.data;
  const requestId = randomUUID();
  const entityId = "membershipId" in command ? command.membershipId : "userId" in command ? command.userId
    : "invitationId" in command ? command.invitationId : tenant.organizationId;
  return db.transaction(async (tx): Promise<StaffState> => {
    // Every staff mutation uses this lock; recheck the actor after waiting for it.
    // NO KEY UPDATE still serializes mutations while allowing the independent audit intent's tenant FK check.
    const [organization] = await tx.select().from(organizations).where(eq(organizations.id, tenant.organizationId)).for("no key update");
    if (!organization) notFound();
    const members = await getStaffMemberships(organization.clerkOrganizationId);
    const assignments = await tx.select().from(organizationRoleAssignments).where(eq(organizationRoleAssignments.organizationId, tenant.organizationId));
    const actor = assignments.find((row) => row.membershipId === tenant.membershipId && row.userId === tenant.userId);
    if (!members.some((member) => member.membershipId === tenant.membershipId && member.userId === tenant.userId) ||
      !actor || !hasPermission(actor.role, "staff.manage")) notFound();
    // Commit intent only after validation, immediately before Clerk, to retain evidence if the completion rolls back.
    const recordRequest = () => appendAudit(db, tenant, { entityType: "staff", entityId, action: command.operation, outcome: "requested", requestId });

    if (command.operation === "invite") {
      const invitations = await getStaffInvitations(organization.clerkOrganizationId);
      if (invitations.some((invitation) => invitation.emailAddress.toLowerCase() === command.emailAddress.toLowerCase() &&
        Date.parse(invitation.expiresAt) > Date.now())) return { status: "success" };
      await recordRequest();
      const invitationId = await inviteStaff(organization.clerkOrganizationId, command.emailAddress);
      await appendAudit(tx, tenant, { entityType: "staff", entityId: invitationId, action: "invite", requestId, after: { invitationId, role: "org:member" } });
    } else if (command.operation === "add") {
      if (members.some((member) => member.userId === command.userId)) return { status: "success" };
      await recordRequest();
      await addStaff(organization.clerkOrganizationId, command.userId);
      await appendAudit(tx, tenant, { entityType: "staff", entityId, action: "add", requestId, after: { userId: command.userId } });
    } else if (command.operation === "revoke") {
      const invitations = await getStaffInvitations(organization.clerkOrganizationId);
      if (!invitations.some((invitation) => invitation.id === command.invitationId)) return { status: "conflict" };
      await recordRequest();
      await revokeStaffInvitation(organization.clerkOrganizationId, command.invitationId);
      await appendAudit(tx, tenant, { entityType: "staff", entityId, action: "revoke", requestId, before: { invitationId: command.invitationId } });
    } else {
      const target = members.find((member) => member.membershipId === command.membershipId);
      if (!target) return { status: "conflict" };
      if (assignments.some((row) => row.membershipId === target.membershipId && row.userId !== target.userId)) return { status: "conflict" };
      const current = assignments.find((row) => row.membershipId === target.membershipId && row.userId === target.userId);
      if ((current?.role === "owner" || (command.operation === "role" && command.role === "owner")) &&
        !hasPermission(actor.role, "ownership.manage")) return { status: "owner-required" };
      if (current?.role === "owner" && (command.operation === "deactivate" || command.role !== "owner")) {
        const owners = members.filter((member) => assignments.some((row) => row.membershipId === member.membershipId &&
          row.userId === member.userId && row.role === "owner"));
        if (owners.length < 2) return { status: "last-owner" };
      }
      if (command.operation === "deactivate") {
        // Clerk revocation is authoritative; retain the old grant as history, bound to its old membership ID.
        await recordRequest();
        await removeStaff(organization.clerkOrganizationId, target.userId);
        await appendAudit(tx, tenant, { entityType: "staff", entityId, action: "deactivate", requestId, before: { ...target, role: current?.role ?? null } });
      } else {
        if (current?.role === command.role) return { status: "success" };
        const saved = await tx.insert(organizationRoleAssignments).values({ organizationId: tenant.organizationId,
          membershipId: target.membershipId, userId: target.userId, role: command.role }).onConflictDoUpdate({
          target: [organizationRoleAssignments.organizationId, organizationRoleAssignments.membershipId],
          set: { role: command.role },
          setWhere: and(eq(organizationRoleAssignments.userId, target.userId), eq(organizationRoleAssignments.organizationId, tenant.organizationId)),
        }).returning({ membershipId: organizationRoleAssignments.membershipId });
        if (saved.length !== 1) return { status: "conflict" };
        await appendAudit(tx, tenant, { entityType: "staff", entityId, action: "role", requestId, before: current ?? null,
          after: { membershipId: target.membershipId, userId: target.userId, role: command.role } });
      }
    }
    return { status: "success" };
  });
}
