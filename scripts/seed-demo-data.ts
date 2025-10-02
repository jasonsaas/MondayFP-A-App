/**
 * Demo Data Seeding Script for Sales Calls
 *
 * This script creates realistic demo data for sales demonstrations.
 * Includes impressive variances, insights, and realistic business scenarios.
 *
 * Usage:
 *   npm run seed:demo                  # Seed demo data
 *   npm run seed:demo -- --clean       # Clean and reseed
 *   npm run seed:demo -- --scenario=1  # Load specific scenario
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import {
  organizations,
  users,
  budgetItems,
  actualItems,
  varianceAnalyses,
  insights,
  syncLogs,
} from '@/db/schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

// Demo scenarios
const scenarios = {
  // Scenario 1: SaaS company with healthy growth
  1: {
    name: 'TechForward SaaS',
    description: 'Fast-growing SaaS company, slightly over on marketing but crushing revenue targets',
    orgName: 'TechForward Inc.',
    mondayAccountId: 99999001,
    qbRealmId: '9999900100000001',
  },
  // Scenario 2: E-commerce with inventory challenges
  2: {
    name: 'StyleHub E-commerce',
    description: 'E-commerce business with inventory overspend, seasonal revenue fluctuations',
    orgName: 'StyleHub Commerce LLC',
    mondayAccountId: 99999002,
    qbRealmId: '9999900200000002',
  },
  // Scenario 3: Professional services firm
  3: {
    name: 'Innovate Consulting',
    description: 'Consulting firm with high utilization, managing contractor costs',
    orgName: 'Innovate Consulting Partners',
    mondayAccountId: 99999003,
    qbRealmId: '9999900300000003',
  },
};

interface DemoDataOptions {
  clean?: boolean;
  scenario?: number;
}

// Color output helpers
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function cleanExistingDemoData() {
  log('\n🧹 Cleaning existing demo data...', 'yellow');

  try {
    // Delete demo organizations and cascade will handle the rest
    const demoOrgIds = Object.values(scenarios).map((s) => s.mondayAccountId);

    for (const mondayId of demoOrgIds) {
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.mondayAccountId, mondayId))
        .limit(1);

      if (org) {
        await db.delete(organizations).where(eq(organizations.id, org.id));
        log(`  ✓ Deleted organization: ${org.mondayAccountName}`, 'green');
      }
    }

    log('✅ Demo data cleaned!', 'green');
  } catch (error) {
    log(`❌ Error cleaning demo data: ${error}`, 'red');
    throw error;
  }
}

async function seedScenario1() {
  const scenario = scenarios[1];
  log(`\n📊 Loading Scenario 1: ${scenario.name}`, 'cyan');
  log(`   ${scenario.description}`, 'blue');

  const currentDate = new Date('2025-01-31');
  const periodStart = new Date('2025-01-01');
  const periodEnd = new Date('2025-01-31');
  const period = '2025-01';

  // Create organization
  const [org] = await db
    .insert(organizations)
    .values({
      mondayAccountId: scenario.mondayAccountId,
      mondayAccountName: scenario.orgName,
      mondayAccessToken: 'demo_token_' + scenario.mondayAccountId,
      mondayRefreshToken: 'demo_refresh_' + scenario.mondayAccountId,
      quickbooksRealmId: scenario.qbRealmId,
      quickbooksAccessToken: 'demo_qb_token_' + scenario.mondayAccountId,
      quickbooksRefreshToken: 'demo_qb_refresh_' + scenario.mondayAccountId,
      subscriptionTier: 'professional',
      subscriptionStatus: 'active',
      billingEmail: 'finance@techforward.io',
      settings: {
        syncFrequency: 'hourly',
        defaultBoardId: 1234567890,
        defaultCurrency: 'USD',
        thresholds: { warning: 10, critical: 15 },
        notifications: { email: true, slack: true, monday: true },
        fiscalYearStart: 1,
      },
    })
    .returning();

  log(`  ✓ Created organization: ${org.mondayAccountName}`, 'green');

  // Create users
  const [admin, cfo, controller] = await db
    .insert(users)
    .values([
      {
        organizationId: org.id,
        mondayUserId: 90001,
        email: 'sarah.chen@techforward.io',
        name: 'Sarah Chen',
        role: 'admin',
        preferences: { theme: 'dark', notifications: true, emailDigest: 'daily' },
      },
      {
        organizationId: org.id,
        mondayUserId: 90002,
        email: 'michael.rodriguez@techforward.io',
        name: 'Michael Rodriguez',
        role: 'editor',
        preferences: { theme: 'light', notifications: true, emailDigest: 'weekly' },
      },
      {
        organizationId: org.id,
        mondayUserId: 90003,
        email: 'emily.watson@techforward.io',
        name: 'Emily Watson',
        role: 'viewer',
        preferences: { theme: 'auto', notifications: false, emailDigest: 'never' },
      },
    ])
    .returning();

  log(`  ✓ Created ${3} users`, 'green');

  // Budget items - SaaS metrics
  await db.insert(budgetItems).values([
    {
      organizationId: org.id,
      mondayBoardId: 1234567890,
      mondayItemId: 'saas_rev_1',
      accountCode: '4010',
      accountName: 'SaaS Subscription Revenue',
      accountType: 'revenue',
      amount: '850000.00',
      period,
      periodStart,
      periodEnd,
      currency: 'USD',
      notes: 'Monthly recurring revenue target',
      tags: ['revenue', 'saas', 'mrr'],
    },
    {
      organizationId: org.id,
      mondayBoardId: 1234567890,
      mondayItemId: 'prof_rev_1',
      accountCode: '4020',
      accountName: 'Professional Services',
      accountType: 'revenue',
      amount: '150000.00',
      period,
      periodStart,
      periodEnd,
      currency: 'USD',
      notes: 'Implementation and consulting',
      tags: ['revenue', 'services'],
    },
    {
      organizationId: org.id,
      mondayBoardId: 1234567890,
      mondayItemId: 'sal_exp_1',
      accountCode: '6010',
      accountName: 'Engineering Salaries',
      accountType: 'expense',
      amount: '450000.00',
      period,
      periodStart,
      periodEnd,
      currency: 'USD',
      tags: ['expense', 'payroll', 'r&d'],
    },
    {
      organizationId: org.id,
      mondayBoardId: 1234567890,
      mondayItemId: 'mkt_exp_1',
      accountCode: '6020',
      accountName: 'Sales & Marketing',
      accountType: 'expense',
      amount: '200000.00',
      period,
      periodStart,
      periodEnd,
      currency: 'USD',
      notes: 'Digital ads, content, events',
      tags: ['expense', 'marketing', 'growth'],
    },
    {
      organizationId: org.id,
      mondayBoardId: 1234567890,
      mondayItemId: 'inf_exp_1',
      accountCode: '6030',
      accountName: 'Cloud Infrastructure',
      accountType: 'expense',
      amount: '85000.00',
      period,
      periodStart,
      periodEnd,
      currency: 'USD',
      notes: 'AWS, GCP, CDN costs',
      tags: ['expense', 'infrastructure', 'cogs'],
    },
    {
      organizationId: org.id,
      mondayBoardId: 1234567890,
      mondayItemId: 'cs_exp_1',
      accountCode: '6040',
      accountName: 'Customer Success',
      accountType: 'expense',
      amount: '120000.00',
      period,
      periodStart,
      periodEnd,
      currency: 'USD',
      tags: ['expense', 'customer-success'],
    },
  ]);

  log(`  ✓ Created budget items`, 'green');

  // Actual items - impressive performance
  await db.insert(actualItems).values([
    {
      organizationId: org.id,
      quickbooksAccountId: 'qb_4010',
      accountCode: '4010',
      accountName: 'SaaS Subscription Revenue',
      accountType: 'revenue',
      amount: '945000.00', // 11.2% over budget - crushing it!
      period,
      periodStart,
      periodEnd,
      currency: 'USD',
      reportType: 'ProfitAndLoss',
      transactionCount: 2847,
      metadata: {
        lastSyncedAt: currentDate.toISOString(),
        mrr: 945000,
        customerCount: 425,
        avgRevenuePerCustomer: 2223.53,
      },
    },
    {
      organizationId: org.id,
      quickbooksAccountId: 'qb_4020',
      accountCode: '4020',
      accountName: 'Professional Services',
      accountType: 'revenue',
      amount: '168000.00', // 12% over budget
      period,
      periodStart,
      periodEnd,
      currency: 'USD',
      reportType: 'ProfitAndLoss',
      transactionCount: 34,
    },
    {
      organizationId: org.id,
      quickbooksAccountId: 'qb_6010',
      accountCode: '6010',
      accountName: 'Engineering Salaries',
      accountType: 'expense',
      amount: '448500.00', // On budget
      period,
      periodStart,
      periodEnd,
      currency: 'USD',
      reportType: 'ProfitAndLoss',
      transactionCount: 62,
    },
    {
      organizationId: org.id,
      quickbooksAccountId: 'qb_6020',
      accountCode: '6020',
      accountName: 'Sales & Marketing',
      accountType: 'expense',
      amount: '235000.00', // 17.5% over budget - red flag
      period,
      periodStart,
      periodEnd,
      currency: 'USD',
      reportType: 'ProfitAndLoss',
      transactionCount: 892,
      metadata: {
        campaigns: {
          google: 95000,
          facebook: 62000,
          linkedin: 45000,
          events: 33000,
        },
      },
    },
    {
      organizationId: org.id,
      quickbooksAccountId: 'qb_6030',
      accountCode: '6030',
      accountName: 'Cloud Infrastructure',
      accountType: 'expense',
      amount: '79800.00', // 6.1% under budget - efficient!
      period,
      periodStart,
      periodEnd,
      currency: 'USD',
      reportType: 'ProfitAndLoss',
      transactionCount: 3,
    },
    {
      organizationId: org.id,
      quickbooksAccountId: 'qb_6040',
      accountCode: '6040',
      accountName: 'Customer Success',
      accountType: 'expense',
      amount: '123400.00', // 2.8% over
      period,
      periodStart,
      periodEnd,
      currency: 'USD',
      reportType: 'ProfitAndLoss',
      transactionCount: 48,
    },
  ]);

  log(`  ✓ Created actual items`, 'green');

  // Variance analysis
  const [analysis] = await db
    .insert(varianceAnalyses)
    .values({
      organizationId: org.id,
      mondayBoardId: 1234567890,
      periodStart,
      periodEnd,
      periodLabel: period,
      totalBudget: '1855000.00',
      totalActual: '2000700.00',
      totalVariance: '145700.00',
      totalVariancePercent: '7.85',
      criticalCount: 1,
      warningCount: 1,
      normalCount: 4,
      results: {
        variances: [
          {
            accountId: '4010',
            accountName: 'SaaS Subscription Revenue',
            accountType: 'revenue',
            budget: 850000,
            actual: 945000,
            variance: 95000,
            variancePercent: 11.18,
            severity: 'normal',
            direction: 'favorable',
            level: 0,
          },
          {
            accountId: '6020',
            accountName: 'Sales & Marketing',
            accountType: 'expense',
            budget: 200000,
            actual: 235000,
            variance: 35000,
            variancePercent: 17.5,
            severity: 'critical',
            direction: 'unfavorable',
            level: 0,
          },
        ],
        insights: [],
      },
      metadata: {
        calculationTime: 342,
        itemsProcessed: 6,
        cacheHit: false,
        version: '1.0.0',
      },
      triggeredBy: admin.id,
    })
    .returning();

  log(`  ✓ Created variance analysis`, 'green');

  // AI Insights
  await db.insert(insights).values([
    {
      organizationId: org.id,
      varianceAnalysisId: analysis.id,
      insightType: 'variance',
      severity: 'normal',
      title: '🚀 SaaS Revenue Exceeds Target by 11.2%',
      message:
        'Exceptional performance in subscription revenue! MRR grew from $850K to $945K, driven by 47 new enterprise customers and successful upsells. Customer retention remains strong at 98.2%, with Net Revenue Retention (NRR) at 115%. The sales team closed 3 major deals (>$50K ARR each) in the final week of January.',
      accountCode: '4010',
      accountName: 'SaaS Subscription Revenue',
      affectedAmount: '95000.00',
      confidence: '0.9800',
      priority: 95,
      actionable: true,
      recommendation:
        'Strong momentum! Consider: 1) Increase sales quotas by 10% for Q2, 2) Allocate additional resources to enterprise segment, 3) Document successful sales playbooks for replication',
      metadata: {
        accountId: '4010',
        period: '2025-01',
        variance: 95000,
        variancePercent: 11.18,
        metrics: {
          mrr: 945000,
          newCustomers: 47,
          churnRate: 1.8,
          nrr: 115,
        },
      },
    },
    {
      organizationId: org.id,
      varianceAnalysisId: analysis.id,
      insightType: 'variance',
      severity: 'critical',
      title: '⚠️ Marketing Overspend Requires Immediate Attention',
      message:
        'Sales & Marketing expenses are 17.5% ($35K) over budget. Primary drivers: Google Ads overspend ($15K above plan), unplanned LinkedIn campaign ($12K), and event sponsorship ($8K). While CAC increased 22% month-over-month, new customer acquisition grew only 8%, indicating declining marketing efficiency.',
      accountCode: '6020',
      accountName: 'Sales & Marketing',
      affectedAmount: '35000.00',
      confidence: '0.9500',
      priority: 98,
      actionable: true,
      recommendation:
        'URGENT ACTIONS: 1) Pause underperforming campaigns immediately (ROI < 2:1), 2) Require VP approval for all spending >$5K, 3) Implement weekly budget reviews with marketing lead, 4) Optimize Google Ads targeting to reduce CPC by 15%',
      metadata: {
        accountId: '6020',
        period: '2025-01',
        variance: 35000,
        variancePercent: 17.5,
        cacIncrease: 22,
        customerGrowth: 8,
      },
    },
    {
      organizationId: org.id,
      varianceAnalysisId: analysis.id,
      insightType: 'recommendation',
      severity: 'normal',
      title: '💡 Infrastructure Cost Optimization Success',
      message:
        'Cloud infrastructure costs came in 6.1% under budget through proactive optimization. Key wins: migrated 40% of workloads to reserved instances (saving $4.2K/month), implemented auto-scaling policies reducing peak usage by 25%, and optimized data transfer costs.',
      accountCode: '6030',
      accountName: 'Cloud Infrastructure',
      affectedAmount: '-5200.00',
      confidence: '0.9200',
      priority: 70,
      actionable: false,
      recommendation:
        'Excellent cost management! Share optimization playbook across engineering teams. Consider extending reserved instance coverage to 60% of compute for additional savings.',
      metadata: {
        accountId: '6030',
        period: '2025-01',
        variance: -5200,
        variancePercent: -6.1,
      },
    },
  ]);

  log(`  ✓ Created ${3} AI insights`, 'green');

  // Sync logs
  await db.insert(syncLogs).values([
    {
      organizationId: org.id,
      syncType: 'monday_budget',
      status: 'completed',
      source: 'scheduled',
      triggeredBy: admin.id,
      startedAt: new Date(currentDate.getTime() - 3600000),
      completedAt: new Date(currentDate.getTime() - 3595000),
      duration: 5000,
      itemsProcessed: 6,
      itemsCreated: 6,
      itemsUpdated: 0,
      itemsFailed: 0,
    },
    {
      organizationId: org.id,
      syncType: 'quickbooks_actual',
      status: 'completed',
      source: 'scheduled',
      triggeredBy: admin.id,
      startedAt: new Date(currentDate.getTime() - 1800000),
      completedAt: new Date(currentDate.getTime() - 1793000),
      duration: 7000,
      itemsProcessed: 6,
      itemsCreated: 6,
      itemsUpdated: 0,
      itemsFailed: 0,
    },
    {
      organizationId: org.id,
      syncType: 'variance_analysis',
      status: 'completed',
      source: 'manual',
      triggeredBy: admin.id,
      startedAt: new Date(currentDate.getTime() - 60000),
      completedAt: new Date(currentDate.getTime() - 59658),
      duration: 342,
      itemsProcessed: 6,
      itemsCreated: 1,
      itemsUpdated: 0,
      itemsFailed: 0,
    },
  ]);

  log(`  ✓ Created sync logs`, 'green');
  log(`\n✅ Scenario 1 loaded successfully!`, 'green');

  return org;
}

async function seedDemoData(options: DemoDataOptions = {}) {
  log('\n╔════════════════════════════════════════════════╗', 'bright');
  log('║   FP&A Platform - Demo Data Seed Script      ║', 'bright');
  log('╚════════════════════════════════════════════════╝\n', 'bright');

  try {
    if (options.clean) {
      await cleanExistingDemoData();
    }

    const scenarioId = options.scenario || 1;

    if (scenarioId === 1) {
      const org = await seedScenario1();

      log('\n📊 Demo Data Summary:', 'cyan');
      log('═══════════════════════════════════════════', 'cyan');
      log(`Organization: ${org.mondayAccountName}`, 'blue');
      log(`Monday Account ID: ${org.mondayAccountId}`, 'blue');
      log(`QuickBooks Realm ID: ${org.quickbooksRealmId}`, 'blue');
      log(`\n💰 Key Metrics:`, 'magenta');
      log(`  • Total Revenue: $1,113,000 (11.3% over budget)`, 'green');
      log(`  • Total Expenses: $886,700 (5.2% over budget)`, 'yellow');
      log(`  • Net Variance: $145,700 favorable`, 'green');
      log(`  • Critical Issues: 1 (Marketing overspend)`, 'red');
      log(`  • Positive Insights: 2`, 'green');

      log('\n🎯 Demo Talking Points:', 'cyan');
      log('═══════════════════════════════════════════', 'cyan');
      log('  1. Show SaaS revenue outperformance (+11.2%)', 'blue');
      log('  2. Highlight marketing overspend alert (-17.5%)', 'blue');
      log('  3. Demonstrate infrastructure cost savings', 'blue');
      log('  4. Walk through AI-generated insights', 'blue');
      log('  5. Show real-time Monday.com sync', 'blue');

      log('\n🔐 Login Credentials:', 'cyan');
      log('═══════════════════════════════════════════', 'cyan');
      log('  Admin: sarah.chen@techforward.io', 'blue');
      log('  CFO: michael.rodriguez@techforward.io', 'blue');
      log('  Controller: emily.watson@techforward.io', 'blue');
    }

    log('\n✅ Demo data seeding completed!\n', 'green');
  } catch (error) {
    log(`\n❌ Error seeding demo data: ${error}`, 'red');
    console.error(error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: DemoDataOptions = {
  clean: args.includes('--clean'),
  scenario: args.find((arg) => arg.startsWith('--scenario='))
    ? parseInt(args.find((arg) => arg.startsWith('--scenario='))!.split('=')[1])
    : 1,
};

// Run seed
seedDemoData(options)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
