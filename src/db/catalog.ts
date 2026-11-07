import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { notFound, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { hasPermission } from "@/auth/permissions";
import { getActiveOrganizationMembership } from "@/auth/organizations";
import { formatDecimal } from "@/domain/decimal";
import { parseWeight, pilotWeightMeasures, quantityToKg } from "@/domain/quantity";
import { localIdSchema } from "@/domain/validation";
import { requirePermission } from "./authorization";
import { db } from "./index";
import { appendAudit } from "./audit";
import { catalogUnits, organizationRoleAssignments, organizations, productCategories, products } from "./schema";

export type CatalogState =
  | { status: "idle" | "success" | "duplicate" | "conflict" }
  | { status: "invalid"; fields: string[] }
  | { status: "error"; correlationId: string };

const nameSchema = z.string().trim().min(1).max(80);
const productDetails = {
  name: nameSchema,
  sku: z.string().trim().max(40).transform((value) => value || null).nullable().default(null),
  categoryId: localIdSchema.nullable().default(null),
  unitId: localIdSchema,
};
const weightSchema = z.string().max(22).transform((value, context) => {
  try { return formatDecimal(parseWeight(value), 3); }
  catch { context.addIssue({ code: "custom", message: "Enter a positive gram-precise weight." }); return z.NEVER; }
});
const unitDetails = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("fixed"), kilogramsPerUnit: weightSchema }),
  z.object({ kind: z.literal("bag"), kilogramsPerUnit: z.null() }),
]);
const commandSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("seed-units") }),
  z.object({ operation: z.literal("create-unit"), name: nameSchema, unit: unitDetails }),
  z.object({ operation: z.literal("update-unit"), id: localIdSchema, name: nameSchema, unit: unitDetails }),
  z.object({ operation: z.literal("deactivate-unit"), id: localIdSchema }),
  z.object({ operation: z.literal("create-category"), name: nameSchema }),
  z.object({ operation: z.literal("update-category"), id: localIdSchema, name: nameSchema }),
  z.object({ operation: z.literal("deactivate-category"), id: localIdSchema }),
  z.object({ operation: z.literal("create-product"), ...productDetails }),
  z.object({ operation: z.literal("update-product"), id: localIdSchema, ...productDetails }),
  z.object({ operation: z.literal("deactivate-product"), id: localIdSchema }),
]);

export async function getCatalogWorkspace() {
  try {
    const tenant = await requirePermission("catalog.read");
    const [units, categories, [actor]] = await Promise.all([
      db.select({ id: catalogUnits.id, name: catalogUnits.name, kind: catalogUnits.kind,
        kilogramsPerUnit: catalogUnits.kilogramsPerUnit, isActive: catalogUnits.isActive })
        .from(catalogUnits).where(eq(catalogUnits.organizationId, tenant.organizationId)).orderBy(asc(catalogUnits.name)),
      db.select({ id: productCategories.id, name: productCategories.name, isActive: productCategories.isActive })
        .from(productCategories).where(eq(productCategories.organizationId, tenant.organizationId)).orderBy(asc(productCategories.name)),
      db.select({ role: organizationRoleAssignments.role }).from(organizationRoleAssignments).where(and(
        eq(organizationRoleAssignments.organizationId, tenant.organizationId),
        eq(organizationRoleAssignments.membershipId, tenant.membershipId), eq(organizationRoleAssignments.userId, tenant.userId),
      )).limit(1),
    ]);
    if (!actor || !hasPermission(actor.role, "catalog.read")) notFound();
    return { units, categories, canManage: hasPermission(actor.role, "catalog.manage") };
  } catch (error) {
    unstable_rethrow(error);
    throw new Error("Catalogue unavailable.");
  }
}

