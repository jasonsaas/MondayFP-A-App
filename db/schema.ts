import {
  pgTable,
  uuid,
  varchar,
  json,
  timestamp,
  integer,
  boolean,
  text,
  decimal,
  index,
  uniqueIndex,
  pgEnum
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const subscriptionTierEnum = pgEnum('subscription_tier', ['trial', 'starter', 'professional', 'enterprise']);
export const userRoleEnum = pgEnum('user_role', ['admin', 'editor', 'viewer']);
export const syncStatusEnum = pgEnum('sync_status', ['pending', 'in_progress', 'completed', 'failed']);
export const accountTypeEnum = pgEnum('account_type', ['asset', 'liability', 'equity', 'revenue', 'expense', 'other']);
export const varianceSeverityEnum = pgEnum('variance_severity', ['normal', 'warning', 'critical']);
export const insightTypeEnum = pgEnum('insight_type', ['variance', 'trend', 'anomaly', 'recommendation']);

// Organizations table - one per Monday account
export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  mondayAccountId: integer('monday_account_id').unique().notNull(),
  mondayAccountName: varchar('monday_account_name', { length: 255 }),
  mondayAccessToken: text('monday_access_token').notNull(),
  mondayRefreshToken: text('monday_refresh_token'),
  mondayTokenExpiresAt: timestamp('monday_token_expires_at'),
  quickbooksRealmId: varchar('quickbooks_realm_id', { length: 255 }).unique(),
  quickbooksAccessToken: text('quickbooks_access_token'),
  quickbooksRefreshToken: text('quickbooks_refresh_token'),
  quickbooksTokenExpiresAt: timestamp('quickbooks_token_expires_at'),
  subscriptionTier: subscriptionTierEnum('subscription_tier').default('trial').notNull(),
  subscriptionStatus: varchar('subscription_status', { length: 50 }).default('active'),
  trialEndsAt: timestamp('trial_ends_at'),
  billingEmail: varchar('billing_email', { length: 255 }),
  settings: json('settings').$type<{
    syncFrequency: 'realtime' | '15min' | 'hourly' | 'daily';
    defaultBoardId?: number;
    defaultCurrency: 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD';
    thresholds: {
      warning: number;
      critical: number;
    };
    notifications: {
      email: boolean;
      slack: boolean;
      monday: boolean;
    };
    fiscalYearStart: number; // Month (1-12)
  }>().default({
    syncFrequency: 'hourly',
    defaultCurrency: 'USD',
    thresholds: { warning: 10, critical: 15 },
    notifications: { email: true, slack: false, monday: true },
    fiscalYearStart: 1
  }),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  mondayAccountIdIdx: index('org_monday_account_idx').on(table.mondayAccountId),
  qbRealmIdIdx: index('org_qb_realm_idx').on(table.quickbooksRealmId),
  activeIdx: index('org_active_idx').on(table.active),
}));

// Users table - multiple per organization
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  mondayUserId: integer('monday_user_id').notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }),
  avatar: varchar('avatar', { length: 500 }),
  role: userRoleEnum('role').default('viewer').notNull(),
  lastLoginAt: timestamp('last_login_at'),
  preferences: json('preferences').$type<{
    theme: 'light' | 'dark' | 'auto';
    notifications: boolean;
    emailDigest: 'daily' | 'weekly' | 'never';
  }>().default({
    theme: 'auto',
    notifications: true,
    emailDigest: 'weekly'
  }),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgMondayUserIdx: uniqueIndex('user_org_monday_idx').on(table.organizationId, table.mondayUserId),
  emailIdx: index('user_email_idx').on(table.email),
  orgIdx: index('user_org_idx').on(table.organizationId),
}));

// Sessions table for JWT management
export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  token: text('token').unique().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('session_user_idx').on(table.userId),
  tokenIdx: index('session_token_idx').on(table.token),
  expiresAtIdx: index('session_expires_idx').on(table.expiresAt),
}));

