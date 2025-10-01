import { NextRequest, NextResponse } from 'next/server';
import { IntuitOAuthClient } from 'intuit-oauth';
import { randomBytes } from 'crypto';

/**
 * QuickBooks OAuth Login Endpoint
 *
 * Initiates the QuickBooks OAuth 2.0 flow by redirecting the user
 * to QuickBooks authorization page.
 *
 * GET /api/auth/quickbooks - Start OAuth flow
 */

export async function GET(request: NextRequest) {
  try {
    // Generate random state for CSRF protection
    const state = randomBytes(32).toString('hex');

    // Validate required environment variables
    if (!process.env.QUICKBOOKS_CLIENT_ID || !process.env.QUICKBOOKS_CLIENT_SECRET) {
      console.error('Missing QuickBooks credentials in environment');
      return NextResponse.redirect(
        new URL('/settings?error=qb_config_missing', request.url)
      );
    }

    // Create OAuth client
    const oauthClient = new IntuitOAuthClient({
      clientId: process.env.QUICKBOOKS_CLIENT_ID,
      clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET,
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
      redirectUri: process.env.QUICKBOOKS_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/quickbooks/callback`,
    });

    // Generate authorization URL
    const authUri = oauthClient.authorizeUri({
      scope: [IntuitOAuthClient.scopes.Accounting],
      state,
    });

    console.log('QuickBooks OAuth initiated:', {
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
      redirectUri: process.env.QUICKBOOKS_REDIRECT_URI,
    });

    // Create response with redirect
    const response = NextResponse.redirect(authUri);

    // Store state in cookie for verification in callback
    response.cookies.set('oauth_qb_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    return response;

  } catch (error) {
    console.error('QuickBooks OAuth error:', error);
    return NextResponse.redirect(
      new URL('/settings?error=qb_oauth_init_failed', request.url)
    );
  }
}