export async function manageCatalog(input: unknown): Promise<CatalogState> {
  const tenant = await requirePermission("catalog.manage");
  const parsed = commandSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid", fields: [...new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? "operation")))] };
  const command = parsed.data;
  const requestId = randomUUID();
  try {
    return await db.transaction(async (tx): Promise<CatalogState> => {
      // Share staff's lock so queued mutations recheck a revoked or changed actor.
      const [organization] = await tx.select({ id: organizations.id, clerkOrganizationId: organizations.clerkOrganizationId })
        .from(organizations).where(eq(organizations.id, tenant.organizationId)).for("update");
      const current = await getActiveOrganizationMembership();
      const [actor] = await tx.select({ role: organizationRoleAssignments.role }).from(organizationRoleAssignments).where(and(
        eq(organizationRoleAssignments.organizationId, tenant.organizationId),
        eq(organizationRoleAssignments.membershipId, tenant.membershipId), eq(organizationRoleAssignments.userId, tenant.userId),
      )).limit(1);
      if (!organization || !current || current.clerkOrganizationId !== organization.clerkOrganizationId ||
        current.membershipId !== tenant.membershipId || current.userId !== tenant.userId ||
        !actor || !hasPermission(actor.role, "catalog.manage")) notFound();
      if (command.operation === "seed-units") {
        const seeded = await tx.insert(catalogUnits).values([
          ...Object.entries(pilotWeightMeasures).map(([name, kilogramsPerUnit]) => ({ organizationId: tenant.organizationId, name,
            kind: "fixed" as const, kilogramsPerUnit })),
          { organizationId: tenant.organizationId, name: "bag", kind: "bag", kilogramsPerUnit: null },
        ]).onConflictDoNothing().returning();
        for (const unit of seeded) await appendAudit(tx, tenant, { entityType: "catalog_unit", entityId: unit.id, action: "create", requestId, after: unit });
        return { status: "success" };
      }
      if (command.operation === "create-unit") {
        const [unit] = await tx.insert(catalogUnits).values({ organizationId: tenant.organizationId, name: command.name, ...command.unit }).returning();
        await appendAudit(tx, tenant, { entityType: "catalog_unit", entityId: unit.id, action: "create", requestId, after: unit });
      } else if (command.operation === "create-category") {
        const [category] = await tx.insert(productCategories).values({ organizationId: tenant.organizationId, name: command.name }).returning();
        await appendAudit(tx, tenant, { entityType: "product_category", entityId: category.id, action: "create", requestId, after: category });
      } else if (command.operation === "create-product" || command.operation === "update-product") {
        const [unit] = await tx.select({ id: catalogUnits.id }).from(catalogUnits).where(and(
          eq(catalogUnits.id, command.unitId), eq(catalogUnits.organizationId, tenant.organizationId), eq(catalogUnits.isActive, true),
        )).limit(1);
        if (!unit) return { status: "invalid", fields: ["unitId"] };
        if (command.categoryId !== null) {
          const [category] = await tx.select({ id: productCategories.id }).from(productCategories).where(and(
            eq(productCategories.id, command.categoryId), eq(productCategories.organizationId, tenant.organizationId), eq(productCategories.isActive, true),
          )).limit(1);
          if (!category) return { status: "invalid", fields: ["categoryId"] };
        }
        const details = { name: command.name, sku: command.sku, unitId: command.unitId, categoryId: command.categoryId };
        if (command.operation === "create-product") {
          const [product] = await tx.insert(products).values({ organizationId: tenant.organizationId, ...details }).returning();
          await appendAudit(tx, tenant, { entityType: "product", entityId: product.id, action: "create", requestId, after: product });
        } else {
          const [before] = await tx.select().from(products).where(and(eq(products.id, command.id), eq(products.organizationId, tenant.organizationId), eq(products.isActive, true)));
          const saved = await tx.update(products).set(details).where(and(eq(products.id, command.id),
            eq(products.organizationId, tenant.organizationId), eq(products.isActive, true))).returning();
          if (saved.length === 0) return { status: "conflict" };
          await appendAudit(tx, tenant, { entityType: "product", entityId: saved[0].id, action: "update", requestId, before, after: saved[0] });
        }
      } else if (command.operation === "deactivate-product") {
        const [before] = await tx.select().from(products).where(and(eq(products.id, command.id), eq(products.organizationId, tenant.organizationId), eq(products.isActive, true)));
        const saved = await tx.update(products).set({ isActive: false }).where(and(eq(products.id, command.id),
          eq(products.organizationId, tenant.organizationId), eq(products.isActive, true))).returning();
        if (saved.length === 0) return { status: "conflict" };
        await appendAudit(tx, tenant, { entityType: "product", entityId: saved[0].id, action: "deactivate", requestId, before, after: saved[0] });
      } else {
        const table = command.operation === "update-unit" || command.operation === "deactivate-unit" ? catalogUnits : productCategories;
        const changes = command.operation === "update-unit" ? { name: command.name, ...command.unit }
          : command.operation === "update-category" ? { name: command.name } : { isActive: false };
        const [before] = await tx.select().from(table).where(and(eq(table.id, command.id), eq(table.organizationId, tenant.organizationId), eq(table.isActive, true)));
        const saved = await tx.update(table).set(changes).where(and(eq(table.id, command.id),
          eq(table.organizationId, tenant.organizationId), eq(table.isActive, true))).returning();
        if (saved.length === 0) return { status: "conflict" };
        await appendAudit(tx, tenant, { entityType: table === catalogUnits ? "catalog_unit" : "product_category", entityId: saved[0].id,
          action: command.operation.startsWith("deactivate") ? "deactivate" : "update", requestId, before, after: saved[0] });
      }
      return { status: "success" };
    });
  } catch (error) {
    unstable_rethrow(error);
    // Drizzle wraps pg errors; only catalogue name/code constraints are expected conflicts.
    const cause = error instanceof Error ? error.cause : error;
    if (cause && typeof cause === "object" && "code" in cause && cause.code === "23505" && "constraint" in cause &&
      (cause.constraint === "catalog_units_organization_name" || cause.constraint === "product_categories_organization_name" ||
        cause.constraint === "products_organization_name" || cause.constraint === "products_organization_sku")) return { status: "duplicate" };
    throw error;
  }
}

