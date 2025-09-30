CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"monday_account_id" text,
	"monday_workspace_id" text,
	"slug" text NOT NULL,
	"settings" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "organization_monday_account_id_unique" UNIQUE("monday_account_id"),
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "monday_user_id" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" text DEFAULT 'member';--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;