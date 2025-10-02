/**
 * Health Check API Endpoint
 *
 * Provides comprehensive health status for the application and its dependencies.
 * Used by load balancers, monitoring systems, and CI/CD pipelines.
 *
 * Endpoints:
 *   GET /api/health       - Basic health check (fast)
 *   GET /api/health?deep  - Deep health check (slower, checks all dependencies)
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { createClient } from 'redis';

// Health check response interface
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: {
    database?: {
      status: 'healthy' | 'unhealthy';
      latency?: number;
      error?: string;
    };
    redis?: {
      status: 'healthy' | 'unhealthy';
      latency?: number;
      error?: string;
    };
    monday?: {
      status: 'healthy' | 'unhealthy';
      error?: string;
    };
    quickbooks?: {
      status: 'healthy' | 'unhealthy';
      error?: string;
    };
  };
  metadata?: {
    hostname?: string;
    platform?: string;
    nodeVersion?: string;
    memoryUsage?: {
      heapUsed: number;
      heapTotal: number;
      rss: number;
    };
  };
}

// Cache health check results for 10 seconds
let cachedHealthCheck: { data: HealthStatus; timestamp: number } | null = null;
const CACHE_TTL = 10000; // 10 seconds

/**
 * Check PostgreSQL database connection
 */
async function checkDatabase(): Promise<HealthStatus['checks']['database']> {
  const startTime = Date.now();

  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      connectionTimeoutMillis: 3000,
    });

    await pool.query('SELECT 1');
    await pool.end();

    const latency = Date.now() - startTime;

    return {
      status: 'healthy',
      latency,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}

/**
 * Check Redis connection
 */
async function checkRedis(): Promise<HealthStatus['checks']['redis']> {
  const startTime = Date.now();

  try {
    if (!process.env.REDIS_URL) {
      return {
        status: 'healthy',
        latency: 0,
      };
    }

    const client = createClient({
      url: process.env.REDIS_URL,
      socket: {
        connectTimeout: 3000,
      },
    });

    await client.connect();
    await client.ping();
    await client.quit();

    const latency = Date.now() - startTime;

    return {
      status: 'healthy',
      latency,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown Redis error',
    };
  }
}

/**
 * Check Monday.com API availability
 */
async function checkMonday(): Promise<HealthStatus['checks']['monday']> {
  try {
    if (!process.env.MONDAY_CLIENT_ID) {
      return { status: 'healthy' }; // Not configured
    }

    const response = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'query { complexity { query reset_in_x_seconds } }',
      }),
      signal: AbortSignal.timeout(3000),
    });

    if (response.ok) {
      return { status: 'healthy' };
    } else {
      return {
        status: 'unhealthy',
        error: `HTTP ${response.status}`,
      };
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown Monday.com error',
    };
  }
}

/**
 * Check QuickBooks API availability
 */
async function checkQuickBooks(): Promise<HealthStatus['checks']['quickbooks']> {
  try {
    if (!process.env.QUICKBOOKS_CLIENT_ID) {
      return { status: 'healthy' }; // Not configured
    }

    const baseUrl =
      process.env.QUICKBOOKS_ENVIRONMENT === 'production'
        ? 'https://quickbooks.api.intuit.com'
        : 'https://sandbox-quickbooks.api.intuit.com';

    // Just check if the API endpoint is reachable
    const response = await fetch(`${baseUrl}/v3/company`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });

    // We expect a 401 Unauthorized, which means the API is up
    if (response.status === 401 || response.ok) {
      return { status: 'healthy' };
    } else {
      return {
        status: 'unhealthy',
        error: `HTTP ${response.status}`,
      };
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown QuickBooks error',
    };
  }
}

/**
 * Perform basic health check (fast)
 */
function getBasicHealthCheck(): HealthStatus {
  const memUsage = process.memoryUsage();

  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    checks: {},
    metadata: {
      hostname: process.env.HOSTNAME,
      platform: process.platform,
      nodeVersion: process.version,
      memoryUsage: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
      },
    },
  };
}

/**
 * Perform deep health check (slower, checks all dependencies)
 */
async function getDeepHealthCheck(): Promise<HealthStatus> {
  const basicCheck = getBasicHealthCheck();

  // Run all checks in parallel
  const [database, redis, monday, quickbooks] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkMonday(),
    checkQuickBooks(),
  ]);

  const checks = {
    database,
    redis,
    quickbooks,
    monday,
  };

  // Determine overall status
  const hasUnhealthy = Object.values(checks).some(
    (check) => check.status === 'unhealthy'
  );

  const status: HealthStatus['status'] = hasUnhealthy
    ? 'unhealthy'
    : 'healthy';

  return {
    ...basicCheck,
    status,
    checks,
  };
}

/**
 * GET /api/health
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isDeep = searchParams.has('deep');

    // Return cached result if available and not deep check
    if (!isDeep && cachedHealthCheck) {
      const age = Date.now() - cachedHealthCheck.timestamp;
      if (age < CACHE_TTL) {
        return NextResponse.json(cachedHealthCheck.data, {
          status: cachedHealthCheck.data.status === 'healthy' ? 200 : 503,
          headers: {
            'Cache-Control': `public, max-age=${Math.floor((CACHE_TTL - age) / 1000)}`,
          },
        });
      }
    }

    // Perform health check
    const healthCheck = isDeep
      ? await getDeepHealthCheck()
      : getBasicHealthCheck();

    // Cache the result (only for basic checks)
    if (!isDeep) {
      cachedHealthCheck = {
        data: healthCheck,
        timestamp: Date.now(),
      };
    }

    // Return response with appropriate status code
    const statusCode = healthCheck.status === 'healthy' ? 200 : 503;

    return NextResponse.json(healthCheck, {
      status: statusCode,
      headers: {
        'Cache-Control': isDeep
          ? 'no-cache, no-store, must-revalidate'
          : 'public, max-age=10',
      },
    });
  } catch (error) {
    console.error('Health check error:', error);

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}

/**
 * HEAD /api/health
 * Lightweight check for load balancers
 */
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
