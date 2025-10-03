import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import {
  organizations,
  budgetItems,
  actualItems,
  varianceAnalyses,
  syncLogs,
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { seedTestData } from '@/scripts/seed-test-data';

/**
 * Development-only endpoint to reset test data
 *
 * SECURITY:
 * - Only works in development environment
 * - Requires both N8N_API_KEY and special RESET_SECRET
 * - Completely disabled in production
 *
 * @example
 * POST /api/test/reset
 * Headers:
 *   X-API-Key: <n8n_api_key>
 *   X-Reset-Secret: <reset_secret>
 * Body:
 *   {
 *     "confirm": "RESET_ALL_DATA",
 *     "reseed": true
 *   }
 */

interface ResetRequest {
  confirm: string;
  reseed?: boolean;
  clearAll?: boolean;
}

/**
 * Verify this is a development environment
 */
function isDevelopment(): boolean {
  return (
    process.env.NODE_ENV === 'development' ||
    process.env.VERCEL_ENV === 'development' ||
    process.env.RAILWAY_ENVIRONMENT === 'development'
  );
}

/**
 * Clear test data from database
 */
async function clearTestData(clearAll: boolean = false): Promise<{
  organizations: number;
  budgetItems: number;
  actualItems: number;
  varianceAnalyses: number;
  syncLogs: number;
}> {
  const counts = {
    organizations: 0,
    budgetItems: 0,
    actualItems: 0,
    varianceAnalyses: 0,
    syncLogs: 0,
  };

  try {
    if (clearAll) {
      // Clear ALL data (use with extreme caution)
      console.log('⚠️  CLEARING ALL DATA FROM DATABASE...');

      // Delete in correct order (respecting foreign keys)
      const deletedVariances = await db.delete(varianceAnalyses).returning();
      counts.varianceAnalyses = deletedVariances.length;

      const deletedSyncLogs = await db.delete(syncLogs).returning();
      counts.syncLogs = deletedSyncLogs.length;

      const deletedActuals = await db.delete(actualItems).returning();
      counts.actualItems = deletedActuals.length;

      const deletedBudgets = await db.delete(budgetItems).returning();
      counts.budgetItems = deletedBudgets.length;

      const deletedOrgs = await db.delete(organizations).returning();
      counts.organizations = deletedOrgs.length;

      console.log('✅ Cleared all data from database');
    } else {
      // Only clear test organizations (mondayAccountId >= 10000000)
      console.log('🧹 Clearing test data only...');

      // Get test organization IDs
      const testOrgs = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.mondayAccountId, 10000000));

      const testOrgIds = testOrgs.map((org) => org.id);

      if (testOrgIds.length === 0) {
        console.log('ℹ️  No test organizations found');
        return counts;
      }

      // Delete related data for test orgs
      for (const orgId of testOrgIds) {
        const deletedVariances = await db
          .delete(varianceAnalyses)
          .where(eq(varianceAnalyses.organizationId, orgId))
          .returning();
        counts.varianceAnalyses += deletedVariances.length;

        const deletedSyncLogs = await db
          .delete(syncLogs)
          .where(eq(syncLogs.organizationId, orgId))
          .returning();
        counts.syncLogs += deletedSyncLogs.length;

        const deletedActuals = await db
          .delete(actualItems)
          .where(eq(actualItems.organizationId, orgId))
          .returning();
        counts.actualItems += deletedActuals.length;

        const deletedBudgets = await db
          .delete(budgetItems)
          .where(eq(budgetItems.organizationId, orgId))
          .returning();
        counts.budgetItems += deletedBudgets.length;

        const deletedOrgs = await db
          .delete(organizations)
          .where(eq(organizations.id, orgId))
          .returning();
        counts.organizations += deletedOrgs.length;
      }

      console.log('✅ Cleared test data');
    }

    return counts;
  } catch (error: any) {
    console.error('❌ Error clearing data:', error);
    throw error;
  }
}

