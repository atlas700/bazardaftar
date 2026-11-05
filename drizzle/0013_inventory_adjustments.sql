ALTER TABLE "inventory_movements" DROP CONSTRAINT "movements_receipt";--> statement-breakpoint
ALTER TABLE "inventory_movements" ALTER COLUMN "receipt_item_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD COLUMN "request_id" uuid;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD COLUMN "request_fingerprint" text;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD COLUMN "reason_code" text;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD COLUMN "reference" text;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD COLUMN "product_name" text;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD COLUMN "warehouse_name" text;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "movements_product" FOREIGN KEY ("organization_id","product_id") REFERENCES "public"."products"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "movements_request_once" UNIQUE("organization_id","request_id");--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "movements_quantity" CHECK ("inventory_movements"."quantity_kg" <> 0 and abs("inventory_movements"."quantity_kg") < 1000000000000000000 and scale("inventory_movements"."quantity_kg") <= 3);--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "movements_source" CHECK (("inventory_movements"."kind" = 'receipt' and "inventory_movements"."receipt_item_id" is not null and "inventory_movements"."quantity_kg" > 0
    and "inventory_movements"."request_id" is null and "inventory_movements"."request_fingerprint" is null and "inventory_movements"."reason_code" is null and "inventory_movements"."reason" is null
    and "inventory_movements"."reference" is null and "inventory_movements"."product_name" is null and "inventory_movements"."warehouse_name" is null)
    or ("inventory_movements"."kind" = 'adjustment' and "inventory_movements"."receipt_item_id" is null and "inventory_movements"."request_id" is not null
    and "inventory_movements"."request_fingerprint" is not null and "inventory_movements"."request_fingerprint" ~ '^[0-9a-f]{64}$'
    and "inventory_movements"."reason_code" is not null and "inventory_movements"."reason_code" in ('loss', 'spoilage', 'count_correction', 'opening_stock')
    and "inventory_movements"."reason" is not null and length(btrim("inventory_movements"."reason")) between 1 and 500
    and "inventory_movements"."reference" is not null and length("inventory_movements"."reference") <= 100
    and "inventory_movements"."product_name" is not null and length(btrim("inventory_movements"."product_name")) > 0
    and "inventory_movements"."warehouse_name" is not null and length(btrim("inventory_movements"."warehouse_name")) > 0
    and ("inventory_movements"."reason_code" = 'count_correction' or ("inventory_movements"."reason_code" = 'opening_stock' and "inventory_movements"."quantity_kg" > 0)
      or ("inventory_movements"."reason_code" in ('loss', 'spoilage') and "inventory_movements"."quantity_kg" < 0))));