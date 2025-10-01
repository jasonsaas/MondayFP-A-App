import { NextRequest, NextResponse } from 'next/server';
import { n8nClient, N8nWorkflowResponse } from '@/lib/n8n-client';
import { db } from '@/db';
import { varianceAnalyses } from '@/db/schema/fpa';
import { eq } from 'drizzle-orm';

/**
 * POST /api/n8n/trigger
 *
 * Trigger n8n workflows from the application
 * Requires authentication via middleware
 */
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const organizationId = request.headers.get('x-organization-id');

    if (!userId || !organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { workflowType, params } = body;

    if (!workflowType) {
      return NextResponse.json(
        { error: 'Workflow type is required' },
        { status: 400 }
      );
    }

    let result: N8nWorkflowResponse;

    switch (workflowType) {
      case 'variance_analysis':
        result = await handleVarianceAnalysis(userId, organizationId, params);
        break;

      case 'data_sync':
        result = await handleDataSync(userId, organizationId, params);
        break;

      case 'notification':
        result = await handleNotification(userId, organizationId, params);
        break;

      case 'schedule_analysis':
        result = await handleScheduleAnalysis(userId, organizationId, params);
        break;

      case 'custom':
        result = await handleCustomWorkflow(userId, organizationId, params);
        break;

      default:
        return NextResponse.json(
          { error: `Unknown workflow type: ${workflowType}` },
          { status: 400 }
        );
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Workflow trigger failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      executionId: result.executionId,
      data: result.data,
      timestamp: result.timestamp,
    });

  } catch (error: any) {
    console.error('n8n trigger error:', error);
    return NextResponse.json(
      { error: 'Failed to trigger workflow', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Handle variance analysis workflow
 */
async function handleVarianceAnalysis(
  userId: string,
  organizationId: string,
  params: any
): Promise<N8nWorkflowResponse> {
  const { boardId, startDate, endDate, analysisName } = params;

  if (!boardId || !startDate || !endDate) {
    return {
      success: false,
      error: 'Missing required parameters: boardId, startDate, endDate',
      timestamp: new Date().toISOString(),
    };
  }

  return n8nClient.triggerVarianceAnalysis({
    userId,
    organizationId,
    boardId,
    startDate,
    endDate,
    analysisName,
  });
}

/**
 * Handle data sync workflow
 */
async function handleDataSync(
  userId: string,
  organizationId: string,
  params: any
): Promise<N8nWorkflowResponse> {
  const {
    source,
    destination,
    syncType,
    entityType,
    entityIds,
  } = params;

  if (!source || !destination || !syncType) {
    return {
      success: false,
      error: 'Missing required parameters: source, destination, syncType',
      timestamp: new Date().toISOString(),
    };
  }

  return n8nClient.triggerDataSync({
    userId,
    organizationId,
    source,
    destination,
    syncType,
    entityType,
    entityIds,
  });
}

/**
 * Handle notification workflow
 */
async function handleNotification(
  userId: string,
  organizationId: string,
  params: any
): Promise<N8nWorkflowResponse> {
  const {
    analysisId,
    notificationType,
    recipients,
    channels,
    severity,
  } = params;

  if (!analysisId || !notificationType) {
    return {
      success: false,
      error: 'Missing required parameters: analysisId, notificationType',
      timestamp: new Date().toISOString(),
    };
  }

  // Verify analysis belongs to user
  const [analysis] = await db
    .select()
    .from(varianceAnalyses)
    .where(eq(varianceAnalyses.id, analysisId))
    .limit(1);

  if (!analysis || analysis.userId !== userId) {
    return {
      success: false,
      error: 'Analysis not found or access denied',
      timestamp: new Date().toISOString(),
    };
  }

  return n8nClient.triggerNotification({
    userId,
    organizationId,
    analysisId,
    notificationType,
    recipients,
    channels,
    severity,
  });
}

/**
 * Handle schedule analysis workflow
 */
async function handleScheduleAnalysis(
  userId: string,
  organizationId: string,
  params: any
): Promise<N8nWorkflowResponse> {
  const { boardId, schedule, enabled } = params;

  if (!boardId || !schedule) {
    return {
      success: false,
      error: 'Missing required parameters: boardId, schedule',
      timestamp: new Date().toISOString(),
    };
  }

  return n8nClient.scheduleRecurringAnalysis({
    userId,
    organizationId,
    boardId,
    schedule,
    enabled: enabled !== false,
  });
}

/**
 * Handle custom workflow with arbitrary data
 */
async function handleCustomWorkflow(
  userId: string,
  organizationId: string,
  params: any
): Promise<N8nWorkflowResponse> {
  const { webhookPath, data, headers } = params;

  if (!webhookPath) {
    return {
      success: false,
      error: 'Missing required parameter: webhookPath',
      timestamp: new Date().toISOString(),
    };
  }

  return n8nClient.triggerWorkflow({
    webhookPath,
    data: {
      userId,
      organizationId,
      ...data,
    },
    headers,
  });
}

/**
 * GET /api/n8n/trigger/status/[executionId]
 *
 * Check the status of a triggered workflow
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const executionId = searchParams.get('executionId');

    if (!executionId) {
      return NextResponse.json(
        { error: 'Execution ID is required' },
        { status: 400 }
      );
    }

    const status = await n8nClient.getExecutionStatus(executionId);

    return NextResponse.json({
      executionId,
      ...status,
    });

  } catch (error: any) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { error: 'Failed to check status', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/n8n/trigger/[executionId]
 *
 * Cancel a running workflow execution
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const executionId = searchParams.get('executionId');

    if (!executionId) {
      return NextResponse.json(
        { error: 'Execution ID is required' },
        { status: 400 }
      );
    }

    const cancelled = await n8nClient.cancelExecution(executionId);

    if (!cancelled) {
      return NextResponse.json(
        { error: 'Failed to cancel execution' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Execution cancelled',
      executionId,
    });

  } catch (error: any) {
    console.error('Cancel execution error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel execution', details: error.message },
      { status: 500 }
    );
  }
}