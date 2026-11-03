ALTER TABLE "purchase_orders" DROP CONSTRAINT "purchase_orders_status";--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "last_mutation_id" uuid;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "last_mutation_fingerprint" text;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "updated_by_user_id" text;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "updated_by_membership_id" text;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "ordered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "ordered_by_user_id" text;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "ordered_by_membership_id" text;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "cancelled_by_user_id" text;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "cancelled_by_membership_id" text;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_revision" CHECK ("purchase_orders"."revision" >= 1 and (
    ("purchase_orders"."revision" = 1 and "purchase_orders"."last_mutation_id" is null and "purchase_orders"."last_mutation_fingerprint" is null)
    or ("purchase_orders"."revision" > 1 and "purchase_orders"."last_mutation_id" is not null and "purchase_orders"."last_mutation_fingerprint" is not null
      and "purchase_orders"."last_mutation_fingerprint" ~ '^[0-9a-f]{64}$' and "purchase_orders"."updated_by_user_id" is not null
      and length(btrim("purchase_orders"."updated_by_user_id")) > 0 and "purchase_orders"."updated_by_membership_id" is not null and length(btrim("purchase_orders"."updated_by_membership_id")) > 0)));--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_ordering" CHECK ((
    ("purchase_orders"."ordered_at" is null and "purchase_orders"."ordered_by_user_id" is null and "purchase_orders"."ordered_by_membership_id" is null and "purchase_orders"."status" <> 'ordered')
    or ("purchase_orders"."ordered_at" is not null and "purchase_orders"."ordered_by_user_id" is not null and length(btrim("purchase_orders"."ordered_by_user_id")) > 0
      and "purchase_orders"."ordered_by_membership_id" is not null and length(btrim("purchase_orders"."ordered_by_membership_id")) > 0 and "purchase_orders"."status" <> 'draft')));--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_cancellation" CHECK ((
    ("purchase_orders"."status" <> 'cancelled' and "purchase_orders"."cancelled_at" is null and "purchase_orders"."cancelled_by_user_id" is null and "purchase_orders"."cancelled_by_membership_id" is null and "purchase_orders"."cancellation_reason" is null)
    or ("purchase_orders"."status" = 'cancelled' and "purchase_orders"."cancelled_at" is not null and "purchase_orders"."cancelled_by_user_id" is not null
      and length(btrim("purchase_orders"."cancelled_by_user_id")) > 0 and "purchase_orders"."cancelled_by_membership_id" is not null
      and length(btrim("purchase_orders"."cancelled_by_membership_id")) > 0 and "purchase_orders"."cancellation_reason" is not null and length(btrim("purchase_orders"."cancellation_reason")) between 1 and 500)));--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_status" CHECK ("purchase_orders"."status" in ('draft', 'ordered', 'cancelled'));