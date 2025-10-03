import { db } from '../db';
import { organizations, budgetItems, actualItems, syncLogs } from '../db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

/**
 * Test Data Seed Script
 *
 * Creates realistic test data including:
 * - Test organizations with Monday and QuickBooks credentials
 * - Sample budget items (30 items across different categories)
 * - Sample actual items with realistic variances (including critical >15%)
 *
 * Usage:
 *   npx tsx scripts/seed-test-data.ts
 */

interface BudgetItem {
  accountName: string;
  accountCode: string;
  accountType: 'revenue' | 'expense' | 'cost_of_goods_sold';
  category: string;
  budgetAmount: number;
  variancePercent: number; // How much actual differs from budget
  direction: 'favorable' | 'unfavorable';
}

// Generate realistic budget data with variance scenarios
const budgetData: BudgetItem[] = [
  // REVENUE (favorable = positive variance)
  {
    accountName: 'Product Sales Revenue',
    accountCode: '4000',
    accountType: 'revenue',
    category: 'Revenue',
    budgetAmount: 150000,
    variancePercent: -8.5, // 8.5% under budget (unfavorable for revenue)
    direction: 'unfavorable',
  },
  {
    accountName: 'Service Revenue',
    accountCode: '4100',
    accountType: 'revenue',
    category: 'Revenue',
    budgetAmount: 85000,
    variancePercent: 12.3, // 12.3% over budget (favorable for revenue) - WARNING
    direction: 'favorable',
  },
  {
    accountName: 'Consulting Revenue',
    accountCode: '4200',
    accountType: 'revenue',
    category: 'Revenue',
    budgetAmount: 65000,
    variancePercent: 18.7, // 18.7% over budget (favorable for revenue) - CRITICAL
    direction: 'favorable',
  },
  {
    accountName: 'Subscription Revenue',
    accountCode: '4300',
    accountType: 'revenue',
    category: 'Revenue',
    budgetAmount: 95000,
    variancePercent: 5.2, // 5.2% over budget (normal)
    direction: 'favorable',
  },
  {
    accountName: 'License Revenue',
    accountCode: '4400',
    accountType: 'revenue',
    category: 'Revenue',
    budgetAmount: 45000,
    variancePercent: -22.4, // 22.4% under budget (unfavorable) - CRITICAL
    direction: 'unfavorable',
  },

  // COST OF GOODS SOLD (favorable = negative variance)
  {
    accountName: 'Direct Materials',
    accountCode: '5000',
    accountType: 'cost_of_goods_sold',
    category: 'Cost of Goods Sold',
    budgetAmount: 32000,
    variancePercent: 16.8, // 16.8% over budget (unfavorable for COGS) - CRITICAL
    direction: 'unfavorable',
  },
  {
    accountName: 'Direct Labor',
    accountCode: '5100',
    accountType: 'cost_of_goods_sold',
    category: 'Cost of Goods Sold',
    budgetAmount: 48000,
    variancePercent: -7.3, // 7.3% under budget (favorable for COGS)
    direction: 'favorable',
  },
  {
    accountName: 'Manufacturing Overhead',
    accountCode: '5200',
    accountType: 'cost_of_goods_sold',
    category: 'Cost of Goods Sold',
    budgetAmount: 28000,
    variancePercent: 11.5, // 11.5% over budget (unfavorable) - WARNING
    direction: 'unfavorable',
  },
  {
    accountName: 'Shipping & Freight',
    accountCode: '5300',
    accountType: 'cost_of_goods_sold',
    category: 'Cost of Goods Sold',
    budgetAmount: 15000,
    variancePercent: 3.8, // Normal variance
    direction: 'unfavorable',
  },

  // OPERATING EXPENSES - Payroll
  {
    accountName: 'Salaries - Engineering',
    accountCode: '6000',
    accountType: 'expense',
    category: 'Payroll',
    budgetAmount: 125000,
    variancePercent: 8.4, // 8.4% over budget (unfavorable for expense)
    direction: 'unfavorable',
  },
  {
    accountName: 'Salaries - Sales',
    accountCode: '6100',
    accountType: 'expense',
    category: 'Payroll',
    budgetAmount: 95000,
    variancePercent: -4.2, // 4.2% under budget (favorable for expense)
    direction: 'favorable',
  },
  {
    accountName: 'Salaries - Operations',
    accountCode: '6200',
    accountType: 'expense',
    category: 'Payroll',
    budgetAmount: 78000,
    variancePercent: 2.1, // Normal variance
    direction: 'unfavorable',
  },
  {
    accountName: 'Payroll Taxes',
    accountCode: '6300',
    accountType: 'expense',
    category: 'Payroll',
    budgetAmount: 42000,
    variancePercent: 6.7, // Normal variance
    direction: 'unfavorable',
  },
  {
    accountName: 'Employee Benefits',
    accountCode: '6400',
    accountType: 'expense',
    category: 'Payroll',
    budgetAmount: 55000,
    variancePercent: 19.3, // 19.3% over budget - CRITICAL
    direction: 'unfavorable',
  },

  // OPERATING EXPENSES - Marketing
  {
    accountName: 'Digital Advertising',
    accountCode: '7000',
    accountType: 'expense',
    category: 'Marketing',
    budgetAmount: 35000,
    variancePercent: 24.6, // 24.6% over budget - CRITICAL
    direction: 'unfavorable',
  },
  {
    accountName: 'Content Marketing',
    accountCode: '7100',
    accountType: 'expense',
    category: 'Marketing',
    budgetAmount: 18000,
    variancePercent: -12.8, // 12.8% under budget - WARNING
    direction: 'favorable',
  },
  {
    accountName: 'Trade Shows & Events',
    accountCode: '7200',
    accountType: 'expense',
    category: 'Marketing',
    budgetAmount: 25000,
    variancePercent: 8.9, // Normal variance
    direction: 'unfavorable',
  },
  {
    accountName: 'Marketing Technology',
    accountCode: '7300',
    accountType: 'expense',
    category: 'Marketing',
    budgetAmount: 12000,
    variancePercent: 4.5, // Normal variance
    direction: 'unfavorable',
  },

  // OPERATING EXPENSES - Technology
  {
    accountName: 'Cloud Infrastructure',
    accountCode: '8000',
    accountType: 'expense',
    category: 'Technology',
    budgetAmount: 28000,
    variancePercent: 17.2, // 17.2% over budget - CRITICAL
    direction: 'unfavorable',
  },
  {
    accountName: 'Software Licenses',
    accountCode: '8100',
    accountType: 'expense',
    category: 'Technology',
    budgetAmount: 22000,
    variancePercent: -3.4, // Normal variance
    direction: 'favorable',
  },
  {
    accountName: 'IT Support',
    accountCode: '8200',
    accountType: 'expense',
    category: 'Technology',
    budgetAmount: 15000,
    variancePercent: 11.6, // 11.6% over budget - WARNING
    direction: 'unfavorable',
  },
  {
    accountName: 'Cybersecurity',
    accountCode: '8300',
    accountType: 'expense',
    category: 'Technology',
    budgetAmount: 18000,
    variancePercent: 6.3, // Normal variance
    direction: 'unfavorable',
  },

  // OPERATING EXPENSES - General & Administrative
  {
    accountName: 'Office Rent',
    accountCode: '9000',
    accountType: 'expense',
    category: 'General & Administrative',
    budgetAmount: 45000,
    variancePercent: 0.8, // Normal variance
    direction: 'unfavorable',
  },
  {
    accountName: 'Office Supplies',
    accountCode: '9100',
    accountType: 'expense',
    category: 'General & Administrative',
    budgetAmount: 5000,
    variancePercent: -15.2, // 15.2% under budget - WARNING
    direction: 'favorable',
  },
  {
    accountName: 'Insurance',
    accountCode: '9200',
    accountType: 'expense',
    category: 'General & Administrative',
    budgetAmount: 32000,
    variancePercent: 3.7, // Normal variance
    direction: 'unfavorable',
  },
  {
    accountName: 'Legal & Professional Fees',
    accountCode: '9300',
    accountType: 'expense',
    category: 'General & Administrative',
    budgetAmount: 28000,
    variancePercent: 21.5, // 21.5% over budget - CRITICAL
    direction: 'unfavorable',
  },
  {
    accountName: 'Travel & Entertainment',
    accountCode: '9400',
    accountType: 'expense',
    category: 'General & Administrative',
    budgetAmount: 22000,
    variancePercent: 13.8, // 13.8% over budget - WARNING
    direction: 'unfavorable',
  },
  {
    accountName: 'Utilities',
    accountCode: '9500',
    accountType: 'expense',
    category: 'General & Administrative',
    budgetAmount: 8000,
    variancePercent: 5.9, // Normal variance
    direction: 'unfavorable',
  },
  {
    accountName: 'Bank Fees',
    accountCode: '9600',
    accountType: 'expense',
    category: 'General & Administrative',
    budgetAmount: 4000,
    variancePercent: -8.2, // Normal variance
    direction: 'favorable',
  },
  {
    accountName: 'Depreciation',
    accountCode: '9700',
    accountType: 'expense',
    category: 'General & Administrative',
    budgetAmount: 18000,
    variancePercent: 1.3, // Normal variance
    direction: 'unfavorable',
  },
];

