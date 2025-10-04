/**
 * Variance Export API
 *
 * GET /api/variance/export
 * Exports the latest variance analysis as CSV
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { varianceSnapshots } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getAuthUser } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!user.organizationId) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Fetch latest variance snapshot
    const [latestSnapshot] = await db
      .select()
      .from(varianceSnapshots)
      .where(eq(varianceSnapshots.organizationId, user.organizationId))
      .orderBy(desc(varianceSnapshots.createdAt))
      .limit(1);

    if (!latestSnapshot) {
      return NextResponse.json(
        { success: false, error: 'No variance data available' },
        { status: 404 }
      );
    }

    // Extract variance items
    const snapshotData = latestSnapshot.data as any;
    const items = snapshotData?.variances || [];

    // Create CSV
    const headers = ['Account', 'Category', 'Budget', 'Actual', 'Variance', 'Variance %', 'Status'];
    const rows = items.map((item: any) => [
      item.accountName || '',
      item.category || '',
      item.budgetAmount || 0,
      item.actualAmount || 0,
      item.variance || 0,
      item.variancePercent?.toFixed(1) || '0.0',
      item.severity || 'normal'
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row: any[]) => row.map(cell => {
        // Escape cells that contain commas or quotes
        if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(','))
    ].join('\n');

    const filename = `variance-analysis-${latestSnapshot.period || new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('Variance export error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
