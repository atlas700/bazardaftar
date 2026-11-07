import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { notFound, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { hasPermission } from "@/auth/permissions";
import { getActiveOrganizationMembership } from "@/auth/organizations";
import { supplierTypes } from "@/domain/supplier";
import { localIdSchema } from "@/domain/validation";
import { requirePermission } from "./authorization";
import { db } from "./index";
import { organizationRoleAssignments, organizations, suppliers } from "./schema";

export type SupplierState =
  | { status: "idle" | "success" | "duplicate" | "conflict" }
  | { status: "invalid"; fields: string[] }
  | { status: "error"; correlationId: string };

const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || null).nullable().default(null);
const details = {
  name: z.string().trim().min(1).max(80),
  phone: optionalText(40).refine((value) => value === null ||
    (value.length >= 3 && /^[+0-9۰-۹٠-٩(). -]+$/.test(value) && /[0-9۰-۹٠-٩]/.test(value))),
  location: optionalText(200),
  type: z.enum(supplierTypes).nullable().default(null),
  notes: optionalText(2000),
  paymentTerms: optionalText(500),
};
const commandSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("create-supplier"), ...details }),
  z.object({ operation: z.literal("update-supplier"), id: localIdSchema, ...details }),
  z.object({ operation: z.literal("deactivate-supplier"), id: localIdSchema }),
]);
const selection = { id: suppliers.id, name: suppliers.name, phone: suppliers.phone, location: suppliers.location,
  type: suppliers.type, notes: suppliers.notes, paymentTerms: suppliers.paymentTerms, isActive: suppliers.isActive };

export async function getSuppliersWorkspace() {
  try {
    const tenant = await requirePermission("suppliers.read");
    const [records, [actor]] = await Promise.all([
      // shortcut: return the small pilot directory in full; paginate before supporting large directories.
      db.select(selection).from(suppliers).where(eq(suppliers.organizationId, tenant.organizationId)).orderBy(asc(suppliers.name)),
      db.select({ role: organizationRoleAssignments.role }).from(organizationRoleAssignments).where(and(
        eq(organizationRoleAssignments.organizationId, tenant.organizationId),
        eq(organizationRoleAssignments.membershipId, tenant.membershipId), eq(organizationRoleAssignments.userId, tenant.userId),
      )).limit(1),
    ]);
    if (!actor || !hasPermission(actor.role, "suppliers.read")) notFound();
    return { suppliers: records, canManage: hasPermission(actor.role, "suppliers.manage"), canReadBalances: hasPermission(actor.role, "supplier_balances.read") };
  } catch (error) {
    unstable_rethrow(error);
    throw new Error("Suppliers unavailable.");
  }
}

export async function getSupplier(input: unknown) {
  try {
    const tenant = await requirePermission("suppliers.read");
    const id = localIdSchema.safeParse(input);
    if (!id.success) notFound();
    const [supplier] = await db.select(selection).from(suppliers)
      .where(and(eq(suppliers.id, id.data), eq(suppliers.organizationId, tenant.organizationId))).limit(1);
    if (!supplier) notFound();
    return supplier;
  } catch (error) {
    unstable_rethrow(error);
    throw new Error("Suppliers unavailable.");
  }
}

export async function manageSupplier(input: unknown): Promise<SupplierState> {
  const tenant = await requirePermission("suppliers.manage");
  const parsed = commandSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid", fields: [...new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? "operation")))] };
  const command = parsed.data;
  try {
    return await db.transaction(async (tx): Promise<SupplierState> => {
      // Share staff's lock, then recheck provider identity and local authority on this connection.
      const [organization] = await tx.select({ id: organizations.id, clerkOrganizationId: organizations.clerkOrganizationId })
        .from(organizations).where(eq(organizations.id, tenant.organizationId)).for("update");
      const current = await getActiveOrganizationMembership();
      const [actor] = await tx.select({ role: organizationRoleAssignments.role }).from(organizationRoleAssignments).where(and(
        eq(organizationRoleAssignments.organizationId, tenant.organizationId),
        eq(organizationRoleAssignments.membershipId, tenant.membershipId), eq(organizationRoleAssignments.userId, tenant.userId),
      )).limit(1);
      if (!organization || !current || current.clerkOrganizationId !== organization.clerkOrganizationId ||
        current.membershipId !== tenant.membershipId || current.userId !== tenant.userId ||
        !actor || !hasPermission(actor.role, "suppliers.manage")) notFound();
      if (command.operation === "create-supplier") {
        const { name, phone, location, type, notes, paymentTerms } = command;
        await tx.insert(suppliers).values({ organizationId: tenant.organizationId, name, phone, location, type, notes, paymentTerms });
      } else {
        const changes = command.operation === "deactivate-supplier" ? { isActive: false } : {
          name: command.name, phone: command.phone, location: command.location, type: command.type,
          notes: command.notes, paymentTerms: command.paymentTerms,
        };
        const saved = await tx.update(suppliers).set(changes).where(and(eq(suppliers.id, command.id),
          eq(suppliers.organizationId, tenant.organizationId), eq(suppliers.isActive, true))).returning({ id: suppliers.id });
        if (saved.length === 0) return { status: "conflict" };
      }
      return { status: "success" };
    });
  } catch (error) {
    unstable_rethrow(error);
    const cause = error instanceof Error ? error.cause ?? error : error;
    if (cause && typeof cause === "object" && "code" in cause && cause.code === "23505" &&
      "constraint" in cause && cause.constraint === "suppliers_organization_name") return { status: "duplicate" };
    throw error;
  }
}
