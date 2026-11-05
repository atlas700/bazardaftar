import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";
import { notFound, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { hasPermission } from "@/auth/permissions";
import { localIdSchema } from "@/domain/validation";
import { requirePermission } from "./authorization";
import { db } from "./index";
import { goodsReceiptItems, inventoryMovements, organizationRoleAssignments, products, purchaseOrders, warehouses } from "./schema";

const querySchema = z.object({ productId: localIdSchema.optional(), after: localIdSchema.optional() });
const pageSize = 20;

export async function getInventoryWorkspace(input: unknown = {}) {
  try {
    const tenant = await requirePermission("inventory.read");
    const parsed = querySchema.safeParse(input);
    if (!parsed.success) notFound();
    const { productId, after } = parsed.data;
    return await db.transaction(async (tx) => {
      const [actor] = await tx.select({ role: organizationRoleAssignments.role }).from(organizationRoleAssignments).where(and(
        eq(organizationRoleAssignments.organizationId, tenant.organizationId), eq(organizationRoleAssignments.membershipId, tenant.membershipId),
        eq(organizationRoleAssignments.userId, tenant.userId),
      )).limit(1);
      if (!actor || !hasPermission(actor.role, "inventory.read")) notFound();
      const canReadPurchases = hasPermission(actor.role, "purchases.read");
      const [product] = productId ? await tx.select({ id: products.id, name: products.name }).from(products)
        .where(and(eq(products.organizationId, tenant.organizationId), eq(products.id, productId))).limit(1) : [];
      if (productId && !product) notFound();
      const scope = and(eq(inventoryMovements.organizationId, tenant.organizationId), productId ? eq(inventoryMovements.productId, productId) : undefined);
      // Keep PostgreSQL's microseconds: converting the cursor timestamp to Date would lose rows.
      const [anchor] = after ? await tx.select({ createdAt: sql<string>`${inventoryMovements.createdAt}::text` }).from(inventoryMovements)
        .where(and(scope, eq(inventoryMovements.id, after))).limit(1) : [];
      if (after && !anchor) notFound();
      // shortcut: load the small pilot's product balances in full; paginate when catalogue size warrants it.
      const balances = await tx.select({ productId: inventoryMovements.productId, productName: products.name, productActive: products.isActive,
        warehouseId: inventoryMovements.warehouseId, warehouseName: warehouses.name, warehouseActive: warehouses.isActive,
        quantityKg: sql<string>`sum(${inventoryMovements.quantityKg})::text`,
      }).from(inventoryMovements)
        .innerJoin(products, and(eq(products.organizationId, inventoryMovements.organizationId), eq(products.id, inventoryMovements.productId)))
        .innerJoin(warehouses, and(eq(warehouses.organizationId, inventoryMovements.organizationId), eq(warehouses.id, inventoryMovements.warehouseId)))
        .where(scope).groupBy(inventoryMovements.productId, products.name, products.isActive, inventoryMovements.warehouseId, warehouses.name, warehouses.isActive)
        .orderBy(asc(products.name), asc(inventoryMovements.productId), asc(inventoryMovements.warehouseId));
      const rows = await tx.select({ id: inventoryMovements.id, productId: inventoryMovements.productId, productName: goodsReceiptItems.productName,
        warehouseName: purchaseOrders.warehouseName, quantityKg: inventoryMovements.quantityKg, kind: inventoryMovements.kind,
        createdAt: inventoryMovements.createdAt, receiptId: goodsReceiptItems.receiptId,
        purchaseId: canReadPurchases ? goodsReceiptItems.purchaseOrderId : sql<null>`null`,
        quantity: goodsReceiptItems.quantity, quantityUnitName: goodsReceiptItems.quantityUnitName, quantityMeasureKg: goodsReceiptItems.quantityMeasureKg,
      }).from(inventoryMovements)
        .innerJoin(goodsReceiptItems, and(eq(goodsReceiptItems.organizationId, inventoryMovements.organizationId), eq(goodsReceiptItems.id, inventoryMovements.receiptItemId)))
        .innerJoin(purchaseOrders, and(eq(purchaseOrders.organizationId, goodsReceiptItems.organizationId), eq(purchaseOrders.id, goodsReceiptItems.purchaseOrderId)))
        .where(and(scope, anchor && after ? sql`(${inventoryMovements.createdAt}, ${inventoryMovements.id}) < (${anchor.createdAt}::timestamptz, ${after}::uuid)` : undefined))
        .orderBy(sql`${inventoryMovements.createdAt} desc nulls last`, sql`${inventoryMovements.id} desc nulls last`).limit(pageSize + 1);
      const movements = rows.slice(0, pageSize);
      return { balances, movements, product: productId ? product : null, after: after ?? null, canReadPurchases,
        nextCursor: rows.length > pageSize ? movements[pageSize - 1].id : null };
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
  } catch (error) { unstable_rethrow(error); throw new Error("Inventory unavailable."); }
}

export type InventoryWorkspace = Awaited<ReturnType<typeof getInventoryWorkspace>>;
