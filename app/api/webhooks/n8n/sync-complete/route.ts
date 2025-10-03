import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { syncLogs, organizations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

/**
 * Webhook endpoint for n8n sync completion notifications
 *
 * This endpoint receives notifications when external syncs complete,
 * updates sync status, and triggers dependent workflows.
 *
 * @example n8n workflow
 * POST /api/webhooks/n8n/sync-complete
 * Headers:
 *   X-N8N-Signature: sha256=<hmac>
 * Body:
 *   {
 *     "syncLogId": "uuid",
 *     "organizationId": "uuid",
 *     "syncType": "quickbooks_sync",
 *     "status": "completed",
 *     "recordsProcessed": 150,
 *     "duration": 5432,
 *     "metadata": {...}
 *   }
 */

interface SyncCompletePayload {
  syncLogId?: string;
  organizationId: string;
  syncType: string;
  status: 'completed' | 'failed' | 'partial';
  recordsProcessed?: number;
  duration?: number; // milliseconds
  errorMessage?: string;
  metadata?: Record<string, any>;
  triggerDependencies?: boolean;
}

interface DependentWorkflow {
  name: string;
  url: string;
  payload: Record<string, any>;
}

/**
 * Verify webhook signature using HMAC-SHA256
 */
function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    const providedSignature = signature.startsWith('sha256=')
      ? signature.slice(7)
      : signature;

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(providedSignature)
    );
  } catch (error) {
    console.error('❌ Webhook signature verification error:', error);
    return false;
  }
}

/**
 * Determine dependent workflows based on sync type
 */
function getDependentWorkflows(
  syncType: string,
  organizationId: string,
  metadata?: Record<string, any>
): DependentWorkflow[] {
  const workflows: DependentWorkflow[] = [];
  const n8nBaseUrl = process.env.N8N_WEBHOOK_BASE_URL;

  if (!n8nBaseUrl) {
    console.warn('⚠️ N8N_WEBHOOK_BASE_URL not configured, skipping dependent workflows');
    return workflows;
  }

  switch (syncType) {
    case 'quickbooks_sync':
      // After QuickBooks sync completes, trigger variance calculation
      workflows.push({
        name: 'variance_calculation',
        url: `${n8nBaseUrl}/webhook/variance-calculation`,
        payload: {
          organizationId,
          period: metadata?.period,
          boardId: metadata?.boardId,
          source: 'quickbooks_sync_complete',
        },
      });
      break;

    case 'variance_calculation':
      // After variance calculation, trigger report generation if critical variances exist
      if (metadata?.criticalCount && metadata.criticalCount > 0) {
        workflows.push({
          name: 'critical_variance_alert',
          url: `${n8nBaseUrl}/webhook/critical-variance-alert`,
          payload: {
            organizationId,
            period: metadata?.period,
            criticalCount: metadata?.criticalCount,
            warningCount: metadata?.warningCount,
          },
        });
      }
      break;

    case 'monday_board_sync':
      // After Monday board sync, trigger QuickBooks comparison
      workflows.push({
        name: 'budget_vs_actual_comparison',
        url: `${n8nBaseUrl}/webhook/budget-comparison`,
        payload: {
          organizationId,
          boardId: metadata?.boardId,
          period: metadata?.period,
        },
      });
      break;

    default:
      console.log(`ℹ️ No dependent workflows configured for sync type: ${syncType}`);
  }

  return workflows;
}

/**
 * Trigger dependent n8n workflows
 */
async function triggerDependentWorkflows(
  workflows: DependentWorkflow[]
): Promise<Array<{ name: string; success: boolean; error?: string }>> {
  const results = [];

  for (const workflow of workflows) {
    try {
      console.log(`🔄 Triggering dependent workflow: ${workflow.name}`);

      const response = await fetch(workflow.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Triggered-By': 'sync-complete-webhook',
        },
        body: JSON.stringify(workflow.payload),
      });

      if (response.ok) {
        console.log(`✅ Successfully triggered: ${workflow.name}`);
        results.push({ name: workflow.name, success: true });
      } else {
        const errorText = await response.text();
        console.error(`❌ Failed to trigger ${workflow.name}: ${response.status} ${errorText}`);
        results.push({
          name: workflow.name,
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
        });
      }
    } catch (error: any) {
      console.error(`❌ Error triggering ${workflow.name}:`, error);
      results.push({
        name: workflow.name,
        success: false,
        error: error.message,
      });
    }
  }

  return results;
}

/**
 * POST /api/webhooks/n8n/sync-complete
 *
 * Receives sync completion notifications and triggers dependent workflows
 */
