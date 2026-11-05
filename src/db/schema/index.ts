import { sql } from "drizzle-orm";
import { boolean, check, date, foreignKey, index, integer, numeric, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { businessRoles } from "@/auth/permissions";
import { supplierTypes } from "@/domain/supplier";

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkOrganizationId: text("clerk_organization_id").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const catalogUnits = pgTable("catalog_units", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  kind: text("kind", { enum: ["fixed", "bag"] }).notNull(),
  // Unscaled numeric prevents PostgreSQL from silently rounding sub-gram inputs.
  kilogramsPerUnit: numeric("kilograms_per_unit"),
  isActive: boolean("is_active").default(true).notNull(),
}, (table) => [
  uniqueIndex("catalog_units_organization_name").on(table.organizationId, sql`lower(btrim(${table.name}))`),
  unique("catalog_units_organization_id").on(table.organizationId, table.id),
  check("catalog_units_name", sql`${table.name} = btrim(${table.name}) and length(${table.name}) between 1 and 80`),
  check("catalog_units_weight", sql`(${table.kind} = 'bag' and ${table.kilogramsPerUnit} is null) or
    (${table.kind} = 'fixed' and ${table.kilogramsPerUnit} is not null and ${table.kilogramsPerUnit} > 0
    and ${table.kilogramsPerUnit} < 1000000000000000000 and scale(${table.kilogramsPerUnit}) <= 3)`),
]);

export const productCategories = pgTable("product_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
}, (table) => [
  uniqueIndex("product_categories_organization_name").on(table.organizationId, sql`lower(btrim(${table.name}))`),
  unique("product_categories_organization_id").on(table.organizationId, table.id),
  check("product_categories_name", sql`${table.name} = btrim(${table.name}) and length(${table.name}) between 1 and 80`),
]);

export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  sku: text("sku"),
  categoryId: uuid("category_id"),
  unitId: uuid("unit_id").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
}, (table) => [
  unique("products_organization_id").on(table.organizationId, table.id),
  uniqueIndex("products_organization_name").on(table.organizationId, sql`lower(btrim(${table.name}))`),
  uniqueIndex("products_organization_sku").on(table.organizationId, sql`lower(btrim(${table.sku}))`),
  foreignKey({ name: "products_tenant_unit", columns: [table.organizationId, table.unitId],
    foreignColumns: [catalogUnits.organizationId, catalogUnits.id] }),
  foreignKey({ name: "products_tenant_category", columns: [table.organizationId, table.categoryId],
    foreignColumns: [productCategories.organizationId, productCategories.id] }),
  check("products_name", sql`${table.name} = btrim(${table.name}) and length(${table.name}) between 1 and 80`),
  check("products_sku", sql`${table.sku} is null or (${table.sku} = btrim(${table.sku}) and length(${table.sku}) between 1 and 40)`),
]);

export const suppliers = pgTable("suppliers", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  phone: text("phone"),
  location: text("location"),
  type: text("type", { enum: supplierTypes }),
  notes: text("notes"),
  paymentTerms: text("payment_terms"),
  isActive: boolean("is_active").default(true).notNull(),
}, (table) => [
  unique("suppliers_organization_id").on(table.organizationId, table.id),
  uniqueIndex("suppliers_organization_name").on(table.organizationId, sql`lower(btrim(${table.name}))`),
  check("suppliers_name", sql`${table.name} = btrim(${table.name}) and length(${table.name}) between 1 and 80`),
  check("suppliers_phone", sql`${table.phone} is null or (${table.phone} = btrim(${table.phone}) and length(${table.phone}) between 3 and 40
    and ${table.phone} ~ '^[+0-9۰-۹٠-٩(). -]+$' and ${table.phone} ~ '[0-9۰-۹٠-٩]')`),
  check("suppliers_location", sql`${table.location} is null or (${table.location} = btrim(${table.location}) and length(${table.location}) between 1 and 200)`),
  check("suppliers_type", sql`${table.type} is null or ${table.type} in ('individual', 'business')`),
  check("suppliers_notes", sql`${table.notes} is null or (${table.notes} = btrim(${table.notes}) and length(${table.notes}) between 1 and 2000)`),
  check("suppliers_payment_terms", sql`${table.paymentTerms} is null or (${table.paymentTerms} = btrim(${table.paymentTerms}) and length(${table.paymentTerms}) between 1 and 500)`),
]);

