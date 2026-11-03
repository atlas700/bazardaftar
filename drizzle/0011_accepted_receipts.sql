CREATE TABLE "goods_receipt_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"receipt_id" uuid NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"purchase_item_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_name" text NOT NULL,
	"quantity" numeric NOT NULL,
	"quantity_unit_id" uuid NOT NULL,
	"quantity_unit_name" text NOT NULL,
	"quantity_unit_kind" text NOT NULL,
	"quantity_measure_kg" numeric NOT NULL,
	"quantity_kg" numeric NOT NULL,
	"unit_price" numeric NOT NULL,
	"price_unit_name" text NOT NULL,
	"price_measure_kg" numeric NOT NULL,
	"previous_quantity_kg" numeric NOT NULL,
	"cumulative_quantity_kg" numeric NOT NULL,
	"previously_recognized" numeric NOT NULL,
	"recognized_value" numeric NOT NULL,
	CONSTRAINT "receipt_items_tenant_id" UNIQUE("organization_id","id"),
	CONSTRAINT "receipt_items_once" UNIQUE("organization_id","receipt_id","purchase_item_id"),
	CONSTRAINT "receipt_items_movement_context" UNIQUE("organization_id","id","product_id","quantity_kg"),
	CONSTRAINT "receipt_items_quantity" CHECK ("goods_receipt_items"."quantity" > 0 and "goods_receipt_items"."quantity" < 1000000000000000000 and scale("goods_receipt_items"."quantity") <= 18
    and "goods_receipt_items"."quantity_kg" > 0 and "goods_receipt_items"."quantity_kg" < 1000000000000000000 and scale("goods_receipt_items"."quantity_kg") <= 3
    and "goods_receipt_items"."quantity_measure_kg" > 0 and "goods_receipt_items"."quantity_measure_kg" < 1000000000000000000 and scale("goods_receipt_items"."quantity_measure_kg") <= 3
    and "goods_receipt_items"."quantity_kg" = "goods_receipt_items"."quantity" * "goods_receipt_items"."quantity_measure_kg"
    and "goods_receipt_items"."previous_quantity_kg" >= 0 and scale("goods_receipt_items"."previous_quantity_kg") <= 3
    and "goods_receipt_items"."cumulative_quantity_kg" = "goods_receipt_items"."previous_quantity_kg" + "goods_receipt_items"."quantity_kg" and "goods_receipt_items"."cumulative_quantity_kg" < 1000000000000000000),
	CONSTRAINT "receipt_items_snapshots" CHECK (length(btrim("goods_receipt_items"."product_name")) between 1 and 80 and length(btrim("goods_receipt_items"."quantity_unit_name")) between 1 and 80
    and length(btrim("goods_receipt_items"."price_unit_name")) between 1 and 80 and "goods_receipt_items"."quantity_unit_kind" in ('fixed', 'bag')
    and "goods_receipt_items"."unit_price" >= 0 and "goods_receipt_items"."unit_price" < 1000000000000000000 and scale("goods_receipt_items"."unit_price") <= 2
    and "goods_receipt_items"."price_measure_kg" > 0 and "goods_receipt_items"."price_measure_kg" < 1000000000000000000 and scale("goods_receipt_items"."price_measure_kg") <= 3),
	CONSTRAINT "receipt_items_value" CHECK ("goods_receipt_items"."previously_recognized" >= 0 and scale("goods_receipt_items"."previously_recognized") <= 2
    and "goods_receipt_items"."recognized_value" >= 0 and "goods_receipt_items"."recognized_value" < 1000000000000000000 and scale("goods_receipt_items"."recognized_value") <= 2
    and "goods_receipt_items"."previously_recognized" * 100 = div("goods_receipt_items"."previous_quantity_kg" * "goods_receipt_items"."unit_price" * 100, "goods_receipt_items"."price_measure_kg")
      + case when mod("goods_receipt_items"."previous_quantity_kg" * "goods_receipt_items"."unit_price" * 100, "goods_receipt_items"."price_measure_kg") * 2 >= "goods_receipt_items"."price_measure_kg" then 1 else 0 end
    and ("goods_receipt_items"."previously_recognized" + "goods_receipt_items"."recognized_value") * 100 = div("goods_receipt_items"."cumulative_quantity_kg" * "goods_receipt_items"."unit_price" * 100, "goods_receipt_items"."price_measure_kg")
      + case when mod("goods_receipt_items"."cumulative_quantity_kg" * "goods_receipt_items"."unit_price" * 100, "goods_receipt_items"."price_measure_kg") * 2 >= "goods_receipt_items"."price_measure_kg" then 1 else 0 end)
);
--> statement-breakpoint
CREATE TABLE "goods_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"request_fingerprint" text NOT NULL,
	"supplier_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"currency" text NOT NULL,
	"total" numeric NOT NULL,
	"completes_purchase" boolean NOT NULL,
	"variance_reason" text,
	"variance_approved_by_user_id" text,
	"variance_approved_by_membership_id" text,
	"accepted_by_user_id" text NOT NULL,
	"accepted_by_membership_id" text NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receipts_tenant_id" UNIQUE("organization_id","id"),
	CONSTRAINT "receipts_request" UNIQUE("organization_id","request_id"),
	CONSTRAINT "receipts_purchase_context" UNIQUE("organization_id","id","purchase_order_id"),
	CONSTRAINT "receipts_payable_context" UNIQUE("organization_id","id","supplier_id","currency","total"),
	CONSTRAINT "receipts_total" CHECK ("goods_receipts"."total" >= 0 and "goods_receipts"."total" < 1000000000000000000 and scale("goods_receipts"."total") <= 2),
	CONSTRAINT "receipts_fingerprint" CHECK ("goods_receipts"."request_fingerprint" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "receipts_actor" CHECK (length(btrim("goods_receipts"."accepted_by_user_id")) > 0 and length(btrim("goods_receipts"."accepted_by_membership_id")) > 0),
	CONSTRAINT "receipts_approval" CHECK (("goods_receipts"."variance_reason" is null and "goods_receipts"."variance_approved_by_user_id" is null and "goods_receipts"."variance_approved_by_membership_id" is null)
    or ("goods_receipts"."variance_reason" is not null and length(btrim("goods_receipts"."variance_reason")) between 1 and 500
      and "goods_receipts"."variance_approved_by_user_id" is not null and "goods_receipts"."variance_approved_by_user_id" = "goods_receipts"."accepted_by_user_id"
      and "goods_receipts"."variance_approved_by_membership_id" is not null and "goods_receipts"."variance_approved_by_membership_id" = "goods_receipts"."accepted_by_membership_id"))
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"receipt_item_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"quantity_kg" numeric NOT NULL,
	"kind" text DEFAULT 'receipt' NOT NULL,
	"performed_by_user_id" text NOT NULL,
	"performed_by_membership_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "movements_receipt_once" UNIQUE("organization_id","receipt_item_id"),
	CONSTRAINT "movements_receipt" CHECK ("inventory_movements"."kind" = 'receipt' and "inventory_movements"."quantity_kg" > 0 and "inventory_movements"."quantity_kg" < 1000000000000000000 and scale("inventory_movements"."quantity_kg") <= 3),
	CONSTRAINT "movements_actor" CHECK (length(btrim("inventory_movements"."performed_by_user_id")) > 0 and length(btrim("inventory_movements"."performed_by_membership_id")) > 0)
);
--> statement-breakpoint
CREATE TABLE "supplier_payables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"receipt_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"currency" text NOT NULL,
	"amount" numeric NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payables_receipt_once" UNIQUE("organization_id","receipt_id"),
	CONSTRAINT "payables_tenant_id" UNIQUE("organization_id","id"),
	CONSTRAINT "payables_amount" CHECK ("supplier_payables"."amount" >= 0 and "supplier_payables"."amount" < 1000000000000000000 and scale("supplier_payables"."amount") <= 2 and "supplier_payables"."currency" in ('AFN', 'PKR'))
);
--> statement-breakpoint
ALTER TABLE "purchase_orders" DROP CONSTRAINT "purchase_orders_status";--> statement-breakpoint
ALTER TABLE "purchase_orders" DROP CONSTRAINT "purchase_orders_ordering";--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD COLUMN "received_quantity_kg" numeric DEFAULT '0.000' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD COLUMN "recognized_value" numeric DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD COLUMN "approved_extra_kg" numeric DEFAULT '0.000' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_items_receipt_context" UNIQUE("organization_id","purchase_order_id","id","product_id");--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_receipt_context" UNIQUE("organization_id","id","supplier_id","warehouse_id","currency");--> statement-breakpoint
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "receipt_items_receipt" FOREIGN KEY ("organization_id","receipt_id","purchase_order_id") REFERENCES "public"."goods_receipts"("organization_id","id","purchase_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "receipt_items_agreement" FOREIGN KEY ("organization_id","purchase_order_id","purchase_item_id","product_id") REFERENCES "public"."purchase_order_items"("organization_id","purchase_order_id","id","product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "receipt_items_unit" FOREIGN KEY ("organization_id","quantity_unit_id") REFERENCES "public"."catalog_units"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goods_receipts" ADD CONSTRAINT "receipts_agreement" FOREIGN KEY ("organization_id","purchase_order_id","supplier_id","warehouse_id","currency") REFERENCES "public"."purchase_orders"("organization_id","id","supplier_id","warehouse_id","currency") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "movements_receipt_item" FOREIGN KEY ("organization_id","receipt_item_id","product_id","quantity_kg") REFERENCES "public"."goods_receipt_items"("organization_id","id","product_id","quantity_kg") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "movements_warehouse" FOREIGN KEY ("organization_id","warehouse_id") REFERENCES "public"."warehouses"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payables" ADD CONSTRAINT "supplier_payables_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payables" ADD CONSTRAINT "payables_receipt" FOREIGN KEY ("organization_id","receipt_id","supplier_id","currency","amount") REFERENCES "public"."goods_receipts"("organization_id","id","supplier_id","currency","total") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "receipts_purchase" ON "goods_receipts" USING btree ("organization_id","purchase_order_id","accepted_at","id");--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_items_received" CHECK ("purchase_order_items"."received_quantity_kg" >= 0 and "purchase_order_items"."received_quantity_kg" < 1000000000000000000 and scale("purchase_order_items"."received_quantity_kg") <= 3
    and "purchase_order_items"."approved_extra_kg" >= 0 and "purchase_order_items"."approved_extra_kg" < 1000000000000000000 and scale("purchase_order_items"."approved_extra_kg") <= 3
    and "purchase_order_items"."received_quantity_kg" <= "purchase_order_items"."quantity_kg" + "purchase_order_items"."approved_extra_kg"
    and "purchase_order_items"."recognized_value" >= 0 and "purchase_order_items"."recognized_value" < 1000000000000000000 and scale("purchase_order_items"."recognized_value") <= 2
    and "purchase_order_items"."recognized_value" * 100 = div("purchase_order_items"."received_quantity_kg" * "purchase_order_items"."unit_price" * 100, "purchase_order_items"."price_measure_kg")
      + case when mod("purchase_order_items"."received_quantity_kg" * "purchase_order_items"."unit_price" * 100, "purchase_order_items"."price_measure_kg") * 2 >= "purchase_order_items"."price_measure_kg" then 1 else 0 end);--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_status" CHECK ("purchase_orders"."status" in ('draft', 'ordered', 'partially_received', 'received', 'cancelled'));--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_ordering" CHECK ((
    ("purchase_orders"."ordered_at" is null and "purchase_orders"."ordered_by_user_id" is null and "purchase_orders"."ordered_by_membership_id" is null and "purchase_orders"."status" not in ('ordered', 'partially_received', 'received'))
    or ("purchase_orders"."ordered_at" is not null and "purchase_orders"."ordered_by_user_id" is not null and length(btrim("purchase_orders"."ordered_by_user_id")) > 0
      and "purchase_orders"."ordered_by_membership_id" is not null and length(btrim("purchase_orders"."ordered_by_membership_id")) > 0 and "purchase_orders"."status" <> 'draft')));
