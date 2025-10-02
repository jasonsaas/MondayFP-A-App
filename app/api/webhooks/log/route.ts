// app/api/webhooks/log/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/app/api/middleware/auth';
import { db } from '@/db';
import { syncLogs } from '@/db/schema';

/**
 * POST /api/webhooks/log
 *
 * Log webhook events for debugging and monitoring
 *
 * Request body:
 * {
 *   source: string;
 *   event: string;
 *   boardId?: number;
 *   itemId?: number;
 *   status: string;
 *   metadata?: object;
 * }
 */
export async function POST(request: NextRequest) {
  // Validate API key for n8n
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { source, event, boardId, itemId, status, metadata } = body;

    if (!source || !event || !status) {
      return NextResponse.json(
        { error: 'source, event, and status are required' },
        { status: 400 }
      );
    }

    // Log to console for immediate visibility
    console.log(`[Webhook Log] ${source}:${event} - ${status}`, {
      boardId,
      itemId,
      metadata,
    });

    // Store in database for historical tracking
    // Note: You may want to create a dedicated webhook_logs table
    // For now, we'll use console logging and return success

    return NextResponse.json({
      success: true,
      logged: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Webhook logging error:', error);
    return NextResponse.json(
      {
        error: 'Failed to log webhook event',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/log
 *
 * Retrieve webhook logs
 *
 * Query params:
 * - source?: string
 * - limit?: number
 * - since?: ISO date string
 */
export async function GET(request: NextRequest) {
  // Validate API key for n8n
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const searchParams = request.nextUrl.searchParams;
    const source = searchParams.get('source');
    const limit = parseInt(searchParams.get('limit') || '100');
    const since = searchParams.get('since');

    // TODO: Implement actual log retrieval from database
    // For now, return empty array as logs are console-only

    return NextResponse.json({
      success: true,
      logs: [],
      count: 0,
      message: 'Webhook logs are currently stored in application logs',
    });
  } catch (error) {
    console.error('Webhook log retrieval error:', error);
    return NextResponse.json(
      {
        error: 'Failed to retrieve logs',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