export const warehouses = pgTable("warehouses", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  location: text("location"),
  isActive: boolean("is_active").default(true).notNull(),
}, (table) => [
  unique("warehouses_organization_id").on(table.organizationId, table.id),
  // Inactive records still occupy the single pilot warehouse slot.
  unique("warehouses_one_per_organization").on(table.organizationId),
  check("warehouses_name", sql`${table.name} = btrim(${table.name}) and length(${table.name}) between 1 and 80`),
  check("warehouses_location", sql`${table.location} is null or (${table.location} = btrim(${table.location}) and length(${table.location}) between 1 and 200)`),
]);

export const purchaseOrders = pgTable("purchase_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  requestId: uuid("request_id").notNull(),
  requestFingerprint: text("request_fingerprint").notNull(),
  supplierId: uuid("supplier_id").notNull(),
  supplierName: text("supplier_name").notNull(),
  warehouseId: uuid("warehouse_id").notNull(),
  warehouseName: text("warehouse_name").notNull(),
  currency: text("currency", { enum: ["AFN", "PKR"] }).notNull(),
  status: text("status", { enum: ["draft", "ordered", "partially_received", "received", "cancelled"] }).default("draft").notNull(),
  revision: integer("revision").default(1).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  lastMutationId: uuid("last_mutation_id"),
  lastMutationFingerprint: text("last_mutation_fingerprint"),
  updatedByUserId: text("updated_by_user_id"),
  updatedByMembershipId: text("updated_by_membership_id"),
  orderedAt: timestamp("ordered_at", { withTimezone: true }),
  orderedByUserId: text("ordered_by_user_id"),
  orderedByMembershipId: text("ordered_by_membership_id"),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancelledByUserId: text("cancelled_by_user_id"),
  cancelledByMembershipId: text("cancelled_by_membership_id"),
  cancellationReason: text("cancellation_reason"),
  total: numeric("total").notNull(),
  createdByUserId: text("created_by_user_id").notNull(),
  createdByMembershipId: text("created_by_membership_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique("purchase_orders_organization_id").on(table.organizationId, table.id),
  unique("purchase_orders_receipt_context").on(table.organizationId, table.id, table.supplierId, table.warehouseId, table.currency),
  unique("purchase_orders_request").on(table.organizationId, table.requestId),
  index("purchase_orders_tenant_created").on(table.organizationId, table.createdAt, table.id),
  foreignKey({ name: "purchase_orders_tenant_supplier", columns: [table.organizationId, table.supplierId], foreignColumns: [suppliers.organizationId, suppliers.id] }),
  foreignKey({ name: "purchase_orders_tenant_warehouse", columns: [table.organizationId, table.warehouseId], foreignColumns: [warehouses.organizationId, warehouses.id] }),
  check("purchase_orders_status", sql`${table.status} in ('draft', 'ordered', 'partially_received', 'received', 'cancelled')`),
  check("purchase_orders_revision", sql`${table.revision} >= 1 and (
    (${table.revision} = 1 and ${table.lastMutationId} is null and ${table.lastMutationFingerprint} is null)
    or (${table.revision} > 1 and ${table.lastMutationId} is not null and ${table.lastMutationFingerprint} is not null
      and ${table.lastMutationFingerprint} ~ '^[0-9a-f]{64}$' and ${table.updatedByUserId} is not null
      and length(btrim(${table.updatedByUserId})) > 0 and ${table.updatedByMembershipId} is not null and length(btrim(${table.updatedByMembershipId})) > 0))`),
  check("purchase_orders_ordering", sql`(
    (${table.orderedAt} is null and ${table.orderedByUserId} is null and ${table.orderedByMembershipId} is null and ${table.status} not in ('ordered', 'partially_received', 'received'))
    or (${table.orderedAt} is not null and ${table.orderedByUserId} is not null and length(btrim(${table.orderedByUserId})) > 0
      and ${table.orderedByMembershipId} is not null and length(btrim(${table.orderedByMembershipId})) > 0 and ${table.status} <> 'draft'))`),
  check("purchase_orders_cancellation", sql`(
    (${table.status} <> 'cancelled' and ${table.cancelledAt} is null and ${table.cancelledByUserId} is null and ${table.cancelledByMembershipId} is null and ${table.cancellationReason} is null)
    or (${table.status} = 'cancelled' and ${table.cancelledAt} is not null and ${table.cancelledByUserId} is not null
      and length(btrim(${table.cancelledByUserId})) > 0 and ${table.cancelledByMembershipId} is not null
      and length(btrim(${table.cancelledByMembershipId})) > 0 and ${table.cancellationReason} is not null and length(btrim(${table.cancellationReason})) between 1 and 500))`),
  check("purchase_orders_currency", sql`${table.currency} in ('AFN', 'PKR')`),
  check("purchase_orders_total", sql`${table.total} >= 0 and ${table.total} < 1000000000000000000 and scale(${table.total}) <= 2`),
  check("purchase_orders_fingerprint", sql`${table.requestFingerprint} ~ '^[0-9a-f]{64}$'`),
  check("purchase_orders_snapshots", sql`length(btrim(${table.supplierName})) between 1 and 80 and length(btrim(${table.warehouseName})) between 1 and 80`),
  check("purchase_orders_actor", sql`length(btrim(${table.createdByUserId})) > 0 and length(btrim(${table.createdByMembershipId})) > 0`),
]);

