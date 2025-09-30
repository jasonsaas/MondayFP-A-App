import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { account } from '@/db/schema/auth';
import { varianceResults, varianceAnalyses } from '@/db/schema/fpa';
import { eq, and } from 'drizzle-orm';

/**
 * POST /api/monday/boards/[boardId]/update
 * Update Monday.com board items with variance analysis results
 *
 * This endpoint writes calculated variance data back to Monday.com boards,
 * typically updating columns like "Actual", "Variance", "Variance %", etc.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const { boardId } = await params;
    const userId = request.headers.get('x-user-id');
    const organizationId = request.headers.get('x-organization-id');

    if (!userId || !organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { analysisId, updates, columnMappings } = body;

    // Validate request
    if (!analysisId) {
      return NextResponse.json(
        { error: 'Analysis ID is required' },
        { status: 400 }
      );
    }

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json(
        { error: 'Updates array is required' },
        { status: 400 }
      );
    }

    // Get user's Monday.com access token
    const [userAccount] = await db
      .select()
      .from(account)
      .where(eq(account.userId, userId))
      .limit(1);

    if (!userAccount?.accessToken) {
      return NextResponse.json(
        { error: 'Monday.com not connected. Please sign in again.' },
        { status: 400 }
      );
    }

    // Verify the analysis belongs to the user
    const [analysis] = await db
      .select()
      .from(varianceAnalyses)
      .where(and(
        eq(varianceAnalyses.id, analysisId),
        eq(varianceAnalyses.userId, userId)
      ))
      .limit(1);

    if (!analysis) {
      return NextResponse.json(
        { error: 'Analysis not found' },
        { status: 404 }
      );
    }

    // Get variance results for this analysis
    const results = await db
      .select()
      .from(varianceResults)
      .where(eq(varianceResults.analysisId, analysisId));

    // Prepare Monday.com API updates
    const mondayUpdates = await Promise.allSettled(
      updates.map(async (update: any) => {
        const { itemId, columnValues } = update;

        // Find corresponding variance result
        const varianceResult = results.find(r => r.budgetItemId === itemId);

        // Build column values for Monday.com
        const columnValuesToUpdate = {
          // Default columns that might exist
          ...(columnMappings?.actualColumn && varianceResult ? {
            [columnMappings.actualColumn]: parseFloat(varianceResult.actualAmount)
          } : {}),
          ...(columnMappings?.varianceColumn && varianceResult ? {
            [columnMappings.varianceColumn]: parseFloat(varianceResult.variance)
          } : {}),
          ...(columnMappings?.variancePercentColumn && varianceResult ? {
            [columnMappings.variancePercentColumn]: parseFloat(varianceResult.variancePercentage)
          } : {}),
          ...(columnMappings?.statusColumn && varianceResult ? {
            [columnMappings.statusColumn]: {
              label: varianceResult.varianceType === 'favorable' ? 'On Track' : 'Over Budget'
            }
          } : {}),
          // Custom column values from request
          ...columnValues
        };

        return updateMondayItem(
          userAccount.accessToken!,
          boardId,
          itemId,
          columnValuesToUpdate
        );
      })
    );

    // Count successes and failures
    const successful = mondayUpdates.filter(r => r.status === 'fulfilled').length;
    const failed = mondayUpdates.filter(r => r.status === 'rejected').length;

    // Get error details
    const errors = mondayUpdates
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map(r => r.reason?.message || 'Unknown error');

    return NextResponse.json({
      message: 'Board update completed',
      summary: {
        total: updates.length,
        successful,
        failed,
        successRate: ((successful / updates.length) * 100).toFixed(1) + '%'
      },
      analysisId,
      boardId,
      ...(errors.length > 0 && { errors: errors.slice(0, 5) }) // Return first 5 errors
    });

  } catch (error: any) {
    console.error('Error updating board:', error);
    return NextResponse.json(
      { error: 'Failed to update board', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Helper function to update a Monday.com item using GraphQL mutation
 */
async function updateMondayItem(
  accessToken: string,
  boardId: string,
  itemId: string,
  columnValues: Record<string, any>
): Promise<any> {
  const mutation = `
    mutation($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
      change_multiple_column_values(
        board_id: $boardId,
        item_id: $itemId,
        column_values: $columnValues
      ) {
        id
        name
      }
    }
  `;

  const response = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'API-Version': '2024-01',
    },
    body: JSON.stringify({
      query: mutation,
      variables: {
        boardId,
        itemId,
        columnValues: JSON.stringify(columnValues),
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Monday API error: ${response.status}`);
  }

  const data = await response.json();

  if (data.errors) {
    throw new Error(data.errors[0]?.message || 'Monday API mutation failed');
  }

  return data.data.change_multiple_column_values;
}

/**
 * GET /api/monday/boards/[boardId]/update
 * Get the update history/status for a specific board
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const { boardId } = await params;
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all analyses for this board
    const analyses = await db
      .select()
      .from(varianceAnalyses)
      .where(and(
        eq(varianceAnalyses.boardId, boardId),
        eq(varianceAnalyses.userId, userId)
      ))
      .orderBy(varianceAnalyses.lastRunAt);

    return NextResponse.json({
      boardId,
      analyses: analyses.map(a => ({
        id: a.id,
        name: a.name,
        status: a.status,
        lastRunAt: a.lastRunAt,
        totalVariance: a.totalVariance,
        variancePercentage: a.variancePercentage,
      })),
      count: analyses.length
    });

  } catch (error) {
    console.error('Error fetching update history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch update history' },
      { status: 500 }
    );
  }
}