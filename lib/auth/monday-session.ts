/**
 * Monday.com Session Verification
 *
 * Verifies session tokens from Monday Apps SDK embedded views
 */

import { db } from '@/lib/db';
import { sessions, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function verifyMondaySession(sessionToken: string) {
  try {
    // For Monday embedded views, the sessionToken comes from monday.get('sessionToken')
    // We need to verify this is a valid session in our database

    const session = await db.query.sessions.findFirst({
      where: eq(sessions.token, sessionToken),
      with: {
        user: {
          with: {
            organization: true,
          },
        },
      },
    });

    if (!session) {
      return null;
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      return null;
    }

    return session;

  } catch (error) {
    console.error('Session verification error:', error);
    return null;
  }
}

export async function getMondayContext(sessionToken: string) {
  const session = await verifyMondaySession(sessionToken);

  if (!session) {
    return null;
  }

  return {
    user: session.user,
    organization: session.user.organization,
    sessionToken,
  };
}
