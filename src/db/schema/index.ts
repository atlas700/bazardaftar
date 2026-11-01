import { sql } from "drizzle-orm";
import { boolean, check, foreignKey, numeric, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
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
  uniqueIndex("suppliers_organization_name").on(table.organizationId, sql`lower(btrim(${table.name}))`),
  check("suppliers_name", sql`${table.name} = btrim(${table.name}) and length(${table.name}) between 1 and 80`),
  check("suppliers_phone", sql`${table.phone} is null or (${table.phone} = btrim(${table.phone}) and length(${table.phone}) between 3 and 40
    and ${table.phone} ~ '^[+0-9۰-۹٠-٩(). -]+$' and ${table.phone} ~ '[0-9۰-۹٠-٩]')`),
  check("suppliers_location", sql`${table.location} is null or (${table.location} = btrim(${table.location}) and length(${table.location}) between 1 and 200)`),
  check("suppliers_type", sql`${table.type} is null or ${table.type} in ('individual', 'business')`),
  check("suppliers_notes", sql`${table.notes} is null or (${table.notes} = btrim(${table.notes}) and length(${table.notes}) between 1 and 2000)`),
  check("suppliers_payment_terms", sql`${table.paymentTerms} is null or (${table.paymentTerms} = btrim(${table.paymentTerms}) and length(${table.paymentTerms}) between 1 and 500)`),
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