export async function POST(request: NextRequest) {
  try {
    // Get webhook secret
    const webhookSecret = process.env.N8N_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('❌ N8N_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { success: false, error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    // Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get('x-n8n-signature');

    // Verify webhook signature
    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      console.error('❌ Invalid webhook signature');
      return NextResponse.json(
        { success: false, error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    // Parse payload
    let payload: SyncCompletePayload;
    try {
      payload = JSON.parse(rawBody);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const {
      syncLogId,
      organizationId,
      syncType,
      status,
      recordsProcessed,
      duration,
      errorMessage,
      metadata,
      triggerDependencies = true,
    } = payload;

    // Validate required fields
    if (!organizationId || !syncType || !status) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: organizationId, syncType, status',
        },
        { status: 400 }
      );
    }

    // Validate status
    if (!['completed', 'failed', 'partial'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status. Must be: completed, failed, or partial' },
        { status: 400 }
      );
    }

    // Verify organization exists
    const [org] = await db
      .select({
        id: organizations.id,
        name: organizations.mondayAccountName,
        active: organizations.active,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!org) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Update existing sync log if syncLogId provided
    let syncLog;
    if (syncLogId) {
      const [existing] = await db
        .select()
        .from(syncLogs)
        .where(
          and(
            eq(syncLogs.id, syncLogId),
            eq(syncLogs.organizationId, organizationId)
          )
        )
        .limit(1);

      if (existing) {
        [syncLog] = await db
          .update(syncLogs)
          .set({
            status,
            errorMessage,
            metadata: {
              ...existing.metadata,
              ...metadata,
              recordsProcessed,
              duration,
              completedAt: new Date().toISOString(),
            },
            syncEndedAt: new Date(),
          })
          .where(eq(syncLogs.id, syncLogId))
          .returning();

        console.log(`✅ Updated sync log ${syncLogId}: ${status}`);
      } else {
        console.warn(`⚠️ Sync log ${syncLogId} not found, creating new log`);
      }
    }

    // Create new sync log if not updated
    if (!syncLog) {
      [syncLog] = await db
        .insert(syncLogs)
        .values({
          organizationId,
          syncType,
          status,
          source: 'n8n_webhook',
          errorMessage,
          metadata: {
            ...metadata,
            recordsProcessed,
            duration,
            webhookReceived: true,
          },
          syncStartedAt: new Date(),
          syncEndedAt: new Date(),
        })
        .returning();

      console.log(`📝 Created new sync log: ${syncLog.id}`);
    }

    // Log completion
    const emoji = status === 'completed' ? '✅' : status === 'failed' ? '❌' : '⚠️';
    console.log(
      `${emoji} Sync ${status}: ${org.name} - ${syncType} ` +
      `(${recordsProcessed || 0} records${duration ? `, ${duration}ms` : ''})`
    );

    // Trigger dependent workflows if requested and sync completed successfully
    let dependentWorkflowResults;
    if (triggerDependencies && status === 'completed') {
      const workflows = getDependentWorkflows(syncType, organizationId, metadata);

      if (workflows.length > 0) {
        console.log(`🔄 Triggering ${workflows.length} dependent workflow(s)...`);
        dependentWorkflowResults = await triggerDependentWorkflows(workflows);
      }
    }

    // Return success response
    return NextResponse.json({
      success: true,
      syncLogId: syncLog.id,
      organizationId,
      organizationName: org.name,
      syncType,
      status,
      recordsProcessed,
      duration,
      dependentWorkflows: dependentWorkflowResults
        ? {
            triggered: dependentWorkflowResults.length,
            successful: dependentWorkflowResults.filter((r) => r.success).length,
            failed: dependentWorkflowResults.filter((r) => !r.success).length,
            results: dependentWorkflowResults,
          }
        : undefined,
      metadata: {
        syncLogCreated: !syncLogId,
        syncLogUpdated: !!syncLogId,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('❌ Sync complete webhook error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/n8n/sync-complete
 *
 * Get recent sync completions (for monitoring)
 */
export async function GET(request: NextRequest) {
  try {
    // Simple API key check for monitoring
    const apiKey = request.headers.get('x-api-key');
    if (apiKey !== process.env.N8N_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const syncType = searchParams.get('syncType');
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    // Build query conditions
    const conditions = [eq(syncLogs.source, 'n8n_webhook')];
    if (organizationId) {
      conditions.push(eq(syncLogs.organizationId, organizationId));
    }
    if (syncType) {
      conditions.push(eq(syncLogs.syncType, syncType));
    }

    const recentSyncs = await db
      .select()
      .from(syncLogs)
      .where(and(...conditions))
      .orderBy(syncLogs.createdAt)
      .limit(Math.min(limit, 100));

    return NextResponse.json({
      success: true,
      count: recentSyncs.length,
      syncs: recentSyncs.map((sync) => ({
        id: sync.id,
        organizationId: sync.organizationId,
        syncType: sync.syncType,
        status: sync.status,
        recordsProcessed: sync.metadata?.recordsProcessed,
        duration: sync.metadata?.duration,
        createdAt: sync.createdAt,
        errorMessage: sync.errorMessage,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ Sync history error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