export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  purchaseOrderId: uuid("purchase_order_id").notNull(),
  lineNumber: integer("line_number").notNull(),
  productId: uuid("product_id").notNull(),
  productName: text("product_name").notNull(),
  productSku: text("product_sku"),
  quantity: numeric("quantity").notNull(),
  quantityUnitId: uuid("quantity_unit_id").notNull(),
  quantityUnitName: text("quantity_unit_name").notNull(),
  quantityUnitKind: text("quantity_unit_kind", { enum: ["fixed", "bag"] }).notNull(),
  // For a bag, this is its actual entered weight; fixed measures retain their catalogue weight.
  quantityMeasureKg: numeric("quantity_measure_kg").notNull(),
  quantityKg: numeric("quantity_kg").notNull(),
  unitPrice: numeric("unit_price").notNull(),
  priceUnitId: uuid("price_unit_id").notNull(),
  priceUnitName: text("price_unit_name").notNull(),
  priceUnitKind: text("price_unit_kind", { enum: ["fixed", "bag"] }).notNull(),
  priceMeasureKg: numeric("price_measure_kg").notNull(),
  lineTotal: numeric("line_total").notNull(),
  receivedQuantityKg: numeric("received_quantity_kg").default("0.000").notNull(),
  recognizedValue: numeric("recognized_value").default("0.00").notNull(),
  approvedExtraKg: numeric("approved_extra_kg").default("0.000").notNull(),
}, (table) => [
  unique("purchase_items_line").on(table.organizationId, table.purchaseOrderId, table.lineNumber),
  unique("purchase_items_receipt_context").on(table.organizationId, table.purchaseOrderId, table.id, table.productId),
  check("purchase_items_received", sql`${table.receivedQuantityKg} >= 0 and ${table.receivedQuantityKg} < 1000000000000000000 and scale(${table.receivedQuantityKg}) <= 3
    and ${table.approvedExtraKg} >= 0 and ${table.approvedExtraKg} < 1000000000000000000 and scale(${table.approvedExtraKg}) <= 3
    and ${table.receivedQuantityKg} <= ${table.quantityKg} + ${table.approvedExtraKg}
    and ${table.recognizedValue} >= 0 and ${table.recognizedValue} < 1000000000000000000 and scale(${table.recognizedValue}) <= 2
    and ${table.recognizedValue} * 100 = div(${table.receivedQuantityKg} * ${table.unitPrice} * 100, ${table.priceMeasureKg})
      + case when mod(${table.receivedQuantityKg} * ${table.unitPrice} * 100, ${table.priceMeasureKg}) * 2 >= ${table.priceMeasureKg} then 1 else 0 end`),
  foreignKey({ name: "purchase_items_tenant_order", columns: [table.organizationId, table.purchaseOrderId], foreignColumns: [purchaseOrders.organizationId, purchaseOrders.id] }),
  foreignKey({ name: "purchase_items_tenant_product", columns: [table.organizationId, table.productId], foreignColumns: [products.organizationId, products.id] }),
  foreignKey({ name: "purchase_items_tenant_quantity_unit", columns: [table.organizationId, table.quantityUnitId], foreignColumns: [catalogUnits.organizationId, catalogUnits.id] }),
  foreignKey({ name: "purchase_items_tenant_price_unit", columns: [table.organizationId, table.priceUnitId], foreignColumns: [catalogUnits.organizationId, catalogUnits.id] }),
  check("purchase_items_line_number", sql`${table.lineNumber} between 1 and 100`),
  check("purchase_items_names", sql`length(btrim(${table.productName})) between 1 and 80 and length(btrim(${table.quantityUnitName})) between 1 and 80 and length(btrim(${table.priceUnitName})) between 1 and 80`),
  check("purchase_items_kinds", sql`${table.quantityUnitKind} in ('fixed', 'bag') and ${table.priceUnitKind} in ('fixed', 'bag')`),
  check("purchase_items_quantity", sql`${table.quantity} > 0 and ${table.quantity} < 1000000000000000000 and scale(${table.quantity}) <= 18
    and ${table.quantityKg} > 0 and ${table.quantityKg} < 1000000000000000000 and scale(${table.quantityKg}) <= 3
    and ${table.quantityKg} = ${table.quantity} * ${table.quantityMeasureKg}`),
  check("purchase_items_weights", sql`${table.quantityMeasureKg} > 0 and ${table.quantityMeasureKg} < 1000000000000000000 and scale(${table.quantityMeasureKg}) <= 3
    and ${table.priceMeasureKg} > 0 and ${table.priceMeasureKg} < 1000000000000000000 and scale(${table.priceMeasureKg}) <= 3`),
  check("purchase_items_money", sql`${table.unitPrice} >= 0 and ${table.unitPrice} < 1000000000000000000 and scale(${table.unitPrice}) <= 2
    and ${table.lineTotal} >= 0 and ${table.lineTotal} < 1000000000000000000 and scale(${table.lineTotal}) <= 2
    and ${table.lineTotal} * 100 = div(${table.quantityKg} * ${table.unitPrice} * 100, ${table.priceMeasureKg})
      + case when mod(${table.quantityKg} * ${table.unitPrice} * 100, ${table.priceMeasureKg}) * 2 >= ${table.priceMeasureKg} then 1 else 0 end`),
]);

