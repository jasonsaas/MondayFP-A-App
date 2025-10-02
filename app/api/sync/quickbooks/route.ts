import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/app/api/middleware/auth';
import { db } from '@/db';
import { organizations, actualItems, syncLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { setCached } from '@/lib/redis';

/**
 * POST /api/sync/quickbooks
 *
 * Sync QuickBooks P&L data to actualItems table
 *
 * Request body:
 * {
 *   organizationId: string;
 *   period: string; // YYYY-MM format
 * }
 */
export async function POST(request: NextRequest) {
  // Validate API key
  const authError = validateApiKey(request);
  if (authError) return authError;

  const startTime = Date.now();
  let syncLogId: string | undefined;

  try {
    const body = await request.json();
    const { organizationId, period } = body;

    // Validate required fields
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json(
        { error: 'period is required in YYYY-MM format' },
        { status: 400 }
      );
    }

    // Get organization
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Check if QuickBooks is connected
    if (!org.quickbooksRealmId || !org.quickbooksAccessToken) {
      return NextResponse.json(
        {
          error: 'QuickBooks not connected',
          message: 'Please connect QuickBooks before syncing',
        },
        { status: 400 }
      );
    }

    // Check token expiry
    if (org.quickbooksTokenExpiresAt && new Date(org.quickbooksTokenExpiresAt) < new Date()) {
      return NextResponse.json(
        {
          error: 'QuickBooks token expired',
          message: 'Please reconnect your QuickBooks account',
        },
        { status: 401 }
      );
    }

    // Create sync log entry
    const [syncLog] = await db
      .insert(syncLogs)
      .values({
        organizationId: org.id,
        syncType: 'quickbooks_actual',
        status: 'in_progress',
        source: 'api',
        startedAt: new Date(),
        metadata: { period },
      })
      .returning();

    syncLogId = syncLog.id;

    // Parse period
    const [year, month] = period.split('-').map(Number);
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0, 23, 59, 59);

    // Fetch P&L from QuickBooks
    const plResponse = await fetch(
      `https://sandbox-quickbooks.api.intuit.com/v3/company/${org.quickbooksRealmId}/reports/ProfitAndLoss?start_date=${period}-01&end_date=${period}-${periodEnd.getDate()}&accounting_method=Accrual`,
      {
        headers: {
          Authorization: `Bearer ${org.quickbooksAccessToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (!plResponse.ok) {
      const errorText = await plResponse.text();
      throw new Error(`QuickBooks API error: ${plResponse.status} - ${errorText}`);
    }

    const plData = await plResponse.json();

    // Process P&L rows and insert into actualItems
    const plRows = extractPLRows(plData);
    let recordsProcessed = 0;

    for (const row of plRows) {
      await db
        .insert(actualItems)
        .values({
          organizationId: org.id,
          quickbooksAccountId: row.accountId,
          accountCode: row.accountCode,
          accountName: row.accountName,
          accountType: mapAccountType(row.accountType),
          accountSubType: row.accountSubType,
          parentAccountId: row.parentAccountId,
          amount: row.amount.toString(),
          period,
          periodStart,
          periodEnd,
          currency: org.settings?.defaultCurrency || 'USD',
          reportType: 'ProfitAndLoss',
          transactionCount: row.transactionCount || 0,
          metadata: {
            quickbooksData: row.raw,
            lastSyncedAt: new Date().toISOString(),
            syncJobId: syncLog.id,
          },
        })
        .onConflictDoUpdate({
          target: [actualItems.organizationId, actualItems.quickbooksAccountId, actualItems.period],
          set: {
            amount: row.amount.toString(),
            transactionCount: row.transactionCount || 0,
            updatedAt: new Date(),
            metadata: {
              quickbooksData: row.raw,
              lastSyncedAt: new Date().toISOString(),
              syncJobId: syncLog.id,
            },
          },
        });

      recordsProcessed++;
    }

    const duration = Date.now() - startTime;

    // Update sync log
    await db
      .update(syncLogs)
      .set({
        status: 'completed',
        completedAt: new Date(),
        duration,
        itemsProcessed: recordsProcessed,
        itemsCreated: recordsProcessed,
      })
      .where(eq(syncLogs.id, syncLog.id));

    // Cache the result
    const cacheKey = `qb:pl:${organizationId}:${period}`;
    await setCached(cacheKey, plRows, 3600); // 1 hour cache

    console.log(`QuickBooks sync completed: ${recordsProcessed} records for ${period}`);

    return NextResponse.json({
      success: true,
      recordsProcessed,
      period,
      syncId: syncLog.id,
      duration,
      message: 'QuickBooks sync completed successfully',
    });
  } catch (error: any) {
    console.error('QuickBooks sync error:', error);

    // Update sync log with error
    if (syncLogId) {
      await db
        .update(syncLogs)
        .set({
          status: 'failed',
          completedAt: new Date(),
          duration: Date.now() - startTime,
          errorMessage: error.message,
          errorStack: error.stack,
        })
        .where(eq(syncLogs.id, syncLogId));
    }

    return NextResponse.json(
      {
        error: 'Sync failed',
        message: error.message,
        syncId: syncLogId,
      },
      { status: 500 }
    );
  }
}

// Helper function to extract P&L rows from QuickBooks response
function extractPLRows(plData: any): any[] {
  const rows: any[] = [];

  function processRows(rowsData: any[], parentId: string | null = null) {
    if (!rowsData) return;

    for (const row of rowsData) {
      if (row.type === 'Section' || row.type === 'Data') {
        const colData = row.ColData || [];
        const accountName = colData[0]?.value || '';
        const amount = parseFloat(colData[1]?.value || '0');

        if (accountName && amount !== 0) {
          rows.push({
            accountId: row.id || `generated-${accountName.toLowerCase().replace(/\s+/g, '-')}`,
            accountCode: row.code || null,
            accountName,
            accountType: row.account_type || 'other',
            accountSubType: row.account_sub_type || null,
            parentAccountId: parentId,
            amount,
            transactionCount: row.transaction_count || 0,
            raw: row,
          });
        }

        // Process child rows recursively
        if (row.Rows?.Row) {
          processRows(row.Rows.Row, row.id);
        }
      }
    }
  }

  processRows(plData.Rows?.Row || []);
  return rows;
}

// Map QuickBooks account type to our enum
function mapAccountType(qbType: string): 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | 'other' {
  const typeMap: Record<string, any> = {
    Income: 'revenue',
    Revenue: 'revenue',
    Expense: 'expense',
    'Cost of Goods Sold': 'expense',
    COGS: 'expense',
    Asset: 'asset',
    Liability: 'liability',
    Equity: 'equity',
  };

  return typeMap[qbType] || 'other';
}