/**
 * Calculate actual amount based on budget and variance percent
 */
function calculateActualAmount(budgetAmount: number, variancePercent: number): number {
  return Math.round(budgetAmount * (1 + variancePercent / 100));
}

/**
 * Generate test organization data
 */
function generateTestOrganization(index: number) {
  const orgNames = [
    'Acme Corporation',
    'TechStart Innovations',
    'Global Services Inc',
  ];

  // Generate future expiry (1 hour from now)
  const tokenExpiry = new Date();
  tokenExpiry.setHours(tokenExpiry.getHours() + 1);

  return {
    mondayAccountId: 10000000 + index,
    mondayAccountName: orgNames[index] || `Test Organization ${index}`,
    mondayAccessToken: `mock_monday_token_${crypto.randomBytes(16).toString('hex')}`,
    mondayRefreshToken: `mock_monday_refresh_${crypto.randomBytes(16).toString('hex')}`,
    mondayTokenExpiresAt: tokenExpiry,
    mondayUserId: `monday_user_${index}`,
    quickbooksRealmId: `${1234567890 + index}`,
    quickbooksAccessToken: `mock_qb_token_${crypto.randomBytes(16).toString('hex')}`,
    quickbooksRefreshToken: `mock_qb_refresh_${crypto.randomBytes(16).toString('hex')}`,
    quickbooksTokenExpiresAt: tokenExpiry,
    billingEmail: `billing${index === 0 ? '' : index}@${orgNames[index]?.toLowerCase().replace(/\s+/g, '') || 'test'}.com`,
    subscriptionTier: index === 0 ? 'enterprise' : index === 1 ? 'professional' : 'starter',
    subscriptionStatus: 'active',
    active: true,
    settings: {
      thresholds: {
        warning: 10,
        critical: 15,
      },
      notifications: {
        alertEmails: [`cfo@${orgNames[index]?.toLowerCase().replace(/\s+/g, '') || 'test'}.com`],
        frequency: 'immediate',
      },
      preferences: {
        currency: 'USD',
        fiscalYearStart: '01-01',
      },
    },
  };
}

