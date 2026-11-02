import "server-only";

import { createHash } from "node:crypto";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { notFound, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { hasPermission } from "@/auth/permissions";
import { getActiveOrganizationMembership } from "@/auth/organizations";
import { formatDecimal, parseNonNegativeDecimal } from "@/domain/decimal";
import { calculateLineTotal, currencySchema, normalizeMoney, sumLineTotals } from "@/domain/money";
import { parseWeight, quantityToKg } from "@/domain/quantity";
import { localIdSchema } from "@/domain/validation";
import { requirePermission } from "./authorization";
import { db } from "./index";
import { catalogUnits, organizationRoleAssignments, organizations, products, purchaseOrderItems, purchaseOrders, suppliers, warehouses } from "./schema";

export type PurchaseState =
  | { status: "idle" | "conflict" }
  | { status: "success"; purchaseId: string }
  | { status: "invalid"; fields: string[] }
  | { status: "error"; correlationId: string };

const quantitySchema = z.string().max(38).transform((value, context) => {
  try {
    const quantity = parseNonNegativeDecimal(value, 18);
    if (quantity === BigInt(0)) throw new RangeError();
    return formatDecimal(quantity, 18);
  } catch { context.addIssue({ code: "custom", message: "Enter a positive decimal quantity." }); return z.NEVER; }
});
const moneySchema = z.string().max(21).transform((value, context) => {
  try { return normalizeMoney(value); }
  catch { context.addIssue({ code: "custom", message: "Enter a non-negative price with at most two decimal places." }); return z.NEVER; }
});
const bagWeightSchema = z.string().max(22).transform((value, context) => {
  try { return formatDecimal(parseWeight(value), 3); }
  catch { context.addIssue({ code: "custom", message: "Enter a positive gram-precise bag weight." }); return z.NEVER; }
}).nullable().default(null);
const draftSchema = z.object({
  requestId: localIdSchema, supplierId: localIdSchema, warehouseId: localIdSchema, currency: currencySchema,
  items: z.array(z.object({ productId: localIdSchema, quantity: quantitySchema, quantityUnitId: localIdSchema,
    quantityBagWeightKg: bagWeightSchema, unitPrice: moneySchema, priceUnitId: localIdSchema, priceBagWeightKg: bagWeightSchema })).min(1).max(100),
});
const summary = { id: purchaseOrders.id, supplierName: purchaseOrders.supplierName, warehouseName: purchaseOrders.warehouseName,
  currency: purchaseOrders.currency, status: purchaseOrders.status, total: purchaseOrders.total, createdAt: purchaseOrders.createdAt };
const itemSelection = { id: purchaseOrderItems.id, lineNumber: purchaseOrderItems.lineNumber, productName: purchaseOrderItems.productName,
  productSku: purchaseOrderItems.productSku, quantity: purchaseOrderItems.quantity, quantityUnitName: purchaseOrderItems.quantityUnitName,
  quantityUnitKind: purchaseOrderItems.quantityUnitKind, quantityMeasureKg: purchaseOrderItems.quantityMeasureKg, quantityKg: purchaseOrderItems.quantityKg,
  unitPrice: purchaseOrderItems.unitPrice, priceUnitName: purchaseOrderItems.priceUnitName, priceUnitKind: purchaseOrderItems.priceUnitKind,
  priceMeasureKg: purchaseOrderItems.priceMeasureKg, lineTotal: purchaseOrderItems.lineTotal };

export async function getPurchasesWorkspace() {
  try {
    const tenant = await requirePermission("purchases.read");
    const [actor] = await db.select({ role: organizationRoleAssignments.role }).from(organizationRoleAssignments).where(and(
      eq(organizationRoleAssignments.organizationId, tenant.organizationId), eq(organizationRoleAssignments.membershipId, tenant.membershipId),
      eq(organizationRoleAssignments.userId, tenant.userId),
    )).limit(1);
    if (!actor || !hasPermission(actor.role, "purchases.read")) notFound();
    const canManage = hasPermission(actor.role, "purchases.manage");
    const [purchases, supplierOptions, warehouseOptions, unitOptions, productOptions] = await Promise.all([
      // shortcut: return the small pilot purchase register in full; paginate before a large trading history.
      db.select(summary).from(purchaseOrders).where(eq(purchaseOrders.organizationId, tenant.organizationId)).orderBy(desc(purchaseOrders.createdAt), desc(purchaseOrders.id)),
      canManage ? db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(and(eq(suppliers.organizationId, tenant.organizationId), eq(suppliers.isActive, true))).orderBy(asc(suppliers.name)) : [],
      canManage ? db.select({ id: warehouses.id, name: warehouses.name }).from(warehouses).where(and(eq(warehouses.organizationId, tenant.organizationId), eq(warehouses.isActive, true))) : [],
      canManage ? db.select({ id: catalogUnits.id, name: catalogUnits.name, kind: catalogUnits.kind, kilogramsPerUnit: catalogUnits.kilogramsPerUnit }).from(catalogUnits).where(and(eq(catalogUnits.organizationId, tenant.organizationId), eq(catalogUnits.isActive, true))).orderBy(asc(catalogUnits.name)) : [],
      canManage ? db.select({ id: products.id, name: products.name, unitId: products.unitId }).from(products).innerJoin(catalogUnits, and(eq(products.organizationId, catalogUnits.organizationId), eq(products.unitId, catalogUnits.id))).where(and(eq(products.organizationId, tenant.organizationId), eq(products.isActive, true), eq(catalogUnits.isActive, true))).orderBy(asc(products.name)) : [],
    ]);
    return { organizationId: tenant.organizationId, canManage, purchases, suppliers: supplierOptions, warehouse: warehouseOptions[0] ?? null, units: unitOptions, products: productOptions };
  } catch (error) { unstable_rethrow(error); throw new Error("Purchases unavailable."); }
}

export async function getPurchase(input: unknown) {
  try {
    const tenant = await requirePermission("purchases.read");
    const id = localIdSchema.safeParse(input);
    if (!id.success) notFound();
    const [purchase] = await db.select(summary).from(purchaseOrders).where(and(eq(purchaseOrders.organizationId, tenant.organizationId), eq(purchaseOrders.id, id.data))).limit(1);
    if (!purchase) notFound();
    const items = await db.select(itemSelection).from(purchaseOrderItems).where(and(eq(purchaseOrderItems.organizationId, tenant.organizationId), eq(purchaseOrderItems.purchaseOrderId, id.data))).orderBy(asc(purchaseOrderItems.lineNumber));
    return { ...purchase, items };
  } catch (error) { unstable_rethrow(error); throw new Error("Purchases unavailable."); }
}

export async function createPurchaseDraft(input: unknown): Promise<PurchaseState> {
  const tenant = await requirePermission("purchases.manage");
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid", fields: [...new Set(parsed.error.issues.map((issue) => issue.path.join(".") || "items"))] };
  const command = parsed.data;
  const requestFingerprint = createHash("sha256").update(JSON.stringify(command)).digest("hex");
  return db.transaction(async (tx): Promise<PurchaseState> => {
    const [organization] = await tx.select({ id: organizations.id, clerkOrganizationId: organizations.clerkOrganizationId }).from(organizations).where(eq(organizations.id, tenant.organizationId)).for("update");
    const current = await getActiveOrganizationMembership();
    const [actor] = await tx.select({ role: organizationRoleAssignments.role }).from(organizationRoleAssignments).where(and(
      eq(organizationRoleAssignments.organizationId, tenant.organizationId), eq(organizationRoleAssignments.membershipId, tenant.membershipId), eq(organizationRoleAssignments.userId, tenant.userId),
    )).limit(1);
    if (!organization || !current || current.clerkOrganizationId !== organization.clerkOrganizationId || current.membershipId !== tenant.membershipId ||
      current.userId !== tenant.userId || !actor || !hasPermission(actor.role, "purchases.manage")) notFound();
    const [existing] = await tx.select({ id: purchaseOrders.id, fingerprint: purchaseOrders.requestFingerprint }).from(purchaseOrders).where(and(eq(purchaseOrders.organizationId, tenant.organizationId), eq(purchaseOrders.requestId, command.requestId))).limit(1);
    if (existing) return existing.fingerprint === requestFingerprint ? { status: "success", purchaseId: existing.id } : { status: "conflict" };
    const [[supplier], [warehouse], productRows, unitRows] = await Promise.all([
      tx.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(and(eq(suppliers.organizationId, tenant.organizationId), eq(suppliers.id, command.supplierId), eq(suppliers.isActive, true))),
      tx.select({ id: warehouses.id, name: warehouses.name }).from(warehouses).where(and(eq(warehouses.organizationId, tenant.organizationId), eq(warehouses.id, command.warehouseId), eq(warehouses.isActive, true))),
      tx.select({ id: products.id, name: products.name, sku: products.sku, unitId: products.unitId }).from(products).where(and(eq(products.organizationId, tenant.organizationId), inArray(products.id, command.items.map((item) => item.productId)), eq(products.isActive, true))),
      tx.select({ id: catalogUnits.id, name: catalogUnits.name, kind: catalogUnits.kind, kilogramsPerUnit: catalogUnits.kilogramsPerUnit }).from(catalogUnits).where(and(eq(catalogUnits.organizationId, tenant.organizationId), eq(catalogUnits.isActive, true))),
    ]);
    const fields: string[] = [];
    if (!supplier) fields.push("supplierId");
    if (!warehouse) fields.push("warehouseId");
    const unitsById = new Map(unitRows.map((unit) => [unit.id, unit]));
    const productsById = new Map(productRows.map((product) => [product.id, product]));
    const items: Omit<typeof purchaseOrderItems.$inferInsert, "purchaseOrderId">[] = [];
    for (const [index, item] of command.items.entries()) {
      const product = productsById.get(item.productId);
      if (!product || !unitsById.has(product.unitId)) { fields.push(`items.${index}.productId`); continue; }
      const quantityUnit = unitsById.get(item.quantityUnitId);
      const priceUnit = unitsById.get(item.priceUnitId);
      if (!quantityUnit) fields.push(`items.${index}.quantityUnitId`);
      if (!priceUnit) fields.push(`items.${index}.priceUnitId`);
      if (!quantityUnit || !priceUnit) continue;
      const measureWeight = (unit: typeof quantityUnit, bagWeight: string | null, key: string) => {
        if ((unit.kind === "bag") !== (bagWeight !== null)) { fields.push(`items.${index}.${key}`); return null; }
        return unit.kind === "bag" ? bagWeight : unit.kilogramsPerUnit;
      };
      const quantityMeasureKg = measureWeight(quantityUnit, item.quantityBagWeightKg, "quantityBagWeightKg");
      const priceMeasureKg = measureWeight(priceUnit, item.priceBagWeightKg, "priceBagWeightKg");
      if (!quantityMeasureKg || !priceMeasureKg) continue;
      try {
        const quantityKg = quantityToKg(item.quantity, quantityMeasureKg);
        const lineTotal = calculateLineTotal({ quantity: item.quantity, quantityMeasureKg, unitPrice: item.unitPrice, priceMeasureKg });
        items.push({ organizationId: tenant.organizationId, lineNumber: index + 1, productId: product.id, productName: product.name, productSku: product.sku,
          quantity: item.quantity, quantityUnitId: quantityUnit.id, quantityUnitName: quantityUnit.name, quantityUnitKind: quantityUnit.kind,
          quantityMeasureKg, quantityKg, unitPrice: item.unitPrice, priceUnitId: priceUnit.id, priceUnitName: priceUnit.name, priceUnitKind: priceUnit.kind, priceMeasureKg, lineTotal });
      } catch { fields.push(`items.${index}.quantity`); }
    }
    if (fields.length || !supplier || !warehouse) return { status: "invalid", fields };
    let total: string;
    try { total = sumLineTotals(items.map((item) => item.lineTotal)); }
    catch { return { status: "invalid", fields: ["items"] }; }
    const [purchase] = await tx.insert(purchaseOrders).values({ organizationId: tenant.organizationId, requestId: command.requestId, requestFingerprint,
      supplierId: supplier.id, supplierName: supplier.name, warehouseId: warehouse.id, warehouseName: warehouse.name, currency: command.currency, total,
      createdByUserId: tenant.userId, createdByMembershipId: tenant.membershipId }).returning({ id: purchaseOrders.id });
    await tx.insert(purchaseOrderItems).values(items.map((item) => ({ ...item, purchaseOrderId: purchase.id })));
    return { status: "success", purchaseId: purchase.id };
  });
}
