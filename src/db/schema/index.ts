import { sql } from "drizzle-orm";
import { boolean, check, foreignKey, index, integer, numeric, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
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
  status: text("status", { enum: ["draft"] }).default("draft").notNull(),
  total: numeric("total").notNull(),
  createdByUserId: text("created_by_user_id").notNull(),
  createdByMembershipId: text("created_by_membership_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique("purchase_orders_organization_id").on(table.organizationId, table.id),
  unique("purchase_orders_request").on(table.organizationId, table.requestId),
  index("purchase_orders_tenant_created").on(table.organizationId, table.createdAt, table.id),
  foreignKey({ name: "purchase_orders_tenant_supplier", columns: [table.organizationId, table.supplierId], foreignColumns: [suppliers.organizationId, suppliers.id] }),
  foreignKey({ name: "purchase_orders_tenant_warehouse", columns: [table.organizationId, table.warehouseId], foreignColumns: [warehouses.organizationId, warehouses.id] }),
  check("purchase_orders_status", sql`${table.status} = 'draft'`),
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
}, (table) => [
  unique("purchase_items_line").on(table.organizationId, table.purchaseOrderId, table.lineNumber),
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
    and ${table.lineTotal} = round(${table.quantityKg} * ${table.unitPrice} / ${table.priceMeasureKg}, 2)`),
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
