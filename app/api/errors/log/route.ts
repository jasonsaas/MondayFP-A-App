// app/api/errors/log/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/app/api/middleware/auth';

/**
 * POST /api/errors/log
 *
 * Log errors from n8n workflows for centralized monitoring
 *
 * Request body:
 * {
 *   source: string;
 *   workflowId?: string;
 *   workflowName?: string;
 *   executionId?: string;
 *   errorNode?: string;
 *   errorMessage: string;
 *   errorStack?: string;
 *   severity: 'critical' | 'warning' | 'info';
 *   timestamp: string;
 *   metadata?: object;
 * }
 */
export async function POST(request: NextRequest) {
  // Validate API key for n8n
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const {
      source,
      workflowId,
      workflowName,
      executionId,
      errorNode,
      errorMessage,
      errorStack,
      severity,
      timestamp,
      metadata,
    } = body;

    if (!source || !errorMessage || !severity) {
      return NextResponse.json(
        { error: 'source, errorMessage, and severity are required' },
        { status: 400 }
      );
    }

    // Log to console with severity prefix
    const severityEmoji = {
      critical: '🚨',
      warning: '⚠️',
      info: 'ℹ️',
    }[severity] || '❓';

    console.error(
      `${severityEmoji} [${severity.toUpperCase()}] ${source} Error:`,
      {
        workflowName,
        workflowId,
        executionId,
        errorNode,
        errorMessage,
        timestamp,
        metadata,
      }
    );

    // Log stack trace separately for readability
    if (errorStack) {
      console.error('Stack trace:', errorStack);
    }

    // TODO: Store in database for historical tracking and analytics
    // Consider creating an `error_logs` table with:
    // - id, source, workflow_id, workflow_name, execution_id
    // - error_node, error_message, error_stack, severity
    // - timestamp, metadata, created_at

    // TODO: Integrate with error tracking service (Sentry, etc.)
    // if (process.env.SENTRY_DSN) {
    //   Sentry.captureException(new Error(errorMessage), {
    //     tags: { source, severity, workflowId, workflowName },
    //     extra: { executionId, errorNode, metadata },
    //   });
    // }

    return NextResponse.json({
      success: true,
      logged: true,
      severity,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error logging failed:', error);
    return NextResponse.json(
      {
        error: 'Failed to log error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/errors/log
 *
 * Retrieve error logs
 *
 * Query params:
 * - source?: string (filter by source)
 * - severity?: string (filter by severity)
 * - limit?: number (default: 100)
 * - since?: ISO date string
 */
export async function GET(request: NextRequest) {
  // Validate API key for n8n
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const searchParams = request.nextUrl.searchParams;
    const source = searchParams.get('source');
    const severity = searchParams.get('severity');
    const limit = parseInt(searchParams.get('limit') || '100');
    const since = searchParams.get('since');

    // TODO: Implement actual error log retrieval from database
    // For now, return empty array as logs are console-only

    return NextResponse.json({
      success: true,
      errors: [],
      count: 0,
      filters: { source, severity, limit, since },
      message: 'Error logs are currently stored in application logs',
    });
  } catch (error) {
    console.error('Error log retrieval failed:', error);
    return NextResponse.json(
      {
        error: 'Failed to retrieve error logs',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/errors/log
 *
 * Clear old error logs
 *
 * Query params:
 * - before: ISO date string (required) - delete logs before this date
 */
export async function DELETE(request: NextRequest) {
  // Validate API key for n8n
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const searchParams = request.nextUrl.searchParams;
    const before = searchParams.get('before');

    if (!before) {
      return NextResponse.json(
        { error: 'before parameter is required (ISO date string)' },
        { status: 400 }
      );
    }

    const beforeDate = new Date(before);
    if (isNaN(beforeDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format for before parameter' },
        { status: 400 }
      );
    }

    // TODO: Implement actual log deletion from database
    // DELETE FROM error_logs WHERE created_at < $1

    return NextResponse.json({
      success: true,
      deleted: 0,
      before: beforeDate.toISOString(),
      message: 'Log cleanup not yet implemented',
    });
  } catch (error) {
    console.error('Error log cleanup failed:', error);
    return NextResponse.json(
      {
        error: 'Failed to cleanup logs',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
