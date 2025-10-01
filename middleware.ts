import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

const publicPaths = ['/', '/auth', '/api/auth'];

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Allow public paths
  if (publicPaths.some(publicPath => path.startsWith(publicPath))) {
    return NextResponse.next();
  }

  // Check for session
  const session = request.cookies.get('session');

  if (!session) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  try {
    // Verify JWT (basic check, full validation in API routes)
    jwt.verify(session.value, process.env.JWT_SECRET!);
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
