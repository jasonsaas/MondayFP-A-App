// app/api/alerts/log/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/app/api/middleware/auth';
import { db } from '@/db';
import { syncLogs } from '@/db/schema';

/**
 * POST /api/alerts/log
 *
 * Log variance alerts for tracking and notifications
 *
 * Request body:
 * {
 *   organizationId: string;
 *   severity: 'critical' | 'warning' | 'info';
 *   accountName: string;
 *   accountCode?: string;
 *   budgetAmount: number;
 *   actualAmount: number;
 *   variance: number;
 *   variancePercent: number;
 *   period: string;
 *   boardId?: number;
 *   message?: string;
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
      severity,
      accountName,
      accountCode,
      budgetAmount,
      actualAmount,
      variance,
      variancePercent,
      period,
      boardId,
      message,
    } = body;

    // Validate required fields
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    if (!severity || !['critical', 'warning', 'info'].includes(severity)) {
      return NextResponse.json(
        { error: 'severity must be critical, warning, or info' },
        { status: 400 }
      );
    }

    if (!accountName) {
      return NextResponse.json(
        { error: 'accountName is required' },
        { status: 400 }
      );
    }

    if (variance === undefined || variancePercent === undefined) {
      return NextResponse.json(
        { error: 'variance and variancePercent are required' },
        { status: 400 }
      );
    }

    // Use syncLogs table to track alerts (with syncType: 'alert')
    const [alert] = await db
      .insert(syncLogs)
      .values({
        organizationId,
        syncType: 'alert',
        status: 'completed',
        source: 'variance_calculation',
        startedAt: new Date(),
        completedAt: new Date(),
        duration: 0,
        itemsProcessed: 1,
        metadata: {
          severity,
          accountName,
          accountCode,
          budgetAmount,
          actualAmount,
          variance,
          variancePercent,
          period,
          boardId,
          message:
            message ||
            `${accountName} is ${Math.abs(variancePercent).toFixed(1)}% ${variance > 0 ? 'over' : 'under'} budget`,
        },
      })
      .returning();

    console.log(
      `🚨 [${severity.toUpperCase()}] Alert logged: ${accountName} ${variancePercent.toFixed(1)}% variance`
    );

    return NextResponse.json({
      success: true,
      alertId: alert.id,
      severity,
      accountName,
      variancePercent,
      message:
        message ||
        `${accountName} is ${Math.abs(variancePercent).toFixed(1)}% ${variance > 0 ? 'over' : 'under'} budget`,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Alert logging error:', error);
    return NextResponse.json(
      {
        error: 'Failed to log alert',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/alerts/log
 *
 * Retrieve logged alerts
 *
 * Query params:
 * - organizationId: string (required)
 * - severity?: 'critical' | 'warning' | 'info'
 * - period?: string (YYYY-MM format)
 * - limit?: number (default: 100)
 */
export async function GET(request: NextRequest) {
  // Validate API key
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');
    const severity = searchParams.get('severity');
    const period = searchParams.get('period');
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
          db.eq(syncLogs.syncType, 'alert')
        )
      );

    const alerts = await query.limit(limit).orderBy(db.desc(syncLogs.startedAt));

    // Filter by severity and period if provided
    let filteredAlerts = alerts;

    if (severity) {
      filteredAlerts = filteredAlerts.filter(
        (alert: any) => alert.metadata?.severity === severity
      );
    }

    if (period) {
      filteredAlerts = filteredAlerts.filter(
        (alert: any) => alert.metadata?.period === period
      );
    }

    return NextResponse.json({
      success: true,
      alerts: filteredAlerts.map((alert: any) => ({
        id: alert.id,
        organizationId: alert.organizationId,
        severity: alert.metadata?.severity,
        accountName: alert.metadata?.accountName,
        accountCode: alert.metadata?.accountCode,
        budgetAmount: alert.metadata?.budgetAmount,
        actualAmount: alert.metadata?.actualAmount,
        variance: alert.metadata?.variance,
        variancePercent: alert.metadata?.variancePercent,
        period: alert.metadata?.period,
        boardId: alert.metadata?.boardId,
        message: alert.metadata?.message,
        timestamp: alert.startedAt,
      })),
      count: filteredAlerts.length,
      filters: { organizationId, severity, period, limit },
    });
  } catch (error: any) {
    console.error('Alert retrieval error:', error);
    return NextResponse.json(
      {
        error: 'Failed to retrieve alerts',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/alerts/log
 *
 * Clear old alerts
 *
 * Query params:
 * - organizationId: string (required)
 * - before: ISO date string (required) - delete alerts before this date
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

    // Delete old alerts
    const deleted = await db
      .delete(syncLogs)
      .where(
        db.and(
          db.eq(syncLogs.organizationId, organizationId),
          db.eq(syncLogs.syncType, 'alert'),
          db.lt(syncLogs.startedAt, beforeDate)
        )
      )
      .returning();

    return NextResponse.json({
      success: true,
      deleted: deleted.length,
      before: beforeDate.toISOString(),
      message: `Deleted ${deleted.length} alerts before ${beforeDate.toISOString()}`,
    });
  } catch (error: any) {
    console.error('Alert cleanup error:', error);
    return NextResponse.json(
      {
        error: 'Failed to cleanup alerts',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
