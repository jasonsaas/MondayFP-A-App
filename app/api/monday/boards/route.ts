import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { integrationSettings } from '@/db/schema/fpa';
import { MondayClient } from '@/lib/monday-client';
import { eq, and } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get Monday.com integration settings
    const settings = await db
      .select()
      .from(integrationSettings)
      .where(and(
        eq(integrationSettings.userId, session.user.id),
        eq(integrationSettings.provider, 'monday')
      ))
      .limit(1);

    if (!settings[0]?.isConnected || !settings[0].accessToken) {
      return NextResponse.json(
        { error: 'Monday.com integration not connected' },
        { status: 400 }
      );
    }

    const mondayClient = new MondayClient(settings[0].accessToken);
    const boards = await mondayClient.getBoards();

    return NextResponse.json({ boards });

  } catch (error) {
    console.error('Error fetching Monday boards:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Monday.com boards' },
      { status: 500 }
    );
  }
}