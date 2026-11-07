import "server-only";

import { createHash } from "node:crypto";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { notFound, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { hasPermission, type Permission } from "@/auth/permissions";
import { getActiveOrganizationMembership } from "@/auth/organizations";
import { formatDecimal, parseNonNegativeDecimal } from "@/domain/decimal";
import { calculateLineTotal, currencySchema, normalizeMoney, sumLineTotals } from "@/domain/money";
import { parseWeight, quantityToKg } from "@/domain/quantity";
import { assertStatusTransition, localIdSchema } from "@/domain/validation";
import { requirePermission } from "./authorization";
import { db } from "./index";
import { appendAudit } from "./audit";
import type { TenantContext } from "./tenant";
import { catalogUnits, goodsReceiptItems, goodsReceipts, organizationRoleAssignments, organizations, products, purchaseOrderItems, purchaseOrders, suppliers, warehouses } from "./schema";

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
  items: z.array(z.object({ savedItemId: localIdSchema.nullable().optional(), productId: localIdSchema, quantity: quantitySchema, quantityUnitId: localIdSchema,
    quantityBagWeightKg: bagWeightSchema, unitPrice: moneySchema, priceUnitId: localIdSchema, priceBagWeightKg: bagWeightSchema })).min(1).max(100),
});
const mutationBase = z.object({ id: localIdSchema, requestId: localIdSchema, revision: z.number().int().min(1).max(2147483646) });
const mutationSchema = z.discriminatedUnion("action", [
  draftSchema.extend({ ...mutationBase.shape, action: z.literal("edit") }),
  mutationBase.extend({ action: z.literal("order") }),
  mutationBase.extend({ action: z.literal("cancel"), reason: z.string().trim().min(1).max(500) }),
]);
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type StoredItem = typeof purchaseOrderItems.$inferSelect;
type Agreement = { supplierId: string; warehouseId: string; items: (Pick<StoredItem, "productId" | "quantity" | "quantityUnitId" | "unitPrice" | "priceUnitId"> & {
  savedItemId?: string | null; quantityBagWeightKg: string | null; priceBagWeightKg: string | null;
})[] };
const summary = { id: purchaseOrders.id, supplierName: purchaseOrders.supplierName, warehouseName: purchaseOrders.warehouseName,
  currency: purchaseOrders.currency, status: purchaseOrders.status, total: purchaseOrders.total, createdAt: purchaseOrders.createdAt };
