CREATE TABLE "variance_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"board_id" text NOT NULL,
	"period" text NOT NULL,
	"data" jsonb,
	"summary" jsonb,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization" ALTER COLUMN "settings" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "organization" ALTER COLUMN "settings" SET DEFAULT '{"syncFrequency":"hourly","defaultCurrency":"USD","thresholds":{"warning":5,"critical":10}}'::jsonb;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "subscription" text DEFAULT 'trial';--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "trial_ends_at" timestamp;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "subscription_status" text DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "active" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "last_login" timestamp;--> statement-breakpoint
ALTER TABLE "variance_snapshots" ADD CONSTRAINT "variance_snapshots_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;