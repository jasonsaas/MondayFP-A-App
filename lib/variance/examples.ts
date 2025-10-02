/**
 * Variance Engine Usage Examples
 *
 * Practical examples demonstrating common use cases
 */

import {
  VarianceEngine,
  createVarianceEngine,
  BudgetItem,
  ActualItem,
  generateCacheKey,
  getCachedVariance,
  setCachedVariance,
} from './index';

/**
 * Example 1: Basic Variance Calculation
 */
export async function basicVarianceExample() {
  const engine = new VarianceEngine();

  const budgetItems: BudgetItem[] = [
    {
      accountId: '4000',
      accountName: 'Product Sales',
      accountType: 'revenue',
      amount: 100000,
      period: '2024-01',
    },
    {
      accountId: '5000',
      accountName: 'Salaries & Wages',
      accountType: 'expense',
      amount: 50000,
      period: '2024-01',
    },
    {
      accountId: '5100',
      accountName: 'Rent',
      accountType: 'expense',
      amount: 10000,
      period: '2024-01',
    },
    {
      accountId: '5200',
      accountName: 'Marketing',
      accountType: 'expense',
      amount: 15000,
      period: '2024-01',
    },
  ];

  const actualItems: ActualItem[] = [
    {
      accountId: '4000',
      accountName: 'Product Sales',
      accountType: 'revenue',
      amount: 95000, // $5K under budget - BAD for revenue
      period: '2024-01',
    },
    {
      accountId: '5000',
      accountName: 'Salaries & Wages',
      accountType: 'expense',
      amount: 52000, // $2K over budget - BAD for expenses
      period: '2024-01',
    },
    {
      accountId: '5100',
      accountName: 'Rent',
      accountType: 'expense',
      amount: 10000, // On budget - GOOD
      period: '2024-01',
    },
    {
      accountId: '5200',
      accountName: 'Marketing',
      accountType: 'expense',
      amount: 12000, // $3K under budget - GOOD for expenses
      period: '2024-01',
    },
  ];

  const result = await engine.analyze(budgetItems, actualItems, {
    generateInsights: true,
  });

  console.log('=== Basic Variance Analysis ===');
  console.log(`Period: ${result.period}`);
  console.log(`Total Budget: $${result.totalBudget.toLocaleString()}`);
  console.log(`Total Actual: $${result.totalActual.toLocaleString()}`);
  console.log(`Total Variance: $${result.totalVariance.toLocaleString()}`);
  console.log(`Variance %: ${result.totalVariancePercent.toFixed(2)}%`);
  console.log('\nVariances by Account:');

  result.variances.forEach((v) => {
    console.log(
      `  ${v.accountName}: $${v.variance.toLocaleString()} (${v.variancePercent.toFixed(1)}%) - ${v.severity.toUpperCase()}`
    );
  });

  console.log(`\nInsights: ${result.insights.length} generated`);
  result.insights.forEach((insight, i) => {
    console.log(`  ${i + 1}. [${insight.severity.toUpperCase()}] ${insight.message}`);
    if (insight.recommendation) {
      console.log(`     → ${insight.recommendation}`);
    }
  });

  return result;
}

/**
 * Example 2: Hierarchical Account Structure
 */
export async function hierarchicalVarianceExample() {
  const engine = new VarianceEngine();

  const budgetItems: BudgetItem[] = [
    // Parent: Operating Expenses
    {
      accountId: '5000',
      accountName: 'Operating Expenses',
      accountType: 'expense',
      amount: 0, // Will be calculated from children
      period: '2024-01',
    },
    // Children: Personnel
    {
      accountId: '5100',
      accountName: 'Personnel',
      accountType: 'expense',
      amount: 0,
      period: '2024-01',
      parentAccountId: '5000',
    },
    {
      accountId: '5110',
      accountName: 'Salaries',
      accountType: 'expense',
      amount: 40000,
      period: '2024-01',
      parentAccountId: '5100',
    },
    {
      accountId: '5120',
      accountName: 'Benefits',
      accountType: 'expense',
      amount: 10000,
      period: '2024-01',
      parentAccountId: '5100',
    },
    // Children: Facilities
    {
      accountId: '5200',
      accountName: 'Facilities',
      accountType: 'expense',
      amount: 0,
      period: '2024-01',
      parentAccountId: '5000',
    },
    {
      accountId: '5210',
      accountName: 'Rent',
      accountType: 'expense',
      amount: 15000,
      period: '2024-01',
      parentAccountId: '5200',
    },
    {
      accountId: '5220',
      accountName: 'Utilities',
      accountType: 'expense',
      amount: 3000,
      period: '2024-01',
      parentAccountId: '5200',
    },
  ];

  const actualItems: ActualItem[] = [
    {
      accountId: '5110',
      accountName: 'Salaries',
      accountType: 'expense',
      amount: 42000,
      period: '2024-01',
      parentAccountId: '5100',
    },
    {
      accountId: '5120',
      accountName: 'Benefits',
      accountType: 'expense',
      amount: 9500,
      period: '2024-01',
      parentAccountId: '5100',
    },
    {
      accountId: '5210',
      accountName: 'Rent',
      accountType: 'expense',
      amount: 15000,
      period: '2024-01',
      parentAccountId: '5200',
    },
    {
      accountId: '5220',
      accountName: 'Utilities',
      accountType: 'expense',
      amount: 2800,
      period: '2024-01',
      parentAccountId: '5200',
    },
  ];

  const result = await engine.analyze(budgetItems, actualItems, {
    includeChildren: true,
  });

  console.log('=== Hierarchical Variance Analysis ===');

  function printVarianceTree(variances: any[], indent = 0) {
    variances.forEach((v) => {
      const prefix = '  '.repeat(indent);
      console.log(
        `${prefix}${v.accountName}: $${v.variance.toLocaleString()} (${v.variancePercent.toFixed(1)}%) [${v.severity}]`
      );
      if (v.children && v.children.length > 0) {
        printVarianceTree(v.children, indent + 1);
      }
    });
  }

  printVarianceTree(result.variances);

  return result;
}

