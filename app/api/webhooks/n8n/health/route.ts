import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { organizations } from '@/db/schema';
import { getRedisClient } from '@/lib/redis';
import { eq } from 'drizzle-orm';

/**
 * Health check endpoint for n8n monitoring
 *
 * Checks the status of all critical integrations:
 * - Database connection
 * - Redis connection
 * - Monday.com API (sample org check)
 * - QuickBooks API (sample org check)
 *
 * @example n8n workflow
 * GET /api/webhooks/n8n/health
 * Headers:
 *   X-API-Key: <api_key>
 *
 * Returns overall health status and individual component checks
 */

interface HealthCheckResult {
  healthy: boolean;
  responseTime: number;
  error?: string;
  metadata?: Record<string, any>;
}

interface ComponentHealth {
  database: HealthCheckResult;
  redis: HealthCheckResult;
  monday: HealthCheckResult;
  quickbooks: HealthCheckResult;
}

/**
 * Check database connection and query performance
 */
async function checkDatabase(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  try {
    // Simple query to test database connection
    const result = await db
      .select({ count: organizations.id })
      .from(organizations)
      .limit(1);

    return {
      healthy: true,
      responseTime: Date.now() - startTime,
      metadata: {
        connection: 'active',
        querySuccessful: true,
      },
    };
  } catch (error: any) {
    console.error('❌ Database health check failed:', error);
    return {
      healthy: false,
      responseTime: Date.now() - startTime,
      error: error.message,
    };
  }
}

/**
 * Check Redis connection and operations
 */
async function checkRedis(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  try {
    const redis = getRedisClient();
    const testKey = 'health:check';
    const testValue = Date.now().toString();

    // Test write
    await redis.set(testKey, testValue, 'EX', 10); // 10 second expiry

    // Test read
    const readValue = await redis.get(testKey);

    // Test delete
    await redis.del(testKey);

    const isHealthy = readValue === testValue;

    return {
      healthy: isHealthy,
      responseTime: Date.now() - startTime,
      metadata: {
        connection: 'active',
        readWrite: isHealthy ? 'successful' : 'failed',
        status: redis.status,
      },
    };
  } catch (error: any) {
    console.error('❌ Redis health check failed:', error);
    return {
      healthy: false,
      responseTime: Date.now() - startTime,
      error: error.message,
    };
  }
}

/**
 * Check Monday.com API connectivity
 */
async function checkMonday(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  try {
    // Get a random active organization with Monday connection
    const [org] = await db
      .select({
        id: organizations.id,
        name: organizations.mondayAccountName,
        mondayAccessToken: organizations.mondayAccessToken,
      })
      .from(organizations)
      .where(eq(organizations.active, true))
      .limit(1);

    if (!org || !org.mondayAccessToken) {
      return {
        healthy: false,
        responseTime: Date.now() - startTime,
        error: 'No active organizations with Monday connection found',
      };
    }

    // Test Monday API with simple query (get account info)
    const response = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: org.mondayAccessToken,
      },
      body: JSON.stringify({
        query: '{ me { id name email } }',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        healthy: false,
        responseTime: Date.now() - startTime,
        error: `Monday API error: ${response.status} ${errorText}`,
      };
    }

    const data = await response.json();

    if (data.errors) {
      return {
        healthy: false,
        responseTime: Date.now() - startTime,
        error: `Monday API errors: ${JSON.stringify(data.errors)}`,
      };
    }

    return {
      healthy: true,
      responseTime: Date.now() - startTime,
      metadata: {
        apiVersion: 'v2',
        accountId: data.data?.me?.id,
        testOrganization: org.name,
      },
    };
  } catch (error: any) {
    console.error('❌ Monday health check failed:', error);
    return {
      healthy: false,
      responseTime: Date.now() - startTime,
      error: error.message,
    };
  }
}

/**
 * Check QuickBooks API connectivity
 */
