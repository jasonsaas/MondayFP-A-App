import { NextRequest, NextResponse } from 'next/server';
import { QuickBooksClient } from '@/lib/quickbooks-client';
import { db } from '@/db';
import { account } from '@/db/schema/auth';
import { eq, and } from 'drizzle-orm';

/**
 * QuickBooks Profit & Loss Report API
 *
 * Fetches P&L report from QuickBooks for a specified date range.
 * Automatically handles token refresh if access token has expired.
 *
 * GET /api/quickbooks/reports/pl?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const organizationId = request.headers.get('x-organization-id');

    if (!userId || !organizationId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json(
        {
          error: 'Missing required parameters',
          message: 'Both startDate and endDate are required in YYYY-MM-DD format',
          example: '/api/quickbooks/reports/pl?startDate=2024-01-01&endDate=2024-12-31'
        },
        { status: 400 }
      );
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return NextResponse.json(
        {
          error: 'Invalid date format',
          message: 'Dates must be in YYYY-MM-DD format',
          received: { startDate, endDate }
        },
        { status: 400 }
      );
    }

    // Validate date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      return NextResponse.json(
        { error: 'Invalid date range: startDate must be before or equal to endDate' },
        { status: 400 }
      );
    }

    // Get QuickBooks account from database
    const [qbAccount] = await db
      .select()
      .from(account)
      .where(
        and(
          eq(account.userId, userId),
          eq(account.providerId, 'quickbooks')
        )
      )
      .limit(1);

    if (!qbAccount) {
      return NextResponse.json(
        {
          error: 'QuickBooks not connected',
          message: 'Please connect your QuickBooks account first',
          action: 'Visit /api/auth/quickbooks to connect'
        },
        { status: 401 }
      );
    }

    // Check if access token is expired and refresh if needed
    let accessToken = qbAccount.accessToken!;
    const now = new Date();

    if (qbAccount.accessTokenExpiresAt && qbAccount.accessTokenExpiresAt < now) {
      console.log('QuickBooks access token expired, refreshing...');

      // Token expired - attempt to refresh
      if (!qbAccount.refreshToken) {
        return NextResponse.json(
          {
            error: 'QuickBooks token expired',
            message: 'Please reconnect your QuickBooks account',
            action: 'Visit /api/auth/quickbooks to reconnect'
          },
          { status: 401 }
        );
      }

      try {
        // Create temporary client to refresh token
        const tempClient = new QuickBooksClient(
          '',
          qbAccount.accountId,
          process.env.NODE_ENV !== 'production'
        );

        const newTokens = await tempClient.refreshAccessToken(qbAccount.refreshToken);

        // Calculate new expiry times
        const newAccessTokenExpiresAt = new Date(now.getTime() + newTokens.expires_in * 1000);
        const newRefreshTokenExpiresAt = new Date(now.getTime() + newTokens.x_refresh_token_expires_in * 1000);

        // Update tokens in database
        await db
          .update(account)
          .set({
            accessToken: newTokens.access_token,
            refreshToken: newTokens.refresh_token,
            accessTokenExpiresAt: newAccessTokenExpiresAt,
            refreshTokenExpiresAt: newRefreshTokenExpiresAt,
            updatedAt: new Date(),
          })
          .where(eq(account.id, qbAccount.id));

        accessToken = newTokens.access_token;

        console.log('QuickBooks token refreshed successfully');
      } catch (error) {
        console.error('Failed to refresh QuickBooks token:', error);
        return NextResponse.json(
          {
            error: 'Failed to refresh QuickBooks token',
            message: 'Please reconnect your QuickBooks account',
            action: 'Visit /api/auth/quickbooks to reconnect'
          },
          { status: 401 }
        );
      }
    }

    // Create QuickBooks client with valid access token
    const qbClient = new QuickBooksClient(
      accessToken,
      qbAccount.accountId,
      process.env.NODE_ENV !== 'production'
    );

    // Fetch P&L report
    console.log('Fetching P&L report:', { startDate, endDate, realmId: qbAccount.accountId });
    const plReport = await qbClient.getProfitAndLoss(startDate, endDate);

    return NextResponse.json({
      success: true,
      data: plReport,
      metadata: {
        realmId: qbAccount.accountId,
        userId,
        organizationId,
        fetchedAt: new Date().toISOString(),
        dateRange: {
          start: startDate,
          end: endDate,
        },
      },
    });

  } catch (error: any) {
    console.error('P&L report error:', error);

    // Handle specific QuickBooks API errors
    if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
      return NextResponse.json(
        {
          error: 'QuickBooks authorization failed',
          message: 'Please reconnect your QuickBooks account',
          details: error.message
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch P&L report',
        message: error.message || 'Unknown error occurred',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
