import { NextRequest, NextResponse } from 'next/server';
import { mondayAuth } from '@/lib/monday-auth';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        new URL(`/sign-in?error=${encodeURIComponent(error)}`, request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/sign-in?error=missing_code', request.url)
      );
    }

    // Verify state to prevent CSRF
    const cookieStore = await cookies();
    const storedState = cookieStore.get('oauth_state')?.value;

    if (!storedState || storedState !== state) {
      return NextResponse.redirect(
        new URL('/sign-in?error=invalid_state', request.url)
      );
    }

    // Handle OAuth callback
    const { userId, sessionToken } = await mondayAuth.handleCallback(code);

    // Set session cookie
    const response = NextResponse.redirect(new URL('/dashboard', request.url));

    response.cookies.set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    });

    // Clear the state cookie
    response.cookies.delete('oauth_state');

    return response;

  } catch (error) {
    console.error('Monday OAuth callback error:', error);
    return NextResponse.redirect(
      new URL('/sign-in?error=authentication_failed', request.url)
    );
  }
}