/**
 * POST /api/test/reset
 *
 * Reset test data in development environment only
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // SECURITY CHECK 1: Development environment only
    if (!isDevelopment()) {
      console.error('❌ Reset endpoint called in non-development environment');
      return NextResponse.json(
        {
          success: false,
          error: 'This endpoint is only available in development environment',
        },
        { status: 403 }
      );
    }

    // SECURITY CHECK 2: API Key validation
    const apiKey = request.headers.get('x-api-key');
    if (apiKey !== process.env.N8N_API_KEY) {
      console.error('❌ Invalid API key for reset endpoint');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // SECURITY CHECK 3: Reset secret validation
    const resetSecret = request.headers.get('x-reset-secret');
    const expectedSecret = process.env.RESET_SECRET || 'dev-reset-secret-change-me';

    if (resetSecret !== expectedSecret) {
      console.error('❌ Invalid reset secret');
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid reset secret. Set RESET_SECRET in .env.local',
        },
        { status: 401 }
      );
    }

    // Parse request body
    let body: ResetRequest;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { confirm, reseed = true, clearAll = false } = body;

    // SECURITY CHECK 4: Confirmation phrase
    if (confirm !== 'RESET_ALL_DATA') {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing confirmation. Send {"confirm": "RESET_ALL_DATA"}',
        },
        { status: 400 }
      );
    }

    console.log('\n' + '='.repeat(60));
    console.log('🔄 DATABASE RESET INITIATED');
    console.log('='.repeat(60));
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Clear All: ${clearAll}`);
    console.log(`Reseed: ${reseed}`);
    console.log('='.repeat(60) + '\n');

    // Clear existing data
    console.log('🧹 Step 1: Clearing existing data...');
    const deleteCounts = await clearTestData(clearAll);

    console.log('\n📊 Deletion Summary:');
    console.log(`   Organizations: ${deleteCounts.organizations}`);
    console.log(`   Budget Items: ${deleteCounts.budgetItems}`);
    console.log(`   Actual Items: ${deleteCounts.actualItems}`);
    console.log(`   Variance Analyses: ${deleteCounts.varianceAnalyses}`);
    console.log(`   Sync Logs: ${deleteCounts.syncLogs}`);

    // Reseed if requested
    let seedCounts;
    if (reseed) {
      console.log('\n🌱 Step 2: Reseeding test data...');
      await seedTestData();

      // Count new records
      const newOrgs = await db.select({ id: organizations.id }).from(organizations);
      const newBudgets = await db.select({ id: budgetItems.id }).from(budgetItems);
      const newActuals = await db.select({ id: actualItems.id }).from(actualItems);

      seedCounts = {
        organizations: newOrgs.length,
        budgetItems: newBudgets.length,
        actualItems: newActuals.length,
      };

      console.log('\n📊 Seeding Summary:');
      console.log(`   Organizations: ${seedCounts.organizations}`);
      console.log(`   Budget Items: ${seedCounts.budgetItems}`);
      console.log(`   Actual Items: ${seedCounts.actualItems}`);
    }

    const duration = Date.now() - startTime;

    console.log('\n' + '='.repeat(60));
    console.log(`✅ DATABASE RESET COMPLETED (${duration}ms)`);
    console.log('='.repeat(60) + '\n');

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Database reset completed successfully',
      duration,
      deleted: deleteCounts,
      seeded: reseed ? seedCounts : undefined,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('\n❌ Reset endpoint error:', error);
    console.error(error.stack);

    return NextResponse.json(
      {
        success: false,
        error: 'Database reset failed',
        message: error.message,
        duration: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/test/reset
 *
 * Get reset endpoint status and requirements
 */
export async function GET(request: NextRequest) {
  // Only show info in development
  if (!isDevelopment()) {
    return NextResponse.json(
      { success: false, error: 'Not found' },
      { status: 404 }
    );
  }

  const apiKey = request.headers.get('x-api-key');
  if (apiKey !== process.env.N8N_API_KEY) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    endpoint: '/api/test/reset',
    method: 'POST',
    environment: process.env.NODE_ENV,
    available: isDevelopment(),
    requirements: {
      headers: {
        'X-API-Key': 'Required (N8N_API_KEY)',
        'X-Reset-Secret': 'Required (RESET_SECRET from .env)',
      },
      body: {
        confirm: 'Required: "RESET_ALL_DATA"',
        reseed: 'Optional: boolean (default: true)',
        clearAll: 'Optional: boolean (default: false) - USE WITH CAUTION',
      },
    },
    example: {
      curl: `curl -X POST ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/test/reset \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "X-Reset-Secret: YOUR_RESET_SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{"confirm":"RESET_ALL_DATA","reseed":true}'`,
    },
    warning: '⚠️  This endpoint will delete data from your database. Use with caution!',
  });
}

/**
 * DELETE /api/test/reset
 *
 * Alternative method for reset (same as POST)
 */
export async function DELETE(request: NextRequest) {
  return POST(request);
}
