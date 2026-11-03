import "server-only";

import { createHash } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { notFound, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { hasPermission } from "@/auth/permissions";
import { getActiveOrganizationMembership } from "@/auth/organizations";
import { formatDecimal, parseNonNegativeDecimal } from "@/domain/decimal";
import { calculateReceiptValue, sumLineTotals } from "@/domain/money";
import { parseWeight, quantityToKg } from "@/domain/quantity";
import { localIdSchema } from "@/domain/validation";
import { requirePermission } from "./authorization";
import { db } from "./index";
import { catalogUnits, goodsReceiptItems, goodsReceipts, inventoryMovements, organizationRoleAssignments, organizations, products, purchaseOrderItems, purchaseOrders, supplierPayables, suppliers, warehouses } from "./schema";

export type ReceiptState =
  | { status: "idle" | "conflict" }
  | { status: "success"; purchaseId: string; receiptId: string }
  | { status: "invalid"; fields: string[] }
  | { status: "error"; correlationId: string };

const quantitySchema = z.string().max(38).transform((value, ctx) => {
  try { const parsed = parseNonNegativeDecimal(value, 18); if (parsed === BigInt(0)) throw new RangeError(); return formatDecimal(parsed, 18); }
  catch { ctx.addIssue({ code: "custom", message: "Enter a positive quantity." }); return z.NEVER; }
});
const bagSchema = z.string().max(22).transform((value, ctx) => {
  try { return formatDecimal(parseWeight(value), 3); }
  catch { ctx.addIssue({ code: "custom", message: "Enter a positive gram-precise bag weight." }); return z.NEVER; }
}).nullable().default(null);
const receiptSchema = z.object({
  purchaseId: localIdSchema, requestId: localIdSchema, revision: z.number().int().min(1).max(2147483646),
  complete: z.boolean(), approveVariance: z.boolean(), reason: z.string().trim().max(500),
  items: z.array(z.object({ purchaseItemId: localIdSchema, quantity: quantitySchema, quantityUnitId: localIdSchema, bagWeightKg: bagSchema })).min(1).max(100),
}).superRefine((command, ctx) => {
  if (command.approveVariance && !command.reason) ctx.addIssue({ code: "custom", path: ["reason"], message: "Give the owner approval reason." });
  if (new Set(command.items.map((item) => item.purchaseItemId)).size !== command.items.length) ctx.addIssue({ code: "custom", path: ["items"], message: "Each purchase line may occur once." });
});

export async function getReceiptUnits() {
  try {
    const tenant = await requirePermission("receipts.accept");
    return await db.select({ id: catalogUnits.id, name: catalogUnits.name, kind: catalogUnits.kind, kilogramsPerUnit: catalogUnits.kilogramsPerUnit })
      .from(catalogUnits).where(and(eq(catalogUnits.organizationId, tenant.organizationId), eq(catalogUnits.isActive, true))).orderBy(asc(catalogUnits.name));
  } catch (error) { unstable_rethrow(error); throw new Error("Receipt measures unavailable."); }
}

export async function acceptReceipt(input: unknown): Promise<ReceiptState> {
  const tenant = await requirePermission("receipts.accept");
  const parsed = receiptSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid", fields: [...new Set(parsed.error.issues.map((issue) => issue.path.join(".") || "items"))] };
  const command = parsed.data;
  // Line order has no business meaning; normalize it for durable request replay.
  const fingerprint = createHash("sha256").update(JSON.stringify({ ...command, items: [...command.items].sort((a, b) => a.purchaseItemId.localeCompare(b.purchaseItemId)) })).digest("hex");
  return db.transaction(async (tx): Promise<ReceiptState> => {
    const [organization] = await tx.select().from(organizations).where(eq(organizations.id, tenant.organizationId)).for("update");
    const current = await getActiveOrganizationMembership();
    const [actor] = await tx.select().from(organizationRoleAssignments).where(and(eq(organizationRoleAssignments.organizationId, tenant.organizationId),
      eq(organizationRoleAssignments.membershipId, tenant.membershipId), eq(organizationRoleAssignments.userId, tenant.userId)));
    if (!organization || !current || current.clerkOrganizationId !== organization.clerkOrganizationId || current.membershipId !== tenant.membershipId ||
      current.userId !== tenant.userId || !actor || !hasPermission(actor.role, "receipts.accept")) notFound();
    if (command.approveVariance && !hasPermission(actor.role, "receipts.approve_variance")) return { status: "invalid", fields: ["approveVariance"] };
    const [existing] = await tx.select().from(goodsReceipts).where(and(eq(goodsReceipts.organizationId, tenant.organizationId), eq(goodsReceipts.requestId, command.requestId)));
    if (existing) return existing.requestFingerprint === fingerprint
      ? { status: "success", purchaseId: existing.purchaseOrderId, receiptId: existing.id } : { status: "conflict" };
    const scope = and(eq(purchaseOrders.organizationId, tenant.organizationId), eq(purchaseOrders.id, command.purchaseId));
    const [purchase] = await tx.select().from(purchaseOrders).where(scope).for("update");
    if (!purchase) notFound();
    if (purchase.revision !== command.revision || !["ordered", "partially_received"].includes(purchase.status)) return { status: "conflict" };
    const lines = await tx.select().from(purchaseOrderItems).where(and(eq(purchaseOrderItems.organizationId, tenant.organizationId), eq(purchaseOrderItems.purchaseOrderId, purchase.id))).for("update");
    const [supplier] = await tx.select().from(suppliers).where(and(eq(suppliers.organizationId, tenant.organizationId), eq(suppliers.id, purchase.supplierId), eq(suppliers.isActive, true)));
    const [warehouse] = await tx.select().from(warehouses).where(and(eq(warehouses.organizationId, tenant.organizationId), eq(warehouses.id, purchase.warehouseId), eq(warehouses.isActive, true)));
    const unitRows = await tx.select().from(catalogUnits).where(and(eq(catalogUnits.organizationId, tenant.organizationId), eq(catalogUnits.isActive, true)));
    const productRows = await tx.select().from(products).where(and(eq(products.organizationId, tenant.organizationId), eq(products.isActive, true)));
    const units = new Map(unitRows.map((unit) => [unit.id, unit]));
    const activeProducts = new Map(productRows.map((product) => [product.id, product]));
    if (!supplier || !warehouse || !lines.length || lines.some((line) => {
      const product = activeProducts.get(line.productId);
      return !product || !units.has(product.unitId) || !units.has(line.quantityUnitId) || !units.has(line.priceUnitId);
    })) return { status: "invalid", fields: ["references"] };
    const fields: string[] = [];
    const writes: Omit<typeof goodsReceiptItems.$inferInsert, "receiptId">[] = [];
    let excess = false;
    for (const [index, item] of command.items.entries()) {
      const line = lines.find((line) => line.id === item.purchaseItemId);
      const unit = units.get(item.quantityUnitId);
      if (!line) { fields.push(`items.${index}.purchaseItemId`); continue; }
      if (!unit) { fields.push(`items.${index}.quantityUnitId`); continue; }
      const savedMeasure = line.quantityUnitId === unit.id;
      const kind = savedMeasure ? line.quantityUnitKind : unit.kind;
      if ((kind === "bag") !== (item.bagWeightKg !== null)) { fields.push(`items.${index}.bagWeightKg`); continue; }
      const weight = kind === "bag" ? item.bagWeightKg : savedMeasure ? line.quantityMeasureKg : unit.kilogramsPerUnit;
      try {
        const quantityKg = quantityToKg(item.quantity, weight);
        const cumulative = parseNonNegativeDecimal(line.receivedQuantityKg, 3) + parseNonNegativeDecimal(quantityKg, 3);
        const cumulativeQuantityKg = formatDecimal(cumulative, 3);
        excess ||= cumulative > parseNonNegativeDecimal(line.quantityKg, 3);
        const recognizedValue = calculateReceiptValue({ previousQuantityKg: line.receivedQuantityKg, cumulativeQuantityKg,
          previouslyRecognized: line.recognizedValue, unitPrice: line.unitPrice, priceMeasureKg: line.priceMeasureKg });
        writes.push({ organizationId: tenant.organizationId, purchaseOrderId: purchase.id, purchaseItemId: line.id, productId: line.productId,
          productName: line.productName, quantity: item.quantity, quantityUnitId: unit.id, quantityUnitName: savedMeasure ? line.quantityUnitName : unit.name,
          quantityUnitKind: kind, quantityMeasureKg: formatDecimal(parseWeight(weight), 3), quantityKg, unitPrice: line.unitPrice,
          priceUnitName: line.priceUnitName, priceMeasureKg: line.priceMeasureKg, previousQuantityKg: line.receivedQuantityKg,
          cumulativeQuantityKg, previouslyRecognized: line.recognizedValue, recognizedValue });
      } catch { fields.push(`items.${index}.quantity`); }
    }
    if (fields.length) return { status: "invalid", fields };
    const byLine = new Map(writes.map((line) => [line.purchaseItemId, line]));
    const short = lines.some((line) => parseNonNegativeDecimal(byLine.get(line.id)?.cumulativeQuantityKg ?? line.receivedQuantityKg, 3) < parseNonNegativeDecimal(line.quantityKg, 3));
    const variance = excess || (command.complete && short);
    if (variance && !command.approveVariance) return { status: "invalid", fields: ["approveVariance"] };
    let total: string;
    try { total = sumLineTotals(writes.map((line) => line.recognizedValue)); }
    catch { return { status: "invalid", fields: ["items"] }; }
    const now = new Date();
    const completesPurchase = command.complete || !short;
    const [receipt] = await tx.insert(goodsReceipts).values({ organizationId: tenant.organizationId, purchaseOrderId: purchase.id,
      requestId: command.requestId, requestFingerprint: fingerprint, supplierId: purchase.supplierId, warehouseId: purchase.warehouseId,
      currency: purchase.currency, total, completesPurchase, acceptedAt: now, acceptedByUserId: tenant.userId, acceptedByMembershipId: tenant.membershipId,
      varianceReason: variance ? command.reason : null, varianceApprovedByUserId: variance ? tenant.userId : null,
      varianceApprovedByMembershipId: variance ? tenant.membershipId : null }).returning();
    const saved = await tx.insert(goodsReceiptItems).values(writes.map((line) => ({ ...line, receiptId: receipt.id }))).returning();
    for (const line of writes) {
      const agreed = lines.find((item) => item.id === line.purchaseItemId)!;
      const extra = parseNonNegativeDecimal(line.cumulativeQuantityKg, 3) - parseNonNegativeDecimal(agreed.quantityKg, 3);
      await tx.update(purchaseOrderItems).set({ receivedQuantityKg: line.cumulativeQuantityKg,
        recognizedValue: formatDecimal(parseNonNegativeDecimal(line.previouslyRecognized, 2) + parseNonNegativeDecimal(line.recognizedValue, 2), 2),
        approvedExtraKg: formatDecimal(extra > BigInt(0) ? extra : BigInt(0), 3),
      }).where(and(eq(purchaseOrderItems.organizationId, tenant.organizationId), eq(purchaseOrderItems.id, line.purchaseItemId)));
    }
    await tx.insert(inventoryMovements).values(saved.map((line) => ({ organizationId: tenant.organizationId, receiptItemId: line.id,
      productId: line.productId, warehouseId: purchase.warehouseId, quantityKg: line.quantityKg, createdAt: now,
      performedByUserId: tenant.userId, performedByMembershipId: tenant.membershipId })));
    await tx.insert(supplierPayables).values({ organizationId: tenant.organizationId, receiptId: receipt.id, supplierId: purchase.supplierId, currency: purchase.currency, amount: total, createdAt: now });
    await tx.update(purchaseOrders).set({ status: completesPurchase ? "received" : "partially_received", revision: purchase.revision + 1,
      updatedAt: now, updatedByUserId: tenant.userId, updatedByMembershipId: tenant.membershipId, lastMutationId: command.requestId, lastMutationFingerprint: fingerprint }).where(scope);
    // Task 27: append acceptance and owner-approval audit events on this transaction connection.
    return { status: "success", purchaseId: purchase.id, receiptId: receipt.id };
  });
}
