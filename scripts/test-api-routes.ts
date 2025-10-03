import fetch from 'node-fetch';
import { db } from '../db';
import { organizations } from '../db/schema';
import { eq } from 'drizzle-orm';

/**
 * API Routes Test Script
 *
 * Tests all API endpoints with realistic scenarios:
 * - Validates responses and status codes
 * - Checks error handling
 * - Uses seeded test data
 * - Reports test results
 *
 * Usage:
 *   npm run test:api
 *   or
 *   npx tsx scripts/test-api-routes.ts
 *
 * Prerequisites:
 *   - Run seed script first: npm run seed:test
 *   - Set N8N_API_KEY in .env.local
 */

interface TestResult {
  name: string;
  endpoint: string;
  method: string;
  passed: boolean;
  status?: number;
  duration: number;
  error?: string;
  response?: any;
}

const results: TestResult[] = [];
let testOrgId: string;
let testOrgBoardId = 123456789;
let testPeriod = '2025-10';

// Get configuration
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const apiKey = process.env.N8N_API_KEY;

if (!apiKey) {
  console.error('❌ N8N_API_KEY not found in environment variables');
  console.error('   Please set N8N_API_KEY in .env.local');
  process.exit(1);
}

/**
 * Helper to make API requests
 */
async function apiRequest(
  method: string,
  endpoint: string,
  body?: any,
  customHeaders?: Record<string, string>
): Promise<{ status: number; data: any; duration: number }> {
  const startTime = Date.now();

  const headers: Record<string, string> = {
    'X-API-Key': apiKey!,
    ...customHeaders,
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const duration = Date.now() - startTime;
    let data;

    try {
      data = await response.json();
    } catch {
      data = await response.text();
    }

    return { status: response.status, data, duration };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    throw new Error(`Request failed: ${error.message} (${duration}ms)`);
  }
}

/**
 * Run a test and record results
 */
async function runTest(
  name: string,
  endpoint: string,
  method: string,
  expectedStatus: number,
  body?: any,
  validator?: (data: any) => boolean
): Promise<boolean> {
  console.log(`\n🧪 Testing: ${name}`);
  console.log(`   ${method} ${endpoint}`);

  try {
    const { status, data, duration } = await apiRequest(method, endpoint, body);

    const statusMatch = status === expectedStatus;
    const validationPassed = validator ? validator(data) : true;
    const passed = statusMatch && validationPassed;

    results.push({
      name,
      endpoint,
      method,
      passed,
      status,
      duration,
      response: data,
    });

    if (passed) {
      console.log(`   ✅ PASSED (${duration}ms)`);
      if (data.success !== undefined) {
        console.log(`      Success: ${data.success}`);
      }
    } else {
      console.log(`   ❌ FAILED (${duration}ms)`);
      if (!statusMatch) {
        console.log(`      Expected status: ${expectedStatus}, got: ${status}`);
      }
      if (!validationPassed) {
        console.log(`      Validation failed`);
      }
      console.log(`      Response:`, JSON.stringify(data, null, 2));
    }

    return passed;
  } catch (error: any) {
    console.log(`   ❌ ERROR: ${error.message}`);
    results.push({
      name,
      endpoint,
      method,
      passed: false,
      duration: 0,
      error: error.message,
    });
    return false;
  }
}

/**
 * Main test suite
 */
