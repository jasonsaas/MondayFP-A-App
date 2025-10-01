import { NextRequest, NextResponse } from 'next/server';
import { IntuitOAuthClient } from 'intuit-oauth';
import { cookies } from 'next/headers';
import { db } from '@/db';
import { account } from '@/db/schema/auth';
import { eq, and } from 'drizzle-orm';
import { randomBytes } from 'crypto';

/**
 * QuickBooks OAuth Callback Endpoint
 *
 * Handles the OAuth callback from QuickBooks after user authorization.
 * Exchanges code for tokens and stores them in the database.
 *
 * GET /api/auth/quickbooks/callback?code=xxx&state=xxx&realmId=xxx
 */

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const realmId = searchParams.get('realmId');
    const error = searchParams.get('error');

    // Handle OAuth errors from QuickBooks
    if (error) {
      console.error('QuickBooks OAuth error:', error);
      return NextResponse.redirect(
        new URL(`/settings?error=${encodeURIComponent(error)}`, request.url)
      );
    }

    // Validate required parameters
    if (!code) {
      console.error('Missing authorization code');
      return NextResponse.redirect(
        new URL('/settings?error=missing_qb_code', request.url)
      );
    }

    if (!realmId) {
      console.error('Missing realmId (company ID)');
      return NextResponse.redirect(
        new URL('/settings?error=missing_realm_id', request.url)
      );
    }

    // Verify state to prevent CSRF attacks
    const cookieStore = await cookies();
    const storedState = cookieStore.get('oauth_qb_state')?.value;

    if (!storedState || storedState !== state) {
      console.error('State mismatch - possible CSRF attack');
      return NextResponse.redirect(
        new URL('/settings?error=invalid_state', request.url)
      );
    }

    // Get userId from middleware (injected by auth middleware)
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      console.error('User not authenticated');
      return NextResponse.redirect(
        new URL('/sign-in?error=unauthorized', request.url)
      );
    }

    // Create OAuth client
    const oauthClient = new IntuitOAuthClient({
      clientId: process.env.QUICKBOOKS_CLIENT_ID!,
      clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET!,
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
      redirectUri: process.env.QUICKBOOKS_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/quickbooks/callback`,
    });

    // Exchange authorization code for access tokens
    const authResponse = await oauthClient.createToken(request.url);
    const token = authResponse.getToken();

    console.log('QuickBooks tokens received:', {
      realmId,
      userId,
      hasAccessToken: !!token.access_token,
      hasRefreshToken: !!token.refresh_token,
      expiresIn: token.expires_in,
    });

    // Calculate token expiry times
    const now = new Date();
    const accessTokenExpiresAt = new Date(now.getTime() + (token.expires_in || 3600) * 1000);
    const refreshTokenExpiresAt = new Date(now.getTime() + (token.x_refresh_token_expires_in || 8726400) * 1000);

    // Check if QuickBooks account already exists for this user
    const existingAccounts = await db
      .select()
      .from(account)
      .where(
        and(
          eq(account.userId, userId),
          eq(account.providerId, 'quickbooks')
        )
      )
      .limit(1);

    if (existingAccounts.length > 0) {
      // Update existing account with new tokens
      await db
        .update(account)
        .set({
          accountId: realmId,
          accessToken: token.access_token,
          refreshToken: token.refresh_token,
          accessTokenExpiresAt,
          refreshTokenExpiresAt,
          scope: 'com.intuit.quickbooks.accounting',
          updatedAt: now,
        })
        .where(eq(account.id, existingAccounts[0].id));

      console.log('QuickBooks account updated:', existingAccounts[0].id);
    } else {
      // Create new account record
      const newAccountId = `qb_${randomBytes(16).toString('hex')}`;

      await db.insert(account).values({
        id: newAccountId,
        accountId: realmId,
        providerId: 'quickbooks',
        userId,
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        accessTokenExpiresAt,
        refreshTokenExpiresAt,
        scope: 'com.intuit.quickbooks.accounting',
        createdAt: now,
        updatedAt: now,
      });

      console.log('QuickBooks account created:', newAccountId);
    }

    // Success - redirect to dashboard with success message
    const response = NextResponse.redirect(
      new URL('/dashboard?qb_connected=true', request.url)
    );

    // Clear the state cookie
    response.cookies.delete('oauth_qb_state');

    return response;

  } catch (error) {
    console.error('QuickBooks OAuth callback error:', error);

    // Clear state cookie on error
    const response = NextResponse.redirect(
      new URL('/settings?error=qb_auth_failed', request.url)
    );
    response.cookies.delete('oauth_qb_state');

    return response;
  }
}
