import { NextRequest, NextResponse } from 'next/server';
import { mondayAuth } from '@/lib/monday-auth';

const publicPaths = ['/sign-in', '/sign-up', '/api/auth'];
const apiPaths = ['/api'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check for session
  const sessionToken = request.cookies.get('session')?.value;

  if (!sessionToken) {
    // Redirect to sign-in for protected pages
    if (!pathname.startsWith('/api')) {
      return NextResponse.redirect(new URL('/sign-in', request.url));
    }

    // Return 401 for API routes
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Verify session
    const sessionData = await mondayAuth.getSession(sessionToken);

    if (!sessionData) {
      // Invalid or expired session
      const response = pathname.startsWith('/api')
        ? NextResponse.json({ error: 'Session expired' }, { status: 401 })
        : NextResponse.redirect(new URL('/sign-in?error=session_expired', request.url));

      response.cookies.delete('session');
      return response;
    }

    // Add user data to headers for API routes
    if (pathname.startsWith('/api')) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user-id', sessionData.user.id);
      requestHeaders.set('x-organization-id', sessionData.organization.id);
      requestHeaders.set('x-user-role', sessionData.user.role || 'member');

      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    }

    return NextResponse.next();

  } catch (error) {
    console.error('Middleware error:', error);

    const response = pathname.startsWith('/api')
      ? NextResponse.json({ error: 'Authentication error' }, { status: 500 })
      : NextResponse.redirect(new URL('/sign-in?error=auth_error', request.url));

    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|public).*)',
  ],
};