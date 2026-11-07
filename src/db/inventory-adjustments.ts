import "server-only";

import { createHash } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { notFound, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { hasPermission } from "@/auth/permissions";
import { getActiveOrganizationMembership } from "@/auth/organizations";
import { formatDecimal, parseDecimal } from "@/domain/decimal";
import { localIdSchema } from "@/domain/validation";
import { requirePermission } from "./authorization";
import { db } from "./index";
import { appendAudit } from "./audit";
import { inventoryMovements, organizationRoleAssignments, organizations, products, warehouses } from "./schema";

export type AdjustmentState =
  | { status: "idle" | "conflict" | "insufficient_stock" }
  | { status: "success"; productId: string; movementId: string }
  | { status: "invalid"; fields: string[] }
  | { status: "error"; correlationId: string };

const commandSchema = z.object({
  requestId: localIdSchema, productId: localIdSchema, warehouseId: localIdSchema,
  quantityKg: z.string().max(23).transform((value, ctx) => {
    try { const grams = parseDecimal(value, 3); if (grams === BigInt(0)) throw new RangeError(); return formatDecimal(grams, 3); }
    catch { ctx.addIssue({ code: "custom", message: "Enter a nonzero signed weight accurate to one gram." }); return z.NEVER; }
  }),
  reasonCode: z.enum(["loss", "spoilage", "count_correction", "opening_stock"]),
  reason: z.string().trim().min(1).max(500), reference: z.string().trim().max(100), approved: z.literal(true),
}).superRefine((command, ctx) => {
  const negative = command.quantityKg.startsWith("-");
  if ((["loss", "spoilage"].includes(command.reasonCode) && !negative) || (command.reasonCode === "opening_stock" && negative)) {
    ctx.addIssue({ code: "custom", path: ["quantityKg"], message: "Use a deduction for loss/spoilage or an addition for opening stock." });
  }
});

export async function getAdjustmentOptions() {
  try {
    const tenant = await requirePermission("inventory.correct");
    const productRows = await db.select({ id: products.id, name: products.name }).from(products)
      .where(and(eq(products.organizationId, tenant.organizationId), eq(products.isActive, true))).orderBy(asc(products.name));
    const [warehouse] = await db.select({ id: warehouses.id, name: warehouses.name }).from(warehouses)
      .where(and(eq(warehouses.organizationId, tenant.organizationId), eq(warehouses.isActive, true))).limit(1);
    return { organizationId: tenant.organizationId, products: productRows, warehouse: warehouse ?? null };
  } catch (error) { unstable_rethrow(error); throw new Error("Adjustment options unavailable."); }
}

export async function adjustInventory(input: unknown): Promise<AdjustmentState> {
  const tenant = await requirePermission("inventory.correct");
  const parsed = commandSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid", fields: [...new Set(parsed.error.issues.map((issue) => issue.path.join(".") || "references"))] };
  const command = parsed.data;
  const fingerprint = createHash("sha256").update(JSON.stringify(command)).digest("hex");
  return db.transaction(async (tx): Promise<AdjustmentState> => {
    // All stock writers take this lock, including receipts and concurrent corrections.
    const [organization] = await tx.select().from(organizations).where(eq(organizations.id, tenant.organizationId)).for("update");
    const current = await getActiveOrganizationMembership();
    const [actor] = await tx.select().from(organizationRoleAssignments).where(and(eq(organizationRoleAssignments.organizationId, tenant.organizationId),
      eq(organizationRoleAssignments.membershipId, tenant.membershipId), eq(organizationRoleAssignments.userId, tenant.userId)));
    if (!organization || !current || current.clerkOrganizationId !== organization.clerkOrganizationId || current.membershipId !== tenant.membershipId ||
      current.userId !== tenant.userId || !actor || !hasPermission(actor.role, "inventory.correct")) notFound();
    const [existing] = await tx.select().from(inventoryMovements).where(and(eq(inventoryMovements.organizationId, tenant.organizationId), eq(inventoryMovements.requestId, command.requestId)));
    if (existing) return existing.requestFingerprint === fingerprint
      ? { status: "success", productId: existing.productId, movementId: existing.id } : { status: "conflict" };
    const [product] = await tx.select().from(products).where(and(eq(products.organizationId, tenant.organizationId), eq(products.id, command.productId), eq(products.isActive, true)));
    const [warehouse] = await tx.select().from(warehouses).where(and(eq(warehouses.organizationId, tenant.organizationId), eq(warehouses.id, command.warehouseId), eq(warehouses.isActive, true)));
    if (!product || !warehouse) return { status: "invalid", fields: ["references"] };
    // The ledger aggregate can exceed an individual entry's 18-digit bound; compare in PostgreSQL.
    const [stock] = await tx.select({ sufficient: sql<boolean>`coalesce(sum(${inventoryMovements.quantityKg}), 0) + ${command.quantityKg}::numeric >= 0` })
      .from(inventoryMovements).where(and(eq(inventoryMovements.organizationId, tenant.organizationId), eq(inventoryMovements.productId, product.id), eq(inventoryMovements.warehouseId, warehouse.id)));
    if (!stock.sufficient) return { status: "insufficient_stock" };
    const [movement] = await tx.insert(inventoryMovements).values({ organizationId: tenant.organizationId, productId: product.id, warehouseId: warehouse.id,
      kind: "adjustment", quantityKg: command.quantityKg, requestId: command.requestId, requestFingerprint: fingerprint,
      reasonCode: command.reasonCode, reason: command.reason, reference: command.reference, productName: product.name, warehouseName: warehouse.name,
      performedByUserId: tenant.userId, performedByMembershipId: tenant.membershipId, createdAt: new Date() }).returning();
    await appendAudit(tx, tenant, { entityType: "inventory_adjustment", entityId: movement.id, action: "adjust", requestId: command.requestId, after: movement });
    return { status: "success", productId: movement.productId, movementId: movement.id };
  });
}