const itemSelection = { id: purchaseOrderItems.id, lineNumber: purchaseOrderItems.lineNumber, productId: purchaseOrderItems.productId,
  quantityUnitId: purchaseOrderItems.quantityUnitId, priceUnitId: purchaseOrderItems.priceUnitId, productName: purchaseOrderItems.productName,
  productSku: purchaseOrderItems.productSku, quantity: purchaseOrderItems.quantity, quantityUnitName: purchaseOrderItems.quantityUnitName,
  quantityUnitKind: purchaseOrderItems.quantityUnitKind, quantityMeasureKg: purchaseOrderItems.quantityMeasureKg, quantityKg: purchaseOrderItems.quantityKg,
  unitPrice: purchaseOrderItems.unitPrice, priceUnitName: purchaseOrderItems.priceUnitName, priceUnitKind: purchaseOrderItems.priceUnitKind,
  priceMeasureKg: purchaseOrderItems.priceMeasureKg, lineTotal: purchaseOrderItems.lineTotal,
  receivedQuantityKg: purchaseOrderItems.receivedQuantityKg, recognizedValue: purchaseOrderItems.recognizedValue };

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
    return await db.transaction(async (tx) => {
      const [actor] = await tx.select({ role: organizationRoleAssignments.role }).from(organizationRoleAssignments).where(and(
        eq(organizationRoleAssignments.organizationId, tenant.organizationId), eq(organizationRoleAssignments.membershipId, tenant.membershipId), eq(organizationRoleAssignments.userId, tenant.userId),
      )).limit(1);
      if (!actor || !hasPermission(actor.role, "purchases.read")) notFound();
      const [purchase] = await tx.select({ ...summary, supplierId: purchaseOrders.supplierId, warehouseId: purchaseOrders.warehouseId,
        revision: purchaseOrders.revision, updatedAt: purchaseOrders.updatedAt, orderedAt: purchaseOrders.orderedAt,
        orderedByUserId: purchaseOrders.orderedByUserId, orderedByMembershipId: purchaseOrders.orderedByMembershipId,
        cancelledAt: purchaseOrders.cancelledAt, cancelledByUserId: purchaseOrders.cancelledByUserId,
        cancelledByMembershipId: purchaseOrders.cancelledByMembershipId, cancellationReason: purchaseOrders.cancellationReason,
      }).from(purchaseOrders).where(and(eq(purchaseOrders.organizationId, tenant.organizationId), eq(purchaseOrders.id, id.data))).limit(1);
      if (!purchase) notFound();
      const items = await tx.select(itemSelection).from(purchaseOrderItems).where(and(eq(purchaseOrderItems.organizationId, tenant.organizationId), eq(purchaseOrderItems.purchaseOrderId, id.data))).orderBy(asc(purchaseOrderItems.lineNumber));
      const receipts = await tx.select({ id: goodsReceipts.id, total: goodsReceipts.total, acceptedAt: goodsReceipts.acceptedAt,
        completesPurchase: goodsReceipts.completesPurchase, varianceReason: goodsReceipts.varianceReason }).from(goodsReceipts)
        .where(and(eq(goodsReceipts.organizationId, tenant.organizationId), eq(goodsReceipts.purchaseOrderId, id.data))).orderBy(asc(goodsReceipts.acceptedAt), asc(goodsReceipts.id));
      const receiptItems = await tx.select({ id: goodsReceiptItems.id, receiptId: goodsReceiptItems.receiptId, productName: goodsReceiptItems.productName,
        quantity: goodsReceiptItems.quantity, quantityUnitName: goodsReceiptItems.quantityUnitName, quantityMeasureKg: goodsReceiptItems.quantityMeasureKg,
        quantityKg: goodsReceiptItems.quantityKg, recognizedValue: goodsReceiptItems.recognizedValue, unitPrice: goodsReceiptItems.unitPrice,
        priceUnitName: goodsReceiptItems.priceUnitName, priceMeasureKg: goodsReceiptItems.priceMeasureKg }).from(goodsReceiptItems)
        .where(and(eq(goodsReceiptItems.organizationId, tenant.organizationId), eq(goodsReceiptItems.purchaseOrderId, id.data))).orderBy(asc(goodsReceiptItems.id));
      return { ...purchase, items, receipts: receipts.map((receipt) => ({ ...receipt, items: receiptItems.filter((item) => item.receiptId === receipt.id) })),
        organizationId: tenant.organizationId, canManage: hasPermission(actor.role, "purchases.manage"), canCancel: hasPermission(actor.role, "transactions.cancel"),
        canAccept: hasPermission(actor.role, "receipts.accept"), canApproveVariance: hasPermission(actor.role, "receipts.approve_variance") };
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
  } catch (error) { unstable_rethrow(error); throw new Error("Purchases unavailable."); }
}

export async function createPurchaseDraft(input: unknown): Promise<PurchaseState> {
  const tenant = await requirePermission("purchases.manage");
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid", fields: [...new Set(parsed.error.issues.map((issue) => issue.path.join(".") || "items"))] };
  const command = parsed.data;
  const requestFingerprint = createHash("sha256").update(JSON.stringify(command)).digest("hex");
  return db.transaction(async (tx): Promise<PurchaseState> => {
    await lockActor(tx, tenant, "purchases.manage");
    const [existing] = await tx.select({ id: purchaseOrders.id, fingerprint: purchaseOrders.requestFingerprint }).from(purchaseOrders).where(and(eq(purchaseOrders.organizationId, tenant.organizationId), eq(purchaseOrders.requestId, command.requestId))).limit(1);
    if (existing) return existing.fingerprint === requestFingerprint ? { status: "success", purchaseId: existing.id } : { status: "conflict" };
    const agreement = await resolveAgreement(tx, tenant, command);
    if (agreement.status === "invalid") return agreement;
    const { supplier, warehouse, items, total } = agreement;
    const [purchase] = await tx.insert(purchaseOrders).values({ organizationId: tenant.organizationId, requestId: command.requestId, requestFingerprint,
      supplierId: supplier.id, supplierName: supplier.name, warehouseId: warehouse.id, warehouseName: warehouse.name, currency: command.currency, total,
      createdByUserId: tenant.userId, createdByMembershipId: tenant.membershipId }).returning({ id: purchaseOrders.id });
    await tx.insert(purchaseOrderItems).values(items.map((item) => ({ ...item, purchaseOrderId: purchase.id })));
    await appendAudit(tx, tenant, { entityType: "purchase", entityId: purchase.id, action: "create", requestId: command.requestId,
      after: { supplierId: supplier.id, warehouseId: warehouse.id, currency: command.currency, total, status: "draft", revision: 1, itemCount: items.length } });
    return { status: "success", purchaseId: purchase.id };
  });
}

