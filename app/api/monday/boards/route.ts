import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { account } from '@/db/schema/auth';
import { MondayClient } from '@/lib/monday-client';
import { eq } from 'drizzle-orm';

/**
 * GET /api/monday/boards
 * List all Monday.com boards accessible to the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    // Get user info from middleware-added headers
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
      organizationId
    });

  } catch (error) {
    console.error('Error fetching Monday boards:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Monday.com boards' },
      { status: 500 }
    );
  }
}