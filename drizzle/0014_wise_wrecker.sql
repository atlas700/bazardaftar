CREATE TABLE "supplier_payment_allocations" (
	"organization_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"payable_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"currency" text NOT NULL,
	"amount" numeric NOT NULL,
	CONSTRAINT "supplier_payment_allocations_organization_id_payment_id_payable_id_pk" PRIMARY KEY("organization_id","payment_id","payable_id"),
	CONSTRAINT "allocations_settlement_context" UNIQUE("organization_id","payment_id","payable_id","supplier_id","currency"),
	CONSTRAINT "allocations_amount" CHECK ("supplier_payment_allocations"."amount" > 0 and "supplier_payment_allocations"."amount" < 1000000000000000000 and scale("supplier_payment_allocations"."amount") <= 2)
);
--> statement-breakpoint
CREATE TABLE "supplier_payment_reductions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"request_fingerprint" text NOT NULL,
	"payment_id" uuid NOT NULL,
	"payable_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"currency" text NOT NULL,
	"amount" numeric NOT NULL,
	"reason" text NOT NULL,
	"approved_by_user_id" text NOT NULL,
	"approved_by_membership_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reductions_request" UNIQUE("organization_id","request_id"),
	CONSTRAINT "reductions_amount" CHECK ("supplier_payment_reductions"."amount" > 0 and "supplier_payment_reductions"."amount" <= 0.99 and scale("supplier_payment_reductions"."amount") <= 2),
	CONSTRAINT "reductions_provenance" CHECK ("supplier_payment_reductions"."request_fingerprint" ~ '^[0-9a-f]{64}$' and length(btrim("supplier_payment_reductions"."reason")) between 1 and 500
    and length(btrim("supplier_payment_reductions"."approved_by_user_id")) > 0 and length(btrim("supplier_payment_reductions"."approved_by_membership_id")) > 0)
);
--> statement-breakpoint
CREATE TABLE "supplier_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"request_fingerprint" text NOT NULL,
	"supplier_id" uuid NOT NULL,
	"supplier_name" text NOT NULL,
	"currency" text NOT NULL,
	"paid_on" date NOT NULL,
	"afn_cash" numeric NOT NULL,
	"pkr_cash" numeric NOT NULL,
	"pkr_per_afn" numeric,
	"amount" numeric NOT NULL,
	"reference" text NOT NULL,
	"note" text NOT NULL,
	"recorded_by_user_id" text NOT NULL,
	"recorded_by_membership_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_request" UNIQUE("organization_id","request_id"),
	CONSTRAINT "payments_settlement_context" UNIQUE("organization_id","id","supplier_id","currency"),
	CONSTRAINT "payments_cash" CHECK ("supplier_payments"."afn_cash" >= 0 and "supplier_payments"."afn_cash" < 1000000000000000000 and scale("supplier_payments"."afn_cash") = 0
    and "supplier_payments"."pkr_cash" >= 0 and "supplier_payments"."pkr_cash" < 1000000000000000000 and scale("supplier_payments"."pkr_cash") = 0 and ("supplier_payments"."afn_cash" > 0 or "supplier_payments"."pkr_cash" > 0)),
	CONSTRAINT "payments_rate" CHECK (("supplier_payments"."pkr_per_afn" is null and (("supplier_payments"."currency" = 'AFN' and "supplier_payments"."pkr_cash" = 0) or ("supplier_payments"."currency" = 'PKR' and "supplier_payments"."afn_cash" = 0)))
    or ("supplier_payments"."pkr_per_afn" is not null and "supplier_payments"."pkr_per_afn" > 0 and "supplier_payments"."pkr_per_afn" < 1000000000000000000 and scale("supplier_payments"."pkr_per_afn") <= 6)),
	CONSTRAINT "payments_value" CHECK ("supplier_payments"."currency" in ('AFN', 'PKR') and "supplier_payments"."amount" > 0 and "supplier_payments"."amount" < 1000000000000000000 and scale("supplier_payments"."amount") <= 2
    and "supplier_payments"."amount" = case when "supplier_payments"."currency" = 'AFN' then round("supplier_payments"."afn_cash" + "supplier_payments"."pkr_cash" / coalesce("supplier_payments"."pkr_per_afn", 1), 2)
      else round("supplier_payments"."pkr_cash" + "supplier_payments"."afn_cash" * coalesce("supplier_payments"."pkr_per_afn", 1), 2) end),
	CONSTRAINT "payments_provenance" CHECK ("supplier_payments"."request_fingerprint" ~ '^[0-9a-f]{64}$' and length(btrim("supplier_payments"."supplier_name")) between 1 and 80
    and length("supplier_payments"."reference") <= 100 and length("supplier_payments"."note") <= 500
    and length(btrim("supplier_payments"."recorded_by_user_id")) > 0 and length(btrim("supplier_payments"."recorded_by_membership_id")) > 0)
);
--> statement-breakpoint
ALTER TABLE "supplier_payables" ADD CONSTRAINT "payables_settlement_context" UNIQUE("organization_id","id","supplier_id","currency");--> statement-breakpoint
ALTER TABLE "supplier_payment_allocations" ADD CONSTRAINT "allocations_payment" FOREIGN KEY ("organization_id","payment_id","supplier_id","currency") REFERENCES "public"."supplier_payments"("organization_id","id","supplier_id","currency") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payment_allocations" ADD CONSTRAINT "allocations_payable" FOREIGN KEY ("organization_id","payable_id","supplier_id","currency") REFERENCES "public"."supplier_payables"("organization_id","id","supplier_id","currency") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payment_reductions" ADD CONSTRAINT "reductions_allocated_payable" FOREIGN KEY ("organization_id","payment_id","payable_id","supplier_id","currency") REFERENCES "public"."supplier_payment_allocations"("organization_id","payment_id","payable_id","supplier_id","currency") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "payments_tenant_supplier" FOREIGN KEY ("organization_id","supplier_id") REFERENCES "public"."suppliers"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "allocations_payable" ON "supplier_payment_allocations" USING btree ("organization_id","payable_id");--> statement-breakpoint
CREATE INDEX "reductions_payable" ON "supplier_payment_reductions" USING btree ("organization_id","payable_id");--> statement-breakpoint
CREATE INDEX "payments_supplier_history" ON "supplier_payments" USING btree ("organization_id","supplier_id","currency","created_at","id");--> statement-breakpoint
CREATE INDEX "payables_supplier_oldest" ON "supplier_payables" USING btree ("organization_id","supplier_id","currency","created_at","id");
