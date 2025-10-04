/**
 * Current Variance API
 *
 * GET /api/variance/current
 * Returns the most recent variance analysis for the user's organization
 * Triggers sync if data is stale or missing
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { varianceSnapshots } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { syncOrchestrator } from '@/lib/sync/sync-orchestrator';
import { getAuthUser } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          message: 'Authentication required',
        },
        { status: 401 }
      );
    }

    if (!user.organizationId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Not Found',
          message: 'Organization not found',
        },
        { status: 404 }
      );
    }

    // Fetch latest variance snapshot
    const [latestSnapshot] = await db
      .select()
      .from(varianceSnapshots)
      .where(eq(varianceSnapshots.organizationId, user.organizationId))
      .orderBy(desc(varianceSnapshots.createdAt))
      .limit(1);

    // Check if data exists and is fresh
    const hasData = !!latestSnapshot;
    const isStale = hasData
      ? (Date.now() - (latestSnapshot.createdAt?.getTime() || 0)) > (4 * 60 * 60 * 1000) // 4 hours
      : true;

    // If no data or stale, trigger background sync
    if (!hasData || isStale) {
      console.log(`📊 No fresh variance data for org ${user.organizationId} - triggering sync`);

      // Trigger sync in background (don't await)
      syncOrchestrator.syncOrganization(user.organizationId).catch(err => {
        console.error('Background sync failed:', err);
      });

      // Return empty state if no data exists
      if (!hasData) {
        return NextResponse.json({
          success: true,
          hasData: false,
          message: 'No variance data yet. Sync in progress...',
          needsSync: true,
        });
      }
    }

    // Return the snapshot data
    const snapshotData = latestSnapshot.data as any;

    return NextResponse.json({
      success: true,
      hasData: true,
      lastSync: latestSnapshot.createdAt,
      period: latestSnapshot.period,
      summary: snapshotData?.summary || {
        totalBudget: 0,
        totalActual: 0,
        totalVariance: 0,
        totalVariancePercent: 0,
        itemCount: 0,
        criticalCount: 0,
        warningCount: 0,
        normalCount: 0,
      },
      items: snapshotData?.variances || [],
      needsSync: isStale,
    });

  } catch (error) {
    console.error('Current variance error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