// Variance Analyses table - stores analysis results
export const varianceAnalyses = pgTable('variance_analyses', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  mondayBoardId: integer('monday_board_id').notNull(),
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  periodLabel: varchar('period_label', { length: 50 }).notNull(), // e.g., "2025-Q1", "2025-01"
  totalBudget: decimal('total_budget', { precision: 15, scale: 2 }),
  totalActual: decimal('total_actual', { precision: 15, scale: 2 }),
  totalVariance: decimal('total_variance', { precision: 15, scale: 2 }),
  totalVariancePercent: decimal('total_variance_percent', { precision: 8, scale: 4 }),
  criticalCount: integer('critical_count').default(0),
  warningCount: integer('warning_count').default(0),
  normalCount: integer('normal_count').default(0),
  results: json('results').$type<{
    variances: Array<{
      accountId: string;
      accountName: string;
      accountType: string;
      budget: number;
      actual: number;
      variance: number;
      variancePercent: number;
      severity: 'normal' | 'warning' | 'critical';
      direction: 'favorable' | 'unfavorable' | 'neutral';
      level: number;
      children?: any[];
    }>;
    insights: Array<{
      type: string;
      severity: string;
      message: string;
      accountId?: string;
      confidence: number;
    }>;
  }>(),
  metadata: json('metadata').$type<{
    calculationTime: number;
    itemsProcessed: number;
    cacheHit: boolean;
    version: string;
  }>(),
  triggeredBy: uuid('triggered_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  orgBoardPeriodIdx: index('va_org_board_period_idx').on(table.organizationId, table.mondayBoardId, table.periodLabel),
  orgIdx: index('va_org_idx').on(table.organizationId),
  periodIdx: index('va_period_idx').on(table.periodStart, table.periodEnd),
  createdAtIdx: index('va_created_idx').on(table.createdAt),
}));

// Budget Items table - from Monday boards
export const budgetItems = pgTable('budget_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  mondayBoardId: integer('monday_board_id').notNull(),
  mondayItemId: varchar('monday_item_id', { length: 255 }).notNull(),
  mondayGroupId: varchar('monday_group_id', { length: 255 }),
  accountCode: varchar('account_code', { length: 100 }),
  accountName: varchar('account_name', { length: 255 }).notNull(),
  accountType: accountTypeEnum('account_type').notNull(),
  parentAccountCode: varchar('parent_account_code', { length: 100 }),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  period: varchar('period', { length: 50 }).notNull(), // "2025-01" or "2025-Q1"
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  currency: varchar('currency', { length: 3 }).default('USD').notNull(),
  notes: text('notes'),
  tags: json('tags').$type<string[]>(),
  metadata: json('metadata').$type<{
    mondayColumnValues?: Record<string, any>;
    lastSyncedAt?: string;
  }>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgBoardItemIdx: uniqueIndex('budget_org_board_item_idx').on(table.organizationId, table.mondayBoardId, table.mondayItemId, table.period),
  orgPeriodIdx: index('budget_org_period_idx').on(table.organizationId, table.period),
  accountCodeIdx: index('budget_account_code_idx').on(table.accountCode),
  periodRangeIdx: index('budget_period_range_idx').on(table.periodStart, table.periodEnd),
}));

// Actual Items table - from QuickBooks
export const actualItems = pgTable('actual_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  quickbooksAccountId: varchar('quickbooks_account_id', { length: 255 }).notNull(),
  accountCode: varchar('account_code', { length: 100 }),
  accountName: varchar('account_name', { length: 255 }).notNull(),
  accountType: accountTypeEnum('account_type').notNull(),
  accountSubType: varchar('account_sub_type', { length: 100 }),
  parentAccountId: varchar('parent_account_id', { length: 255 }),
  parentAccountCode: varchar('parent_account_code', { length: 100 }),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  period: varchar('period', { length: 50 }).notNull(),
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  currency: varchar('currency', { length: 3 }).default('USD').notNull(),
  reportType: varchar('report_type', { length: 50 }).notNull(), // "ProfitAndLoss", "BalanceSheet"
  transactionCount: integer('transaction_count').default(0),
  metadata: json('metadata').$type<{
    quickbooksData?: any;
    lastSyncedAt?: string;
    syncJobId?: string;
  }>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  orgQbAccountPeriodIdx: uniqueIndex('actual_org_qb_period_idx').on(table.organizationId, table.quickbooksAccountId, table.period),
  orgPeriodIdx: index('actual_org_period_idx').on(table.organizationId, table.period),
  accountCodeIdx: index('actual_account_code_idx').on(table.accountCode),
  periodRangeIdx: index('actual_period_range_idx').on(table.periodStart, table.periodEnd),
  reportTypeIdx: index('actual_report_type_idx').on(table.reportType),
}));