export const goodsReceipts = pgTable("goods_receipts", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  purchaseOrderId: uuid("purchase_order_id").notNull(),
  requestId: uuid("request_id").notNull(),
  requestFingerprint: text("request_fingerprint").notNull(),
  supplierId: uuid("supplier_id").notNull(),
  warehouseId: uuid("warehouse_id").notNull(),
  currency: text("currency", { enum: ["AFN", "PKR"] }).notNull(),
  total: numeric("total").notNull(),
  completesPurchase: boolean("completes_purchase").notNull(),
  varianceReason: text("variance_reason"),
  varianceApprovedByUserId: text("variance_approved_by_user_id"),
  varianceApprovedByMembershipId: text("variance_approved_by_membership_id"),
  acceptedByUserId: text("accepted_by_user_id").notNull(),
  acceptedByMembershipId: text("accepted_by_membership_id").notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique("receipts_tenant_id").on(table.organizationId, table.id),
  unique("receipts_request").on(table.organizationId, table.requestId),
  unique("receipts_purchase_context").on(table.organizationId, table.id, table.purchaseOrderId),
  unique("receipts_payable_context").on(table.organizationId, table.id, table.supplierId, table.currency, table.total),
  index("receipts_purchase").on(table.organizationId, table.purchaseOrderId, table.acceptedAt, table.id),
  foreignKey({ name: "receipts_agreement", columns: [table.organizationId, table.purchaseOrderId, table.supplierId, table.warehouseId, table.currency],
    foreignColumns: [purchaseOrders.organizationId, purchaseOrders.id, purchaseOrders.supplierId, purchaseOrders.warehouseId, purchaseOrders.currency] }),
  check("receipts_total", sql`${table.total} >= 0 and ${table.total} < 1000000000000000000 and scale(${table.total}) <= 2`),
  check("receipts_fingerprint", sql`${table.requestFingerprint} ~ '^[0-9a-f]{64}$'`),
  check("receipts_actor", sql`length(btrim(${table.acceptedByUserId})) > 0 and length(btrim(${table.acceptedByMembershipId})) > 0`),
  check("receipts_approval", sql`(${table.varianceReason} is null and ${table.varianceApprovedByUserId} is null and ${table.varianceApprovedByMembershipId} is null)
    or (${table.varianceReason} is not null and length(btrim(${table.varianceReason})) between 1 and 500
      and ${table.varianceApprovedByUserId} is not null and ${table.varianceApprovedByUserId} = ${table.acceptedByUserId}
      and ${table.varianceApprovedByMembershipId} is not null and ${table.varianceApprovedByMembershipId} = ${table.acceptedByMembershipId})`),
]);

