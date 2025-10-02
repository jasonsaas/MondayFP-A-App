/**
 * Next.js Middleware
 *
 * Runs on every request before the route handler.
 * Used for authentication, security headers, rate limiting, etc.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

const publicPaths = ['/', '/auth', '/api/auth', '/api/health', '/api/webhooks'];

// Security headers
const securityHeaders = {
  'X-DNS-Prefetch-Control': 'on',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

// CSP (Content Security Policy)
const cspHeader = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.monday.com https://appcenter.intuit.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.monday.com https://*.api.intuit.com https://*.sentry.io",
  "frame-src 'self' https://appcenter.intuit.com https://auth.monday.com",
  "worker-src 'self' blob:",
].join('; ');

// Rate limiting store (in-memory, use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function rateLimit(ip: string, limit = 100, windowMs = 60000): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  if (!record || now > record.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count++;
  return true;
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const { pathname } = request.nextUrl;

  // Add security headers to all responses
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Add CSP header (skip for development to avoid blocking hot reload)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Content-Security-Policy', cspHeader);
  }

  // Rate limiting for API routes
  if (pathname.startsWith('/api/')) {
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';

    // Skip rate limiting for health checks and cron jobs
    if (pathname === '/api/health' || pathname.startsWith('/api/cron/')) {
      return response;
    }

    const allowed = rateLimit(ip);

    if (!allowed) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
        },
        {
          status: 429,
          headers: {
            'Retry-After': '60',
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(
              Math.ceil((rateLimitStore.get(ip)?.resetAt || Date.now()) / 1000)
            ),
          },
        }
      );
    }

    // Add rate limit headers
    const record = rateLimitStore.get(ip);
    if (record) {
      response.headers.set('X-RateLimit-Limit', '100');
      response.headers.set('X-RateLimit-Remaining', String(100 - record.count));
      response.headers.set(
        'X-RateLimit-Reset',
        String(Math.ceil(record.resetAt / 1000))
      );
    }
  }

  // CORS for API routes (allow Monday.com and QuickBooks)
  if (pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin');
    const allowedOrigins = [
      process.env.NEXT_PUBLIC_APP_URL,
      'https://monday.com',
      'https://auth.monday.com',
      'https://appcenter.intuit.com',
    ].filter(Boolean);

    if (origin && allowedOrigins.some((allowed) => origin.includes(allowed!))) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS'
      );
      response.headers.set(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization'
      );
      response.headers.set('Access-Control-Max-Age', '86400');
    }
  }

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 200, headers: response.headers });
  }

  // Authentication check for protected routes
  const isPublicPath = publicPaths.some((publicPath) =>
    pathname.startsWith(publicPath)
  );

  if (!isPublicPath) {
    const session = request.cookies.get('session');

    if (!session) {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }

    try {
      // Verify JWT (basic check, full validation in API routes)
      jwt.verify(session.value, process.env.JWT_SECRET!);
    } catch {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }
  }

  return response;
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
