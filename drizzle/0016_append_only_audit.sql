CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"actor_user_id" text NOT NULL,
	"actor_membership_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"outcome" text NOT NULL,
	"request_id" uuid NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_logs_identity" CHECK (length(btrim("audit_logs"."actor_user_id")) between 1 and 200
    and length(btrim("audit_logs"."actor_membership_id")) between 1 and 200 and length(btrim("audit_logs"."entity_id")) between 1 and 200),
	CONSTRAINT "audit_logs_entity" CHECK ("audit_logs"."entity_type" in ('organization', 'staff', 'catalog_unit', 'product_category', 'product', 'supplier', 'warehouse',
    'purchase', 'receipt', 'supplier_payable', 'inventory_adjustment', 'supplier_payment', 'payment_reduction')),
	CONSTRAINT "audit_logs_action" CHECK ("audit_logs"."action" in ('create', 'update', 'deactivate', 'activate', 'order', 'cancel', 'accept', 'approve_variance',
    'adjust', 'record', 'reduce', 'role', 'invite', 'add', 'revoke')),
	CONSTRAINT "audit_logs_outcome" CHECK ("audit_logs"."outcome" = 'completed' or ("audit_logs"."outcome" = 'requested' and "audit_logs"."entity_type" = 'staff'
    and "audit_logs"."action" in ('invite', 'add', 'revoke', 'deactivate'))),
	CONSTRAINT "audit_logs_snapshots" CHECK (("audit_logs"."before" is null or (jsonb_typeof("audit_logs"."before") = 'object' and octet_length("audit_logs"."before"::text) <= 8192))
    and ("audit_logs"."after" is null or (jsonb_typeof("audit_logs"."after") = 'object' and octet_length("audit_logs"."after"::text) <= 8192)))
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_request" ON "audit_logs" USING btree ("organization_id","request_id");
--> statement-breakpoint
CREATE FUNCTION "reject_audit_log_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Audit records are append-only.' USING ERRCODE = '55000';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "audit_logs_append_only" BEFORE UPDATE OR DELETE OR TRUNCATE ON "audit_logs"
FOR EACH STATEMENT EXECUTE FUNCTION "reject_audit_log_mutation"();
--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE ON "audit_logs" FROM PUBLIC;