// Sync Logs table - track all syncs
export const syncLogs = pgTable('sync_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  syncType: varchar('sync_type', { length: 50 }).notNull(), // "monday_budget", "quickbooks_actual", "variance_analysis"
  status: syncStatusEnum('status').notNull(),
  source: varchar('source', { length: 100 }), // "manual", "webhook", "scheduled", "api"
  triggeredBy: uuid('triggered_by').references(() => users.id),
  startedAt: timestamp('started_at').notNull(),
  completedAt: timestamp('completed_at'),
  duration: integer('duration'), // milliseconds
  itemsProcessed: integer('items_processed').default(0),
  itemsCreated: integer('items_created').default(0),
  itemsUpdated: integer('items_updated').default(0),
  itemsFailed: integer('items_failed').default(0),
  errorMessage: text('error_message'),
  errorStack: text('error_stack'),
  metadata: json('metadata').$type<{
    boardId?: number;
    realmId?: string;
    periodStart?: string;
    periodEnd?: string;
    filters?: any;
    retryCount?: number;
    parentJobId?: string;
  }>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  orgTypeStatusIdx: index('sync_org_type_status_idx').on(table.organizationId, table.syncType, table.status),
  statusIdx: index('sync_status_idx').on(table.status),
  startedAtIdx: index('sync_started_idx').on(table.startedAt),
  createdAtIdx: index('sync_created_idx').on(table.createdAt),
}));

// Insights table - AI-generated insights
export const insights = pgTable('insights', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  varianceAnalysisId: uuid('variance_analysis_id').references(() => varianceAnalyses.id, { onDelete: 'cascade' }),
  insightType: insightTypeEnum('insight_type').notNull(),
  severity: varianceSeverityEnum('severity').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  accountCode: varchar('account_code', { length: 100 }),
  accountName: varchar('account_name', { length: 255 }),
  affectedAmount: decimal('affected_amount', { precision: 15, scale: 2 }),
  confidence: decimal('confidence', { precision: 5, scale: 4 }), // 0-1 scale
  priority: integer('priority').default(50), // 0-100
  actionable: boolean('actionable').default(false),
  recommendation: text('recommendation'),
  metadata: json('metadata').$type<{
    accountId?: string;
    period?: string;
    variance?: number;
    variancePercent?: number;
    trendData?: any[];
    relatedInsights?: string[];
  }>(),
  dismissedBy: uuid('dismissed_by').references(() => users.id),
  dismissedAt: timestamp('dismissed_at'),
  dismissReason: text('dismiss_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  orgSeverityIdx: index('insight_org_severity_idx').on(table.organizationId, table.severity),
  vaIdIdx: index('insight_va_idx').on(table.varianceAnalysisId),
  typeIdx: index('insight_type_idx').on(table.insightType),
  dismissedIdx: index('insight_dismissed_idx').on(table.dismissedAt),
  createdAtIdx: index('insight_created_idx').on(table.createdAt),
}));

// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  varianceAnalyses: many(varianceAnalyses),
  budgetItems: many(budgetItems),
  actualItems: many(actualItems),
  syncLogs: many(syncLogs),
  insights: many(insights),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  sessions: many(sessions),
  triggeredAnalyses: many(varianceAnalyses),
  triggeredSyncs: many(syncLogs),
  dismissedInsights: many(insights),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const varianceAnalysesRelations = relations(varianceAnalyses, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [varianceAnalyses.organizationId],
    references: [organizations.id],
  }),
  triggeredBy: one(users, {
    fields: [varianceAnalyses.triggeredBy],
    references: [users.id],
  }),
  insights: many(insights),
}));

export const budgetItemsRelations = relations(budgetItems, ({ one }) => ({
  organization: one(organizations, {
    fields: [budgetItems.organizationId],
    references: [organizations.id],
  }),
}));

export const actualItemsRelations = relations(actualItems, ({ one }) => ({
  organization: one(organizations, {
    fields: [actualItems.organizationId],
    references: [organizations.id],
  }),
}));

export const syncLogsRelations = relations(syncLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [syncLogs.organizationId],
    references: [organizations.id],
  }),
  triggeredBy: one(users, {
    fields: [syncLogs.triggeredBy],
    references: [users.id],
  }),
}));

export const insightsRelations = relations(insights, ({ one }) => ({
  organization: one(organizations, {
    fields: [insights.organizationId],
    references: [organizations.id],
  }),
  varianceAnalysis: one(varianceAnalyses, {
    fields: [insights.varianceAnalysisId],
    references: [varianceAnalyses.id],
  }),
  dismissedBy: one(users, {
    fields: [insights.dismissedBy],
    references: [users.id],
  }),
}));

// Type exports for use in application
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type VarianceAnalysis = typeof varianceAnalyses.$inferSelect;
export type NewVarianceAnalysis = typeof varianceAnalyses.$inferInsert;
export type BudgetItem = typeof budgetItems.$inferSelect;
export type NewBudgetItem = typeof budgetItems.$inferInsert;
export type ActualItem = typeof actualItems.$inferSelect;
export type NewActualItem = typeof actualItems.$inferInsert;
export type SyncLog = typeof syncLogs.$inferSelect;
export type NewSyncLog = typeof syncLogs.$inferInsert;
export type Insight = typeof insights.$inferSelect;
export type NewInsight = typeof insights.$inferInsert;
