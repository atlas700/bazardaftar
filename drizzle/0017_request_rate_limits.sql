CREATE TABLE "request_rate_limits" (
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"hits" integer NOT NULL,
	"reset_at" timestamp with time zone NOT NULL,
	CONSTRAINT "request_rate_limits_scope_key_pk" PRIMARY KEY("scope","key"),
	CONSTRAINT "request_rate_limits_scope" CHECK ("request_rate_limits"."scope" in ('authentication', 'mutation', 'anonymous')),
	CONSTRAINT "request_rate_limits_key" CHECK ("request_rate_limits"."key" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "request_rate_limits_hits" CHECK ("request_rate_limits"."hits" between 1 and 61)
);
--> statement-breakpoint
CREATE INDEX "request_rate_limits_expiry" ON "request_rate_limits" USING btree ("reset_at");