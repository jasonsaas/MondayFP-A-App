import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { varianceAnalyses, varianceResults } from '@/db/schema/fpa';
import { eq } from 'drizzle-orm';

/**
 * n8n Webhook Integration for FP&A Platform
 *
 * This webhook allows n8n to:
 * 1. Trigger variance analysis runs
 * 2. Sync data between Monday.com and QuickBooks
 * 3. Send notifications about critical variances
 *
 * Authentication: Bearer token (set in environment)
 */

interface N8NWebhookPayload {
  action: 'run_analysis' | 'sync_data' | 'notify_variances' | 'callback' | 'status_update';
  data: any;
  organizationId?: string;
  userId?: string;
  executionId?: string;
  callbackType?: 'success' | 'error' | 'progress';
  metadata?: Record<string, any>;
}

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.N8N_WEBHOOK_SECRET;

    if (!expectedToken) {
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 500 }
      );
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    if (token !== expectedToken) {
      return NextResponse.json(
        { error: 'Invalid webhook secret' },
        { status: 401 }
      );
    }

    const payload: N8NWebhookPayload = await request.json();

    switch (payload.action) {
      case 'run_analysis':
        return await handleRunAnalysis(payload);

      case 'sync_data':
        return await handleSyncData(payload);

      case 'notify_variances':
        return await handleNotifyVariances(payload);

      case 'callback':
        return await handleCallback(payload);

      case 'status_update':
        return await handleStatusUpdate(payload);

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('n8n webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleRunAnalysis(payload: N8NWebhookPayload) {
  const { userId, boardId, startDate, endDate, analysisName } = payload.data;

  if (!userId || !boardId || !startDate || !endDate) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    );
  }

  // Trigger analysis asynchronously
  // In production, you'd use a job queue like BullMQ or Inngest
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/variance/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
      'x-organization-id': payload.organizationId || '',
    },
    body: JSON.stringify({
      boardId,
      startDate,
      endDate,
      analysisName: analysisName || `Analysis ${new Date().toISOString()}`,
    }),
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: 'Analysis failed to start' },
      { status: 500 }
    );
  }

  const result = await response.json();

  return NextResponse.json({
    success: true,
    message: 'Analysis started',
    data: result,
  });
}

async function handleSyncData(payload: N8NWebhookPayload) {
  const { source, destination, syncType } = payload.data;

  // Log sync request
  console.log('Sync requested:', { source, destination, syncType });

  // In production, implement actual sync logic
  // For now, return success
  return NextResponse.json({
    success: true,
    message: 'Data sync queued',
    data: {
      source,
      destination,
      syncType,
      status: 'queued',
      timestamp: new Date().toISOString(),
    },
  });
}

async function handleNotifyVariances(payload: N8NWebhookPayload) {
  const { analysisId, notificationChannels } = payload.data;

  if (!analysisId) {
    return NextResponse.json(
      { error: 'Missing analysis ID' },
      { status: 400 }
    );
  }

  // Get analysis results
  const [analysis] = await db
    .select()
    .from(varianceAnalyses)
    .where(eq(varianceAnalyses.id, analysisId))
    .limit(1);

  if (!analysis) {
    return NextResponse.json(
      { error: 'Analysis not found' },
      { status: 404 }
    );
  }

  // Get critical variance results
  const results = await db
    .select()
    .from(varianceResults)
    .where(eq(varianceResults.analysisId, analysisId));

  const criticalVariances = results.filter(r => r.severity === 'critical');

  // In production, send notifications via email, Slack, etc.
  console.log('Critical variances found:', criticalVariances.length);

  return NextResponse.json({
    success: true,
    message: 'Notifications sent',
    data: {
      analysisId,
      criticalVariances: criticalVariances.length,
      channels: notificationChannels || ['email'],
      sentAt: new Date().toISOString(),
    },
  });
}

async function handleCallback(payload: N8NWebhookPayload) {
  const { executionId, callbackType, data, metadata } = payload;

  if (!executionId) {
    return NextResponse.json(
      { error: 'Missing execution ID' },
      { status: 400 }
    );
  }

  // Log the callback for monitoring
  console.log('n8n callback received:', {
    executionId,
    callbackType,
    timestamp: new Date().toISOString(),
    metadata,
  });

  // Handle different callback types
  switch (callbackType) {
    case 'success':
      // Workflow completed successfully
      console.log(`Workflow ${executionId} completed successfully`, data);

      // If this was a sync operation, update the sync status
      if (metadata?.syncJobId) {
        // In production, update sync job status in database
        console.log(`Sync job ${metadata.syncJobId} completed`);
      }

      return NextResponse.json({
        success: true,
        message: 'Callback processed',
        data: {
          executionId,
          status: 'completed',
          processedAt: new Date().toISOString(),
        },
      });

    case 'error':
      // Workflow encountered an error
      console.error(`Workflow ${executionId} failed:`, data?.error || data);

      // In production, update job status and notify relevant parties
      if (metadata?.syncJobId) {
        console.error(`Sync job ${metadata.syncJobId} failed`);
      }

      return NextResponse.json({
        success: true,
        message: 'Error callback processed',
        data: {
          executionId,
          status: 'failed',
          error: data?.error || 'Unknown error',
          processedAt: new Date().toISOString(),
        },
      });

    case 'progress':
      // Workflow progress update
      console.log(`Workflow ${executionId} progress:`, data?.progress || 0);

      return NextResponse.json({
        success: true,
        message: 'Progress update received',
        data: {
          executionId,
          progress: data?.progress || 0,
          message: data?.message,
          processedAt: new Date().toISOString(),
        },
      });

    default:
      return NextResponse.json(
        { error: 'Unknown callback type' },
        { status: 400 }
      );
  }
}

async function handleStatusUpdate(payload: N8NWebhookPayload) {
  const { executionId, data, metadata } = payload;

  if (!executionId) {
    return NextResponse.json(
      { error: 'Missing execution ID' },
      { status: 400 }
    );
  }

  const { status, progress, currentStep, totalSteps, message, error } = data || {};

  // Log the status update
  console.log('n8n status update:', {
    executionId,
    status,
    progress,
    currentStep,
    totalSteps,
    timestamp: new Date().toISOString(),
  });

  // In production, you would:
  // 1. Update the execution status in database
  // 2. Emit real-time updates via WebSocket or SSE
  // 3. Update UI progress indicators
  // 4. Send notifications if status is 'completed' or 'failed'

  // For sync jobs, update the sync status
  if (metadata?.syncJobId) {
    // Update sync job progress in database
    console.log(`Sync job ${metadata.syncJobId} status: ${status}, progress: ${progress}%`);
  }

  return NextResponse.json({
    success: true,
    message: 'Status update processed',
    data: {
      executionId,
      status,
      progress: progress || 0,
      currentStep: currentStep || 1,
      totalSteps: totalSteps || 1,
      message: message || 'Processing...',
      error,
      updatedAt: new Date().toISOString(),
    },
  });
}

// GET endpoint for n8n to verify webhook is working
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.N8N_WEBHOOK_SECRET;

  if (!expectedToken || !authHeader || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ status: 'unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    status: 'active',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    supportedActions: ['run_analysis', 'sync_data', 'notify_variances'],
  });
}