/**
 * Example 3: Custom Thresholds for Different Business Units
 */
export async function customThresholdsExample() {
  // Conservative thresholds for established business unit
  const conservativeEngine = createVarianceEngine({
    thresholds: {
      critical: 10, // 10% is critical
      warning: 5, // 5% is warning
      favorable: -3,
    },
  });

  // Aggressive thresholds for startup/growth phase
  const aggressiveEngine = createVarianceEngine({
    thresholds: {
      critical: 25, // 25% is critical
      warning: 15, // 15% is warning
      favorable: -10,
    },
  });

  const budgetItems: BudgetItem[] = [
    {
      accountId: '1',
      accountName: 'Marketing',
      accountType: 'expense',
      amount: 10000,
      period: '2024-01',
    },
  ];

  const actualItems: ActualItem[] = [
    {
      accountId: '1',
      accountName: 'Marketing',
      accountType: 'expense',
      amount: 12000, // 20% over budget
      period: '2024-01',
    },
  ];

  const conservativeResult = await conservativeEngine.analyze(
    budgetItems,
    actualItems
  );
  const aggressiveResult = await aggressiveEngine.analyze(budgetItems, actualItems);

  console.log('=== Custom Thresholds Example ===');
  console.log(
    `Conservative Engine (10%/5% thresholds): ${conservativeResult.variances[0].severity}`
  );
  console.log(
    `Aggressive Engine (25%/15% thresholds): ${aggressiveResult.variances[0].severity}`
  );

  return { conservativeResult, aggressiveResult };
}

/**
 * Example 4: Edge Cases - Division by Zero, Missing Data
 */
export async function edgeCasesExample() {
  const engine = new VarianceEngine();

  const budgetItems: BudgetItem[] = [
    // Case 1: Zero budget
    {
      accountId: '1',
      accountName: 'New Product Line (Zero Budget)',
      accountType: 'revenue',
      amount: 0,
      period: '2024-01',
    },
    // Case 2: Normal budget
    {
      accountId: '2',
      accountName: 'Existing Product',
      accountType: 'revenue',
      amount: 50000,
      period: '2024-01',
    },
    // Case 3: Will have no actual data
    {
      accountId: '3',
      accountName: 'Planned but Not Started',
      accountType: 'expense',
      amount: 10000,
      period: '2024-01',
    },
  ];

  const actualItems: ActualItem[] = [
    // Case 1: Actual revenue on zero budget
    {
      accountId: '1',
      accountName: 'New Product Line (Zero Budget)',
      accountType: 'revenue',
      amount: 5000, // Surprise revenue!
      period: '2024-01',
    },
    // Case 2: Normal actual
    {
      accountId: '2',
      accountName: 'Existing Product',
      accountType: 'revenue',
      amount: 48000,
      period: '2024-01',
    },
    // Case 3: No actual data (missing from array)
  ];

  const result = await engine.analyze(budgetItems, actualItems);

  console.log('=== Edge Cases Example ===');
  result.variances.forEach((v) => {
    console.log(`\n${v.accountName}:`);
    console.log(`  Budget: $${v.budget.toLocaleString()}`);
    console.log(`  Actual: $${v.actual.toLocaleString()}`);
    console.log(`  Variance: $${v.variance.toLocaleString()}`);
    console.log(
      `  Variance %: ${v.variancePercent === Infinity ? 'N/A' : v.variancePercent.toFixed(1) + '%'}`
    );
    console.log(`  Severity: ${v.severity}`);
  });

  return result;
}

/**
 * Example 5: Caching for Performance
 */
