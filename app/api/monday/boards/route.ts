import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/app/api/middleware/auth';
import { db } from '@/db';
import { account } from '@/db/schema/auth';
import { organizations } from '@/db/schema';
import { MondayClient } from '@/lib/monday-client';
import { eq } from 'drizzle-orm';

/**
 * GET /api/monday/boards
 * List all Monday.com boards accessible to the authenticated user or organization
 *
 * Auth methods:
 * 1. User auth via middleware headers (x-user-id, x-organization-id)
 * 2. API key auth for n8n (X-API-Key header + organizationId query param)
 */
export async function GET(request: NextRequest) {
  try {
    // Check for API key authentication (for n8n)
    const apiKey = request.headers.get('X-API-Key');
    const searchParams = request.nextUrl.searchParams;

    if (apiKey) {
      // API key authentication path
      const authError = validateApiKey(request);
      if (authError) return authError;

      const organizationId = searchParams.get('organizationId');

      if (!organizationId) {
        return NextResponse.json(
          { error: 'organizationId parameter is required with API key auth' },
          { status: 400 }
        );
      }

      // Get organization
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);

      if (!org) {
        return NextResponse.json(
          { error: 'Organization not found' },
          { status: 404 }
        );
      }

      if (!org.mondayAccessToken) {
        return NextResponse.json(
          { error: 'Monday.com not connected for this organization' },
          { status: 400 }
        );
      }

      // Fetch boards from Monday.com
      const mondayClient = new MondayClient(org.mondayAccessToken);
      const boards = await mondayClient.getBoards();

      return NextResponse.json({
        success: true,
        boards,
        count: boards.length,
        organizationId,
      });
    }

    // User authentication path (existing behavior)
    const userId = request.headers.get('x-user-id');
    const organizationId = request.headers.get('x-organization-id');

    if (!userId || !organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's Monday.com access token from account table
    const [userAccount] = await db
      .select()
      .from(account)
      .where(eq(account.userId, userId))
      .limit(1);

    if (!userAccount?.accessToken) {
      return NextResponse.json(
        { error: 'Monday.com not connected. Please sign in again.' },
        { status: 400 }
      );
    }

    // Fetch boards from Monday.com
    const mondayClient = new MondayClient(userAccount.accessToken);
    const boards = await mondayClient.getBoards();

    return NextResponse.json({
      boards,
      count: boards.length,
      organizationId,
    });
  } catch (error) {
    console.error('Error fetching Monday boards:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Monday.com boards' },
      { status: 500 }
    );
  }
}