export const goodsReceiptItems = pgTable("goods_receipt_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  receiptId: uuid("receipt_id").notNull(),
  purchaseOrderId: uuid("purchase_order_id").notNull(),
  purchaseItemId: uuid("purchase_item_id").notNull(),
  productId: uuid("product_id").notNull(),
  productName: text("product_name").notNull(),
  quantity: numeric("quantity").notNull(),
  quantityUnitId: uuid("quantity_unit_id").notNull(),
  quantityUnitName: text("quantity_unit_name").notNull(),
  quantityUnitKind: text("quantity_unit_kind", { enum: ["fixed", "bag"] }).notNull(),
  quantityMeasureKg: numeric("quantity_measure_kg").notNull(),
  quantityKg: numeric("quantity_kg").notNull(),
  unitPrice: numeric("unit_price").notNull(),
  priceUnitName: text("price_unit_name").notNull(),
  priceMeasureKg: numeric("price_measure_kg").notNull(),
  previousQuantityKg: numeric("previous_quantity_kg").notNull(),
  cumulativeQuantityKg: numeric("cumulative_quantity_kg").notNull(),
  previouslyRecognized: numeric("previously_recognized").notNull(),
  recognizedValue: numeric("recognized_value").notNull(),
}, (table) => [
  unique("receipt_items_tenant_id").on(table.organizationId, table.id),
  unique("receipt_items_once").on(table.organizationId, table.receiptId, table.purchaseItemId),
  unique("receipt_items_movement_context").on(table.organizationId, table.id, table.productId, table.quantityKg),
  foreignKey({ name: "receipt_items_receipt", columns: [table.organizationId, table.receiptId, table.purchaseOrderId], foreignColumns: [goodsReceipts.organizationId, goodsReceipts.id, goodsReceipts.purchaseOrderId] }),
  foreignKey({ name: "receipt_items_agreement", columns: [table.organizationId, table.purchaseOrderId, table.purchaseItemId, table.productId], foreignColumns: [purchaseOrderItems.organizationId, purchaseOrderItems.purchaseOrderId, purchaseOrderItems.id, purchaseOrderItems.productId] }),
  foreignKey({ name: "receipt_items_unit", columns: [table.organizationId, table.quantityUnitId], foreignColumns: [catalogUnits.organizationId, catalogUnits.id] }),
  check("receipt_items_quantity", sql`${table.quantity} > 0 and ${table.quantity} < 1000000000000000000 and scale(${table.quantity}) <= 18
    and ${table.quantityKg} > 0 and ${table.quantityKg} < 1000000000000000000 and scale(${table.quantityKg}) <= 3
    and ${table.quantityMeasureKg} > 0 and ${table.quantityMeasureKg} < 1000000000000000000 and scale(${table.quantityMeasureKg}) <= 3
    and ${table.quantityKg} = ${table.quantity} * ${table.quantityMeasureKg}
    and ${table.previousQuantityKg} >= 0 and scale(${table.previousQuantityKg}) <= 3
    and ${table.cumulativeQuantityKg} = ${table.previousQuantityKg} + ${table.quantityKg} and ${table.cumulativeQuantityKg} < 1000000000000000000`),
  check("receipt_items_snapshots", sql`length(btrim(${table.productName})) between 1 and 80 and length(btrim(${table.quantityUnitName})) between 1 and 80
    and length(btrim(${table.priceUnitName})) between 1 and 80 and ${table.quantityUnitKind} in ('fixed', 'bag')
    and ${table.unitPrice} >= 0 and ${table.unitPrice} < 1000000000000000000 and scale(${table.unitPrice}) <= 2
    and ${table.priceMeasureKg} > 0 and ${table.priceMeasureKg} < 1000000000000000000 and scale(${table.priceMeasureKg}) <= 3`),
  check("receipt_items_value", sql`${table.previouslyRecognized} >= 0 and scale(${table.previouslyRecognized}) <= 2
    and ${table.recognizedValue} >= 0 and ${table.recognizedValue} < 1000000000000000000 and scale(${table.recognizedValue}) <= 2
    and ${table.previouslyRecognized} * 100 = div(${table.previousQuantityKg} * ${table.unitPrice} * 100, ${table.priceMeasureKg})
      + case when mod(${table.previousQuantityKg} * ${table.unitPrice} * 100, ${table.priceMeasureKg}) * 2 >= ${table.priceMeasureKg} then 1 else 0 end
    and (${table.previouslyRecognized} + ${table.recognizedValue}) * 100 = div(${table.cumulativeQuantityKg} * ${table.unitPrice} * 100, ${table.priceMeasureKg})
      + case when mod(${table.cumulativeQuantityKg} * ${table.unitPrice} * 100, ${table.priceMeasureKg}) * 2 >= ${table.priceMeasureKg} then 1 else 0 end`),
]);

