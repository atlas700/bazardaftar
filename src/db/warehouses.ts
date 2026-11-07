import "server-only";
import { safeServerError } from "@/diagnostics/server";

import { and, eq } from "drizzle-orm";
import { notFound, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { hasPermission } from "@/auth/permissions";
import { getActiveOrganizationMembership } from "@/auth/organizations";
import { localIdSchema } from "@/domain/validation";
import { requirePermission } from "./authorization";
import { db } from "./index";
import { appendAudit } from "./audit";
import { organizationRoleAssignments, organizations, warehouses } from "./schema";

export type WarehouseState =
  | { status: "idle" | "success" | "exists" | "conflict" }
  | { status: "invalid"; fields: string[] }
  | { status: "error"; correlationId: string };
export type Warehouse = Pick<typeof warehouses.$inferSelect, "id" | "name" | "location" | "isActive">;

const details = {
  name: z.string().trim().min(1).max(80),
  location: z.string().trim().max(200).transform((value) => value || null).nullable().default(null),
};
const commandSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("create-warehouse"), ...details }),
  z.object({ operation: z.literal("update-warehouse"), id: localIdSchema, ...details }),
  z.object({ operation: z.literal("deactivate-warehouse"), id: localIdSchema }),
  z.object({ operation: z.literal("activate-warehouse"), id: localIdSchema }),
]);
const selection = { id: warehouses.id, name: warehouses.name, location: warehouses.location, isActive: warehouses.isActive };

export async function getWarehouseWorkspace() {
  try {
    const tenant = await requirePermission("organization.read");
    const [[warehouse], [actor]] = await Promise.all([
      db.select(selection).from(warehouses).where(eq(warehouses.organizationId, tenant.organizationId)).limit(1),
      db.select({ role: organizationRoleAssignments.role }).from(organizationRoleAssignments).where(and(
        eq(organizationRoleAssignments.organizationId, tenant.organizationId),
        eq(organizationRoleAssignments.membershipId, tenant.membershipId), eq(organizationRoleAssignments.userId, tenant.userId),
      )).limit(1),
    ]);
    if (!actor || !hasPermission(actor.role, "organization.read")) notFound();
    return { organizationId: tenant.organizationId, warehouse: warehouse ?? null, canManage: hasPermission(actor.role, "organization.manage") };
  } catch (error) {
    throw safeServerError("Warehouse unavailable.", error);
  }
}

// Selection only; purchase/receipt writes must recheck active ownership in their transaction.
export async function getActiveWarehouse(): Promise<Warehouse | null> {
  try {
    const tenant = await requirePermission("organization.read");
    const [warehouse] = await db.select(selection).from(warehouses).where(and(
      eq(warehouses.organizationId, tenant.organizationId), eq(warehouses.isActive, true),
    )).limit(1);
    return warehouse ?? null;
  } catch (error) {
    throw safeServerError("Warehouse unavailable.", error);
  }
}

export async function manageWarehouse(input: unknown): Promise<WarehouseState> {
  const tenant = await requirePermission("organization.manage");
  const parsed = commandSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid", fields: [...new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? "operation")))] };
  const command = parsed.data;
  try {
    return await db.transaction(async (tx): Promise<WarehouseState> => {
      // Share staff's lock, then recheck provider identity and local grants on this connection.
      const [organization] = await tx.select({ id: organizations.id, clerkOrganizationId: organizations.clerkOrganizationId })
        .from(organizations).where(eq(organizations.id, tenant.organizationId)).for("update");
      const current = await getActiveOrganizationMembership();
      const [actor] = await tx.select({ role: organizationRoleAssignments.role }).from(organizationRoleAssignments).where(and(
        eq(organizationRoleAssignments.organizationId, tenant.organizationId),
        eq(organizationRoleAssignments.membershipId, tenant.membershipId), eq(organizationRoleAssignments.userId, tenant.userId),
      )).limit(1);
      if (!organization || !current || current.clerkOrganizationId !== organization.clerkOrganizationId ||
        current.membershipId !== tenant.membershipId || current.userId !== tenant.userId ||
        !actor || !hasPermission(actor.role, "organization.manage")) notFound();
      if (command.operation === "create-warehouse") {
        const [warehouse] = await tx.insert(warehouses).values({ organizationId: tenant.organizationId, name: command.name, location: command.location }).returning();
        await appendAudit(tx, tenant, { entityType: "warehouse", entityId: warehouse.id, action: "create", after: warehouse });
      } else {
        const changingStatus = command.operation !== "update-warehouse";
        const changes = command.operation === "update-warehouse" ? { name: command.name, location: command.location }
          : { isActive: command.operation === "activate-warehouse" };
        const scope = and(eq(warehouses.id, command.id),
          eq(warehouses.organizationId, tenant.organizationId),
          changingStatus ? eq(warehouses.isActive, command.operation === "deactivate-warehouse") : undefined,
        );
        const [before] = await tx.select().from(warehouses).where(scope);
        const saved = await tx.update(warehouses).set(changes).where(scope).returning();
        if (saved.length === 0) return { status: "conflict" };
        await appendAudit(tx, tenant, { entityType: "warehouse", entityId: saved[0].id, before, after: saved[0],
          action: command.operation === "update-warehouse" ? "update" : command.operation === "activate-warehouse" ? "activate" : "deactivate" });
      }
      return { status: "success" };
    });
  } catch (error) {
    unstable_rethrow(error);
    const cause = error instanceof Error ? error.cause ?? error : error;
    if (cause && typeof cause === "object" && "code" in cause && cause.code === "23505" &&
      "constraint" in cause && cause.constraint === "warehouses_one_per_organization") return { status: "exists" };
    throw error;
  }
}
