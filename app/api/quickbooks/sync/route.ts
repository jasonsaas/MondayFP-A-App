import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { account } from '@/db/schema/auth';
import { eq, and } from 'drizzle-orm';

/**
 * QuickBooks Sync API
 *
 * Triggers n8n workflow to sync QuickBooks data to Monday.com boards.
 * Also provides endpoint to check sync status.
 *
 * POST /api/quickbooks/sync - Trigger sync workflow
 * GET /api/quickbooks/sync?executionId=xxx - Check sync status
 */

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const organizationId = request.headers.get('x-organization-id');

    if (!userId || !organizationId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      syncType = 'full',
      startDate,
      endDate,
      entityTypes = ['accounts', 'transactions'],
    } = body;

    // Validate syncType
    const validSyncTypes = ['full', 'incremental', 'pl_report'];
    if (!validSyncTypes.includes(syncType)) {
      return NextResponse.json(
        {
          error: 'Invalid syncType',
          message: `syncType must be one of: ${validSyncTypes.join(', ')}`,
          received: syncType
        },
        { status: 400 }
      );
    }

    // Validate date format if provided
    if (startDate || endDate) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (startDate && !dateRegex.test(startDate)) {
        return NextResponse.json(
          { error: 'Invalid startDate format. Use YYYY-MM-DD' },
          { status: 400 }
        );
      }
      if (endDate && !dateRegex.test(endDate)) {
        return NextResponse.json(
          { error: 'Invalid endDate format. Use YYYY-MM-DD' },
          { status: 400 }
        );
      }
    }

    // Verify QuickBooks connection exists
    const [qbAccount] = await db
      .select()
      .from(account)
      .where(
        and(
          eq(account.userId, userId),
          eq(account.providerId, 'quickbooks')
        )
      )
      .limit(1);

    if (!qbAccount) {
      return NextResponse.json(
        {
          error: 'QuickBooks not connected',
          message: 'Please connect your QuickBooks account before syncing',
          action: 'Visit /api/auth/quickbooks to connect'
        },
        { status: 401 }
      );
    }

    console.log('Triggering QuickBooks sync:', {
      userId,
      organizationId,
      realmId: qbAccount.accountId,
      syncType,
      entityTypes,
    });

    // Trigger n8n workflow via existing n8n trigger endpoint
    const n8nResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/n8n/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
        'x-organization-id': organizationId,
      },
      body: JSON.stringify({
        workflowType: 'data_sync',
        params: {
          source: 'quickbooks',
          destination: 'monday',
          syncType,
          entityType: 'financial_data',
          entityIds: entityTypes,
          metadata: {
            realmId: qbAccount.accountId,
            startDate,
            endDate,
            userId,
            organizationId,
          },
        },
      }),
    });

    if (!n8nResponse.ok) {
      const errorData = await n8nResponse.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || 'Failed to trigger n8n workflow');
    }

    const n8nData = await n8nResponse.json();

    return NextResponse.json({
      success: true,
      message: 'QuickBooks sync triggered successfully',
      data: {
        syncType,
        executionId: n8nData.data?.executionId,
        status: 'initiated',
        entityTypes,
        metadata: {
          realmId: qbAccount.accountId,
          startDate,
          endDate,
          userId,
          organizationId,
        },
        triggeredAt: new Date().toISOString(),
        statusCheckUrl: n8nData.data?.executionId
          ? `/api/quickbooks/sync?executionId=${n8nData.data.executionId}`
          : null,
      },
    });

  } catch (error: any) {
    console.error('QuickBooks sync error:', error);
    return NextResponse.json(
      {
        error: 'Failed to trigger sync',
        message: error.message || 'Unknown error occurred',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const organizationId = request.headers.get('x-organization-id');

    if (!userId || !organizationId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get executionId from query parameters
    const { searchParams } = new URL(request.url);
    const executionId = searchParams.get('executionId');

    if (!executionId) {
      return NextResponse.json(
        {
          error: 'Missing executionId parameter',
          message: 'Provide executionId to check sync status',
          example: '/api/quickbooks/sync?executionId=abc123'
        },
        { status: 400 }
      );
    }

    console.log('Checking sync status:', { executionId, userId, organizationId });

    // Check sync status via existing sync status endpoint
    const statusResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/sync/status?executionId=${executionId}`,
      {
        headers: {
          'x-user-id': userId,
          'x-organization-id': organizationId,
        },
      }
    );

    if (!statusResponse.ok) {
      const errorData = await statusResponse.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || 'Failed to fetch sync status');
    }

    const statusData = await statusResponse.json();

    return NextResponse.json({
      success: true,
      data: {
        executionId,
        ...statusData.data,
        checkedAt: new Date().toISOString(),
      },
    });

  } catch (error: any) {
    console.error('Sync status check error:', error);
    return NextResponse.json(
      {
        error: 'Failed to check sync status',
        message: error.message || 'Unknown error occurred',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