export const inventoryMovements = pgTable("inventory_movements", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  receiptItemId: uuid("receipt_item_id"),
  productId: uuid("product_id").notNull(),
  warehouseId: uuid("warehouse_id").notNull(),
  quantityKg: numeric("quantity_kg").notNull(),
  kind: text("kind", { enum: ["receipt", "adjustment"] }).default("receipt").notNull(),
  requestId: uuid("request_id"),
  requestFingerprint: text("request_fingerprint"),
  reasonCode: text("reason_code", { enum: ["loss", "spoilage", "count_correction", "opening_stock"] }),
  reason: text("reason"),
  reference: text("reference"),
  productName: text("product_name"),
  warehouseName: text("warehouse_name"),
  performedByUserId: text("performed_by_user_id").notNull(),
  performedByMembershipId: text("performed_by_membership_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique("movements_receipt_once").on(table.organizationId, table.receiptItemId),
  unique("movements_request_once").on(table.organizationId, table.requestId),
  index("movements_history").on(table.organizationId, table.createdAt.desc(), table.id.desc()),
  index("movements_product_history").on(table.organizationId, table.productId, table.createdAt.desc(), table.id.desc()),
  foreignKey({ name: "movements_receipt_item", columns: [table.organizationId, table.receiptItemId, table.productId, table.quantityKg], foreignColumns: [goodsReceiptItems.organizationId, goodsReceiptItems.id, goodsReceiptItems.productId, goodsReceiptItems.quantityKg] }),
  foreignKey({ name: "movements_warehouse", columns: [table.organizationId, table.warehouseId], foreignColumns: [warehouses.organizationId, warehouses.id] }),
  foreignKey({ name: "movements_product", columns: [table.organizationId, table.productId], foreignColumns: [products.organizationId, products.id] }),
  check("movements_quantity", sql`${table.quantityKg} <> 0 and abs(${table.quantityKg}) < 1000000000000000000 and scale(${table.quantityKg}) <= 3`),
  check("movements_source", sql`(${table.kind} = 'receipt' and ${table.receiptItemId} is not null and ${table.quantityKg} > 0
    and ${table.requestId} is null and ${table.requestFingerprint} is null and ${table.reasonCode} is null and ${table.reason} is null
    and ${table.reference} is null and ${table.productName} is null and ${table.warehouseName} is null)
    or (${table.kind} = 'adjustment' and ${table.receiptItemId} is null and ${table.requestId} is not null
    and ${table.requestFingerprint} is not null and ${table.requestFingerprint} ~ '^[0-9a-f]{64}$'
    and ${table.reasonCode} is not null and ${table.reasonCode} in ('loss', 'spoilage', 'count_correction', 'opening_stock')
    and ${table.reason} is not null and length(btrim(${table.reason})) between 1 and 500
    and ${table.reference} is not null and length(${table.reference}) <= 100
    and ${table.productName} is not null and length(btrim(${table.productName})) > 0
    and ${table.warehouseName} is not null and length(btrim(${table.warehouseName})) > 0
    and (${table.reasonCode} = 'count_correction' or (${table.reasonCode} = 'opening_stock' and ${table.quantityKg} > 0)
      or (${table.reasonCode} in ('loss', 'spoilage') and ${table.quantityKg} < 0)))`),
  check("movements_actor", sql`length(btrim(${table.performedByUserId})) > 0 and length(btrim(${table.performedByMembershipId})) > 0`),
]);

