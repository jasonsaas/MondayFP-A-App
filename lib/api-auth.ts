/**
 * API Authentication Helper
 *
 * Provides session validation for API routes
 */

import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { db } from './db';
import { sessions } from './db/schema';
import { eq, and } from 'drizzle-orm';
import type { SessionUser } from './auth';

const JWT_SECRET = process.env.JWT_SECRET!;

/**
 * Get the authenticated user from the request
 * Returns null if not authenticated
 */
export async function getAuthUser(request: NextRequest): Promise<SessionUser | null> {
  try {
    // Try to get session from cookie
    const sessionCookie = request.cookies.get('session');
    if (!sessionCookie) {
      // Fallback to x-user-id header for backward compatibility during migration
      const userId = request.headers.get('x-user-id');
      if (userId) {
        // For development/testing only - remove in production
        console.warn('Using x-user-id header - this should only be used for testing');
        return {
          id: userId,
          email: 'test@example.com',
          name: 'Test User',
          organizationId: '',
          mondayUserId: 0,
          mondayAccountId: 0,
          role: 'admin'
        };
      }
      return null;
    }

    // Verify JWT
    const decoded = jwt.verify(sessionCookie.value, JWT_SECRET) as SessionUser;

    // Verify session exists in database and hasn't expired
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
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
}

/**
 * Require authentication for an API route
 * Throws an error if not authenticated
 */
export async function requireAuth(request: NextRequest): Promise<SessionUser> {
  const user = await getAuthUser(request);
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}
