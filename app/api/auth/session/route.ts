import { NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';

export async function GET() {
  const session = await validateSession();

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: session,
  });
}
