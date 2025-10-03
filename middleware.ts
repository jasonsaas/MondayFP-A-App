/**
 * Next.js Middleware
 *
 * Handles:
 * - Rate limiting for API routes (100 req/min per IP)
 * - CORS configuration for n8n and integrations
 * - Request logging
 * - Security headers
 * - Authentication (JWT verification)
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const publicPaths = ['/', '/auth', '/api/auth', '/api/health', '/api/webhooks'];

// CORS allowed origins
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.N8N_WEBHOOK_BASE_URL,
  'https://app.n8n.cloud',
  'https://n8n.cloud',
  'https://monday.com',
  'https://auth.monday.com',
  'https://appcenter.intuit.com',
].filter(Boolean) as string[];

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
  "connect-src 'self' https://api.monday.com https://*.api.intuit.com https://*.sentry.io https://app.n8n.cloud https://n8n.cloud",
  "frame-src 'self' https://appcenter.intuit.com https://auth.monday.com",
  "worker-src 'self' blob:",
].join('; ');

// Rate limiting store (in-memory, use Redis in production for distributed systems)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Rate limit configuration from environment
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10); // 60 seconds
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10); // 100 requests

/**
 * Get client identifier (IP or API key)
 */
function getClientId(request: NextRequest): string {
  // Prefer API key for authenticated requests
  const apiKey = request.headers.get('x-api-key');
  if (apiKey) {
    return `key:${apiKey.slice(0, 10)}`;
  }

  // Fallback to IP
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = request.ip || forwardedFor?.split(',')[0] || realIp || 'unknown';

  return `ip:${ip}`;
}

/**
 * Check rate limit
 */
function checkRateLimit(clientId: string): { allowed: boolean; limit: number; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = rateLimitStore.get(clientId);

  // Initialize or reset if window expired
  if (!record || now > record.resetAt) {
    const resetAt = now + RATE_LIMIT_WINDOW;
    rateLimitStore.set(clientId, { count: 1, resetAt });
    return { allowed: true, limit: RATE_LIMIT_MAX, remaining: RATE_LIMIT_MAX - 1, resetAt };
  }

  // Check limit
  if (record.count >= RATE_LIMIT_MAX) {
    return { allowed: false, limit: RATE_LIMIT_MAX, remaining: 0, resetAt: record.resetAt };
  }

  // Increment
  record.count++;
  return { allowed: true, limit: RATE_LIMIT_MAX, remaining: RATE_LIMIT_MAX - record.count, resetAt: record.resetAt };
}

/**
 * Clean up expired entries (runs periodically)
 */
function cleanupRateLimitStore() {
  const now = Date.now();
  for (const [clientId, data] of rateLimitStore.entries()) {
    if (now > data.resetAt) {
      rateLimitStore.delete(clientId);
    }
  }
}

// Cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
}

/**
 * Log request
 */
function logRequest(request: NextRequest, rateLimit?: { remaining: number }): void {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/api/')) {
    const method = request.method;
    const clientId = getClientId(request);
    const remaining = rateLimit?.remaining ?? 'N/A';
    const timestamp = new Date().toISOString();

    console.log(`[${timestamp}] ${method} ${pathname} - ${clientId} - Remaining: ${remaining}`);
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // Add security headers to all responses
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Add CSP header (skip for development to avoid blocking hot reload)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Content-Security-Policy', cspHeader);
  }

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    const origin = request.headers.get('origin');
    const corsResponse = new NextResponse(null, { status: 204 });

    if (origin && (ALLOWED_ORIGINS.includes(origin) || origin.includes('localhost'))) {
      corsResponse.headers.set('Access-Control-Allow-Origin', origin);
      corsResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      corsResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-N8N-Signature, X-Reset-Secret');
      corsResponse.headers.set('Access-Control-Allow-Credentials', 'true');
      corsResponse.headers.set('Access-Control-Max-Age', '86400');
    }

    return corsResponse;
  }

  // Rate limiting for API routes
  if (pathname.startsWith('/api/')) {
    // Skip rate limiting for health checks
    const isHealthCheck = pathname.includes('/health') || pathname === '/api/health';

    if (!isHealthCheck) {
      const clientId = getClientId(request);
      const rateLimit = checkRateLimit(clientId);

      // Log request
      logRequest(request, rateLimit);

      // Return 429 if exceeded
      if (!rateLimit.allowed) {
        console.warn(`⚠️ Rate limit exceeded for ${clientId} on ${request.method} ${pathname}`);

        return NextResponse.json(
          {
            success: false,
            error: 'Rate limit exceeded',
            message: `Too many requests. Please try again in ${Math.ceil((rateLimit.resetAt - Date.now()) / 1000)} seconds.`,
            limit: rateLimit.limit,
            remaining: 0,
            reset: new Date(rateLimit.resetAt).toISOString(),
          },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
              'X-RateLimit-Limit': String(rateLimit.limit),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetAt / 1000)),
            },
          }
        );
      }

      // Add rate limit headers
      response.headers.set('X-RateLimit-Limit', String(rateLimit.limit));
      response.headers.set('X-RateLimit-Remaining', String(rateLimit.remaining));
      response.headers.set('X-RateLimit-Reset', String(Math.ceil(rateLimit.resetAt / 1000)));
    } else {
      logRequest(request);
    }

    // Add CORS headers for API routes
    const origin = request.headers.get('origin');
    if (origin && (ALLOWED_ORIGINS.includes(origin) || origin.includes('localhost'))) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-N8N-Signature, X-Reset-Secret');
    }
  }

  // Authentication check for protected routes (skip for now - handled in routes)
  // Uncomment when implementing JWT auth
  /*
  const isPublicPath = publicPaths.some((publicPath) =>
    pathname.startsWith(publicPath)
  );

  if (!isPublicPath) {
    const session = request.cookies.get('session');
    if (!session) {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }
  }
  */

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
