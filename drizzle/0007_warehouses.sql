CREATE TABLE "warehouses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"location" text,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "warehouses_one_per_organization" UNIQUE("organization_id"),
	CONSTRAINT "warehouses_name" CHECK ("warehouses"."name" = btrim("warehouses"."name") and length("warehouses"."name") between 1 and 80),
	CONSTRAINT "warehouses_location" CHECK ("warehouses"."location" is null or ("warehouses"."location" = btrim("warehouses"."location") and length("warehouses"."location") between 1 and 200))
);
--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;