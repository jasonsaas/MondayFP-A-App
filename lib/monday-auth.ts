import { db } from '@/db';
import { user, organization, session, account } from '@/db/schema/auth';
import { eq } from 'drizzle-orm';
import { SignJWT, jwtVerify } from 'jose';

const MONDAY_AUTH_URL = 'https://auth.monday.com/oauth2/authorize';
const MONDAY_TOKEN_URL = 'https://auth.monday.com/oauth2/token';
const MONDAY_API_URL = 'https://api.monday.com/v2';

interface MondayTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

interface MondayUser {
  id: string;
  name: string;
  email: string;
  photo_thumb?: string;
  account: {
    id: string;
    name: string;
    slug: string;
  };
}

export class MondayAuth {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = process.env.MONDAY_CLIENT_ID!;
    this.clientSecret = process.env.MONDAY_CLIENT_SECRET!;
    this.redirectUri = process.env.MONDAY_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/monday/callback`;
  }

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      state,
    });

    return `${MONDAY_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<MondayTokenResponse> {
    const response = await fetch(MONDAY_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: this.redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code for token');
    }

    return response.json();
  }

  async getMondayUser(accessToken: string): Promise<MondayUser> {
    const query = `
      query {
        me {
          id
          name
          email
          photo_thumb
          account {
            id
            name
            slug
          }
        }
      }
    `;

    const response = await fetch(MONDAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'API-Version': '2024-01',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch Monday user');
    }

    const data = await response.json();
    return data.data.me;
  }

  async handleCallback(code: string): Promise<{ userId: string; sessionToken: string }> {
    // Exchange code for access token
    const tokenData = await this.exchangeCodeForToken(code);

    // Get user info from Monday
    const mondayUser = await this.getMondayUser(tokenData.access_token);

    // Find or create organization
    let [org] = await db
      .select()
      .from(organization)
      .where(eq(organization.mondayAccountId, mondayUser.account.id))
      .limit(1);

    if (!org) {
      [org] = await db
        .insert(organization)
        .values({
          id: crypto.randomUUID(),
          name: mondayUser.account.name,
          mondayAccountId: mondayUser.account.id,
          slug: mondayUser.account.slug,
        })
        .returning();
    }

    // Find or create user
    let [existingUser] = await db
      .select()
      .from(user)
      .where(eq(user.mondayUserId, mondayUser.id))
      .limit(1);

    if (!existingUser) {
      [existingUser] = await db
        .insert(user)
        .values({
          id: crypto.randomUUID(),
          name: mondayUser.name,
          email: mondayUser.email,
          image: mondayUser.photo_thumb,
          mondayUserId: mondayUser.id,
          organizationId: org.id,
          emailVerified: true,
          role: 'owner', // First user becomes owner
        })
        .returning();
    } else {
      // Update user info
      [existingUser] = await db
        .update(user)
        .set({
          name: mondayUser.name,
          email: mondayUser.email,
          image: mondayUser.photo_thumb,
          updatedAt: new Date(),
        })
        .where(eq(user.id, existingUser.id))
        .returning();
    }

    // Store or update OAuth account
    const [existingAccount] = await db
      .select()
      .from(account)
      .where(eq(account.userId, existingUser.id))
      .limit(1);

    if (existingAccount) {
      await db
        .update(account)
        .set({
          accessToken: tokenData.access_token,
          updatedAt: new Date(),
        })
        .where(eq(account.id, existingAccount.id));
    } else {
      await db
        .insert(account)
        .values({
          id: crypto.randomUUID(),
          accountId: mondayUser.account.id,
          providerId: 'monday',
          userId: existingUser.id,
          accessToken: tokenData.access_token,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
    }

    // Create session
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await db
      .insert(session)
      .values({
        id: sessionId,
        userId: existingUser.id,
        token: sessionId,
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    // Create JWT session token
    const sessionToken = await this.createSessionToken({
      userId: existingUser.id,
      sessionId,
      organizationId: org.id,
    });

    return {
      userId: existingUser.id,
      sessionToken,
    };
  }

  async createSessionToken(payload: { userId: string; sessionId: string; organizationId: string }): Promise<string> {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key-change-in-production');

    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(secret);

    return token;
  }

  async verifySessionToken(token: string): Promise<{ userId: string; sessionId: string; organizationId: string } | null> {
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key-change-in-production');
      const { payload } = await jwtVerify(token, secret);

      return {
        userId: payload.userId as string,
        sessionId: payload.sessionId as string,
        organizationId: payload.organizationId as string,
      };
    } catch (error) {
      return null;
    }
  }

  async getSession(token: string) {
    const payload = await this.verifySessionToken(token);
    if (!payload) return null;

    const [sessionData] = await db
      .select()
      .from(session)
      .where(eq(session.id, payload.sessionId))
      .limit(1);

    if (!sessionData || sessionData.expiresAt < new Date()) {
      return null;
    }

    const [userData] = await db
      .select()
      .from(user)
      .where(eq(user.id, payload.userId))
      .limit(1);

    const [orgData] = await db
      .select()
      .from(organization)
      .where(eq(organization.id, payload.organizationId))
      .limit(1);

    return {
      user: userData,
      organization: orgData,
      session: sessionData,
    };
  }

  async invalidateSession(sessionId: string) {
    await db
      .delete(session)
      .where(eq(session.id, sessionId));
  }
}

export const mondayAuth = new MondayAuth();