export async function cachingExample() {
  const engine = new VarianceEngine();
  const organizationId = 'org-123';
  const boardId = '456';
  const period = '2024-01';

  const budgetItems: BudgetItem[] = [
    {
      accountId: '1',
      accountName: 'Sales',
      accountType: 'revenue',
      amount: 100000,
      period,
    },
  ];

  const actualItems: ActualItem[] = [
    {
      accountId: '1',
      accountName: 'Sales',
      accountType: 'revenue',
      amount: 95000,
      period,
    },
  ];

  console.log('=== Caching Example ===');

  // First call - calculate and cache
  console.log('First call (no cache)...');
  const cacheKey = generateCacheKey(organizationId, boardId, period);
  const startTime1 = Date.now();

  let cached = await getCachedVariance(cacheKey);
  if (!cached) {
    const result = await engine.analyze(budgetItems, actualItems);
    await setCachedVariance(cacheKey, result);
    console.log(`  Calculated in ${Date.now() - startTime1}ms`);
  }

  // Second call - use cache
  console.log('Second call (with cache)...');
  const startTime2 = Date.now();
  cached = await getCachedVariance(cacheKey);
  if (cached) {
    console.log(`  Retrieved from cache in ${Date.now() - startTime2}ms`);
    console.log(`  Variance: $${cached.totalVariance.toLocaleString()}`);
  }

  return cached;
}

/**
 * Example 6: Trend Analysis
 */
export async function trendAnalysisExample() {
  const engine = new VarianceEngine();

  const historical = [
    {
      period: '2023-10',
      budget: 10000,
      actual: 12000,
      variance: 2000,
      variancePercent: 20,
    },
    {
      period: '2023-11',
      budget: 10000,
      actual: 11500,
      variance: 1500,
      variancePercent: 15,
    },
    {
      period: '2023-12',
      budget: 10000,
      actual: 11000,
      variance: 1000,
      variancePercent: 10,
    },
    {
      period: '2024-01',
      budget: 10000,
      actual: 10500,
      variance: 500,
      variancePercent: 5,
    },
  ];

  const trend = engine.calculateTrend(historical);

  console.log('=== Trend Analysis Example ===');
  console.log(`Trend Direction: ${trend?.direction}`);
  console.log(`Average Variance: ${trend?.averageVariance.toFixed(2)}%`);
  console.log(`Volatility: ${trend?.volatility.toFixed(2)}%`);
  console.log('\nPeriod-by-Period:');
  trend?.periods.forEach((p) => {
    console.log(`  ${p.period}: ${p.variancePercent.toFixed(1)}%`);
  });

  return trend;
}

/**
 * Example 7: Revenue vs Expense Logic
 */
export async function revenueVsExpenseExample() {
  const engine = new VarianceEngine();

  const budgetItems: BudgetItem[] = [
    {
      accountId: '1',
      accountName: 'Revenue Account',
      accountType: 'revenue',
      amount: 100000,
      period: '2024-01',
    },
    {
      accountId: '2',
      accountName: 'Expense Account',
      accountType: 'expense',
      amount: 50000,
      period: '2024-01',
    },
  ];

  // Scenario 1: Both 20% over
  const scenario1Actuals: ActualItem[] = [
    { accountId: '1', accountName: 'Revenue Account', accountType: 'revenue', amount: 120000, period: '2024-01' },
    { accountId: '2', accountName: 'Expense Account', accountType: 'expense', amount: 60000, period: '2024-01' },
  ];

  // Scenario 2: Both 20% under
  const scenario2Actuals: ActualItem[] = [
    { accountId: '1', accountName: 'Revenue Account', accountType: 'revenue', amount: 80000, period: '2024-01' },
    { accountId: '2', accountName: 'Expense Account', accountType: 'expense', amount: 40000, period: '2024-01' },
  ];

  const result1 = await engine.analyze(budgetItems, scenario1Actuals);
  const result2 = await engine.analyze(budgetItems, scenario2Actuals);

  console.log('=== Revenue vs Expense Logic Example ===');
  console.log('\nScenario 1: Both 20% OVER budget');
  console.log(
    `  Revenue (+20%): ${result1.variances[0].severity} (${result1.variances[0].direction})`
  );
  console.log(
    `  Expense (+20%): ${result1.variances[1].severity} (${result1.variances[1].direction})`
  );

  console.log('\nScenario 2: Both 20% UNDER budget');
  console.log(
    `  Revenue (-20%): ${result2.variances[0].severity} (${result2.variances[0].direction})`
  );
  console.log(
    `  Expense (-20%): ${result2.variances[1].severity} (${result2.variances[1].direction})`
  );

  return { result1, result2 };
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  console.log('🚀 Running Variance Engine Examples\n');

  await basicVarianceExample();
  console.log('\n---\n');

  await hierarchicalVarianceExample();
  console.log('\n---\n');

  await customThresholdsExample();
  console.log('\n---\n');

  await edgeCasesExample();
  console.log('\n---\n');

  await cachingExample();
  console.log('\n---\n');

  await trendAnalysisExample();
  console.log('\n---\n');

  await revenueVsExpenseExample();

  console.log('\n✅ All examples completed!');
}

// Run examples if executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}
