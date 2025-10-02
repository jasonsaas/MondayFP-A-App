// app/api/variance/calculate-full/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/app/api/middleware/auth';
import { db } from '@/db';
import { organizations, budgetItems, actualItems, varianceAnalyses, syncLogs } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { getCached, setCached, invalidatePattern } from '@/lib/redis';

/**
 * POST /api/variance/calculate-full
 *
 * Calculate comprehensive variance analysis with caching and Monday.com updates
 *
 * Request body:
 * {
 *   organizationId: string;
 *   boardId: number;
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
    const { organizationId, boardId, period } = body;

    // Validate required fields
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    if (!boardId) {
      return NextResponse.json(
        { error: 'boardId is required' },
        { status: 400 }
      );
    }

    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json(
        { error: 'period is required in YYYY-MM format' },
        { status: 400 }
      );
    }

    // Check Redis cache first
    const cacheKey = `variance:${organizationId}:${boardId}:${period}`;
    const cached = await getCached<any>(cacheKey);

    if (cached) {
      console.log(`Variance cache hit: ${cacheKey}`);
      return NextResponse.json({
        ...cached,
        fromCache: true,
        cacheKey,
      });
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

    // Create sync log for variance calculation
    const [syncLog] = await db
      .insert(syncLogs)
      .values({
        organizationId: org.id,
        syncType: 'variance_analysis',
        status: 'in_progress',
        source: 'api',
        startedAt: new Date(),
        metadata: { boardId, period },
      })
      .returning();

    syncLogId = syncLog.id;

    // Get budget items from Monday board
    const budgets = await db
      .select()
      .from(budgetItems)
      .where(
        and(
          eq(budgetItems.organizationId, organizationId),
          eq(budgetItems.mondayBoardId, boardId),
          eq(budgetItems.period, period)
        )
      );

    // Get actual items from QuickBooks
    const actuals = await db
      .select()
      .from(actualItems)
      .where(
        and(
          eq(actualItems.organizationId, organizationId),
          eq(actualItems.period, period)
        )
      );

    if (budgets.length === 0) {
      return NextResponse.json(
        {
          error: 'No budget data found',
          message: `No budget items found for board ${boardId} and period ${period}`,
        },
        { status: 404 }
      );
    }

    // Calculate variances
    const varianceResults = calculateVariances(budgets, actuals, org.settings);

    // Parse period for timestamps
    const [year, month] = period.split('-').map(Number);
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0, 23, 59, 59);

    // Store variance analysis in database
    const [analysis] = await db
      .insert(varianceAnalyses)
      .values({
        organizationId: org.id,
        mondayBoardId: boardId,
        periodStart,
        periodEnd,
        periodLabel: period,
        totalBudget: varianceResults.summary.totalBudget.toString(),
        totalActual: varianceResults.summary.totalActual.toString(),
        totalVariance: varianceResults.summary.totalVariance.toString(),
        totalVariancePercent: varianceResults.summary.totalVariancePercent.toString(),
        criticalCount: varianceResults.summary.criticalCount,
        warningCount: varianceResults.summary.warningCount,
        normalCount: varianceResults.summary.normalCount,
        results: {
          variances: varianceResults.variances,
          insights: varianceResults.insights,
        },
        metadata: {
          calculationTime: Date.now() - startTime,
          itemsProcessed: budgets.length,
          cacheHit: false,
          version: '1.0',
        },
      })
      .returning();

    const duration = Date.now() - startTime;

    // Update sync log
    await db
      .update(syncLogs)
      .set({
        status: 'completed',
        completedAt: new Date(),
        duration,
        itemsProcessed: budgets.length,
      })
      .where(eq(syncLogs.id, syncLog.id));

    // Trigger alerts for critical variances (>15%)
    const criticalThreshold = org.settings?.thresholds?.critical || 15;
    const criticalVariances = varianceResults.variances.filter(
      (v) => Math.abs(v.variancePercent) > criticalThreshold
    );

    if (criticalVariances.length > 0) {
      console.log(`🚨 ${criticalVariances.length} critical variances detected (>${criticalThreshold}%)`);
      // TODO: Send alerts (email, Slack, Monday.com notifications)
      // await sendCriticalVarianceAlert(org, criticalVariances, period);
    }

    // Update Monday.com board with variance data
    if (org.mondayAccessToken) {
      await updateMondayBoard(org, boardId, varianceResults.variances);
    }

    // Cache the result (1 hour TTL)
    const result = {
      success: true,
      analysisId: analysis.id,
      syncId: syncLog.id,
      period,
      summary: varianceResults.summary,
      variances: varianceResults.variances,
      insights: varianceResults.insights,
      calculationTime: duration,
      timestamp: new Date().toISOString(),
    };

    await setCached(cacheKey, result, 3600);

    console.log(`Variance analysis completed: ${budgets.length} items in ${duration}ms`);

    return NextResponse.json({
      ...result,
      fromCache: false,
    });
  } catch (error: any) {
    console.error('Variance calculation error:', error);

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
        error: 'Variance calculation failed',
        message: error.message,
        syncId: syncLogId,
      },
      { status: 500 }
    );
  }
}

// Calculate variances between budget and actual
function calculateVariances(
  budgets: any[],
  actuals: any[],
  settings: any
): {
  variances: any[];
  insights: any[];
  summary: any;
} {
  const variances: any[] = [];
  const insights: any[] = [];

  const warningThreshold = settings?.thresholds?.warning || 10;
  const criticalThreshold = settings?.thresholds?.critical || 15;

  // Create lookup map for actuals by account code
  const actualsMap = new Map();
  actuals.forEach((actual) => {
    const key = actual.accountCode || actual.accountName;
    actualsMap.set(key, parseFloat(actual.amount));
  });

  let totalBudget = 0;
  let totalActual = 0;
  let criticalCount = 0;
  let warningCount = 0;
  let normalCount = 0;

  // Calculate variance for each budget item
  budgets.forEach((budget) => {
    const budgetAmount = parseFloat(budget.amount);
    const key = budget.accountCode || budget.accountName;
    const actualAmount = actualsMap.get(key) || 0;

    const variance = actualAmount - budgetAmount;
    const variancePercent = budgetAmount !== 0 ? (variance / budgetAmount) * 100 : 0;

    totalBudget += budgetAmount;
    totalActual += actualAmount;

    // Determine severity
    let severity: 'normal' | 'warning' | 'critical' = 'normal';
    if (Math.abs(variancePercent) > criticalThreshold) {
      severity = 'critical';
      criticalCount++;
    } else if (Math.abs(variancePercent) > warningThreshold) {
      severity = 'warning';
      warningCount++;
    } else {
      normalCount++;
    }

    // Determine direction (favorable/unfavorable)
    let direction: 'favorable' | 'unfavorable' | 'neutral' = 'neutral';
    if (budget.accountType === 'revenue') {
      direction = variance > 0 ? 'favorable' : 'unfavorable';
    } else if (budget.accountType === 'expense') {
      direction = variance < 0 ? 'favorable' : 'unfavorable';
    }

    variances.push({
      accountId: budget.id,
      accountCode: budget.accountCode,
      accountName: budget.accountName,
      accountType: budget.accountType,
      budget: budgetAmount,
      actual: actualAmount,
      variance,
      variancePercent,
      severity,
      direction,
      level: 0,
    });

    // Generate insights for critical variances
    if (severity === 'critical') {
      insights.push({
        type: 'variance',
        severity,
        message: `${budget.accountName} is ${Math.abs(variancePercent).toFixed(1)}% ${variance > 0 ? 'over' : 'under'} budget`,
        accountId: budget.id,
        confidence: 0.95,
      });
    }
  });

  const totalVariance = totalActual - totalBudget;
  const totalVariancePercent = totalBudget !== 0 ? (totalVariance / totalBudget) * 100 : 0;

  // Add high-level insight
  if (Math.abs(totalVariancePercent) > criticalThreshold) {
    insights.push({
      type: 'trend',
      severity: 'critical',
      message: `Overall budget is ${Math.abs(totalVariancePercent).toFixed(1)}% ${totalVariance > 0 ? 'over' : 'under'} target`,
      confidence: 0.99,
    });
  }

  return {
    variances,
    insights,
    summary: {
      totalBudget,
      totalActual,
      totalVariance,
      totalVariancePercent,
      criticalCount,
      warningCount,
      normalCount,
    },
  };
}

// Update Monday.com board with variance data
async function updateMondayBoard(
  org: any,
  boardId: number,
  variances: any[]
): Promise<void> {
  try {
    // Build GraphQL mutations to update Monday items
    const mutations = variances
      .filter((v) => v.severity !== 'normal') // Only update warning/critical
      .slice(0, 10) // Limit to 10 to avoid rate limits
      .map((v, index) => {
        const varianceColumn = 'variance_percent'; // Adjust to your column ID
        const statusColumn = 'status'; // Adjust to your column ID

        return `
          mutation_${index}: change_multiple_column_values(
            board_id: ${boardId},
            item_id: "${v.accountId}",
            column_values: "{\\"${varianceColumn}\\":\\"${v.variancePercent.toFixed(2)}%\\",\\"${statusColumn}\\":\\"${v.severity}\\"}"
          ) {
            id
          }
        `;
      })
      .join('\n');

    if (!mutations) return;

    const query = `mutation { ${mutations} }`;

    const response = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: org.mondayAccessToken,
        'API-Version': '2024-01',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      console.error('Failed to update Monday.com board:', await response.text());
    } else {
      console.log(`✅ Updated ${variances.length} items on Monday.com board ${boardId}`);
    }
  } catch (error) {
    console.error('Error updating Monday.com board:', error);
    // Don't throw - board update failure shouldn't fail the entire variance calc
  }
}
