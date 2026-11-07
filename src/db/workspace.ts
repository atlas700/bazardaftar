import "server-only";
import { safeServerError } from "@/diagnostics/server";

import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { hasPermission } from "@/auth/permissions";
import { requirePermission } from "./authorization";
import { db } from "./index";
import { organizationRoleAssignments, organizationSettings } from "./schema";

export async function getWorkspaceSummary() {
  try {
    const tenant = await requirePermission("organization.read");
    const [workspace] = await db.select({ name: organizationSettings.name, role: organizationRoleAssignments.role })
      .from(organizationRoleAssignments)
      .innerJoin(organizationSettings, eq(organizationSettings.organizationId, organizationRoleAssignments.organizationId))
      .where(and(
        eq(organizationRoleAssignments.organizationId, tenant.organizationId),
        eq(organizationRoleAssignments.membershipId, tenant.membershipId),
        eq(organizationRoleAssignments.userId, tenant.userId),
      )).limit(1);
    if (!workspace || !hasPermission(workspace.role, "organization.read")) notFound();
    return workspace;
  } catch (error) {
    throw safeServerError("Workspace unavailable.", error);
  }
}
