// app/api/organizations/active/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/app/api/middleware/auth';
import { db } from '@/db';
import { organizations } from '@/db/schema';
import { and, eq, isNotNull } from 'drizzle-orm';

/**
 * GET /api/organizations/active
 * Returns all organizations with both Monday.com AND QuickBooks connected
 * Required for n8n sync workflows
 */
export async function GET(request: NextRequest) {
  // Validate API key
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    // Get active organizations with both Monday and QuickBooks connected
    const activeOrgs = await db
      .select({
        id: organizations.id,
        name: organizations.mondayAccountName,
        mondayAccountId: organizations.mondayAccountId,
        quickbooksRealmId: organizations.quickbooksRealmId,
        quickbooksTokenExpiresAt: organizations.quickbooksTokenExpiresAt,
        settings: organizations.settings,
        active: organizations.active,
      })
      .from(organizations)
      .where(
        and(
          eq(organizations.active, true),
          isNotNull(organizations.mondayAccessToken),
          isNotNull(organizations.quickbooksRealmId),
          isNotNull(organizations.quickbooksAccessToken)
        )
      );

    return NextResponse.json({
      success: true,
      data: activeOrgs,
      count: activeOrgs.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching active organizations:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
