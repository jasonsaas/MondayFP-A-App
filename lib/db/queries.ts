/**
 * Common Database Queries for FP&A Platform
 *
 * This module provides high-level query functions for common database operations.
 * All queries use Drizzle ORM for type safety and performance.
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and, gte, lte, desc, asc, sql, inArray, isNull, or } from 'drizzle-orm';
import { Pool } from 'pg';
import {
  organizations,
  users,
  sessions,
  varianceAnalyses,
  budgetItems,
  actualItems,
  syncLogs,
  insights,
  type Organization,
  type User,
  type Session,
  type VarianceAnalysis,
  type BudgetItem,
  type ActualItem,
  type SyncLog,
  type Insight,
} from '@/db/schema';

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool);

// ============================================================================
// ORGANIZATION QUERIES
// ============================================================================

/**
 * Get organization by Monday.com account ID
 */
export async function getOrganizationByMondayId(mondayAccountId: number): Promise<Organization | null> {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.mondayAccountId, mondayAccountId))
    .limit(1);

  return org || null;
}

/**
 * Get organization by QuickBooks realm ID
 */
export async function getOrganizationByQuickBooksRealmId(realmId: string): Promise<Organization | null> {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.quickbooksRealmId, realmId))
    .limit(1);

  return org || null;
}

/**
 * Get organization by ID with all related data
 */
export async function getOrganizationWithRelations(organizationId: string) {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!org) return null;

  const [userList, analysesCount, lastSync] = await Promise.all([
    db.select().from(users).where(eq(users.organizationId, organizationId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(varianceAnalyses)
      .where(eq(varianceAnalyses.organizationId, organizationId)),
    db
      .select()
      .from(syncLogs)
      .where(and(
        eq(syncLogs.organizationId, organizationId),
        eq(syncLogs.status, 'completed')
      ))
      .orderBy(desc(syncLogs.completedAt))
      .limit(1),
  ]);

  return {
    ...org,
    users: userList,
    analysesCount: analysesCount[0]?.count || 0,
    lastSync: lastSync[0] || null,
  };
}

/**
 * Update organization OAuth tokens
 */
export async function updateOrganizationTokens(
  organizationId: string,
  tokens: {
    monday?: { accessToken: string; refreshToken?: string; expiresAt?: Date };
    quickbooks?: { accessToken: string; refreshToken: string; expiresAt: Date };
  }
) {
  const updates: any = {};

  if (tokens.monday) {
    updates.mondayAccessToken = tokens.monday.accessToken;
    if (tokens.monday.refreshToken) updates.mondayRefreshToken = tokens.monday.refreshToken;
    if (tokens.monday.expiresAt) updates.mondayTokenExpiresAt = tokens.monday.expiresAt;
  }

  if (tokens.quickbooks) {
    updates.quickbooksAccessToken = tokens.quickbooks.accessToken;
    updates.quickbooksRefreshToken = tokens.quickbooks.refreshToken;
    updates.quickbooksTokenExpiresAt = tokens.quickbooks.expiresAt;
  }

  const [updated] = await db
    .update(organizations)
    .set(updates)
    .where(eq(organizations.id, organizationId))
    .returning();

  return updated;
}

// ============================================================================
// USER QUERIES
// ============================================================================

/**
 * Get user by Monday user ID and organization
 */
export async function getUserByMondayId(mondayUserId: number, organizationId: string): Promise<User | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(and(
      eq(users.mondayUserId, mondayUserId),
      eq(users.organizationId, organizationId)
    ))
    .limit(1);

  return user || null;
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return user || null;
}

/**
 * Update user last login timestamp
 */
export async function updateUserLastLogin(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, userId));
}

/**
 * Get all users for an organization
 */
export async function getOrganizationUsers(organizationId: string): Promise<User[]> {
  return db
    .select()
    .from(users)
    .where(and(
      eq(users.organizationId, organizationId),
      eq(users.active, true)
    ))
    .orderBy(asc(users.name));
}

// ============================================================================
// SESSION QUERIES
// ============================================================================

/**
 * Get valid session by token
 */