const productSelection = { id: products.id, name: products.name, sku: products.sku, categoryId: products.categoryId,
  unitId: products.unitId, isActive: products.isActive, unitName: catalogUnits.name, categoryName: productCategories.name };

export async function getProducts() {
  try {
    const tenant = await requirePermission("catalog.read");
    // shortcut: return the small pilot catalogue in full, paginate before supporting large catalogues.
    return await db.select(productSelection).from(products)
      .innerJoin(catalogUnits, and(eq(products.unitId, catalogUnits.id), eq(products.organizationId, catalogUnits.organizationId)))
      .leftJoin(productCategories, and(eq(products.categoryId, productCategories.id), eq(products.organizationId, productCategories.organizationId)))
      .where(eq(products.organizationId, tenant.organizationId)).orderBy(asc(products.name));
  } catch (error) {
    unstable_rethrow(error);
    throw new Error("Products unavailable.");
  }
}

export async function getProduct(input: unknown) {
  try {
    const tenant = await requirePermission("catalog.read");
    const id = localIdSchema.safeParse(input);
    if (!id.success) notFound();
    const [product] = await db.select(productSelection).from(products)
      .innerJoin(catalogUnits, and(eq(products.unitId, catalogUnits.id), eq(products.organizationId, catalogUnits.organizationId)))
      .leftJoin(productCategories, and(eq(products.categoryId, productCategories.id), eq(products.organizationId, productCategories.organizationId)))
      .where(and(eq(products.id, id.data), eq(products.organizationId, tenant.organizationId))).limit(1);
    if (!product) notFound();
    return product;
  } catch (error) {
    unstable_rethrow(error);
    throw new Error("Products unavailable.");
  }
}

// The posting service must persist these scalar snapshots alongside each transaction line.
export async function getUnitSnapshot(input: unknown) {
  const tenant = await requirePermission("catalog.read");
  const request = z.object({ id: localIdSchema, quantity: z.string().max(38), bagWeightKg: weightSchema.optional() }).parse(input);
  const [unit] = await db.select({ id: catalogUnits.id, name: catalogUnits.name, kind: catalogUnits.kind,
    kilogramsPerUnit: catalogUnits.kilogramsPerUnit }).from(catalogUnits).where(and(
    eq(catalogUnits.id, request.id), eq(catalogUnits.organizationId, tenant.organizationId), eq(catalogUnits.isActive, true),
  )).limit(1);
  if (!unit) notFound();
  const kilogramsPerUnit = unit.kind === "bag" ? request.bagWeightKg : unit.kilogramsPerUnit;
  if (!kilogramsPerUnit || (unit.kind !== "bag" && request.bagWeightKg !== undefined)) throw new Error("A bag needs its actual weight; fixed units use their saved weight.");
  return { unitId: unit.id, name: unit.name, kind: unit.kind, kilogramsPerUnit,
    quantity: request.quantity, quantityKg: quantityToKg(request.quantity, kilogramsPerUnit) };
}