export const supplierPayables = pgTable("supplier_payables", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  receiptId: uuid("receipt_id").notNull(),
  supplierId: uuid("supplier_id").notNull(),
  currency: text("currency", { enum: ["AFN", "PKR"] }).notNull(),
  amount: numeric("amount").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique("payables_receipt_once").on(table.organizationId, table.receiptId),
  unique("payables_tenant_id").on(table.organizationId, table.id),
  unique("payables_settlement_context").on(table.organizationId, table.id, table.supplierId, table.currency),
  index("payables_supplier_oldest").on(table.organizationId, table.supplierId, table.currency, table.createdAt, table.id),
  foreignKey({ name: "payables_receipt", columns: [table.organizationId, table.receiptId, table.supplierId, table.currency, table.amount], foreignColumns: [goodsReceipts.organizationId, goodsReceipts.id, goodsReceipts.supplierId, goodsReceipts.currency, goodsReceipts.total] }),
  check("payables_amount", sql`${table.amount} >= 0 and ${table.amount} < 1000000000000000000 and scale(${table.amount}) <= 2 and ${table.currency} in ('AFN', 'PKR')`),
]);

export const supplierPayments = pgTable("supplier_payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  requestId: uuid("request_id").notNull(),
  requestFingerprint: text("request_fingerprint").notNull(),
  supplierId: uuid("supplier_id").notNull(),
  supplierName: text("supplier_name").notNull(),
  currency: text("currency", { enum: ["AFN", "PKR"] }).notNull(),
  paidOn: date("paid_on", { mode: "string" }).notNull(),
  afnCash: numeric("afn_cash").notNull(),
  pkrCash: numeric("pkr_cash").notNull(),
  pkrPerAfn: numeric("pkr_per_afn"),
  amount: numeric("amount").notNull(),
  reference: text("reference").notNull(),
  note: text("note").notNull(),
  recordedByUserId: text("recorded_by_user_id").notNull(),
  recordedByMembershipId: text("recorded_by_membership_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique("payments_request").on(table.organizationId, table.requestId),
  unique("payments_settlement_context").on(table.organizationId, table.id, table.supplierId, table.currency),
  index("payments_supplier_history").on(table.organizationId, table.supplierId, table.currency, table.createdAt, table.id),
  foreignKey({ name: "payments_tenant_supplier", columns: [table.organizationId, table.supplierId], foreignColumns: [suppliers.organizationId, suppliers.id] }),
  check("payments_cash", sql`${table.afnCash} >= 0 and ${table.afnCash} < 1000000000000000000 and scale(${table.afnCash}) = 0
    and ${table.pkrCash} >= 0 and ${table.pkrCash} < 1000000000000000000 and scale(${table.pkrCash}) = 0 and (${table.afnCash} > 0 or ${table.pkrCash} > 0)`),
  check("payments_rate", sql`(${table.pkrPerAfn} is null and ((${table.currency} = 'AFN' and ${table.pkrCash} = 0) or (${table.currency} = 'PKR' and ${table.afnCash} = 0)))
    or (${table.pkrPerAfn} is not null and ${table.pkrPerAfn} > 0 and ${table.pkrPerAfn} < 1000000000000000000 and scale(${table.pkrPerAfn}) <= 6)`),
  check("payments_value", sql`${table.currency} in ('AFN', 'PKR') and ${table.amount} > 0 and ${table.amount} < 1000000000000000000 and scale(${table.amount}) <= 2
    and ${table.amount} = case when ${table.currency} = 'AFN' then round(${table.afnCash} + ${table.pkrCash} / coalesce(${table.pkrPerAfn}, 1), 2)
      else round(${table.pkrCash} + ${table.afnCash} * coalesce(${table.pkrPerAfn}, 1), 2) end`),
  check("payments_provenance", sql`${table.requestFingerprint} ~ '^[0-9a-f]{64}$' and length(btrim(${table.supplierName})) between 1 and 80
    and length(${table.reference}) <= 100 and length(${table.note}) <= 500
    and length(btrim(${table.recordedByUserId})) > 0 and length(btrim(${table.recordedByMembershipId})) > 0`),
]);

