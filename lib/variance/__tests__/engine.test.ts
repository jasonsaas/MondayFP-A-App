/**
 * Variance Engine Tests
 *
 * Comprehensive test suite covering edge cases and business logic
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { VarianceEngine } from '../engine';
import { BudgetItem, ActualItem, AccountType } from '../types';

describe('VarianceEngine', () => {
  let engine: VarianceEngine;

  beforeEach(() => {
    engine = new VarianceEngine();
  });

  describe('calculateVariance', () => {
    it('should calculate basic variance correctly', () => {
      const result = engine.calculateVariance(1000, 1200, 'expense');

      expect(result.variance).toBe(200);
      expect(result.variancePercent).toBe(20);
      expect(result.direction).toBe('over');
    });

    it('should handle zero budget (division by zero)', () => {
      const result = engine.calculateVariance(0, 500, 'expense');

      expect(result.variance).toBe(500);
      expect(result.variancePercent).toBe(100);
      expect(result.direction).toBe('over');
    });

    it('should handle zero budget and zero actual', () => {
      const result = engine.calculateVariance(0, 0, 'expense');

      expect(result.variance).toBe(0);
      expect(result.variancePercent).toBe(0);
      expect(result.direction).toBe('on_target');
    });

    it('should handle negative budget', () => {
      const result = engine.calculateVariance(-1000, -800, 'revenue');

      expect(result.variance).toBe(200);
      expect(result.variancePercent).toBe(20); // Based on absolute value
      expect(result.direction).toBe('over');
    });

    it('should handle negative actual', () => {
      const result = engine.calculateVariance(1000, -500, 'expense');

      expect(result.variance).toBe(-1500);
      expect(result.variancePercent).toBe(-150);
      expect(result.direction).toBe('under');
    });

    it('should identify on_target when within 0.5%', () => {
      const result = engine.calculateVariance(10000, 10040, 'expense');

      expect(result.variancePercent).toBe(0.4);
      expect(result.direction).toBe('on_target');
    });

    it('should handle very large numbers', () => {
      const result = engine.calculateVariance(
        1000000000,
        1200000000,
        'expense'
      );

      expect(result.variance).toBe(200000000);
      expect(result.variancePercent).toBe(20);
    });

    it('should handle very small numbers', () => {
      const result = engine.calculateVariance(0.01, 0.02, 'expense');

      expect(result.variance).toBe(0.01);
      expect(result.variancePercent).toBe(100);
    });
  });

  describe('analyzeVarianceSeverity', () => {
    describe('Expense accounts', () => {
      it('should mark critical when over 15%', () => {
        const severity = engine.analyzeVarianceSeverity(
          20,
          'expense',
          'over'
        );
        expect(severity).toBe('critical');
      });

      it('should mark warning when over 10%', () => {
        const severity = engine.analyzeVarianceSeverity(
          12,
          'expense',
          'over'
        );
        expect(severity).toBe('warning');
      });

      it('should mark normal when under 10%', () => {
        const severity = engine.analyzeVarianceSeverity(
          5,
          'expense',
          'over'
        );
        expect(severity).toBe('normal');
      });

      it('should mark favorable when under budget by 5%', () => {
        const severity = engine.analyzeVarianceSeverity(
          -8,
          'expense',
          'under'
        );
        expect(severity).toBe('favorable');
      });

      it('should mark normal when on target', () => {
        const severity = engine.analyzeVarianceSeverity(
          0.3,
          'expense',
          'on_target'
        );
        expect(severity).toBe('normal');
      });
    });

    describe('Revenue accounts', () => {
      it('should mark critical when under by 15%', () => {
        const severity = engine.analyzeVarianceSeverity(
          -20,
          'revenue',
          'under'
        );
        expect(severity).toBe('critical');
      });

      it('should mark warning when under by 10%', () => {
        const severity = engine.analyzeVarianceSeverity(
          -12,
          'revenue',
          'under'
        );
        expect(severity).toBe('warning');
      });

      it('should mark favorable when over budget', () => {
        const severity = engine.analyzeVarianceSeverity(
          8,
          'revenue',
          'over'
        );
        expect(severity).toBe('favorable');
      });

      it('should mark normal for small positive variance', () => {
        const severity = engine.analyzeVarianceSeverity(
          3,
          'revenue',
          'over'
        );
        expect(severity).toBe('normal');
      });
    });

    describe('Asset accounts', () => {
      it('should apply same logic as expense accounts', () => {
        const severity = engine.analyzeVarianceSeverity(
          20,
          'asset',
          'over'
        );
        expect(severity).toBe('critical');
      });
    });
  });

  describe('buildVarianceTree', () => {
    const budgetItems: BudgetItem[] = [
      {
        accountId: '1',
        accountName: 'Salaries',
        accountType: 'expense',
        amount: 10000,
        period: '2024-01',
      },
      {
        accountId: '2',
        accountName: 'Rent',
        accountType: 'expense',
        amount: 5000,
        period: '2024-01',
      },
      {
        accountId: '3',
        accountName: 'Revenue',
        accountType: 'revenue',
        amount: 50000,
        period: '2024-01',
      },
    ];

    const actualItems: ActualItem[] = [
      {
        accountId: '1',
        accountName: 'Salaries',
        accountType: 'expense',
        amount: 12000,
        period: '2024-01',
      },
      {
        accountId: '2',
        accountName: 'Rent',
        accountType: 'expense',
        amount: 4500,
        period: '2024-01',
      },
      {
        accountId: '3',
        accountName: 'Revenue',
        accountType: 'revenue',
        amount: 45000,
        period: '2024-01',
      },
    ];

    it('should build flat variance list', () => {
      const variances = engine.buildVarianceTree(budgetItems, actualItems);

      expect(variances).toHaveLength(3);
      expect(variances[0].variance).toBe(2000); // Salaries over
      expect(variances[1].variance).toBe(-500); // Rent under
      expect(variances[2].variance).toBe(-5000); // Revenue under
    });

    it('should handle missing actual data', () => {
      const partialActuals: ActualItem[] = [
        {
          accountId: '1',
          accountName: 'Salaries',
          accountType: 'expense',
          amount: 12000,
          period: '2024-01',
        },
      ];

      const variances = engine.buildVarianceTree(budgetItems, partialActuals);

      expect(variances).toHaveLength(3);
      expect(variances[1].actual).toBe(0); // Rent has no actual
      expect(variances[1].variance).toBe(-5000); // Full budget variance
    });

    it('should handle missing budget data', () => {
      const partialBudgets: BudgetItem[] = [
        {
          accountId: '1',
          accountName: 'Salaries',
          accountType: 'expense',
          amount: 10000,
          period: '2024-01',
        },
      ];

      const variances = engine.buildVarianceTree(partialBudgets, actualItems);

      expect(variances).toHaveLength(3);
      expect(variances.find((v) => v.accountId === '2')?.budget).toBe(0);
    });

    it('should exclude zero variances when option is set', () => {
      const budgets: BudgetItem[] = [
        {
          accountId: '1',
          accountName: 'Item 1',
          accountType: 'expense',
          amount: 1000,
          period: '2024-01',
        },
        {
          accountId: '2',
          accountName: 'Item 2',
          accountType: 'expense',
          amount: 0,
          period: '2024-01',
        },
      ];

      const actuals: ActualItem[] = [
        {
          accountId: '1',
          accountName: 'Item 1',
          accountType: 'expense',
          amount: 1200,
          period: '2024-01',
        },
        {
          accountId: '2',
          accountName: 'Item 2',
          accountType: 'expense',
          amount: 0,
          period: '2024-01',
        },
      ];

      const variances = engine.buildVarianceTree(budgets, actuals, {
        includeZeroVariances: false,
      });

      expect(variances).toHaveLength(1);
      expect(variances[0].accountId).toBe('1');
    });

    it('should build hierarchical tree when option is set', () => {
      const budgets: BudgetItem[] = [
        {
          accountId: 'parent',
          accountName: 'Total Expenses',
          accountType: 'expense',
          amount: 0, // Parent total calculated from children
          period: '2024-01',
        },
        {
          accountId: 'child1',
          accountName: 'Salaries',
          accountType: 'expense',
          amount: 10000,
          period: '2024-01',
          parentAccountId: 'parent',
        },
        {
          accountId: 'child2',
          accountName: 'Rent',
          accountType: 'expense',
          amount: 5000,
          period: '2024-01',
          parentAccountId: 'parent',
        },
      ];

      const actuals: ActualItem[] = [
        {
          accountId: 'child1',
          accountName: 'Salaries',
          accountType: 'expense',
          amount: 12000,
          period: '2024-01',
          parentAccountId: 'parent',
        },
        {
          accountId: 'child2',
          accountName: 'Rent',
          accountType: 'expense',
          amount: 4500,
          period: '2024-01',
          parentAccountId: 'parent',
        },
      ];

      const variances = engine.buildVarianceTree(budgets, actuals, {
        includeChildren: true,
      });

      expect(variances).toHaveLength(1); // Only root parent
      expect(variances[0].accountId).toBe('parent');
      expect(variances[0].children).toHaveLength(2);
      expect(variances[0].budget).toBe(15000); // Sum of children
      expect(variances[0].actual).toBe(16500); // Sum of children
      expect(variances[0].variance).toBe(1500);
    });
  });

  describe('generateInsights', () => {
    it('should generate insights for critical expense overruns', () => {
      const variances = engine.buildVarianceTree(
        [
          {
            accountId: '1',
            accountName: 'Marketing',
            accountType: 'expense',
            amount: 10000,
            period: '2024-01',
          },
        ],
        [
          {
            accountId: '1',
            accountName: 'Marketing',
            accountType: 'expense',
            amount: 13000,
            period: '2024-01',
          },
        ]
      );

      const insights = engine.generateInsights(variances);

      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0].severity).toBe('critical');
      expect(insights[0].message).toContain('over budget');
      expect(insights[0].recommendation).toBeTruthy();
    });

    it('should generate insights for critical revenue shortfalls', () => {
      const variances = engine.buildVarianceTree(
        [
          {
            accountId: '1',
            accountName: 'Product Sales',
            accountType: 'revenue',
            amount: 100000,
            period: '2024-01',
          },
        ],
        [
          {
            accountId: '1',
            accountName: 'Product Sales',
            accountType: 'revenue',
            amount: 80000,
            period: '2024-01',
          },
        ]
      );

      const insights = engine.generateInsights(variances);

      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0].severity).toBe('critical');
      expect(insights[0].message).toContain('below budget');
      expect(insights[0].recommendation).toContain('revenue');
    });

    it('should not generate insights for normal variances', () => {
      const variances = engine.buildVarianceTree(
        [
          {
            accountId: '1',
            accountName: 'Office Supplies',
            accountType: 'expense',
            amount: 1000,
            period: '2024-01',
          },
        ],
        [
          {
            accountId: '1',
            accountName: 'Office Supplies',
            accountType: 'expense',
            amount: 1050,
            period: '2024-01',
          },
        ]
      );

      const insights = engine.generateInsights(variances);

      const accountInsights = insights.filter((i) => i.accountId === '1');
      expect(accountInsights).toHaveLength(0);
    });

    it('should generate aggregate insights for systematic issues', () => {
      const budgets: BudgetItem[] = [];
      const actuals: ActualItem[] = [];

      // Create 5 critical variances
      for (let i = 1; i <= 5; i++) {
        budgets.push({
          accountId: `${i}`,
          accountName: `Account ${i}`,
          accountType: 'expense',
          amount: 10000,
          period: '2024-01',
        });
        actuals.push({
          accountId: `${i}`,
          accountName: `Account ${i}`,
          accountType: 'expense',
          amount: 13000,
          period: '2024-01',
        });
      }

      const variances = engine.buildVarianceTree(budgets, actuals);
      const insights = engine.generateInsights(variances);

      const systematicInsight = insights.find(
        (i) => i.accountId === 'systematic'
      );
      expect(systematicInsight).toBeTruthy();
      expect(systematicInsight?.severity).toBe('critical');
    });
  });

  describe('analyze', () => {
    it('should perform complete analysis', async () => {
      const budgets: BudgetItem[] = [
        {
          accountId: '1',
          accountName: 'Salaries',
          accountType: 'expense',
          amount: 10000,
          period: '2024-01',
        },
        {
          accountId: '2',
          accountName: 'Revenue',
          accountType: 'revenue',
          amount: 50000,
          period: '2024-01',
        },
      ];

      const actuals: ActualItem[] = [
        {
          accountId: '1',
          accountName: 'Salaries',
          accountType: 'expense',
          amount: 12000,
          period: '2024-01',
        },
        {
          accountId: '2',
          accountName: 'Revenue',
          accountType: 'revenue',
          amount: 45000,
          period: '2024-01',
        },
      ];

      const result = await engine.analyze(budgets, actuals);

      expect(result.period).toBe('2024-01');
      expect(result.totalBudget).toBe(60000);
      expect(result.totalActual).toBe(57000);
      expect(result.variances).toHaveLength(2);
      expect(result.insights.length).toBeGreaterThan(0);
      expect(result.summary.criticalCount).toBeGreaterThanOrEqual(0);
      expect(result.generatedAt).toBeInstanceOf(Date);
    });

    it('should throw error when budget items are missing', async () => {
      await expect(
        engine.analyze([], [])
      ).rejects.toThrow('Budget items are required');
    });

    it('should handle empty actuals gracefully', async () => {
      const budgets: BudgetItem[] = [
        {
          accountId: '1',
          accountName: 'Item',
          accountType: 'expense',
          amount: 1000,
          period: '2024-01',
        },
      ];

      const result = await engine.analyze(budgets, []);

      expect(result.variances).toHaveLength(1);
      expect(result.variances[0].actual).toBe(0);
    });
  });

  describe('calculateTrend', () => {
    it('should calculate improving trend', () => {
      const historical = [
        { period: '2024-01', budget: 1000, actual: 1200, variance: 200, variancePercent: 20 },
        { period: '2024-02', budget: 1000, actual: 1150, variance: 150, variancePercent: 15 },
        { period: '2024-03', budget: 1000, actual: 1100, variance: 100, variancePercent: 10 },
      ];

      const trend = engine.calculateTrend(historical);

      expect(trend).toBeTruthy();
      expect(trend?.direction).toBe('improving');
    });

    it('should calculate declining trend', () => {
      const historical = [
        { period: '2024-01', budget: 1000, actual: 1100, variance: 100, variancePercent: 10 },
        { period: '2024-02', budget: 1000, actual: 1150, variance: 150, variancePercent: 15 },
        { period: '2024-03', budget: 1000, actual: 1200, variance: 200, variancePercent: 20 },
      ];

      const trend = engine.calculateTrend(historical);

      expect(trend).toBeTruthy();
      expect(trend?.direction).toBe('declining');
    });

    it('should calculate stable trend', () => {
      const historical = [
        { period: '2024-01', budget: 1000, actual: 1100, variance: 100, variancePercent: 10 },
        { period: '2024-02', budget: 1000, actual: 1105, variance: 105, variancePercent: 10.5 },
        { period: '2024-03', budget: 1000, actual: 1095, variance: 95, variancePercent: 9.5 },
      ];

      const trend = engine.calculateTrend(historical);

      expect(trend).toBeTruthy();
      expect(trend?.direction).toBe('stable');
    });

    it('should return undefined for insufficient data', () => {
      const historical = [
        { period: '2024-01', budget: 1000, actual: 1100, variance: 100, variancePercent: 10 },
      ];

      const trend = engine.calculateTrend(historical);

      expect(trend).toBeUndefined();
    });

    it('should calculate volatility', () => {
      const historical = [
        { period: '2024-01', budget: 1000, actual: 1100, variance: 100, variancePercent: 10 },
        { period: '2024-02', budget: 1000, actual: 1300, variance: 300, variancePercent: 30 },
        { period: '2024-03', budget: 1000, actual: 1050, variance: 50, variancePercent: 5 },
      ];

      const trend = engine.calculateTrend(historical);

      expect(trend).toBeTruthy();
      expect(trend?.volatility).toBeGreaterThan(0);
    });
  });
});
