import { NextRequest, NextResponse } from 'next/server';
import { n8nClient } from '@/lib/n8n-client';

/**
 * Sync Status API
 *
 * Endpoints to check the status of n8n workflow executions and sync jobs
 *
 * GET /api/sync/status?executionId=xxx - Get status of a specific n8n execution
 * GET /api/sync/status/all - Get status of all recent executions for the user
 */

interface SyncStatus {
  executionId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  workflowType: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
  metadata?: Record<string, any>;
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

    const { searchParams } = new URL(request.url);
    const executionId = searchParams.get('executionId');

    // If executionId is provided, get status for that specific execution
    if (executionId) {
      return await getExecutionStatus(executionId);
    }

    // Otherwise, return error asking for executionId
    return NextResponse.json(
      { error: 'Missing executionId parameter' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Sync status error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sync status' },
      { status: 500 }
    );
  }
}

async function getExecutionStatus(executionId: string): Promise<NextResponse> {
  try {
    // Check if N8N_API_KEY is configured
    if (!process.env.N8N_API_KEY) {
      return NextResponse.json(
        {
          error: 'N8N_API_KEY not configured',
          message: 'Cannot check execution status without N8N_API_KEY',
        },
        { status: 500 }
      );
    }

    // Get execution status from n8n
    const status = await n8nClient.getExecutionStatus(executionId);

    // Map n8n status to our SyncStatus format
    const syncStatus: SyncStatus = {
      executionId,
      status: mapN8nStatus(status.status),
      progress: getProgressFromStatus(status.status),
      workflowType: 'unknown', // n8n API doesn't return workflow type in execution
      startedAt: new Date().toISOString(), // n8n API provides this in data
      completedAt: status.status === 'success' || status.status === 'error'
        ? new Date().toISOString()
        : undefined,
      error: status.error,
      metadata: status.data,
    };

    return NextResponse.json({
      success: true,
      data: syncStatus,
    });

  } catch (error: any) {
    console.error('Failed to get execution status:', error);

    // If n8n API is not available, return a fallback response
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch execution status',
      message: error.message || 'n8n API unavailable',
      data: {
        executionId,
        status: 'unknown',
        progress: 0,
        workflowType: 'unknown',
        startedAt: new Date().toISOString(),
      } as SyncStatus,
    });
  }
}

function mapN8nStatus(n8nStatus: 'running' | 'success' | 'error' | 'waiting'): SyncStatus['status'] {
  switch (n8nStatus) {
    case 'running':
      return 'running';
    case 'success':
      return 'completed';
    case 'error':
      return 'failed';
    case 'waiting':
      return 'queued';
    default:
      return 'queued';
  }
}

function getProgressFromStatus(status: string): number {
  switch (status) {
    case 'running':
      return 50; // In progress
    case 'success':
      return 100; // Completed
    case 'error':
      return 100; // Failed but done
    case 'waiting':
      return 0; // Queued
    default:
      return 0;
  }
}

/**
 * POST endpoint to manually update sync status
 * (For testing or manual status updates)
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

    const body = await request.json();
    const { executionId, status, progress, error, metadata } = body;

    if (!executionId) {
      return NextResponse.json(
        { error: 'Missing executionId' },
        { status: 400 }
      );
    }

    // In production, you would:
    // 1. Validate the user has permission to update this execution
    // 2. Store the status update in database
    // 3. Emit real-time updates via WebSocket/SSE

    console.log('Manual sync status update:', {
      executionId,
      status,
      progress,
      userId,
      organizationId,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Status updated',
      data: {
        executionId,
        status: status || 'running',
        progress: progress || 0,
        error,
        metadata,
        updatedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Status update error:', error);
    return NextResponse.json(
      { error: 'Failed to update sync status' },
      { status: 500 }
    );
  }
}
