CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"location" text,
	"type" text,
	"notes" text,
	"payment_terms" text,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "suppliers_name" CHECK ("suppliers"."name" = btrim("suppliers"."name") and length("suppliers"."name") between 1 and 80),
	CONSTRAINT "suppliers_phone" CHECK ("suppliers"."phone" is null or ("suppliers"."phone" = btrim("suppliers"."phone") and length("suppliers"."phone") between 3 and 40
    and "suppliers"."phone" ~ '^[+0-9۰-۹٠-٩(). -]+$' and "suppliers"."phone" ~ '[0-9۰-۹٠-٩]')),
	CONSTRAINT "suppliers_location" CHECK ("suppliers"."location" is null or ("suppliers"."location" = btrim("suppliers"."location") and length("suppliers"."location") between 1 and 200)),
	CONSTRAINT "suppliers_type" CHECK ("suppliers"."type" is null or "suppliers"."type" in ('individual', 'business')),
	CONSTRAINT "suppliers_notes" CHECK ("suppliers"."notes" is null or ("suppliers"."notes" = btrim("suppliers"."notes") and length("suppliers"."notes") between 1 and 2000)),
	CONSTRAINT "suppliers_payment_terms" CHECK ("suppliers"."payment_terms" is null or ("suppliers"."payment_terms" = btrim("suppliers"."payment_terms") and length("suppliers"."payment_terms") between 1 and 500))
);
--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_organization_name" ON "suppliers" USING btree ("organization_id",lower(btrim("name")));