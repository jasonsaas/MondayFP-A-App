import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const clientId = process.env.MONDAY_CLIENT_ID!;
  const redirectUri = `${process.env.NEXT_PUBLIC_URL}/api/auth/monday/callback`;

  // Generate state for CSRF protection
  const state = Math.random().toString(36).substring(7);

  // Store state in cookie
  const response = NextResponse.redirect(
    `https://auth.monday.com/oauth2/authorize?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `state=${state}&` +
    `scope=me:read boards:read boards:write account:read workspaces:read`
  );

  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });

  return response;
}
