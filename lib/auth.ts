import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { db } from './db';
import { sessions, users, organizations } from './db/schema';
import { eq, and } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET!;
const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  mondayUserId: number;
  mondayAccountId: number;
  role: string;
}

export async function createSession(user: any, organization: any): Promise<string> {
  const payload: SessionUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    organizationId: organization.id,
    mondayUserId: user.mondayUserId,
    mondayAccountId: organization.mondayAccountId,
    role: user.role,
  };

  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: '30d',
  });

  // Store in database
  await db.insert(sessions).values({
    userId: user.id,
    token,
    expiresAt: new Date(Date.now() + SESSION_DURATION),
  });

  // Set cookie
  cookies().set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION / 1000,
    path: '/',
  });

  return token;
}

export async function validateSession(): Promise<SessionUser | null> {
  try {
    const sessionCookie = cookies().get('session');
    if (!sessionCookie) return null;

    const decoded = jwt.verify(sessionCookie.value, JWT_SECRET) as SessionUser;

    // Verify session exists in database
    const dbSession = await db.query.sessions.findFirst({
      where: and(
        eq(sessions.token, sessionCookie.value),
        eq(sessions.userId, decoded.id)
      ),
    });

    if (!dbSession || dbSession.expiresAt < new Date()) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

export async function destroySession() {
  const sessionCookie = cookies().get('session');
  if (sessionCookie) {
    // Remove from database
    await db.delete(sessions).where(eq(sessions.token, sessionCookie.value));
    // Remove cookie
    cookies().delete('session');
  }
}
