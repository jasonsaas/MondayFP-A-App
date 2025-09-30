import { NextRequest, NextResponse } from 'next/server';
import { mondayAuth } from '@/lib/monday-auth';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;

    if (sessionToken) {
      const payload = await mondayAuth.verifySessionToken(sessionToken);
      if (payload) {
        await mondayAuth.invalidateSession(payload.sessionId);
      }
    }

    const response = NextResponse.json({ success: true });
    response.cookies.delete('session');

    return response;

  } catch (error) {
    console.error('Logout error:', error);
    const response = NextResponse.json({ success: false }, { status: 500 });
    response.cookies.delete('session');
    return response;
  }
}