export const supplierPaymentAllocations = pgTable("supplier_payment_allocations", {
  organizationId: uuid("organization_id").notNull(),
  paymentId: uuid("payment_id").notNull(),
  payableId: uuid("payable_id").notNull(),
  supplierId: uuid("supplier_id").notNull(),
  currency: text("currency", { enum: ["AFN", "PKR"] }).notNull(),
  amount: numeric("amount").notNull(),
}, (table) => [
  primaryKey({ columns: [table.organizationId, table.paymentId, table.payableId] }),
  unique("allocations_settlement_context").on(table.organizationId, table.paymentId, table.payableId, table.supplierId, table.currency),
  index("allocations_payable").on(table.organizationId, table.payableId),
  foreignKey({ name: "allocations_payment", columns: [table.organizationId, table.paymentId, table.supplierId, table.currency], foreignColumns: [supplierPayments.organizationId, supplierPayments.id, supplierPayments.supplierId, supplierPayments.currency] }),
  foreignKey({ name: "allocations_payable", columns: [table.organizationId, table.payableId, table.supplierId, table.currency], foreignColumns: [supplierPayables.organizationId, supplierPayables.id, supplierPayables.supplierId, supplierPayables.currency] }),
  check("allocations_amount", sql`${table.amount} > 0 and ${table.amount} < 1000000000000000000 and scale(${table.amount}) <= 2`),
]);

// This separate append-only source records the owner's approval; reductions are never cash.
export const supplierPaymentReductions = pgTable("supplier_payment_reductions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  requestId: uuid("request_id").notNull(),
  requestFingerprint: text("request_fingerprint").notNull(),
  paymentId: uuid("payment_id").notNull(),
  payableId: uuid("payable_id").notNull(),
  supplierId: uuid("supplier_id").notNull(),
  currency: text("currency", { enum: ["AFN", "PKR"] }).notNull(),
  amount: numeric("amount").notNull(),
  reason: text("reason").notNull(),
  approvedByUserId: text("approved_by_user_id").notNull(),
  approvedByMembershipId: text("approved_by_membership_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique("reductions_request").on(table.organizationId, table.requestId),
  index("reductions_payable").on(table.organizationId, table.payableId),
  foreignKey({ name: "reductions_allocated_payable", columns: [table.organizationId, table.paymentId, table.payableId, table.supplierId, table.currency],
    foreignColumns: [supplierPaymentAllocations.organizationId, supplierPaymentAllocations.paymentId, supplierPaymentAllocations.payableId, supplierPaymentAllocations.supplierId, supplierPaymentAllocations.currency] }),
  check("reductions_amount", sql`${table.amount} > 0 and ${table.amount} <= 0.99 and scale(${table.amount}) <= 2`),
  check("reductions_provenance", sql`${table.requestFingerprint} ~ '^[0-9a-f]{64}$' and length(btrim(${table.reason})) between 1 and 500
    and length(btrim(${table.approvedByUserId})) > 0 and length(btrim(${table.approvedByMembershipId})) > 0`),
]);

export const organizationRoleAssignments = pgTable("organization_role_assignments", {
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  membershipId: text("membership_id").notNull(),
  userId: text("user_id").notNull(),
  role: text("role", { enum: businessRoles }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.organizationId, table.membershipId] }),
  check("organization_role_assignments_role", sql`${table.role} in ('owner', 'admin', 'manager', 'warehouse', 'sales', 'accountant', 'viewer')`),
  check("organization_role_assignments_identity", sql`length(btrim(${table.membershipId})) > 0 and length(btrim(${table.userId})) > 0`),
]);

export const organizationSettings = pgTable("organization_settings", {
  organizationId: uuid("organization_id").primaryKey().references(() => organizations.id),
  name: text("name").notNull(),
  businessType: text("business_type").notNull(),
  timezone: text("timezone").notNull(),
  baseCurrency: text("base_currency").notNull(),
  locale: text("locale").notNull(),
}, (table) => [
  check("organization_settings_name", sql`length(btrim(${table.name})) between 1 and 100`),
  check("organization_settings_business_type", sql`length(btrim(${table.businessType})) between 1 and 100`),
  check("organization_settings_timezone", sql`length(${table.timezone}) between 1 and 100`),
  check("organization_settings_currency", sql`${table.baseCurrency} = 'AFN'`),
  check("organization_settings_locale", sql`${table.locale} in ('en-US', 'ps-AF')`),
]);

// One durable request per creator keeps retries tied to the first business.
export const organizationOnboarding = pgTable("organization_onboarding", {
  userId: text("user_id").primaryKey(),
  id: uuid("id").defaultRandom().notNull().unique(),
  clerkOrganizationId: text("clerk_organization_id").unique(),
  ownerMembershipId: text("owner_membership_id"),
  name: text("name").notNull(),
  businessType: text("business_type").notNull(),
  timezone: text("timezone").notNull(),
  baseCurrency: text("base_currency").notNull(),
  locale: text("locale").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
