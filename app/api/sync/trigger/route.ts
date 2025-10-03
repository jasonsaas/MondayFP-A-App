/**
 * Manual Sync Trigger API
 *
 * POST /api/sync/trigger
 * Allows users to manually trigger a sync of their variance data
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncOrchestrator } from '@/lib/sync/sync-orchestrator';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    // Get user from session/auth
    // For MVP, we'll use a simple header-based auth
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          message: 'User ID required',
        },
        { status: 401 }
      );
    }

    // Get user's organization
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user || !user.organizationId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Not Found',
          message: 'User or organization not found',
        },
        { status: 404 }
      );
    }

    console.log(`🔄 Manual sync triggered by user ${userId} for org ${user.organizationId}`);

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
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user || !user.organizationId) {
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