/**
 * Main seed function
 */
async function seedTestData() {
  console.log('🌱 Starting test data seed...\n');

  try {
    // 1. Create test organizations
    console.log('📊 Creating test organizations...');
    const createdOrgs = [];

    for (let i = 0; i < 3; i++) {
      const orgData = generateTestOrganization(i);

      const [org] = await db
        .insert(organizations)
        .values(orgData)
        .onConflictDoNothing() // Skip if already exists
        .returning();

      if (org) {
        createdOrgs.push(org);
        console.log(`  ✅ Created: ${org.mondayAccountName} (${org.id})`);
      } else {
        // If conflict, fetch existing
        const [existing] = await db
          .select()
          .from(organizations)
          .where(eq(organizations.mondayAccountId, orgData.mondayAccountId))
          .limit(1);

        if (existing) {
          createdOrgs.push(existing);
          console.log(`  ℹ️  Exists: ${existing.mondayAccountName} (${existing.id})`);
        }
      }
    }

    if (createdOrgs.length === 0) {
      console.error('❌ No organizations created or found');
      return;
    }

    // Use first organization for detailed test data
    const testOrg = createdOrgs[0];
    console.log(`\n🎯 Using organization: ${testOrg.mondayAccountName}\n`);

    // 2. Create budget items
    console.log('💰 Creating budget items...');
    const period = '2025-10'; // October 2025
    const boardId = 123456789; // Mock Monday board ID

    const createdBudgetItems = [];
    for (const item of budgetData) {
      const [budgetItem] = await db
        .insert(budgetItems)
        .values({
          organizationId: testOrg.id,
          boardId,
          itemId: `budget_${item.accountCode}`,
          accountName: item.accountName,
          accountCode: item.accountCode,
          accountType: item.accountType,
          category: item.category,
          period,
          amount: item.budgetAmount.toString(),
          notes: `Test budget for ${item.accountName}`,
          createdBy: 'test-seed-script',
        })
        .onConflictDoNothing()
        .returning();

      if (budgetItem) {
        createdBudgetItems.push(budgetItem);
      }
    }

    console.log(`  ✅ Created ${createdBudgetItems.length} budget items`);

    // Count by severity
    const criticalCount = budgetData.filter(
      (item) => Math.abs(item.variancePercent) > 15
    ).length;
    const warningCount = budgetData.filter(
      (item) => Math.abs(item.variancePercent) > 10 && Math.abs(item.variancePercent) <= 15
    ).length;
    const normalCount = budgetData.filter(
      (item) => Math.abs(item.variancePercent) <= 10
    ).length;

    console.log(`  📊 Variance distribution:`);
    console.log(`     🚨 Critical (>15%): ${criticalCount}`);
    console.log(`     ⚠️  Warning (10-15%): ${warningCount}`);
    console.log(`     ✅ Normal (<10%): ${normalCount}`);

    // 3. Create actual items
    console.log('\n📈 Creating actual items...');
    const createdActualItems = [];

    for (const item of budgetData) {
      const actualAmount = calculateActualAmount(item.budgetAmount, item.variancePercent);

      const [actualItem] = await db
        .insert(actualItems)
        .values({
          organizationId: testOrg.id,
          quickbooksAccountId: item.accountCode,
          accountName: item.accountName,
          accountCode: item.accountCode,
          accountType: item.accountType,
          category: item.category,
          period,
          amount: actualAmount.toString(),
          transactionCount: Math.floor(Math.random() * 50) + 10, // Random 10-60 transactions
        })
        .onConflictDoUpdate({
          target: [
            actualItems.organizationId,
            actualItems.quickbooksAccountId,
            actualItems.period,
          ],
          set: {
            amount: actualAmount.toString(),
            updatedAt: new Date(),
          },
        })
        .returning();

      if (actualItem) {
        createdActualItems.push(actualItem);
      }
    }

    console.log(`  ✅ Created ${createdActualItems.length} actual items`);

    // 4. Create sample sync logs
    console.log('\n📝 Creating sync logs...');

    const syncTypes = [
      { type: 'quickbooks_sync', status: 'completed', records: 30 },
      { type: 'monday_board_sync', status: 'completed', records: 30 },
      { type: 'variance_calculation', status: 'completed', records: 30 },
      { type: 'alert', status: 'completed', records: criticalCount },
    ];

    for (const sync of syncTypes) {
      await db.insert(syncLogs).values({
        organizationId: testOrg.id,
        syncType: sync.type,
        status: sync.status as 'completed',
        source: 'test-seed-script',
        metadata: {
          recordsProcessed: sync.records,
          period,
          boardId,
          seeded: true,
        },
        syncStartedAt: new Date(),
        syncEndedAt: new Date(),
      });
    }

    console.log(`  ✅ Created ${syncTypes.length} sync log entries`);

    // 5. Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ Test data seed completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`   Organizations: ${createdOrgs.length}`);
    console.log(`   Budget Items: ${createdBudgetItems.length}`);
    console.log(`   Actual Items: ${createdActualItems.length}`);
    console.log(`   Sync Logs: ${syncTypes.length}`);
    console.log('\n🎯 Primary Test Organization:');
    console.log(`   ID: ${testOrg.id}`);
    console.log(`   Name: ${testOrg.mondayAccountName}`);
    console.log(`   Monday Account: ${testOrg.mondayAccountId}`);
    console.log(`   QuickBooks Realm: ${testOrg.quickbooksRealmId}`);
    console.log(`   Email: ${testOrg.billingEmail}`);
    console.log(`   Period: ${period}`);
    console.log(`   Board ID: ${boardId}`);
    console.log('\n💡 You can now test API routes with this data!');
    console.log('   Run: npm run test:api\n');
    console.log('='.repeat(60));
  } catch (error: any) {
    console.error('\n❌ Error seeding test data:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run seed if called directly
if (require.main === module) {
  seedTestData()
    .then(() => {
      console.log('\n✅ Seed script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Seed script failed:', error);
      process.exit(1);
    });
}

export { seedTestData, budgetData, generateTestOrganization };