async function checkQuickBooks(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  try {
    // Get a random active organization with QuickBooks connection
    const [org] = await db
      .select({
        id: organizations.id,
        name: organizations.mondayAccountName,
        quickbooksRealmId: organizations.quickbooksRealmId,
        quickbooksAccessToken: organizations.quickbooksAccessToken,
        quickbooksTokenExpiresAt: organizations.quickbooksTokenExpiresAt,
      })
      .from(organizations)
      .where(eq(organizations.active, true))
      .limit(1);

    if (!org || !org.quickbooksRealmId || !org.quickbooksAccessToken) {
      return {
        healthy: false,
        responseTime: Date.now() - startTime,
        error: 'No active organizations with QuickBooks connection found',
      };
    }

    // Check token expiry
    const now = new Date();
    const tokenExpired = org.quickbooksTokenExpiresAt
      ? new Date(org.quickbooksTokenExpiresAt) < now
      : true;

    if (tokenExpired) {
      return {
        healthy: false,
        responseTime: Date.now() - startTime,
        error: 'QuickBooks token expired (needs refresh)',
        metadata: {
          tokenExpiresAt: org.quickbooksTokenExpiresAt,
          testOrganization: org.name,
        },
      };
    }

    // Test QuickBooks API with simple query (get company info)
    const baseUrl = process.env.QUICKBOOKS_ENVIRONMENT === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';

    const response = await fetch(
      `${baseUrl}/v3/company/${org.quickbooksRealmId}/companyinfo/${org.quickbooksRealmId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${org.quickbooksAccessToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        healthy: false,
        responseTime: Date.now() - startTime,
        error: `QuickBooks API error: ${response.status} ${errorText}`,
      };
    }

    const data = await response.json();

    return {
      healthy: true,
      responseTime: Date.now() - startTime,
      metadata: {
        apiVersion: 'v3',
        environment: process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox',
        realmId: org.quickbooksRealmId,
        companyName: data.CompanyInfo?.CompanyName,
        testOrganization: org.name,
        tokenExpiresAt: org.quickbooksTokenExpiresAt,
      },
    };
  } catch (error: any) {
    console.error('❌ QuickBooks health check failed:', error);
    return {
      healthy: false,
      responseTime: Date.now() - startTime,
      error: error.message,
    };
  }
}

/**
 * GET /api/webhooks/n8n/health
 *
 * Comprehensive health check for all integrations
 */
export async function GET(request: NextRequest) {
  const overallStartTime = Date.now();

  try {
    // Validate API key
    const apiKey = request.headers.get('x-api-key');
    if (apiKey !== process.env.N8N_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const detailed = searchParams.get('detailed') === 'true';
    const componentsParam = searchParams.get('components');
    const requestedComponents = componentsParam
      ? componentsParam.split(',').map((c) => c.trim())
      : ['database', 'redis', 'monday', 'quickbooks'];

    console.log('🏥 Running health checks...');

    // Run health checks in parallel
    const checks: Partial<ComponentHealth> = {};

    const checkPromises: Promise<void>[] = [];

    if (requestedComponents.includes('database')) {
      checkPromises.push(
        checkDatabase().then((result) => {
          checks.database = result;
        })
      );
    }

    if (requestedComponents.includes('redis')) {
      checkPromises.push(
        checkRedis().then((result) => {
          checks.redis = result;
        })
      );
    }

    if (requestedComponents.includes('monday')) {
      checkPromises.push(
        checkMonday().then((result) => {
          checks.monday = result;
        })
      );
    }

    if (requestedComponents.includes('quickbooks')) {
      checkPromises.push(
        checkQuickBooks().then((result) => {
          checks.quickbooks = result;
        })
      );
    }

    await Promise.all(checkPromises);

    // Calculate overall health
    const allChecks = Object.values(checks) as HealthCheckResult[];
    const healthyChecks = allChecks.filter((c) => c.healthy);
    const unhealthyChecks = allChecks.filter((c) => !c.healthy);
    const overallHealthy = unhealthyChecks.length === 0;

    const overallResponseTime = Date.now() - overallStartTime;

    // Prepare response
    const response: any = {
      success: true,
      healthy: overallHealthy,
      status: overallHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      responseTime: overallResponseTime,
      components: {
        total: allChecks.length,
        healthy: healthyChecks.length,
        unhealthy: unhealthyChecks.length,
      },
    };

    // Add detailed checks if requested
    if (detailed) {
      response.checks = checks;
    } else {
      // Simplified response
      response.summary = Object.entries(checks).reduce(
        (acc, [component, result]) => {
          acc[component] = {
            healthy: result.healthy,
            responseTime: result.responseTime,
            error: result.error,
          };
          return acc;
        },
        {} as Record<string, any>
      );
    }

    // Log results
    const statusEmoji = overallHealthy ? '✅' : '⚠️';
    console.log(
      `${statusEmoji} Health check complete: ${healthyChecks.length}/${allChecks.length} healthy (${overallResponseTime}ms)`
    );

    if (unhealthyChecks.length > 0) {
      unhealthyChecks.forEach((check) => {
        console.error(`❌ Unhealthy component: ${check.error}`);
      });
    }

    // Return appropriate status code
    const statusCode = overallHealthy ? 200 : 503;

    return NextResponse.json(response, { status: statusCode });
  } catch (error: any) {
    console.error('❌ Health check error:', error);
    return NextResponse.json(
      {
        success: false,
        healthy: false,
        status: 'error',
        error: 'Health check failed',
        message: error.message,
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - overallStartTime,
      },
      { status: 500 }
    );
  }
}

/**
 * HEAD /api/webhooks/n8n/health
 *
 * Lightweight health check (just returns status code)
 */
export async function HEAD(request: NextRequest) {
  try {
    // Validate API key
    const apiKey = request.headers.get('x-api-key');
    if (apiKey !== process.env.N8N_API_KEY) {
      return new NextResponse(null, { status: 401 });
    }

    // Quick database check only
    const dbCheck = await checkDatabase();

    return new NextResponse(null, {
      status: dbCheck.healthy ? 200 : 503,
      headers: {
        'X-Health-Status': dbCheck.healthy ? 'healthy' : 'unhealthy',
        'X-Response-Time': `${dbCheck.responseTime}ms`,
      },
    });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}