async function runTests() {
  console.log('🚀 Starting API Routes Test Suite');
  console.log('='.repeat(60));
  console.log(`Base URL: ${baseUrl}`);
  console.log(`API Key: ${apiKey?.slice(0, 10)}...`);
  console.log('='.repeat(60));

  try {
    // Get test organization
    console.log('\n📋 Fetching test organization...');
    const [testOrg] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.mondayAccountId, 10000000))
      .limit(1);

    if (!testOrg) {
      console.error('❌ Test organization not found. Run seed script first:');
      console.error('   npm run seed:test');
      process.exit(1);
    }

    testOrgId = testOrg.id;
    console.log(`✅ Found test org: ${testOrg.mondayAccountName} (${testOrgId})`);

    // =================================================================
    // TEST SUITE 1: Organization Endpoints
    // =================================================================
    console.log('\n' + '='.repeat(60));
    console.log('📦 TEST SUITE 1: Organization Endpoints');
    console.log('='.repeat(60));

    await runTest(
      'Get Active Organizations',
      '/api/organizations/active',
      'GET',
      200,
      undefined,
      (data) => {
        return (
          data.success === true &&
          Array.isArray(data.data) &&
          data.data.length > 0 &&
          data.data.some((org: any) => org.id === testOrgId)
        );
      }
    );

    await runTest(
      'Get All Organizations',
      '/api/organizations/all?active=true',
      'GET',
      200,
      undefined,
      (data) => {
        return (
          data.success === true &&
          Array.isArray(data.data) &&
          data.summary?.total > 0
        );
      }
    );

    // =================================================================
    // TEST SUITE 2: Sync Endpoints
    // =================================================================
    console.log('\n' + '='.repeat(60));
    console.log('🔄 TEST SUITE 2: Sync Endpoints');
    console.log('='.repeat(60));

    await runTest(
      'Sync QuickBooks Data',
      '/api/sync/quickbooks',
      'POST',
      200,
      {
        organizationId: testOrgId,
        period: testPeriod,
      },
      (data) => {
        return (
          data.success === true &&
          data.recordsProcessed !== undefined &&
          data.period === testPeriod
        );
      }
    );

    // =================================================================
    // TEST SUITE 3: Variance Calculation
    // =================================================================
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUITE 3: Variance Calculation');
    console.log('='.repeat(60));

    await runTest(
      'Calculate Variance Analysis',
      '/api/variance/calculate-full',
      'POST',
      200,
      {
        organizationId: testOrgId,
        boardId: testOrgBoardId,
        period: testPeriod,
      },
      (data) => {
        return (
          data.success === true &&
          data.analysis?.results?.variances &&
          Array.isArray(data.analysis.results.variances) &&
          data.analysis.results.variances.length > 0
        );
      }
    );

    // =================================================================
    // TEST SUITE 4: Authentication & Token Management
    // =================================================================
    console.log('\n' + '='.repeat(60));
    console.log('🔐 TEST SUITE 4: Authentication & Token Management');
    console.log('='.repeat(60));

    await runTest(
      'Refresh QuickBooks Token',
      '/api/auth/quickbooks/refresh',
      'POST',
      200,
      {
        organizationId: testOrgId,
      },
      (data) => {
        return (
          data.success === true &&
          data.accessToken !== undefined &&
          data.expiresAt !== undefined
        );
      }
    );

    // =================================================================
    // TEST SUITE 5: Reports
    // =================================================================
    console.log('\n' + '='.repeat(60));
    console.log('📄 TEST SUITE 5: Reports');
    console.log('='.repeat(60));

    await runTest(
      'Generate Monthly Report',
      '/api/reports/monthly',
      'POST',
      200,
      {
        organizationId: testOrgId,
        period: testPeriod,
        includeCharts: true,
        includeInsights: true,
      },
      (data) => {
        return (
          data.success === true &&
          data.reportData !== undefined &&
          data.reportData.summary !== undefined
        );
      }
    );

    await runTest(
      'List Monthly Reports',
      `/api/reports/monthly?organizationId=${testOrgId}`,
      'GET',
      200,
      undefined,
      (data) => {
        return data.success === true && data.periods !== undefined;
      }
    );

    // =================================================================
    // TEST SUITE 6: Alerts & Logging
    // =================================================================
    console.log('\n' + '='.repeat(60));
    console.log('🚨 TEST SUITE 6: Alerts & Logging');
    console.log('='.repeat(60));

    await runTest(
      'Log Variance Alert',
      '/api/alerts/log',
      'POST',
      200,
      {
        organizationId: testOrgId,
        severity: 'critical',
        accountName: 'Digital Advertising',
        accountCode: '7000',
        budgetAmount: 35000,
        actualAmount: 43610,
        variance: 8610,
        variancePercent: 24.6,
        period: testPeriod,
        boardId: testOrgBoardId,
      },
      (data) => {
        return (
          data.success === true &&
          data.alertId !== undefined &&
          data.severity === 'critical'
        );
      }
    );

    await runTest(
      'Get Alerts',
      `/api/alerts/log?organizationId=${testOrgId}&severity=critical`,
      'GET',
      200,
      undefined,
      (data) => {
        return data.success === true && Array.isArray(data.alerts);
      }
    );

    await runTest(
      'Log Report Generation',
      '/api/reports/log',
      'POST',
      200,
      {
        organizationId: testOrgId,
        reportType: 'monthly',
        period: testPeriod,
        status: 'generated',
        fileSize: 2456789,
        boardIds: [testOrgBoardId],
      },
      (data) => {
        return (
          data.success === true &&
          data.reportLogId !== undefined &&
          data.reportType === 'monthly'
        );
      }
    );

    // =================================================================
    // TEST SUITE 7: Webhooks
    // =================================================================
    console.log('\n' + '='.repeat(60));
    console.log('🪝 TEST SUITE 7: Webhooks');
    console.log('='.repeat(60));

    await runTest(
      'Health Check',
      '/api/webhooks/n8n/health',
      'GET',
      200,
      undefined,
      (data) => {
        return (
          data.success === true &&
          data.healthy !== undefined &&
          data.components !== undefined
        );
      }
    );

    await runTest(
      'Health Check - Detailed',
      '/api/webhooks/n8n/health?detailed=true',
      'GET',
      200,
      undefined,
      (data) => {
        return (
          data.success === true &&
          data.checks !== undefined &&
          data.checks.database !== undefined
        );
      }
    );

    // Note: Webhook signature tests require N8N_WEBHOOK_SECRET
    const webhookSecret = process.env.N8N_WEBHOOK_SECRET;
    if (webhookSecret) {
      const crypto = require('crypto');

      // Test variance alert webhook
      const alertPayload = {
        organizationId: testOrgId,
        severity: 'critical',
        variances: [
          {
            accountName: 'Cloud Infrastructure',
            accountCode: '8000',
            budgetAmount: 28000,
            actualAmount: 32816,
            variance: 4816,
            variancePercent: 17.2,
            direction: 'unfavorable',
          },
        ],
        period: testPeriod,
        boardId: testOrgBoardId,
      };

      const alertPayloadStr = JSON.stringify(alertPayload);
      const alertSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(alertPayloadStr)
        .digest('hex');

      await runTest(
        'Variance Alert Webhook',
        '/api/webhooks/n8n/variance-alert',
        'POST',
        200,
        alertPayload,
        (data) => {
          return (
            data.success === true &&
            data.severity === 'critical' &&
            data.alertsLogged === 1
          );
        }
      );

      // Test sync complete webhook
      const syncPayload = {
        organizationId: testOrgId,
        syncType: 'quickbooks_sync',
        status: 'completed',
        recordsProcessed: 30,
        duration: 5432,
        metadata: { period: testPeriod },
      };

      const syncPayloadStr = JSON.stringify(syncPayload);
      const syncSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(syncPayloadStr)
        .digest('hex');

      await runTest(
        'Sync Complete Webhook',
        '/api/webhooks/n8n/sync-complete',
        'POST',
        200,
        syncPayload,
        (data) => {
          return (
            data.success === true &&
            data.status === 'completed' &&
            data.syncType === 'quickbooks_sync'
          );
        }
      );
    } else {
      console.log('\n⚠️  Skipping webhook signature tests (N8N_WEBHOOK_SECRET not set)');
    }

    // =================================================================
    // TEST SUITE 8: Error Handling
    // =================================================================
    console.log('\n' + '='.repeat(60));
    console.log('❌ TEST SUITE 8: Error Handling');
    console.log('='.repeat(60));

    await runTest(
      'Invalid API Key',
      '/api/organizations/active',
      'GET',
      401,
      undefined,
      (data) => data.error !== undefined
    );

    await runTest(
      'Missing Organization ID',
      '/api/sync/quickbooks',
      'POST',
      400,
      { period: testPeriod },
      (data) => data.error !== undefined
    );

    await runTest(
      'Invalid Organization ID',
      '/api/sync/quickbooks',
      'POST',
      404,
      { organizationId: '00000000-0000-0000-0000-000000000000', period: testPeriod },
      (data) => data.error !== undefined
    );

    await runTest(
      'Invalid Period Format',
      '/api/sync/quickbooks',
      'POST',
      400,
      { organizationId: testOrgId, period: 'invalid' },
      (data) => data.error !== undefined
    );

    // =================================================================
    // FINAL RESULTS
    // =================================================================
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(60));

    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;
    const total = results.length;
    const passRate = ((passed / total) * 100).toFixed(1);

    console.log(`\nTotal Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Pass Rate: ${passRate}%`);

    // Average response time
    const avgDuration =
      results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    console.log(`⏱️  Average Response Time: ${avgDuration.toFixed(0)}ms`);

    // Failed tests details
    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      results
        .filter((r) => !r.passed)
        .forEach((r) => {
          console.log(`\n   ${r.name}`);
          console.log(`   ${r.method} ${r.endpoint}`);
          if (r.error) {
            console.log(`   Error: ${r.error}`);
          } else {
            console.log(`   Status: ${r.status}`);
            console.log(`   Response: ${JSON.stringify(r.response, null, 2)}`);
          }
        });
    }

    // Test suite breakdown
    console.log('\n📋 Test Suite Breakdown:');
    const suites = [
      'Organization Endpoints',
      'Sync Endpoints',
      'Variance Calculation',
      'Authentication & Token Management',
      'Reports',
      'Alerts & Logging',
      'Webhooks',
      'Error Handling',
    ];

    suites.forEach((suite) => {
      const suiteResults = results.filter((r) => r.name.includes(suite));
      if (suiteResults.length > 0) {
        const suitePassed = suiteResults.filter((r) => r.passed).length;
        const suiteTotal = suiteResults.length;
        console.log(`   ${suite}: ${suitePassed}/${suiteTotal}`);
      }
    });

    console.log('\n' + '='.repeat(60));

    if (failed === 0) {
      console.log('🎉 All tests passed!');
      process.exit(0);
    } else {
      console.log('⚠️  Some tests failed. Please review the results above.');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n❌ Test suite error:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests if called directly
if (require.main === module) {
  runTests();
}

export { runTests };
