/**
 * Database Seed Script for FP&A Platform
 *
 * Usage:
 *   npm run seed          # Seed development data
 *   npm run seed:test     # Seed test data
 *   npm run seed:clean    # Clean and reseed
 *
 * This script creates:
 * - 2 demo organizations
 * - 5 demo users (various roles)
 * - Sample budget items from Monday.com
 * - Sample actual items from QuickBooks
 * - Historical variance analyses
 * - AI-generated insights
 * - Sync logs
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import {
  organizations,
  users,
  budgetItems,
  actualItems,
  varianceAnalyses,
  insights,
  syncLogs,
  type NewOrganization,
  type NewUser,
  type NewBudgetItem,
  type NewActualItem,
  type NewVarianceAnalysis,
  type NewInsight,
  type NewSyncLog,
} from './schema';

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

// Seed data
const seedOrganizations: NewOrganization[] = [
  {
    mondayAccountId: 12345678,
    mondayAccountName: 'Acme Corporation',
    mondayAccessToken: 'demo_monday_token_acme_12345',
    mondayRefreshToken: 'demo_monday_refresh_acme_12345',
    quickbooksRealmId: '9130356528374650',
    quickbooksAccessToken: 'demo_qb_token_acme_12345',
    quickbooksRefreshToken: 'demo_qb_refresh_acme_12345',
    subscriptionTier: 'professional',
    subscriptionStatus: 'active',
    billingEmail: 'billing@acmecorp.com',
    settings: {
      syncFrequency: 'hourly',
      defaultBoardId: 987654321,
      defaultCurrency: 'USD',
      thresholds: {
        warning: 10,
        critical: 15,
      },
      notifications: {
        email: true,
        slack: true,
        monday: true,
      },
      fiscalYearStart: 1,
    },
    active: true,
  },
  {
    mondayAccountId: 87654321,
    mondayAccountName: 'Tech Startup Inc',
    mondayAccessToken: 'demo_monday_token_startup_67890',
    mondayRefreshToken: 'demo_monday_refresh_startup_67890',
    quickbooksRealmId: '1234567890123456',
    quickbooksAccessToken: 'demo_qb_token_startup_67890',
    quickbooksRefreshToken: 'demo_qb_refresh_startup_67890',
    subscriptionTier: 'starter',
    subscriptionStatus: 'active',
    billingEmail: 'finance@techstartup.io',
    settings: {
      syncFrequency: 'daily',
      defaultBoardId: 123456789,
      defaultCurrency: 'USD',
      thresholds: {
        warning: 15,
        critical: 25,
      },
      notifications: {
        email: true,
        slack: false,
        monday: true,
      },
      fiscalYearStart: 1,
    },
    active: true,
  },
];

async function createUsers(orgId: string): Promise<string[]> {
  const userIds: string[] = [];

  const seedUsers: NewUser[] = [
    {
      organizationId: orgId,
      mondayUserId: 11111111,
      email: 'john.doe@acmecorp.com',
      name: 'John Doe',
      role: 'admin',
      preferences: {
        theme: 'dark',
        notifications: true,
        emailDigest: 'daily',
      },
      active: true,
    },
    {
      organizationId: orgId,
      mondayUserId: 22222222,
      email: 'jane.smith@acmecorp.com',
      name: 'Jane Smith',
      role: 'editor',
      preferences: {
        theme: 'light',
        notifications: true,
        emailDigest: 'weekly',
      },
      active: true,
    },
    {
      organizationId: orgId,
      mondayUserId: 33333333,
      email: 'bob.wilson@acmecorp.com',
      name: 'Bob Wilson',
      role: 'viewer',
      preferences: {
        theme: 'auto',
        notifications: false,
        emailDigest: 'never',
      },
      active: true,
    },
  ];

  for (const userData of seedUsers) {
    const [user] = await db.insert(users).values(userData).returning();
    userIds.push(user.id);
  }

  return userIds;
}

async function createBudgetItems(orgId: string): Promise<void> {
  const currentDate = new Date();
  const periodStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const periodEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const period = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

  const budgetData: NewBudgetItem[] = [
    {
      organizationId: orgId,
      mondayBoardId: 987654321,
      mondayItemId: 'item_001',
      mondayGroupId: 'group_revenue',
      accountCode: '4000',
      accountName: 'Product Revenue',
      accountType: 'revenue',
      amount: '500000.00',
      period,
      periodStart,
      periodEnd,
      currency: 'USD',
      notes: 'Q1 product sales budget',
      tags: ['revenue', 'products', 'core'],
    },
    {
      organizationId: orgId,
      mondayBoardId: 987654321,
      mondayItemId: 'item_002',
      mondayGroupId: 'group_revenue',
      accountCode: '4100',
      accountName: 'Service Revenue',
      accountType: 'revenue',
      amount: '200000.00',
      period,
      periodStart,
      periodEnd,
      currency: 'USD',
      notes: 'Professional services budget',
      tags: ['revenue', 'services'],
    },
    {
      organizationId: orgId,
      mondayBoardId: 987654321,
      mondayItemId: 'item_003',
      mondayGroupId: 'group_expenses',
      accountCode: '6000',
      accountName: 'Salaries & Wages',
      accountType: 'expense',
      amount: '300000.00',
      period,
      periodStart,
      periodEnd,
      currency: 'USD',
      notes: 'Employee payroll budget',
      tags: ['expenses', 'payroll', 'fixed'],
    },
    {
      organizationId: orgId,
      mondayBoardId: 987654321,
      mondayItemId: 'item_004',
      mondayGroupId: 'group_expenses',
      accountCode: '6500',
      accountName: 'Marketing & Advertising',
      accountType: 'expense',
      amount: '100000.00',
      period,
      periodStart,
      periodEnd,
      currency: 'USD',
      notes: 'Digital marketing campaigns',
      tags: ['expenses', 'marketing', 'variable'],
    },
    {
      organizationId: orgId,
      mondayBoardId: 987654321,
      mondayItemId: 'item_005',
      mondayGroupId: 'group_expenses',
      accountCode: '6800',
      accountName: 'Technology & Software',
      accountType: 'expense',
      amount: '50000.00',
      period,
      periodStart,
      periodEnd,
      currency: 'USD',
      notes: 'SaaS subscriptions and infrastructure',
      tags: ['expenses', 'technology', 'fixed'],
    },
    {
      organizationId: orgId,
      mondayBoardId: 987654321,
      mondayItemId: 'item_006',
      mondayGroupId: 'group_expenses',
      accountCode: '7000',
      accountName: 'Office & Facilities',
      accountType: 'expense',
      amount: '40000.00',
      period,
      periodStart,
      periodEnd,
      currency: 'USD',
      notes: 'Rent, utilities, supplies',
      tags: ['expenses', 'facilities', 'fixed'],
    },
  ];

  await db.insert(budgetItems).values(budgetData);
}

async function createActualItems(orgId: string): Promise<void> {
  const currentDate = new Date();
  const periodStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const periodEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const period = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

  const actualData: NewActualItem[] = [
    {
      organizationId: orgId,
      quickbooksAccountId: 'qb_acc_4000',
      accountCode: '4000',
      accountName: 'Product Revenue',
      accountType: 'revenue',
      accountSubType: 'SalesOfProductIncome',
      amount: '475000.00', // 5% under budget
      period,
      periodStart,
      periodEnd,
      currency: 'USD',
      reportType: 'ProfitAndLoss',
      transactionCount: 145,
      metadata: {
        lastSyncedAt: new Date().toISOString(),
      },
    },
    {
      organizationId: orgId,
      quickbooksAccountId: 'qb_acc_4100',
      accountCode: '4100',
      accountName: 'Service Revenue',
      accountType: 'revenue',
      accountSubType: 'ServiceFeeIncome',
      amount: '215000.00', // 7.5% over budget
      period,
      periodStart,
      periodEnd,
      currency: 'USD',
      reportType: 'ProfitAndLoss',
      transactionCount: 87,
      metadata: {
        lastSyncedAt: new Date().toISOString(),
      },
    },
    {
      organizationId: orgId,
      quickbooksAccountId: 'qb_acc_6000',
      accountCode: '6000',
      accountName: 'Salaries & Wages',
      accountType: 'expense',
      accountSubType: 'PayrollExpenses',
      amount: '305000.00', // 1.7% over budget
      period,
      periodStart,
      periodEnd,
      currency: 'USD',
      reportType: 'ProfitAndLoss',
      transactionCount: 52,
      metadata: {
        lastSyncedAt: new Date().toISOString(),
      },
    },
    {
      organizationId: orgId,
      quickbooksAccountId: 'qb_acc_6500',
      accountCode: '6500',
      accountName: 'Marketing & Advertising',
      accountType: 'expense',
      accountSubType: 'AdvertisingPromotional',
      amount: '125000.00', // 25% over budget - CRITICAL
      period,
      periodStart,
      periodEnd,
      currency: 'USD',
      reportType: 'ProfitAndLoss',
      transactionCount: 234,
      metadata: {
        lastSyncedAt: new Date().toISOString(),
      },
    },
    {
      organizationId: orgId,
      quickbooksAccountId: 'qb_acc_6800',
      accountCode: '6800',
      accountName: 'Technology & Software',
      accountType: 'expense',
      accountSubType: 'Software',
      amount: '48000.00', // 4% under budget
      period,
      periodStart,
      periodEnd,
      currency: 'USD',
      reportType: 'ProfitAndLoss',
      transactionCount: 45,
      metadata: {
        lastSyncedAt: new Date().toISOString(),
      },
    },
    {
      organizationId: orgId,
      quickbooksAccountId: 'qb_acc_7000',
      accountCode: '7000',
      accountName: 'Office & Facilities',
      accountType: 'expense',
      accountSubType: 'Rent',
      amount: '41500.00', // 3.75% over budget
      period,
      periodStart,
      periodEnd,
      currency: 'USD',
      reportType: 'ProfitAndLoss',
      transactionCount: 12,
      metadata: {
        lastSyncedAt: new Date().toISOString(),
      },
    },
  ];

  await db.insert(actualItems).values(actualData);
}

async function createVarianceAnalysis(orgId: string, userId: string): Promise<string> {
  const currentDate = new Date();
  const periodStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const periodEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const period = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

  const varianceData: NewVarianceAnalysis = {
    organizationId: orgId,
    mondayBoardId: 987654321,
    periodStart,
    periodEnd,
    periodLabel: period,
    totalBudget: '1190000.00',
    totalActual: '1209500.00',
    totalVariance: '19500.00',
    totalVariancePercent: '1.64',
    criticalCount: 1,
    warningCount: 2,
    normalCount: 3,
    results: {
      variances: [
        {
          accountId: '4000',
          accountName: 'Product Revenue',
          accountType: 'revenue',
          budget: 500000,
          actual: 475000,
          variance: -25000,
          variancePercent: -5.0,
          severity: 'normal',
          direction: 'unfavorable',
          level: 0,
        },
        {
          accountId: '4100',
          accountName: 'Service Revenue',
          accountType: 'revenue',
          budget: 200000,
          actual: 215000,
          variance: 15000,
          variancePercent: 7.5,
          severity: 'normal',
          direction: 'favorable',
          level: 0,
        },
        {
          accountId: '6500',
          accountName: 'Marketing & Advertising',
          accountType: 'expense',
          budget: 100000,
          actual: 125000,
          variance: 25000,
          variancePercent: 25.0,
          severity: 'critical',
          direction: 'unfavorable',
          level: 0,
        },
      ],
      insights: [
        {
          type: 'variance',
          severity: 'critical',
          message: 'Marketing spending is 25% over budget, driven by increased digital ad costs',
          accountId: '6500',
          confidence: 0.95,
        },
        {
          type: 'trend',
          severity: 'warning',
          message: 'Product revenue trending 5% below target for 3 consecutive months',
          accountId: '4000',
          confidence: 0.88,
        },
      ],
    },
    metadata: {
      calculationTime: 125,
      itemsProcessed: 6,
      cacheHit: false,
      version: '1.0.0',
    },
    triggeredBy: userId,
  };

  const [analysis] = await db.insert(varianceAnalyses).values(varianceData).returning();
  return analysis.id;
}

async function createInsights(orgId: string, analysisId: string): Promise<void> {
  const insightData: NewInsight[] = [
    {
      organizationId: orgId,
      varianceAnalysisId: analysisId,
      insightType: 'variance',
      severity: 'critical',
      title: 'Marketing Budget Overspend',
      message: 'Marketing & Advertising expenses are 25% ($25,000) over budget. This variance is primarily driven by increased digital advertising costs on Facebook and Google Ads. The campaign conversion rate remains strong at 3.2%, but CPA has increased 18% month-over-month.',
      accountCode: '6500',
      accountName: 'Marketing & Advertising',
      affectedAmount: '25000.00',
      confidence: '0.9500',
      priority: 95,
      actionable: true,
      recommendation: 'Consider: 1) Pausing underperforming ad campaigns, 2) Reallocating budget to higher-ROI channels, 3) Requesting additional budget approval if conversions justify the spend',
      metadata: {
        accountId: '6500',
        period: '2025-01',
        variance: 25000,
        variancePercent: 25.0,
      },
    },
    {
      organizationId: orgId,
      varianceAnalysisId: analysisId,
      insightType: 'trend',
      severity: 'warning',
      title: 'Product Revenue Declining Trend',
      message: 'Product Revenue has underperformed budget by 5% for three consecutive months. This pattern suggests potential issues with product-market fit, pricing, or competitive pressure.',
      accountCode: '4000',
      accountName: 'Product Revenue',
      affectedAmount: '-25000.00',
      confidence: '0.8800',
      priority: 80,
      actionable: true,
      recommendation: 'Conduct customer interviews to understand buying hesitation. Review competitor pricing. Consider launching a limited-time promotion to boost sales velocity.',
      metadata: {
        accountId: '4000',
        period: '2025-01',
        variance: -25000,
        variancePercent: -5.0,
        trendData: [
          { period: '2024-11', variance: -3.2 },
          { period: '2024-12', variance: -4.1 },
          { period: '2025-01', variance: -5.0 },
        ],
      },
    },
    {
      organizationId: orgId,
      varianceAnalysisId: analysisId,
      insightType: 'recommendation',
      severity: 'normal',
      title: 'Service Revenue Exceeding Expectations',
      message: 'Service Revenue is performing 7.5% above budget. This positive variance indicates strong demand for professional services.',
      accountCode: '4100',
      accountName: 'Service Revenue',
      affectedAmount: '15000.00',
      confidence: '0.9200',
      priority: 60,
      actionable: true,
      recommendation: 'Consider hiring additional service delivery staff to capture growing demand. Update forecasts for Q2 to reflect this positive trend.',
      metadata: {
        accountId: '4100',
        period: '2025-01',
        variance: 15000,
        variancePercent: 7.5,
      },
    },
  ];

  await db.insert(insights).values(insightData);
}

async function createSyncLogs(orgId: string, userId: string): Promise<void> {
  const now = new Date();

  const syncData: NewSyncLog[] = [
    {
      organizationId: orgId,
      syncType: 'monday_budget',
      status: 'completed',
      source: 'scheduled',
      triggeredBy: userId,
      startedAt: new Date(now.getTime() - 300000), // 5 minutes ago
      completedAt: new Date(now.getTime() - 295000),
      duration: 5000,
      itemsProcessed: 6,
      itemsCreated: 6,
      itemsUpdated: 0,
      itemsFailed: 0,
      metadata: {
        boardId: 987654321,
        periodStart: '2025-01-01',
        periodEnd: '2025-01-31',
      },
    },
    {
      organizationId: orgId,
      syncType: 'quickbooks_actual',
      status: 'completed',
      source: 'scheduled',
      triggeredBy: userId,
      startedAt: new Date(now.getTime() - 180000), // 3 minutes ago
      completedAt: new Date(now.getTime() - 175000),
      duration: 5000,
      itemsProcessed: 6,
      itemsCreated: 6,
      itemsUpdated: 0,
      itemsFailed: 0,
      metadata: {
        realmId: '9130356528374650',
        periodStart: '2025-01-01',
        periodEnd: '2025-01-31',
      },
    },
    {
      organizationId: orgId,
      syncType: 'variance_analysis',
      status: 'completed',
      source: 'manual',
      triggeredBy: userId,
      startedAt: new Date(now.getTime() - 60000), // 1 minute ago
      completedAt: new Date(now.getTime() - 59875),
      duration: 125,
      itemsProcessed: 6,
      itemsCreated: 1,
      itemsUpdated: 0,
      itemsFailed: 0,
      metadata: {
        boardId: 987654321,
        periodStart: '2025-01-01',
        periodEnd: '2025-01-31',
      },
    },
  ];

  await db.insert(syncLogs).values(syncData);
}

// Main seed function
async function seed() {
  console.log('🌱 Starting database seed...\n');

  try {
    // Create organizations
    console.log('📊 Creating organizations...');
    const [org1, org2] = await db.insert(organizations).values(seedOrganizations).returning();
    console.log(`✅ Created ${seedOrganizations.length} organizations\n`);

    // Create users for first organization
    console.log('👥 Creating users...');
    const userIds = await createUsers(org1.id);
    console.log(`✅ Created ${userIds.length} users\n`);

    // Create budget items
    console.log('💰 Creating budget items...');
    await createBudgetItems(org1.id);
    console.log('✅ Created budget items\n');

    // Create actual items
    console.log('📈 Creating actual items from QuickBooks...');
    await createActualItems(org1.id);
    console.log('✅ Created actual items\n');

    // Create variance analysis
    console.log('🔍 Creating variance analysis...');
    const analysisId = await createVarianceAnalysis(org1.id, userIds[0]);
    console.log('✅ Created variance analysis\n');

    // Create insights
    console.log('💡 Creating AI insights...');
    await createInsights(org1.id, analysisId);
    console.log('✅ Created insights\n');

    // Create sync logs
    console.log('📝 Creating sync logs...');
    await createSyncLogs(org1.id, userIds[0]);
    console.log('✅ Created sync logs\n');

    console.log('🎉 Database seeding completed successfully!\n');
    console.log('📋 Summary:');
    console.log(`   - Organizations: ${seedOrganizations.length}`);
    console.log(`   - Users: ${userIds.length}`);
    console.log('   - Budget Items: 6');
    console.log('   - Actual Items: 6');
    console.log('   - Variance Analyses: 1');
    console.log('   - Insights: 3');
    console.log('   - Sync Logs: 3');
    console.log('\n✨ You can now start the application with sample data!');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run seed if called directly
if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { seed };
