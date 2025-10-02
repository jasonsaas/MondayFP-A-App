// app/api/auth/quickbooks/refresh/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/app/api/middleware/auth';
import { db } from '@/db';
import { organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * POST /api/auth/quickbooks/refresh
 *
 * Refresh QuickBooks OAuth access token using refresh token
 *
 * Request body:
 * {
 *   organizationId: string;
 * }
 */
export async function POST(request: NextRequest) {
  // Validate API key
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { organizationId } = body;

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
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

    if (!org.quickbooksRefreshToken) {
      return NextResponse.json(
        {
          error: 'No refresh token available',
          message: 'QuickBooks needs to be reconnected via OAuth flow',
        },
        { status: 400 }
      );
    }

    // Prepare refresh token request
    const clientId = process.env.QUICKBOOKS_CLIENT_ID;
    const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'QuickBooks OAuth not configured' },
        { status: 500 }
      );
    }

    // Base64 encode credentials
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    // Call QuickBooks token refresh endpoint
    const tokenEndpoint =
      process.env.QUICKBOOKS_ENVIRONMENT === 'production'
        ? 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
        : 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

    const tokenResponse = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: org.quickbooksRefreshToken,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('QuickBooks token refresh failed:', errorText);

      return NextResponse.json(
        {
          error: 'Token refresh failed',
          message: 'Failed to refresh QuickBooks access token',
          details: tokenResponse.status === 400 ? 'Invalid refresh token - reconnection required' : errorText,
        },
        { status: tokenResponse.status }
      );
    }

    const tokenData = await tokenResponse.json();

    // Calculate token expiry (QuickBooks tokens expire in 3600 seconds = 1 hour)
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 3600));

    // Update organization with new tokens
    await db
      .update(organizations)
      .set({
        quickbooksAccessToken: tokenData.access_token,
        quickbooksRefreshToken: tokenData.refresh_token, // QuickBooks returns new refresh token
        quickbooksTokenExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organizationId));

    console.log(`✅ QuickBooks token refreshed for org ${org.mondayAccountName}`);

    return NextResponse.json({
      success: true,
      accessToken: tokenData.access_token,
      expiresAt: expiresAt.toISOString(),
      expiresIn: tokenData.expires_in,
      message: 'QuickBooks token refreshed successfully',
    });
  } catch (error: any) {
    console.error('QuickBooks token refresh error:', error);
    return NextResponse.json(
      {
        error: 'Token refresh failed',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
