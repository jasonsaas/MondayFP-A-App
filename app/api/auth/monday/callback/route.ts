import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { organizations, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  // Verify state
  const savedState = request.cookies.get('oauth_state');
  if (!savedState || savedState.value !== state) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/auth/error?message=Invalid state`);
  }

  if (!code) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/auth/error?message=No code provided`);
  }

  try {
    // Exchange code for token
    const tokenResponse = await fetch('https://auth.monday.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.MONDAY_CLIENT_ID!,
        client_secret: process.env.MONDAY_CLIENT_SECRET!,
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_URL}/api/auth/monday/callback`,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      throw new Error('No access token received');
    }

    // Get user info from Monday
    const meResponse = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Authorization': tokenData.access_token,
        'Content-Type': 'application/json',
        'API-Version': '2024-01',
      },
      body: JSON.stringify({
        query: `query {
          me {
            id
            name
            email
            account {
              id
              name
            }
          }
        }`,
      }),
    });

    const meData = await meResponse.json();
    const mondayUser = meData.data.me;

    // Check if organization exists
    let organization = await db.query.organizations.findFirst({
      where: eq(organizations.mondayAccountId, parseInt(mondayUser.account.id)),
    });

    if (!organization) {
      // Create new organization
      const [newOrg] = await db.insert(organizations).values({
        mondayAccountId: parseInt(mondayUser.account.id),
        mondayAccountName: mondayUser.account.name,
        mondayAccessToken: tokenData.access_token,
        mondayRefreshToken: tokenData.refresh_token,
        mondayTokenExpiresAt: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000)
          : null,
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 day trial
      }).returning();
      organization = newOrg;
    } else {
      // Update tokens
      await db.update(organizations)
        .set({
          mondayAccessToken: tokenData.access_token,
          mondayRefreshToken: tokenData.refresh_token,
          mondayTokenExpiresAt: tokenData.expires_in
            ? new Date(Date.now() + tokenData.expires_in * 1000)
            : null,
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, organization.id));
    }

    // Check if user exists
    let user = await db.query.users.findFirst({
      where: eq(users.mondayUserId, parseInt(mondayUser.id)),
    });

    if (!user) {
      // Create new user
      const [newUser] = await db.insert(users).values({
        organizationId: organization.id,
        mondayUserId: parseInt(mondayUser.id),
        email: mondayUser.email,
        name: mondayUser.name,
        role: 'admin', // First user is admin
        lastLogin: new Date(),
      }).returning();
      user = newUser;
    } else {
      // Update last login
      await db.update(users)
        .set({ lastLogin: new Date() })
        .where(eq(users.id, user.id));
    }

    // Create session
    await createSession(user, organization);

    // Redirect to dashboard
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/dashboard`);

  } catch (error) {
    console.error('OAuth error:', error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/auth/error?message=Authentication failed`);
  }
}