export async function getSessionByToken(token: string): Promise<(Session & { user: User }) | null> {
  const [session] = await db
    .select({
      session: sessions,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(
      eq(sessions.token, token),
      gte(sessions.expiresAt, new Date())
    ))
    .limit(1);

  if (!session) return null;

  return {
    ...session.session,
    user: session.user,
  };
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await db
    .delete(sessions)
    .where(lte(sessions.expiresAt, new Date()));

  return result.rowCount || 0;
}

// ============================================================================
// VARIANCE ANALYSIS QUERIES
// ============================================================================

/**
 * Get variance analyses for organization with filters
 */
export async function getVarianceAnalyses(options: {
  organizationId: string;
  boardId?: number;
  periodLabel?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const { organizationId, boardId, periodLabel, startDate, endDate, limit = 50, offset = 0 } = options;

  const conditions = [eq(varianceAnalyses.organizationId, organizationId)];

  if (boardId) {
    conditions.push(eq(varianceAnalyses.mondayBoardId, boardId));
  }
  if (periodLabel) {
    conditions.push(eq(varianceAnalyses.periodLabel, periodLabel));
  }
  if (startDate) {
    conditions.push(gte(varianceAnalyses.periodStart, startDate));
  }
  if (endDate) {
    conditions.push(lte(varianceAnalyses.periodEnd, endDate));
  }

  const [results, totalCount] = await Promise.all([
    db
      .select()
      .from(varianceAnalyses)
      .where(and(...conditions))
      .orderBy(desc(varianceAnalyses.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(varianceAnalyses)
      .where(and(...conditions)),
  ]);

  return {
    data: results,
    total: totalCount[0]?.count || 0,
    limit,
    offset,
  };
}

/**
 * Get latest variance analysis for a board and period
 */
export async function getLatestVarianceAnalysis(
  organizationId: string,
  boardId: number,
  periodLabel: string
): Promise<VarianceAnalysis | null> {
  const [analysis] = await db
    .select()
    .from(varianceAnalyses)
    .where(and(
      eq(varianceAnalyses.organizationId, organizationId),
      eq(varianceAnalyses.mondayBoardId, boardId),
      eq(varianceAnalyses.periodLabel, periodLabel)
    ))
    .orderBy(desc(varianceAnalyses.createdAt))
    .limit(1);

  return analysis || null;
}

/**
 * Get variance analysis summary stats for dashboard
 */
export async function getVarianceAnalysisSummary(organizationId: string, periodLabel?: string) {
  const conditions = [eq(varianceAnalyses.organizationId, organizationId)];
  if (periodLabel) {
    conditions.push(eq(varianceAnalyses.periodLabel, periodLabel));
  }

  const [summary] = await db
    .select({
      totalAnalyses: sql<number>`count(*)`,
      totalCritical: sql<number>`sum(${varianceAnalyses.criticalCount})`,
      totalWarning: sql<number>`sum(${varianceAnalyses.warningCount})`,
      totalNormal: sql<number>`sum(${varianceAnalyses.normalCount})`,
      avgVariancePercent: sql<number>`avg(${varianceAnalyses.totalVariancePercent})`,
    })
    .from(varianceAnalyses)
    .where(and(...conditions));

  return summary || null;
}

// ============================================================================
// BUDGET & ACTUAL ITEMS QUERIES
// ============================================================================

/**
 * Get budget items for a period
 */
export async function getBudgetItemsForPeriod(
  organizationId: string,
  period: string,
  boardId?: number
): Promise<BudgetItem[]> {
  const conditions = [
    eq(budgetItems.organizationId, organizationId),
    eq(budgetItems.period, period),
  ];

  if (boardId) {
    conditions.push(eq(budgetItems.mondayBoardId, boardId));
  }

  return db
    .select()
    .from(budgetItems)
    .where(and(...conditions))
    .orderBy(asc(budgetItems.accountCode));
}

/**
 * Get actual items for a period
 */
export async function getActualItemsForPeriod(
  organizationId: string,
  period: string
): Promise<ActualItem[]> {
  return db
    .select()
    .from(actualItems)
    .where(and(
      eq(actualItems.organizationId, organizationId),
      eq(actualItems.period, period)
    ))
    .orderBy(asc(actualItems.accountCode));
}

/**
 * Upsert budget item (update if exists, insert if not)
 */
export async function upsertBudgetItem(item: Omit<BudgetItem, 'id' | 'createdAt' | 'updatedAt'>) {
  const existing = await db
    .select()
    .from(budgetItems)
    .where(and(
      eq(budgetItems.organizationId, item.organizationId),
      eq(budgetItems.mondayBoardId, item.mondayBoardId),
      eq(budgetItems.mondayItemId, item.mondayItemId),
      eq(budgetItems.period, item.period)
    ))
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db
      .update(budgetItems)
      .set({ ...item, updatedAt: new Date() })
      .where(eq(budgetItems.id, existing[0].id))
      .returning();
    return updated;
  } else {
    const [inserted] = await db.insert(budgetItems).values(item).returning();
    return inserted;
  }
}

/**
 * Upsert actual item (update if exists, insert if not)
 */
export async function upsertActualItem(item: Omit<ActualItem, 'id' | 'createdAt' | 'updatedAt'>) {
  const existing = await db
    .select()
    .from(actualItems)
    .where(and(
      eq(actualItems.organizationId, item.organizationId),
      eq(actualItems.quickbooksAccountId, item.quickbooksAccountId),
      eq(actualItems.period, item.period)
    ))
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db
      .update(actualItems)
      .set({ ...item, updatedAt: new Date() })
      .where(eq(actualItems.id, existing[0].id))
      .returning();
    return updated;
  } else {
    const [inserted] = await db.insert(actualItems).values(item).returning();
    return inserted;
  }
}

/**
 * Delete budget items for a board (useful for full refresh)
 */
export async function deleteBudgetItemsForBoard(organizationId: string, boardId: number, period: string) {
  return db
    .delete(budgetItems)
    .where(and(
      eq(budgetItems.organizationId, organizationId),
      eq(budgetItems.mondayBoardId, boardId),
      eq(budgetItems.period, period)
    ));
}

// ============================================================================
// SYNC LOG QUERIES
// ============================================================================

/**
 * Create sync log
 */
export async function createSyncLog(log: Omit<SyncLog, 'id' | 'createdAt'>) {
  const [created] = await db.insert(syncLogs).values(log).returning();
  return created;
}

/**
 * Update sync log status
 */
export async function updateSyncLogStatus(
  syncLogId: string,
  status: 'completed' | 'failed',
  metadata?: {
    completedAt?: Date;
    duration?: number;
    itemsProcessed?: number;
    itemsCreated?: number;
    itemsUpdated?: number;
    itemsFailed?: number;
    errorMessage?: string;
    errorStack?: string;
  }
) {
  const [updated] = await db
    .update(syncLogs)
    .set({
      status,
      ...metadata,
    })
    .where(eq(syncLogs.id, syncLogId))
    .returning();

  return updated;
}

/**
 * Get sync logs for organization
 */
export async function getSyncLogs(options: {
  organizationId: string;
  syncType?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const { organizationId, syncType, status, limit = 50, offset = 0 } = options;

  const conditions = [eq(syncLogs.organizationId, organizationId)];

  if (syncType) {
    conditions.push(eq(syncLogs.syncType, syncType));
  }
  if (status) {
    conditions.push(eq(syncLogs.status, status as any));
  }

  return db
    .select()
    .from(syncLogs)
    .where(and(...conditions))
    .orderBy(desc(syncLogs.startedAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Get latest successful sync by type
 */
export async function getLatestSuccessfulSync(organizationId: string, syncType: string): Promise<SyncLog | null> {
  const [log] = await db
    .select()
    .from(syncLogs)
    .where(and(
      eq(syncLogs.organizationId, organizationId),
      eq(syncLogs.syncType, syncType),
      eq(syncLogs.status, 'completed')
    ))
    .orderBy(desc(syncLogs.completedAt))
    .limit(1);

  return log || null;
}

// ============================================================================
// INSIGHTS QUERIES
// ============================================================================

/**
 * Get insights for organization
 */
export async function getInsights(options: {
  organizationId: string;
  varianceAnalysisId?: string;
  severity?: 'normal' | 'warning' | 'critical';
  insightType?: 'variance' | 'trend' | 'anomaly' | 'recommendation';
  includeDismissed?: boolean;
  limit?: number;
  offset?: number;
}) {
  const {
    organizationId,
    varianceAnalysisId,
    severity,
    insightType,
    includeDismissed = false,
    limit = 50,
    offset = 0,
  } = options;

  const conditions = [eq(insights.organizationId, organizationId)];

  if (varianceAnalysisId) {
    conditions.push(eq(insights.varianceAnalysisId, varianceAnalysisId));
  }
  if (severity) {
    conditions.push(eq(insights.severity, severity));
  }
  if (insightType) {
    conditions.push(eq(insights.insightType, insightType));
  }
  if (!includeDismissed) {
    conditions.push(isNull(insights.dismissedAt));
  }

  const [results, totalCount] = await Promise.all([
    db
      .select()
      .from(insights)
      .where(and(...conditions))
      .orderBy(desc(insights.priority), desc(insights.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(insights)
      .where(and(...conditions)),
  ]);

  return {
    data: results,
    total: totalCount[0]?.count || 0,
    limit,
    offset,
  };
}

/**
 * Dismiss insight
 */
export async function dismissInsight(insightId: string, userId: string, reason?: string) {
  const [dismissed] = await db
    .update(insights)
    .set({
      dismissedBy: userId,
      dismissedAt: new Date(),
      dismissReason: reason,
    })
    .where(eq(insights.id, insightId))
    .returning();

  return dismissed;
}

/**
 * Get insight summary for dashboard
 */
export async function getInsightSummary(organizationId: string) {
  const [summary] = await db
    .select({
      totalInsights: sql<number>`count(*)`,
      criticalCount: sql<number>`sum(case when ${insights.severity} = 'critical' then 1 else 0 end)`,
      warningCount: sql<number>`sum(case when ${insights.severity} = 'warning' then 1 else 0 end)`,
      normalCount: sql<number>`sum(case when ${insights.severity} = 'normal' then 1 else 0 end)`,
      actionableCount: sql<number>`sum(case when ${insights.actionable} = true then 1 else 0 end)`,
      dismissedCount: sql<number>`sum(case when ${insights.dismissedAt} is not null then 1 else 0 end)`,
    })
    .from(insights)
    .where(eq(insights.organizationId, organizationId));

  return summary || null;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Execute raw SQL query (use sparingly, prefer typed queries)
 */
export async function executeRawQuery<T = any>(query: string, params?: any[]): Promise<T[]> {
  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Close database connection
 */
export async function closeDatabaseConnection() {
  await pool.end();
}

/**
 * Health check - verify database connectivity
 */
export async function healthCheck(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}
