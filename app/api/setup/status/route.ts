/**
 * Setup Status API
 *
 * GET /api/setup/status
 * Checks which integrations are connected for the user's organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { organizations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthUser } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
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

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, user.organizationId))
      .limit(1);

    if (!org) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Check connections
    const mondayConnected = !!org.mondayAccessToken;
    const quickbooksConnected = !!org.quickbooksAccessToken && !!org.quickbooksCompanyId;
    const allConnected = mondayConnected && quickbooksConnected;

    return NextResponse.json({
      success: true,
      organizationId: org.id,
      organizationName: org.mondayAccountName,
      connections: {
        monday: {
          connected: mondayConnected,
          accountId: org.mondayAccountId,
          accountName: org.mondayAccountName,
        },
        quickbooks: {
          connected: quickbooksConnected,
          companyId: org.quickbooksCompanyId,
        },
      },
      allConnected,
      nextStep: !mondayConnected
        ? 'connect-monday'
        : !quickbooksConnected
        ? 'connect-quickbooks'
        : 'run-sync',
    });
  } catch (error) {
    console.error('Setup status error:', error);

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
