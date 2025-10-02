import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { varianceSnapshots } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { verifyMondaySession } from '@/lib/auth/monday-session';

/**
 * GET /api/variance/summary
 *
 * Returns summarized variance data for Monday dashboard widget
 * Query params: boardId (required)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const boardId = searchParams.get('boardId');

    if (!boardId) {
      return NextResponse.json(
        { error: 'boardId is required' },
        { status: 400 }
      );
    }

    // Verify Monday session token
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const sessionToken = authHeader.replace('Bearer ', '');
    const session = await verifyMondaySession(sessionToken);

    if (!session) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }

    // Get latest variance snapshot for this board
    const snapshot = await db.query.varianceSnapshots.findFirst({
      where: eq(varianceSnapshots.boardId, parseInt(boardId)),
      orderBy: [desc(varianceSnapshots.createdAt)],
    });

    if (!snapshot || !snapshot.data) {
      return NextResponse.json({
        totalBudget: 0,
        totalActual: 0,
        totalVariance: 0,
        variancePercent: 0,
        criticalCount: 0,
        warningCount: 0,
        lastSync: new Date().toISOString(),
      });
    }

    // Calculate summary metrics
    const variances = snapshot.data.variances || [];

    const totalBudget = variances.reduce((sum: number, v: any) => sum + v.budget, 0);
    const totalActual = variances.reduce((sum: number, v: any) => sum + v.actual, 0);
    const totalVariance = totalActual - totalBudget;
    const variancePercent = totalBudget > 0 ? (totalVariance / totalBudget) * 100 : 0;

    const criticalCount = variances.filter((v: any) => v.status === 'critical').length;
    const warningCount = variances.filter((v: any) => v.status === 'warning').length;

    return NextResponse.json({
      totalBudget,
      totalActual,
      totalVariance,
      variancePercent,
      criticalCount,
      warningCount,
      lastSync: snapshot.createdAt.toISOString(),
    });

  } catch (error) {
    console.error('Variance summary error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch variance summary' },
      { status: 500 }
    );
  }
}
