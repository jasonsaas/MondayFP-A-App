// app/api/reports/log/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/app/api/middleware/auth';
import { db } from '@/db';
import { syncLogs } from '@/db/schema';

/**
 * POST /api/reports/log
 *
 * Log report generation for tracking and auditing
 *
 * Request body:
 * {
 *   organizationId: string;
 *   reportType: 'monthly' | 'quarterly' | 'annual' | 'custom';
 *   period: string;
 *   status: 'generated' | 'sent' | 'failed';
 *   sentTo?: string[]; // Array of email addresses
 *   fileSize?: number; // PDF size in bytes
 *   boardIds?: number[]; // Monday boards included
 *   includeCharts?: boolean;
 *   includeInsights?: boolean;
 *   errorMessage?: string; // If status is 'failed'
 * }
 */
export async function POST(request: NextRequest) {
  // Validate API key
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const {
      organizationId,
      reportType,
      period,
      status,
      sentTo,
      fileSize,
      boardIds,
      includeCharts,
      includeInsights,
      errorMessage,
    } = body;

    // Validate required fields
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    if (!reportType || !['monthly', 'quarterly', 'annual', 'custom'].includes(reportType)) {
      return NextResponse.json(
        { error: 'reportType must be monthly, quarterly, annual, or custom' },
        { status: 400 }
      );
    }

    if (!period) {
      return NextResponse.json(
        { error: 'period is required' },
        { status: 400 }
      );
    }

    if (!status || !['generated', 'sent', 'failed'].includes(status)) {
      return NextResponse.json(
        { error: 'status must be generated, sent, or failed' },
        { status: 400 }
      );
    }

    // Use syncLogs table to track report generation (with syncType: 'report_generation')
    const [reportLog] = await db
      .insert(syncLogs)
      .values({
        organizationId,
        syncType: 'report_generation',
        status: status === 'failed' ? 'failed' : 'completed',
        source: 'api',
        startedAt: new Date(),
        completedAt: new Date(),
        duration: 0,
        itemsProcessed: boardIds?.length || 1,
        errorMessage: status === 'failed' ? errorMessage : null,
        metadata: {
          reportType,
          period,
          reportStatus: status,
          sentTo: sentTo || [],
          fileSize,
          boardIds: boardIds || [],
          includeCharts: includeCharts !== false,
          includeInsights: includeInsights !== false,
          recipientCount: sentTo?.length || 0,
        },
      })
      .returning();

    const logMessage = status === 'sent'
      ? `📧 Report sent to ${sentTo?.length || 0} recipient(s)`
      : status === 'generated'
        ? `📄 Report generated for ${period}`
        : `❌ Report generation failed: ${errorMessage}`;

    console.log(`${logMessage} - ${reportType} report for ${organizationId}`);

    return NextResponse.json({
      success: true,
      reportLogId: reportLog.id,
      organizationId,
      reportType,
      period,
      status,
      sentTo: sentTo || [],
      recipientCount: sentTo?.length || 0,
      timestamp: new Date().toISOString(),
      message: logMessage,
    });
  } catch (error: any) {
    console.error('Report logging error:', error);
    return NextResponse.json(
      {
        error: 'Failed to log report',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reports/log
 *
 * Retrieve report generation logs
 *
 * Query params:
 * - organizationId: string (required)
 * - reportType?: 'monthly' | 'quarterly' | 'annual' | 'custom'
 * - period?: string
 * - status?: 'generated' | 'sent' | 'failed'
 * - limit?: number (default: 100)
 */
export async function GET(request: NextRequest) {
  // Validate API key
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');
    const reportType = searchParams.get('reportType');
    const period = searchParams.get('period');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '100');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId parameter is required' },
        { status: 400 }
      );
    }

    // Build query
    let query = db
      .select()
      .from(syncLogs)
      .where(
        db.and(
          db.eq(syncLogs.organizationId, organizationId),
          db.eq(syncLogs.syncType, 'report_generation')
        )
      );

    const reports = await query.limit(limit).orderBy(db.desc(syncLogs.startedAt));

    // Filter by reportType, period, and status if provided
    let filteredReports = reports;

    if (reportType) {
      filteredReports = filteredReports.filter(
        (report: any) => report.metadata?.reportType === reportType
      );
    }

    if (period) {
      filteredReports = filteredReports.filter(
        (report: any) => report.metadata?.period === period
      );
    }

    if (status) {
      filteredReports = filteredReports.filter(
        (report: any) => report.metadata?.reportStatus === status
      );
    }

    return NextResponse.json({
      success: true,
      reports: filteredReports.map((report: any) => ({
        id: report.id,
        organizationId: report.organizationId,
        reportType: report.metadata?.reportType,
        period: report.metadata?.period,
        status: report.metadata?.reportStatus,
        sentTo: report.metadata?.sentTo || [],
        recipientCount: report.metadata?.recipientCount || 0,
        fileSize: report.metadata?.fileSize,
        boardIds: report.metadata?.boardIds || [],
        includeCharts: report.metadata?.includeCharts,
        includeInsights: report.metadata?.includeInsights,
        errorMessage: report.errorMessage,
        timestamp: report.startedAt,
      })),
      count: filteredReports.length,
      filters: { organizationId, reportType, period, status, limit },
    });
  } catch (error: any) {
    console.error('Report log retrieval error:', error);
    return NextResponse.json(
      {
        error: 'Failed to retrieve report logs',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/reports/log
 *
 * Clear old report logs
 *
 * Query params:
 * - organizationId: string (required)
 * - before: ISO date string (required) - delete logs before this date
 */
export async function DELETE(request: NextRequest) {
  // Validate API key
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');
    const before = searchParams.get('before');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId parameter is required' },
        { status: 400 }
      );
    }

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

    // Delete old report logs
    const deleted = await db
      .delete(syncLogs)
      .where(
        db.and(
          db.eq(syncLogs.organizationId, organizationId),
          db.eq(syncLogs.syncType, 'report_generation'),
          db.lt(syncLogs.startedAt, beforeDate)
        )
      )
      .returning();

    return NextResponse.json({
      success: true,
      deleted: deleted.length,
      before: beforeDate.toISOString(),
      message: `Deleted ${deleted.length} report logs before ${beforeDate.toISOString()}`,
    });
  } catch (error: any) {
    console.error('Report log cleanup error:', error);
    return NextResponse.json(
      {
        error: 'Failed to cleanup report logs',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
