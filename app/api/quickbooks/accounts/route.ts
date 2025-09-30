import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { integrationSettings } from '@/db/schema/fpa';
import { QuickBooksClient } from '@/lib/quickbooks-client';
import { eq, and } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get QuickBooks integration settings
    const settings = await db
      .select()
      .from(integrationSettings)
      .where(and(
        eq(integrationSettings.userId, session.user.id),
        eq(integrationSettings.provider, 'quickbooks')
      ))
      .limit(1);

    if (!settings[0]?.isConnected || !settings[0].accessToken) {
      return NextResponse.json(
        { error: 'QuickBooks integration not connected' },
        { status: 400 }
      );
    }

    const qbClient = new QuickBooksClient(
      settings[0].accessToken,
      settings[0].realmId!,
      process.env.NODE_ENV !== 'production'
    );
    
    const accounts = await qbClient.getAccounts();

    return NextResponse.json({ accounts });

  } catch (error) {
    console.error('Error fetching QuickBooks accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch QuickBooks accounts' },
      { status: 500 }
    );
  }
}