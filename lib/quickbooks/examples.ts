/**
 * QuickBooks Integration Examples
 *
 * Practical examples demonstrating QuickBooks integration usage
 */

import {
  createQuickBooksClient,
  getSyncManager,
} from './index';

/**
 * Example 1: OAuth Token Refresh
 */
export async function example1_refreshToken() {
  console.log('=== Example 1: Refresh OAuth Token ===\n');

  const client = createQuickBooksClient();

  const refreshToken = 'YOUR_REFRESH_TOKEN';

  try {
    const newToken = await client.refreshToken(refreshToken);

    console.log('✓ Token refreshed successfully');
    console.log(`  Access Token: ${newToken.access_token.substring(0, 20)}...`);
    console.log(`  Expires In: ${newToken.expires_in} seconds`);
    console.log(`  Refresh Token: ${newToken.refresh_token.substring(0, 20)}...`);

    return newToken;
  } catch (error: any) {
    console.error('✗ Token refresh failed:', error.message);
    throw error;
  }
}

/**
 * Example 2: Fetch Chart of Accounts
 */
export async function example2_getAccounts() {
  console.log('=== Example 2: Fetch Chart of Accounts ===\n');

  const client = createQuickBooksClient();
  const accessToken = 'YOUR_ACCESS_TOKEN';
  const realmId = 'YOUR_REALM_ID';

  try {
    console.log('Fetching all accounts...');

    const accounts = await client.getAllAccounts(accessToken, realmId, true);

    console.log(`✓ Retrieved ${accounts.length} accounts\n`);

    // Group by type
    const byType = accounts.reduce((acc, account) => {
      const type = account.AccountType;
      if (!acc[type]) acc[type] = [];
      acc[type].push(account);
      return acc;
    }, {} as Record<string, typeof accounts>);

    console.log('Accounts by type:');
    Object.entries(byType).forEach(([type, accts]) => {
      console.log(`  ${type}: ${accts.length} accounts`);
    });

    return accounts;
  } catch (error: any) {
    console.error('✗ Failed to fetch accounts:', error.message);
    throw error;
  }
}

/**
 * Example 3: Fetch Profit & Loss Report
 */
