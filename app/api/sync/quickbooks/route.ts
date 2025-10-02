import { NextRequest, NextResponse } from 'next/server';
import { getSyncManager } from '@/lib/quickbooks/sync-manager';
import { QBSyncOptions } from '@/lib/quickbooks/types';
import { db } from '@/lib/db';
import { organizations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * POST /api/sync/quickbooks
 *
 * Trigger QuickBooks data sync
 *
 * Request body:
 * {
 *   organizationId: string;
 *   options?: {
 *     syncAccounts?: boolean;
 *     syncPL?: boolean;
 *     syncBalanceSheet?: boolean;
 *     startDate?: string;
 *     endDate?: string;
 *     forceRefresh?: boolean;
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId, options } = body;

    // Validate required fields
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    // Verify organization exists
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
    });

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Check if QuickBooks is connected
    if (!org.quickbooksCompanyId) {
      return NextResponse.json(
        {
          error: 'QuickBooks not connected',
          message: 'Please connect QuickBooks before syncing',
        },
        { status: 400 }
      );
    }

    // Get sync manager
    const syncManager = getSyncManager();

    // Start sync (async - don't wait)
    console.log(`Starting QuickBooks sync for organization ${organizationId}...`);

    const syncOptions: QBSyncOptions = {
      syncAccounts: options?.syncAccounts !== false,
      syncPL: options?.syncPL !== false,
      syncBalanceSheet: options?.syncBalanceSheet || false,
      startDate: options?.startDate,
      endDate: options?.endDate,
      forceRefresh: options?.forceRefresh || false,
    };

    // Perform sync
    const syncStatus = await syncManager.syncAll(organizationId, syncOptions);

    // Save sync status
    await syncManager.saveSyncStatus(syncStatus);

    return NextResponse.json({
      success: true,
      syncId: syncStatus.syncId,
      status: syncStatus.status,
      itemsSynced: syncStatus.itemsSynced,
      errors: syncStatus.errors,
      message: 'Sync completed successfully',
    });
  } catch (error: any) {
    console.error('QuickBooks sync error:', error);

    // Handle specific error types
    if (error.code === 'token_expired') {
      return NextResponse.json(
        {
          error: 'QuickBooks token expired',
          message: 'Please reconnect your QuickBooks account',
          code: 'token_expired',
        },
        { status: 401 }
      );
    }

    if (error.code === 'rate_limit_exceeded') {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: 'Too many requests to QuickBooks API. Please try again later.',
          code: 'rate_limit_exceeded',
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        error: 'Sync failed',
        message: error.message,
        code: error.code || 'sync_error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sync/quickbooks
 *
 * Get sync status or check connection
 *
 * Query params:
 * - organizationId: string (required)
 * - syncId?: string (optional - get specific sync status)
 * - action?: 'status' | 'health' (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');
    const syncId = searchParams.get('syncId');
    const action = searchParams.get('action');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId parameter required' },
        { status: 400 }
      );
    }

    const syncManager = getSyncManager();

    // Get specific sync status
    if (syncId) {
      const status = await syncManager.getSyncStatus(syncId);

      if (!status) {
        return NextResponse.json(
          { error: 'Sync not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(status);
    }

    // Health check
    if (action === 'health') {
      const health = await syncManager.healthCheck(organizationId);

      return NextResponse.json({
        connected: health.connected,
        realmId: health.realmId,
        error: health.error,
      });
    }

    // Get organization sync info
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
    });

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      organizationId: org.id,
      quickbooksConnected: !!org.quickbooksCompanyId,
      realmId: org.quickbooksCompanyId,
      lastUpdated: org.updatedAt,
    });
  } catch (error: any) {
    console.error('Sync status error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get sync status',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sync/quickbooks
 *
 * Clear QuickBooks cache
 *
 * Query params:
 * - organizationId: string (required)
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId parameter required' },
        { status: 400 }
      );
    }

    // Get organization
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
    });

    if (!org || !org.quickbooksCompanyId) {
      return NextResponse.json(
        { error: 'QuickBooks not connected' },
        { status: 404 }
      );
    }

    // Clear cache
    const syncManager = getSyncManager();
    await syncManager.clearCache(org.quickbooksCompanyId);

    return NextResponse.json({
      success: true,
      message: 'Cache cleared successfully',
    });
  } catch (error: any) {
    console.error('Cache clear error:', error);
    return NextResponse.json(
      {
        error: 'Failed to clear cache',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/sync/quickbooks
 *
 * Incremental sync - sync only changed data since last sync
 *
 * Request body:
 * {
 *   organizationId: string;
 *   lastSyncedAt?: string; // ISO date string
 * }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId, lastSyncedAt } = body;

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    const syncManager = getSyncManager();

    // Determine last sync time
    let lastSync: Date;
    if (lastSyncedAt) {
      lastSync = new Date(lastSyncedAt);
    } else {
      // Get from organization
      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, organizationId),
      });

      if (!org) {
        return NextResponse.json(
          { error: 'Organization not found' },
          { status: 404 }
        );
      }

      lastSync = org.updatedAt;
    }

    console.log(`Incremental sync since ${lastSync.toISOString()}...`);

    const syncStatus = await syncManager.incrementalSync(
      organizationId,
      lastSync
    );

    await syncManager.saveSyncStatus(syncStatus);

    return NextResponse.json({
      success: true,
      syncId: syncStatus.syncId,
      status: syncStatus.status,
      itemsSynced: syncStatus.itemsSynced,
      errors: syncStatus.errors,
      message: 'Incremental sync completed',
    });
  } catch (error: any) {
    console.error('Incremental sync error:', error);
    return NextResponse.json(
      {
        error: 'Incremental sync failed',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