async function lockActor(tx: Transaction, tenant: TenantContext, permission: Permission) {
  const [organization] = await tx.select({ id: organizations.id, clerkOrganizationId: organizations.clerkOrganizationId }).from(organizations).where(eq(organizations.id, tenant.organizationId)).for("update");
  const current = await getActiveOrganizationMembership();
  const [actor] = await tx.select({ role: organizationRoleAssignments.role }).from(organizationRoleAssignments).where(and(
    eq(organizationRoleAssignments.organizationId, tenant.organizationId), eq(organizationRoleAssignments.membershipId, tenant.membershipId), eq(organizationRoleAssignments.userId, tenant.userId),
  )).limit(1);
  if (!organization || !current || current.clerkOrganizationId !== organization.clerkOrganizationId || current.membershipId !== tenant.membershipId ||
    current.userId !== tenant.userId || !actor || !hasPermission(actor.role, permission)) notFound();
}

async function resolveAgreement(tx: Transaction, tenant: TenantContext, command: Agreement, previousItems: StoredItem[] = []) {
    const [supplier] = await tx.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(and(eq(suppliers.organizationId, tenant.organizationId), eq(suppliers.id, command.supplierId), eq(suppliers.isActive, true)));
    const [warehouse] = await tx.select({ id: warehouses.id, name: warehouses.name }).from(warehouses).where(and(eq(warehouses.organizationId, tenant.organizationId), eq(warehouses.id, command.warehouseId), eq(warehouses.isActive, true)));
    const productRows = await tx.select({ id: products.id, name: products.name, sku: products.sku, unitId: products.unitId }).from(products).where(and(eq(products.organizationId, tenant.organizationId), inArray(products.id, command.items.map((item) => item.productId)), eq(products.isActive, true)));
    const unitRows = await tx.select({ id: catalogUnits.id, name: catalogUnits.name, kind: catalogUnits.kind, kilogramsPerUnit: catalogUnits.kilogramsPerUnit }).from(catalogUnits).where(and(eq(catalogUnits.organizationId, tenant.organizationId), eq(catalogUnits.isActive, true)));
    const fields: string[] = [];
    if (!supplier) fields.push("supplierId");
    if (!warehouse) fields.push("warehouseId");
    const unitsById = new Map(unitRows.map((unit) => [unit.id, unit]));
    const productsById = new Map(productRows.map((product) => [product.id, product]));
    const previousById = new Map(previousItems.map((item) => [item.id, item]));
    const usedIds = new Set<string>();
    const items: Omit<typeof purchaseOrderItems.$inferInsert, "purchaseOrderId">[] = [];
    for (const [index, item] of command.items.entries()) {
      const previous = item.savedItemId ? previousById.get(item.savedItemId) : undefined;
      if (item.savedItemId && (!previous || usedIds.has(item.savedItemId))) { fields.push(`items.${index}.savedItemId`); continue; }
      if (item.savedItemId) usedIds.add(item.savedItemId);
      const product = productsById.get(item.productId);
      if (!product || !unitsById.has(product.unitId)) { fields.push(`items.${index}.productId`); continue; }
      const retain = previous?.productId === item.productId ? previous : undefined;
      const quantityCurrent = unitsById.get(item.quantityUnitId);
      const priceCurrent = unitsById.get(item.priceUnitId);
      const quantityUnit = quantityCurrent && retain?.quantityUnitId === item.quantityUnitId
        ? { ...quantityCurrent, name: retain.quantityUnitName, kind: retain.quantityUnitKind, kilogramsPerUnit: retain.quantityMeasureKg } : quantityCurrent;
      const priceUnit = priceCurrent && retain?.priceUnitId === item.priceUnitId
        ? { ...priceCurrent, name: retain.priceUnitName, kind: retain.priceUnitKind, kilogramsPerUnit: retain.priceMeasureKg } : priceCurrent;
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
      let quantityKg: string;
      try { quantityKg = quantityToKg(item.quantity, quantityMeasureKg); }
      catch { fields.push(`items.${index}.quantity`); continue; }
      try {
        const lineTotal = calculateLineTotal({ quantity: item.quantity, quantityMeasureKg, unitPrice: item.unitPrice, priceMeasureKg });
        items.push({ ...(previous ? { id: previous.id } : {}), organizationId: tenant.organizationId, lineNumber: index + 1, productId: product.id,
          productName: retain?.productName ?? product.name, productSku: retain ? retain.productSku : product.sku,
          quantity: item.quantity, quantityUnitId: quantityUnit.id, quantityUnitName: quantityUnit.name, quantityUnitKind: quantityUnit.kind,
          quantityMeasureKg, quantityKg, unitPrice: item.unitPrice, priceUnitId: priceUnit.id, priceUnitName: priceUnit.name, priceUnitKind: priceUnit.kind, priceMeasureKg, lineTotal });
      } catch { fields.push(`items.${index}.unitPrice`); }
    }
    if (fields.length || !supplier || !warehouse) return { status: "invalid" as const, fields };
    let total: string;
    try { total = sumLineTotals(items.map((item) => item.lineTotal)); }
    catch { return { status: "invalid" as const, fields: ["items"] }; }
    return { status: "ready" as const, supplier, warehouse, items, total };
}

