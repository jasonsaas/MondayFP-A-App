CREATE TABLE "actual_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"qb_transaction_id" text NOT NULL,
	"transaction_type" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"description" text,
	"transaction_date" timestamp NOT NULL,
	"vendor" text,
	"customer" text,
	"department" text,
	"class" text,
	"location" text,
	"memo" text,
	"metadata" jsonb,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_items" (
	"id" text PRIMARY KEY NOT NULL,
	"board_id" text NOT NULL,
	"item_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"subcategory" text,
	"budget_amount" numeric(12, 2) NOT NULL,
	"period" text NOT NULL,
	"period_start_date" timestamp NOT NULL,
	"period_end_date" timestamp NOT NULL,
	"department" text,
	"cost_center" text,
	"tags" text[],
	"metadata" jsonb,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"is_connected" boolean DEFAULT false,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"company_id" text,
	"realm_id" text,
	"settings" jsonb,
	"last_sync_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monday_boards" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"user_id" text NOT NULL,
	"monday_board_id" text NOT NULL,
	"workspace_id" text,
	"is_active" boolean DEFAULT true,
	"last_sync_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quickbooks_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"qb_account_id" text NOT NULL,
	"name" text NOT NULL,
	"account_type" text NOT NULL,
	"account_sub_type" text,
	"classification" text,
	"is_active" boolean DEFAULT true,
	"balance" numeric(12, 2),
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "variance_analyses" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"board_id" text NOT NULL,
	"analysis_type" text NOT NULL,
	"period_start_date" timestamp NOT NULL,
	"period_end_date" timestamp NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"total_budget" numeric(12, 2),
	"total_actual" numeric(12, 2),
	"total_variance" numeric(12, 2),
	"variance_percentage" numeric(5, 2),
	"settings" jsonb,
	"last_run_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "variance_results" (
	"id" text PRIMARY KEY NOT NULL,
	"analysis_id" text NOT NULL,
	"budget_item_id" text,
	"category" text NOT NULL,
	"subcategory" text,
	"budget_amount" numeric(12, 2) NOT NULL,
	"actual_amount" numeric(12, 2) NOT NULL,
	"variance" numeric(12, 2) NOT NULL,
	"variance_percentage" numeric(5, 2) NOT NULL,
	"variance_type" text NOT NULL,
	"severity" text NOT NULL,
	"notes" text,
	"action_items" jsonb,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "actual_transactions" ADD CONSTRAINT "actual_transactions_account_id_quickbooks_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."quickbooks_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_board_id_monday_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."monday_boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_settings" ADD CONSTRAINT "integration_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monday_boards" ADD CONSTRAINT "monday_boards_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quickbooks_accounts" ADD CONSTRAINT "quickbooks_accounts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variance_analyses" ADD CONSTRAINT "variance_analyses_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variance_analyses" ADD CONSTRAINT "variance_analyses_board_id_monday_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."monday_boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variance_results" ADD CONSTRAINT "variance_results_analysis_id_variance_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."variance_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variance_results" ADD CONSTRAINT "variance_results_budget_item_id_budget_items_id_fk" FOREIGN KEY ("budget_item_id") REFERENCES "public"."budget_items"("id") ON DELETE cascade ON UPDATE no action;