import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { db } from '@/lib/db';
import { organizations, varianceSnapshots } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { MondayWebhookPayload } from '@/lib/monday/types';
import { invalidateVarianceCache } from '@/lib/variance/cache';

/**
 * POST /api/webhooks/monday
 *
 * Handle Monday.com webhook events
 * Supports: change_column_value, create_item, item_deleted
 *
 * Webhook verification using signature validation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const payload: MondayWebhookPayload = JSON.parse(body);

    // Verify webhook signature
    const signature = request.headers.get('x-monday-signature');
    if (!verifyWebhookSignature(body, signature)) {
      console.error('Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Handle challenge response (webhook setup)
    if (payload.challenge) {
      console.log('Webhook challenge received:', payload.challenge);
      return NextResponse.json({ challenge: payload.challenge });
    }

    // Log webhook event
    console.log('Monday webhook received:', {
      type: payload.event.type,
      boardId: payload.boardId,
      itemId: payload.itemId,
      columnId: payload.columnId,
    });

    // Handle different event types
    switch (payload.event.type) {
      case 'change_column_value':
        await handleColumnValueChange(payload);
        break;

      case 'create_item':
        await handleItemCreated(payload);
        break;

      case 'item_deleted':
        await handleItemDeleted(payload);
        break;

      default:
        console.log(`Unhandled webhook event type: ${payload.event.type}`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * Verify webhook signature using HMAC
 */
function verifyWebhookSignature(
  body: string,
  signature: string | null
): boolean {
  if (!signature) {
    console.warn('No signature provided in webhook request');
    return process.env.NODE_ENV === 'development'; // Allow in dev mode
  }

  const secret = process.env.MONDAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('MONDAY_WEBHOOK_SECRET not configured');
    return false;
  }

  try {
    const hmac = createHmac('sha256', secret);
    hmac.update(body);
    const calculatedSignature = hmac.digest('hex');

    return signature === calculatedSignature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Handle column value change event
 * Triggers variance recalculation when budget or actual values change
 */
async function handleColumnValueChange(payload: MondayWebhookPayload) {
  const { boardId, itemId, columnId, value, previousValue } = payload;

  if (!boardId || !itemId || !columnId) {
    console.warn('Missing required webhook data');
    return;
  }

  // Find organization by board ID
  const org = await findOrganizationByBoardId(boardId);
  if (!org) {
    console.warn(`No organization found for board ${boardId}`);
    return;
  }

  // Check if the changed column is a budget or actual column
  const isBudgetOrActualColumn = await isBudgetActualColumn(
    org.id,
    boardId.toString(),
    columnId
  );

  if (!isBudgetOrActualColumn) {
    console.log(`Column ${columnId} is not a budget/actual column, skipping recalculation`);
    return;
  }

  console.log(`Budget/actual column changed: ${columnId}`);
  console.log(`Previous value: ${previousValue}, New value: ${value}`);

  // Invalidate cache for this board
  await invalidateVarianceCache(org.id, boardId.toString());

  // Trigger variance recalculation (async, don't wait)
  triggerVarianceRecalculation(org.id, boardId.toString()).catch((error) => {
    console.error('Variance recalculation failed:', error);
  });
}

/**
 * Handle item created event
 */
async function handleItemCreated(payload: MondayWebhookPayload) {
  const { boardId, itemId } = payload;

  if (!boardId || !itemId) {
    console.warn('Missing required webhook data');
    return;
  }

  console.log(`New item created: ${itemId} on board ${boardId}`);

  // Find organization
  const org = await findOrganizationByBoardId(boardId);
  if (!org) {
    return;
  }

  // Invalidate cache
  await invalidateVarianceCache(org.id, boardId.toString());

  // Optional: Auto-populate variance columns for new item
  // await initializeVarianceColumns(org.id, boardId.toString(), itemId.toString());
}

/**
 * Handle item deleted event
 */
async function handleItemDeleted(payload: MondayWebhookPayload) {
  const { boardId, itemId } = payload;

  if (!boardId || !itemId) {
    console.warn('Missing required webhook data');
    return;
  }

  console.log(`Item deleted: ${itemId} from board ${boardId}`);

  // Find organization
  const org = await findOrganizationByBoardId(boardId);
  if (!org) {
    return;
  }

  // Invalidate cache and trigger recalculation
  await invalidateVarianceCache(org.id, boardId.toString());

  triggerVarianceRecalculation(org.id, boardId.toString()).catch((error) => {
    console.error('Variance recalculation failed:', error);
  });
}

/**
 * Find organization by board ID
 * Assumes board ID is stored in organization settings
 */
async function findOrganizationByBoardId(
  boardId: number
): Promise<{ id: string } | null> {
  try {
    // Query organizations where settings.defaultBoardId matches
    const orgs = await db.query.organizations.findMany();

    for (const org of orgs) {
      if (org.settings?.defaultBoardId === boardId.toString()) {
        return { id: org.id };
      }
    }

    return null;
  } catch (error) {
    console.error('Error finding organization:', error);
    return null;
  }
}

/**
 * Check if column is a budget or actual column
 * This should check against stored column mapping in organization settings
 */
async function isBudgetActualColumn(
  organizationId: string,
  boardId: string,
  columnId: string
): Promise<boolean> {
  try {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
    });

    if (!org || !org.settings) {
      return false;
    }

    // Check if column ID matches budget or actual columns
    // This assumes column mapping is stored in organization settings
    const columnMapping = (org.settings as any).columnMapping || {};

    return (
      columnMapping.budgetColumn === columnId ||
      columnMapping.actualColumn === columnId
    );
  } catch (error) {
    console.error('Error checking column type:', error);
    return false;
  }
}