export async function mutatePurchase(input: unknown): Promise<PurchaseState> {
  const action = z.object({ action: z.enum(["edit", "order", "cancel"]) }).safeParse(input);
  const permission = action.success && action.data.action === "cancel" ? "transactions.cancel" : "purchases.manage";
  const tenant = await requirePermission(permission);
  const parsed = mutationSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid", fields: [...new Set(parsed.error.issues.map((issue) => issue.path.join(".") || "action"))] };
  const command = parsed.data;
  const fingerprint = createHash("sha256").update(JSON.stringify(command)).digest("hex");
  return db.transaction(async (tx): Promise<PurchaseState> => {
    await lockActor(tx, tenant, permission);
    const scope = and(eq(purchaseOrders.organizationId, tenant.organizationId), eq(purchaseOrders.id, command.id));
    const [purchase] = await tx.select().from(purchaseOrders).where(scope).for("update");
    if (!purchase) notFound();
    if (purchase.lastMutationId === command.requestId) return purchase.lastMutationFingerprint === fingerprint
      ? { status: "success", purchaseId: purchase.id } : { status: "conflict" };
    if (purchase.revision !== command.revision) return { status: "conflict" };
    if (command.action === "edit" && purchase.status !== "draft") return { status: "conflict" };
    const next = command.action === "order" ? "ordered" : command.action === "cancel" ? "cancelled" : "draft";
    if (command.action !== "edit") {
      try { assertStatusTransition(purchase.status, next, { draft: ["ordered", "cancelled"], ordered: ["cancelled"], cancelled: [] }); }
      catch { return { status: "conflict" }; }
    }
    const now = new Date();
    let changes: Partial<typeof purchaseOrders.$inferInsert> = {};
    if (command.action !== "cancel") {
      const previous = await tx.select().from(purchaseOrderItems).where(and(eq(purchaseOrderItems.organizationId, tenant.organizationId), eq(purchaseOrderItems.purchaseOrderId, purchase.id))).orderBy(asc(purchaseOrderItems.lineNumber));
      const agreementCommand = command.action === "edit" ? command : { requestId: command.requestId, supplierId: purchase.supplierId,
        warehouseId: purchase.warehouseId, currency: purchase.currency, items: previous.map((item) => ({ savedItemId: item.id, productId: item.productId,
          quantity: item.quantity, quantityUnitId: item.quantityUnitId, quantityBagWeightKg: item.quantityUnitKind === "bag" ? item.quantityMeasureKg : null,
          unitPrice: item.unitPrice, priceUnitId: item.priceUnitId, priceBagWeightKg: item.priceUnitKind === "bag" ? item.priceMeasureKg : null })) };
      const agreement = await resolveAgreement(tx, tenant, agreementCommand, previous);
      if (agreement.status === "invalid") return agreement;
      if (command.action === "edit") {
        changes = { supplierId: agreement.supplier.id, supplierName: purchase.supplierId === agreement.supplier.id ? purchase.supplierName : agreement.supplier.name,
          warehouseId: agreement.warehouse.id, warehouseName: purchase.warehouseId === agreement.warehouse.id ? purchase.warehouseName : agreement.warehouse.name,
          currency: command.currency, total: agreement.total };
        await tx.delete(purchaseOrderItems).where(and(eq(purchaseOrderItems.organizationId, tenant.organizationId), eq(purchaseOrderItems.purchaseOrderId, purchase.id)));
        await tx.insert(purchaseOrderItems).values(agreement.items.map((item) => ({ ...item, purchaseOrderId: purchase.id })));
      } else changes = { orderedAt: now, orderedByUserId: tenant.userId, orderedByMembershipId: tenant.membershipId };
    } else changes = { cancelledAt: now, cancelledByUserId: tenant.userId, cancelledByMembershipId: tenant.membershipId, cancellationReason: command.reason };
    await tx.update(purchaseOrders).set({ ...changes, status: next, revision: purchase.revision + 1, updatedAt: now,
      updatedByUserId: tenant.userId, updatedByMembershipId: tenant.membershipId, lastMutationId: command.requestId, lastMutationFingerprint: fingerprint }).where(scope);
    await appendAudit(tx, tenant, { entityType: "purchase", entityId: purchase.id, action: command.action === "edit" ? "update" : command.action,
      requestId: command.requestId, before: purchase, after: { ...purchase, ...changes, status: next, revision: purchase.revision + 1 } });
    return { status: "success", purchaseId: purchase.id };
  });
}
