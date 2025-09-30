import { NextRequest, NextResponse } from 'next/server';
import { mondayAuth } from '@/lib/monday-auth';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Generate state for CSRF protection
    const state = crypto.randomUUID();

    // Store state in cookie
    const cookieStore = await cookies();
    cookieStore.set('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    // Get authorization URL
    const authUrl = mondayAuth.getAuthorizationUrl(state);

    return NextResponse.redirect(authUrl);

  } catch (error) {
    console.error('Monday OAuth login error:', error);
    return NextResponse.redirect(
      new URL('/sign-in?error=initialization_failed', request.url)
    );
  }
}