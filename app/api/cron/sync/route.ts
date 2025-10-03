/**
 * Automated Sync Cron Job
 *
 * GET /api/cron/sync
 * Runs every 4 hours via Vercel Cron
 * Syncs all active organizations that need syncing
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncOrchestrator } from '@/lib/sync/sync-orchestrator';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'dev-secret-change-in-prod';

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn('⚠️  Unauthorized cron attempt');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🕐 Cron job started:', new Date().toISOString());

    // Run sync for all organizations
    const results = await syncOrchestrator.syncAllOrganizations();

    // Calculate summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalItems = results.reduce((sum, r) => sum + r.itemsProcessed, 0);
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

    const summary = {
      timestamp: new Date().toISOString(),
      totalOrganizations: results.length,
      successful,
      failed,
      totalItemsProcessed: totalItems,
      totalDuration,
      results: results.map(r => ({
        organizationId: r.organizationId,
        success: r.success,
        itemsProcessed: r.itemsProcessed,
        duration: r.duration,
        error: r.error,
      })),
    };

    console.log('✅ Cron job completed:', summary);

    // Send notification if there were failures
    if (failed > 0) {
      console.error(`❌ ${failed} organization(s) failed to sync`);
      // TODO: Send email/Slack notification
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${successful}/${results.length} organizations`,
      summary,
    });

  } catch (error) {
    console.error('❌ Cron job error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Cron job failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