export async function example3_getProfitLoss() {
  console.log('=== Example 3: Fetch P&L Report ===\n');

  const client = createQuickBooksClient();
  const accessToken = 'YOUR_ACCESS_TOKEN';
  const realmId = 'YOUR_REALM_ID';

  try {
    const startDate = '2024-01-01';
    const endDate = '2024-01-31';

    console.log(`Fetching P&L for ${startDate} to ${endDate}...`);

    const plReport = await client.getProfitLossReport(
      accessToken,
      realmId,
      startDate,
      endDate,
      {
        accountingMethod: 'Accrual',
        summarizeBy: 'Total',
      }
    );

    console.log('✓ P&L Report fetched successfully\n');

    // Transform to standard format
    const standardPL = client.transformProfitLoss(plReport);

    console.log('Financial Summary:');
    console.log(`  Total Revenue: $${standardPL.totalRevenue.toLocaleString()}`);
    console.log(`  Total Expenses: $${standardPL.totalExpenses.toLocaleString()}`);
    console.log(`  Total COGS: $${standardPL.totalCOGS.toLocaleString()}`);
    console.log(`  Net Income: $${standardPL.netIncome.toLocaleString()}`);
    console.log(`\n  Line Items: ${standardPL.lineItems.length}`);

    // Show top 5 revenue accounts
    const revenueItems = standardPL.lineItems
      .filter((item) => item.accountType === 'revenue')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    console.log('\nTop 5 Revenue Accounts:');
    revenueItems.forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.accountName}: $${item.amount.toLocaleString()}`);
    });

    return standardPL;
  } catch (error: any) {
    console.error('✗ Failed to fetch P&L:', error.message);
    throw error;
  }
}

/**
 * Example 4: Fetch Balance Sheet
 */
export async function example4_getBalanceSheet() {
  console.log('=== Example 4: Fetch Balance Sheet ===\n');

  const client = createQuickBooksClient();
  const accessToken = 'YOUR_ACCESS_TOKEN';
  const realmId = 'YOUR_REALM_ID';

  try {
    const date = '2024-01-31';

    console.log(`Fetching Balance Sheet as of ${date}...`);

    const balanceSheet = await client.getBalanceSheet(
      accessToken,
      realmId,
      date,
      {
        accountingMethod: 'Accrual',
      }
    );

    console.log('✓ Balance Sheet fetched successfully');
    console.log(`  Report Name: ${balanceSheet.Header.ReportName}`);
    console.log(`  Report Date: ${balanceSheet.Header.StartPeriod}`);

    return balanceSheet;
  } catch (error: any) {
    console.error('✗ Failed to fetch Balance Sheet:', error.message);
    throw error;
  }
}

/**
 * Example 5: Transform QuickBooks Data
 */
export async function example5_transformData() {
  console.log('=== Example 5: Transform QB Data ===\n');

  const client = createQuickBooksClient();
  const accessToken = 'YOUR_ACCESS_TOKEN';
  const realmId = 'YOUR_REALM_ID';

  try {
    // Fetch accounts
    const qbAccounts = await client.getAllAccounts(accessToken, realmId);

    // Transform to standard format
    const standardAccounts = client.transformAccounts(qbAccounts);

    console.log(`✓ Transformed ${standardAccounts.length} accounts\n`);

    // Show sample transformed account
    const sampleAccount = standardAccounts[0];
    console.log('Sample Transformed Account:');
    console.log(`  ID: ${sampleAccount.id}`);
    console.log(`  Name: ${sampleAccount.name}`);
    console.log(`  Type: ${sampleAccount.type}`);
    console.log(`  Balance: $${sampleAccount.balance.toLocaleString()}`);
    console.log(`  Active: ${sampleAccount.active}`);
    console.log(`  Sub-Account: ${sampleAccount.isSubAccount}`);

    return standardAccounts;
  } catch (error: any) {
    console.error('✗ Transformation failed:', error.message);
    throw error;
  }
}

/**
 * Example 6: Full Sync
 */
export async function example6_fullSync() {
  console.log('=== Example 6: Full QuickBooks Sync ===\n');

  const syncManager = getSyncManager();
  const organizationId = 'org-123';

  try {
    console.log('Starting full sync...');

    const syncStatus = await syncManager.syncAll(organizationId, {
      syncAccounts: true,
      syncPL: true,
      syncBalanceSheet: true,
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      forceRefresh: false, // Use cache if available
    });

    console.log('\n✓ Sync completed successfully\n');
    console.log('Sync Summary:');
    console.log(`  Sync ID: ${syncStatus.syncId}`);
    console.log(`  Status: ${syncStatus.status}`);
    console.log(`  Duration: ${
      syncStatus.completedAt
        ? `${
            (syncStatus.completedAt.getTime() - syncStatus.startedAt.getTime()) / 1000
          }s`
        : 'N/A'
    }`);
    console.log('\n  Items Synced:');
    console.log(`    Accounts: ${syncStatus.itemsSynced.accounts}`);
    console.log(`    P&L Reports: ${syncStatus.itemsSynced.plReports}`);
    console.log(`    Balance Sheet: ${syncStatus.itemsSynced.balanceSheet}`);

    if (syncStatus.errors.length > 0) {
      console.log('\n  Errors:');
      syncStatus.errors.forEach((err, i) => {
        console.log(`    ${i + 1}. [${err.type}] ${err.message}`);
      });
    }

    return syncStatus;
  } catch (error: any) {
    console.error('✗ Sync failed:', error.message);
    throw error;
  }
}

/**
 * Example 7: Incremental Sync
 */
export async function example7_incrementalSync() {
  console.log('=== Example 7: Incremental Sync ===\n');

  const syncManager = getSyncManager();
  const organizationId = 'org-123';

  try {
    const lastSyncedAt = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

    console.log(`Syncing changes since ${lastSyncedAt.toISOString()}...`);

    const syncStatus = await syncManager.incrementalSync(
      organizationId,
      lastSyncedAt
    );

    console.log('\n✓ Incremental sync completed');
    console.log(`  Items Synced: ${JSON.stringify(syncStatus.itemsSynced)}`);

    return syncStatus;
  } catch (error: any) {
    console.error('✗ Incremental sync failed:', error.message);
    throw error;
  }
}

/**
 * Example 8: Error Handling
 */
export async function example8_errorHandling() {
  console.log('=== Example 8: Error Handling ===\n');

  const client = createQuickBooksClient();

  try {
    // Try with invalid token
    console.log('Testing with invalid token...');

    await client.getAccounts('invalid_token', 'invalid_realm_id');
  } catch (error: any) {
    console.log('✓ Error caught successfully\n');
    console.log('Error Details:');
    console.log(`  Name: ${error.name}`);
    console.log(`  Message: ${error.message}`);
    console.log(`  Code: ${error.code}`);
    console.log(`  Status Code: ${error.statusCode || 'N/A'}`);
    console.log(`  Retryable: ${error.retryable}`);

    if (error.code === 'token_expired') {
      console.log('\n💡 Tip: Refresh your access token using refreshToken()');
    }
  }
}

/**
 * Example 9: Rate Limit Handling
 */
export async function example9_rateLimits() {
  console.log('=== Example 9: Rate Limit Handling ===\n');

  const client = createQuickBooksClient();
  const accessToken = 'YOUR_ACCESS_TOKEN';
  const realmId = 'YOUR_REALM_ID';

  console.log('Making multiple rapid requests...');

  const promises = [];
  for (let i = 0; i < 10; i++) {
    promises.push(
      client.getAccounts(accessToken, realmId, {
        startPosition: 1,
        maxResults: 10,
      })
    );
  }

  try {
    const results = await Promise.all(promises);
    console.log(`✓ Completed ${results.length} requests`);
    console.log('  Rate limiting handled automatically');
  } catch (error: any) {
    console.error('✗ Request failed:', error.message);
  }
}

/**
 * Example 10: Health Check
 */
export async function example10_healthCheck() {
  console.log('=== Example 10: Health Check ===\n');

  const syncManager = getSyncManager();
  const organizationId = 'org-123';

  try {
    console.log('Checking QuickBooks connection...');

    const health = await syncManager.healthCheck(organizationId);

    console.log('\nConnection Status:');
    console.log(`  Connected: ${health.connected ? '✓' : '✗'}`);
    console.log(`  Realm ID: ${health.realmId || 'N/A'}`);

    if (health.error) {
      console.log(`  Error: ${health.error}`);
    }

    return health;
  } catch (error: any) {
    console.error('✗ Health check failed:', error.message);
    throw error;
  }
}

/**
 * Run all examples (safe read-only operations)
 */
export async function runAllExamples() {
  console.log('🚀 Running QuickBooks Integration Examples\n');
  console.log('='.repeat(60) + '\n');

  try {
    // Error handling example (safe)
    await example8_errorHandling();
    console.log('\n' + '='.repeat(60) + '\n');

    // Note: Other examples require valid credentials
    console.log('ℹ️  Other examples require valid QuickBooks credentials');
    console.log('   Set the following in your code:');
    console.log('   - YOUR_ACCESS_TOKEN');
    console.log('   - YOUR_REFRESH_TOKEN');
    console.log('   - YOUR_REALM_ID');

    console.log('\n✅ Examples completed!');
  } catch (error) {
    console.error('\n❌ Example failed:', error);
  }
}

// Run examples if executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}