/**
 * Trigger variance recalculation
 * Calls the variance calculation API endpoint
 */
async function triggerVarianceRecalculation(
  organizationId: string,
  boardId: string
): Promise<void> {
  try {
    console.log(`Triggering variance recalculation for board ${boardId}...`);

    // Get current period (use current month)
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Call internal API endpoint
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api/variance/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        organizationId,
        boardId,
        period,
        useCache: false, // Force fresh calculation
        writeBackToBoard: true, // Write results back to Monday
      }),
    });

    if (!response.ok) {
      throw new Error(`Recalculation failed: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Variance recalculation completed:', {
      totalVariance: result.totalVariance,
      criticalCount: result.summary?.criticalCount,
    });
  } catch (error) {
    console.error('Error triggering recalculation:', error);
    throw error;
  }
}

/**
 * GET /api/webhooks/monday
 *
 * Get webhook status and configuration
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const boardId = searchParams.get('boardId');

    if (!boardId) {
      return NextResponse.json(
        { error: 'boardId parameter required' },
        { status: 400 }
      );
    }

    // Find organization
    const org = await findOrganizationByBoardId(parseInt(boardId));

    if (!org) {
      return NextResponse.json(
        { error: 'Board not found in any organization' },
        { status: 404 }
      );
    }

    // Get webhook configuration
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/monday`;

    return NextResponse.json({
      configured: true,
      organizationId: org.id,
      boardId,
      webhookUrl,
      events: ['change_column_value', 'create_item', 'item_deleted'],
      verificationEnabled: !!process.env.MONDAY_WEBHOOK_SECRET,
    });
  } catch (error: any) {
    console.error('Webhook status error:', error);
    return NextResponse.json(
      { error: 'Failed to get webhook status', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/webhooks/monday
 *
 * Remove webhook subscription (for testing)
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const webhookId = searchParams.get('webhookId');

    if (!webhookId) {
      return NextResponse.json(
        { error: 'webhookId parameter required' },
        { status: 400 }
      );
    }

    // Use Monday client to delete webhook
    const { getMondayClient } = await import('@/lib/monday/client');
    const client = getMondayClient();

    await client.deleteWebhook(webhookId);

    return NextResponse.json({
      success: true,
      message: 'Webhook deleted successfully',
    });
  } catch (error: any) {
    console.error('Webhook deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete webhook', message: error.message },
      { status: 500 }
    );
  }
}
