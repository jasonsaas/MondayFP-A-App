import { pgTable, text, numeric, timestamp, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { user, organization } from "./auth";

// TypeScript types for variance data
export type VarianceData = {
  itemId: string;
  itemName: string;
  category: string;
  budgetAmount: number;
  actualAmount: number;
  variance: number;
  variancePercentage: number;
  severity: 'normal' | 'warning' | 'critical';
};

export type VarianceSummary = {
  totalBudget: number;
  totalActual: number;
  totalVariance: number;
  variancePercentage: number;
  itemCount: number;
};

export const mondayBoards = pgTable("monday_boards", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  mondayBoardId: text("monday_board_id").notNull(),
  workspaceId: text("workspace_id"),
  isActive: boolean("is_active").default(true),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()).notNull(),
  updatedAt: timestamp("updated_at").$defaultFn(() => new Date()).notNull(),
});

export const budgetItems = pgTable("budget_items", {
  id: text("id").primaryKey(),
  boardId: text("board_id")
    .notNull()
    .references(() => mondayBoards.id, { onDelete: "cascade" }),
  itemId: text("item_id").notNull(), // Monday item ID
  name: text("name").notNull(),
  category: text("category"),
  subcategory: text("subcategory"),
  budgetAmount: numeric("budget_amount", { precision: 12, scale: 2 }).notNull(),
  period: text("period").notNull(), // "monthly", "quarterly", "yearly"
  periodStartDate: timestamp("period_start_date").notNull(),
  periodEndDate: timestamp("period_end_date").notNull(),
  department: text("department"),
  costCenter: text("cost_center"),
  tags: text("tags").array(),
  metadata: jsonb("metadata"), // Store additional Monday.com column data
  createdAt: timestamp("created_at").$defaultFn(() => new Date()).notNull(),
  updatedAt: timestamp("updated_at").$defaultFn(() => new Date()).notNull(),
});

export const quickbooksAccounts = pgTable("quickbooks_accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  qbAccountId: text("qb_account_id").notNull(),
  name: text("name").notNull(),
  accountType: text("account_type").notNull(),
  accountSubType: text("account_sub_type"),
  classification: text("classification"), // "Asset", "Liability", "Equity", "Revenue", "Expense"
  isActive: boolean("is_active").default(true),
  balance: numeric("balance", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()).notNull(),
  updatedAt: timestamp("updated_at").$defaultFn(() => new Date()).notNull(),
});

export const actualTransactions = pgTable("actual_transactions", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => quickbooksAccounts.id, { onDelete: "cascade" }),
  qbTransactionId: text("qb_transaction_id").notNull(),
  transactionType: text("transaction_type").notNull(), // "expense", "income", "transfer"
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  transactionDate: timestamp("transaction_date").notNull(),
  vendor: text("vendor"),
  customer: text("customer"),
  department: text("department"),
  class: text("class"),
  location: text("location"),
  memo: text("memo"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()).notNull(),
  updatedAt: timestamp("updated_at").$defaultFn(() => new Date()).notNull(),
});

export const varianceAnalyses = pgTable("variance_analyses", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  boardId: text("board_id")
    .notNull()
    .references(() => mondayBoards.id, { onDelete: "cascade" }),
  analysisType: text("analysis_type").notNull(), // "budget_vs_actual", "forecast_vs_actual"
  periodStartDate: timestamp("period_start_date").notNull(),
  periodEndDate: timestamp("period_end_date").notNull(),
  status: text("status").notNull().default("draft"), // "draft", "running", "completed", "failed"
  totalBudget: numeric("total_budget", { precision: 12, scale: 2 }),
  totalActual: numeric("total_actual", { precision: 12, scale: 2 }),
  totalVariance: numeric("total_variance", { precision: 12, scale: 2 }),
  variancePercentage: numeric("variance_percentage", { precision: 5, scale: 2 }),
  settings: jsonb("settings"), // Analysis configuration
  lastRunAt: timestamp("last_run_at"),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()).notNull(),
  updatedAt: timestamp("updated_at").$defaultFn(() => new Date()).notNull(),
});

export const varianceResults = pgTable("variance_results", {
  id: text("id").primaryKey(),
  analysisId: text("analysis_id")
    .notNull()
    .references(() => varianceAnalyses.id, { onDelete: "cascade" }),
  budgetItemId: text("budget_item_id")
    .references(() => budgetItems.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  subcategory: text("subcategory"),
  budgetAmount: numeric("budget_amount", { precision: 12, scale: 2 }).notNull(),
  actualAmount: numeric("actual_amount", { precision: 12, scale: 2 }).notNull(),
  variance: numeric("variance", { precision: 12, scale: 2 }).notNull(),
  variancePercentage: numeric("variance_percentage", { precision: 5, scale: 2 }).notNull(),
  varianceType: text("variance_type").notNull(), // "favorable", "unfavorable"
  severity: text("severity").notNull(), // "low", "medium", "high", "critical"
  notes: text("notes"),
  actionItems: jsonb("action_items"),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()).notNull(),
});

export const integrationSettings = pgTable("integration_settings", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(), // "monday", "quickbooks"
  isConnected: boolean("is_connected").default(false),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  companyId: text("company_id"), // For QuickBooks
  realmId: text("realm_id"), // For QuickBooks
  settings: jsonb("settings"),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()).notNull(),
  updatedAt: timestamp("updated_at").$defaultFn(() => new Date()).notNull(),
});

export const varianceSnapshots = pgTable("variance_snapshots", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  boardId: text("board_id").notNull(), // Monday.com board ID
  period: text("period").notNull(), // "2024-Q1", "2024-01", "2024"
  data: jsonb("data").$type<VarianceData[]>(), // Array of variance line items
  summary: jsonb("summary").$type<VarianceSummary>(), // Aggregated totals
  createdAt: timestamp("created_at").$defaultFn(() => new Date()).notNull(),
});