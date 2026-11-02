CREATE TABLE "purchase_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"line_number" integer NOT NULL,
	"product_id" uuid NOT NULL,
	"product_name" text NOT NULL,
	"product_sku" text,
	"quantity" numeric NOT NULL,
	"quantity_unit_id" uuid NOT NULL,
	"quantity_unit_name" text NOT NULL,
	"quantity_unit_kind" text NOT NULL,
	"quantity_measure_kg" numeric NOT NULL,
	"quantity_kg" numeric NOT NULL,
	"unit_price" numeric NOT NULL,
	"price_unit_id" uuid NOT NULL,
	"price_unit_name" text NOT NULL,
	"price_unit_kind" text NOT NULL,
	"price_measure_kg" numeric NOT NULL,
	"line_total" numeric NOT NULL,
	CONSTRAINT "purchase_items_line" UNIQUE("organization_id","purchase_order_id","line_number"),
	CONSTRAINT "purchase_items_line_number" CHECK ("purchase_order_items"."line_number" between 1 and 100),
	CONSTRAINT "purchase_items_names" CHECK (length(btrim("purchase_order_items"."product_name")) between 1 and 80 and length(btrim("purchase_order_items"."quantity_unit_name")) between 1 and 80 and length(btrim("purchase_order_items"."price_unit_name")) between 1 and 80),
	CONSTRAINT "purchase_items_kinds" CHECK ("purchase_order_items"."quantity_unit_kind" in ('fixed', 'bag') and "purchase_order_items"."price_unit_kind" in ('fixed', 'bag')),
	CONSTRAINT "purchase_items_quantity" CHECK ("purchase_order_items"."quantity" > 0 and "purchase_order_items"."quantity" < 1000000000000000000 and scale("purchase_order_items"."quantity") <= 18
    and "purchase_order_items"."quantity_kg" > 0 and "purchase_order_items"."quantity_kg" < 1000000000000000000 and scale("purchase_order_items"."quantity_kg") <= 3
    and "purchase_order_items"."quantity_kg" = "purchase_order_items"."quantity" * "purchase_order_items"."quantity_measure_kg"),
	CONSTRAINT "purchase_items_weights" CHECK ("purchase_order_items"."quantity_measure_kg" > 0 and "purchase_order_items"."quantity_measure_kg" < 1000000000000000000 and scale("purchase_order_items"."quantity_measure_kg") <= 3
    and "purchase_order_items"."price_measure_kg" > 0 and "purchase_order_items"."price_measure_kg" < 1000000000000000000 and scale("purchase_order_items"."price_measure_kg") <= 3),
	CONSTRAINT "purchase_items_money" CHECK ("purchase_order_items"."unit_price" >= 0 and "purchase_order_items"."unit_price" < 1000000000000000000 and scale("purchase_order_items"."unit_price") <= 2
    and "purchase_order_items"."line_total" >= 0 and "purchase_order_items"."line_total" < 1000000000000000000 and scale("purchase_order_items"."line_total") <= 2
    and "purchase_order_items"."line_total" = round("purchase_order_items"."quantity_kg" * "purchase_order_items"."unit_price" / "purchase_order_items"."price_measure_kg", 2))
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"request_fingerprint" text NOT NULL,
	"supplier_id" uuid NOT NULL,
	"supplier_name" text NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"warehouse_name" text NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"total" numeric NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_by_membership_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_organization_id" UNIQUE("organization_id","id"),
	CONSTRAINT "purchase_orders_request" UNIQUE("organization_id","request_id"),
	CONSTRAINT "purchase_orders_status" CHECK ("purchase_orders"."status" = 'draft'),
	CONSTRAINT "purchase_orders_currency" CHECK ("purchase_orders"."currency" in ('AFN', 'PKR')),
	CONSTRAINT "purchase_orders_total" CHECK ("purchase_orders"."total" >= 0 and "purchase_orders"."total" < 1000000000000000000 and scale("purchase_orders"."total") <= 2),
	CONSTRAINT "purchase_orders_fingerprint" CHECK ("purchase_orders"."request_fingerprint" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "purchase_orders_snapshots" CHECK (length(btrim("purchase_orders"."supplier_name")) between 1 and 80 and length(btrim("purchase_orders"."warehouse_name")) between 1 and 80),
	CONSTRAINT "purchase_orders_actor" CHECK (length(btrim("purchase_orders"."created_by_user_id")) > 0 and length(btrim("purchase_orders"."created_by_membership_id")) > 0)
);
--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id" UNIQUE("organization_id","id");--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_organization_id" UNIQUE("organization_id","id");--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_organization_id" UNIQUE("organization_id","id");--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_items_tenant_order" FOREIGN KEY ("organization_id","purchase_order_id") REFERENCES "public"."purchase_orders"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_items_tenant_product" FOREIGN KEY ("organization_id","product_id") REFERENCES "public"."products"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_items_tenant_quantity_unit" FOREIGN KEY ("organization_id","quantity_unit_id") REFERENCES "public"."catalog_units"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_items_tenant_price_unit" FOREIGN KEY ("organization_id","price_unit_id") REFERENCES "public"."catalog_units"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_tenant_supplier" FOREIGN KEY ("organization_id","supplier_id") REFERENCES "public"."suppliers"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_tenant_warehouse" FOREIGN KEY ("organization_id","warehouse_id") REFERENCES "public"."warehouses"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "purchase_orders_tenant_created" ON "purchase_orders" USING btree ("organization_id","created_at","id");
