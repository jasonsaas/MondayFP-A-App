/**
 * Manual Sync Trigger API
 *
 * POST /api/sync/trigger
 * Allows users to manually trigger a sync of their variance data
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncOrchestrator } from '@/lib/sync/sync-orchestrator';
import { getAuthUser } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
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

    console.log(`🔄 Manual sync triggered by user ${user.id} for org ${user.organizationId}`);

    // Run sync
    const result = await syncOrchestrator.syncOrganization(user.organizationId);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Sync Failed',
          message: result.error || 'Sync failed',
          details: result,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${result.itemsProcessed} items`,
      data: {
        itemsProcessed: result.itemsProcessed,
        duration: result.duration,
        timestamp: result.timestamp,
        hasVariances: (result.variances?.length || 0) > 0,
      },
    });

  } catch (error) {
    console.error('Manual sync error:', error);

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

// GET method to check sync status
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!user.organizationId) {
      return NextResponse.json(
        { success: false, error: 'Not found' },
        { status: 404 }
      );
    }

    // Check if sync is needed
    const shouldSync = await syncOrchestrator.shouldSync(user.organizationId);

    return NextResponse.json({
      success: true,
      organizationId: user.organizationId,
      shouldSync,
      message: shouldSync
        ? 'Sync recommended (last sync > 4 hours ago)'
        : 'No sync needed yet',
    });

  } catch (error) {
    console.error('Sync status check error:', error);

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
