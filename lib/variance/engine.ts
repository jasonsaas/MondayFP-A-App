/**
 * Variance Analysis Engine
 *
 * Production-ready financial variance calculation and analysis engine
 * Handles budget vs actual comparisons with hierarchical account support
 */

import {
  AccountType,
  VarianceSeverity,
  VarianceDirection,
  BudgetItem,
  ActualItem,
  VarianceCalculation,
  VarianceInsight,
  VarianceAnalysisResult,
  VarianceEngineOptions,
  VarianceThresholds,
  HistoricalVariance,
  VarianceTrend,
  DEFAULT_THRESHOLDS,
  ACCOUNT_TYPE_MULTIPLIERS,
  VarianceCalculationError,
} from './types';

export class VarianceEngine {
  private thresholds: VarianceThresholds;

  constructor(options?: VarianceEngineOptions) {
    this.thresholds = options?.thresholds || DEFAULT_THRESHOLDS;
  }

  /**
   * Calculate variance between budget and actual
   * Handles edge cases: zero budget, missing data, etc.
   */
  calculateVariance(
    budget: number,
    actual: number,
    accountType: AccountType
  ): {
    variance: number;
    variancePercent: number;
    direction: VarianceDirection;
  } {
    // Handle edge case: both zero
    if (budget === 0 && actual === 0) {
      return {
        variance: 0,
        variancePercent: 0,
        direction: 'on_target',
      };
    }

    // Calculate dollar variance
    const variance = actual - budget;

    // Handle edge case: zero budget (division by zero)
    let variancePercent: number;
    if (budget === 0) {
      // If budget is zero but actual exists, it's 100% variance
      variancePercent = actual !== 0 ? (actual > 0 ? 100 : -100) : 0;
    } else {
      variancePercent = (variance / Math.abs(budget)) * 100;
    }

    // Determine direction
    let direction: VarianceDirection;
    if (Math.abs(variancePercent) < 0.5) {
      // Within 0.5% is considered on target
      direction = 'on_target';
    } else if (variance > 0) {
      direction = 'over';
    } else {
      direction = 'under';
    }

    return { variance, variancePercent, direction };
  }

  /**
   * Analyze variance severity based on percentage and account type
   * Revenue: negative variance is bad
   * Expense: positive variance is bad
   */
  analyzeVarianceSeverity(
    variancePercent: number,
    accountType: AccountType,
    direction: VarianceDirection
  ): VarianceSeverity {
    if (direction === 'on_target') {
      return 'normal';
    }

    // Apply account type multiplier to normalize variance
    // For revenue, we flip the sign so negative variance becomes positive (bad)
    // For expense, positive variance stays positive (bad)
    const multiplier = ACCOUNT_TYPE_MULTIPLIERS[accountType];
    const normalizedVariance = variancePercent * multiplier;

    // Check if favorable (under budget for expenses, over budget for revenue)
    if (normalizedVariance <= this.thresholds.favorable) {
      return 'favorable';
    }

    // Check severity thresholds
    const absVariance = Math.abs(normalizedVariance);

    if (absVariance >= this.thresholds.critical) {
      return 'critical';
    }

    if (absVariance >= this.thresholds.warning) {
      return 'warning';
    }

    return 'normal';
  }

  /**
   * Generate AI-powered insights for variances
   * Analyzes patterns and provides actionable recommendations
   */
  generateInsights(
    variances: VarianceCalculation[],
    options?: { includeNormal?: boolean }
  ): VarianceInsight[] {
    const insights: VarianceInsight[] = [];

    // Filter to critical and warning variances (unless includeNormal is true)
    const significantVariances = options?.includeNormal
      ? variances
      : variances.filter(
          (v) => v.severity === 'critical' || v.severity === 'warning'
        );

    for (const variance of significantVariances) {
      const insight = this.generateSingleInsight(variance);
      if (insight) {
        insights.push(insight);
      }
    }

    // Add aggregate insights
    const aggregateInsights = this.generateAggregateInsights(variances);
    insights.push(...aggregateInsights);

    return insights;
  }

  /**
   * Generate insight for a single variance
   */
  private generateSingleInsight(
    variance: VarianceCalculation
  ): VarianceInsight | null {
    const { accountType, variancePercent, variance: dollarVariance, severity } = variance;

    if (severity === 'normal' || severity === 'favorable') {
      return null;
    }

    let message = '';
    let recommendation = '';
    let confidence: 'high' | 'medium' | 'low' = 'medium';

    // Revenue variances
    if (accountType === 'revenue') {
      if (dollarVariance < 0) {
        message = `${variance.accountName} is ${Math.abs(variancePercent).toFixed(1)}% below budget (${this.formatCurrency(Math.abs(dollarVariance))} shortfall).`;

        if (severity === 'critical') {
          recommendation = 'Urgent: Review revenue pipeline, pricing strategy, and sales performance. Consider cost reduction measures if revenue shortfall persists.';
          confidence = 'high';
        } else {
          recommendation = 'Monitor closely. Review sales forecasts and identify any temporary factors affecting revenue.';
          confidence = 'medium';
        }
      } else {
        message = `${variance.accountName} is ${variancePercent.toFixed(1)}% above budget (${this.formatCurrency(dollarVariance)} surplus).`;
        recommendation = 'Favorable variance. Analyze contributing factors and consider if this is sustainable for future budgeting.';
        confidence = 'medium';
      }
    }

    // Expense variances
    if (accountType === 'expense') {
      if (dollarVariance > 0) {
        message = `${variance.accountName} is ${variancePercent.toFixed(1)}% over budget (${this.formatCurrency(dollarVariance)} overspend).`;

        if (severity === 'critical') {
          recommendation = 'Critical overspend. Immediately review spending approvals, identify unauthorized expenses, and implement cost controls.';
          confidence = 'high';
        } else {
          recommendation = 'Review expense drivers and ensure proper authorization for additional spending.';
          confidence = 'medium';
        }

        // Pattern-based insights
        if (variance.trend?.direction === 'declining') {
          recommendation += ' Trend shows worsening variance - take corrective action soon.';
          confidence = 'high';
        }
      } else {
        message = `${variance.accountName} is ${Math.abs(variancePercent).toFixed(1)}% under budget (${this.formatCurrency(Math.abs(dollarVariance))} savings).`;
        recommendation = 'Favorable variance. Verify service levels are being maintained and no critical spending was deferred.';
        confidence = 'low';
      }
    }

    // Asset variances
    if (accountType === 'asset') {
      if (dollarVariance < 0) {
        message = `${variance.accountName} is ${Math.abs(variancePercent).toFixed(1)}% below expected levels.`;
        recommendation = 'Review asset utilization and potential impairment. Verify accuracy of asset values.';
      } else {
        message = `${variance.accountName} is ${variancePercent.toFixed(1)}% above expected levels.`;
        recommendation = 'Review recent asset acquisitions and ensure proper capitalization policies.';
      }
    }

    return {
      accountId: variance.accountId,
      accountName: variance.accountName,
      severity,
      message,
      recommendation,
      impact: Math.abs(dollarVariance),
      confidence,
    };
  }

  /**
   * Generate aggregate insights across all variances
   */
  private generateAggregateInsights(
    variances: VarianceCalculation[]
  ): VarianceInsight[] {
    const insights: VarianceInsight[] = [];

    // Calculate totals by type
    const revenueVariances = variances.filter((v) => v.accountType === 'revenue');
    const expenseVariances = variances.filter((v) => v.accountType === 'expense');

    const totalRevenueVariance = revenueVariances.reduce((sum, v) => sum + v.variance, 0);
    const totalExpenseVariance = expenseVariances.reduce((sum, v) => sum + v.variance, 0);

    // Net impact insight
    const netImpact = totalRevenueVariance - totalExpenseVariance;

    if (Math.abs(netImpact) > 1000) {
      const isPositive = netImpact > 0;
      insights.push({
        accountId: 'aggregate',
        accountName: 'Overall Financial Performance',
        severity: Math.abs(netImpact) > 50000 ? 'critical' : 'warning',
        message: `Net financial variance is ${this.formatCurrency(Math.abs(netImpact))} ${isPositive ? 'favorable' : 'unfavorable'}.`,
        recommendation: isPositive
          ? 'Strong performance. Consider reinvesting surplus or adjusting future budgets.'
          : 'Negative net variance. Priority areas: ' +
            this.identifyTopVariances(variances, 3).join(', '),
        impact: Math.abs(netImpact),
        confidence: 'high',
      });
    }

    // Identify systematic issues
    const criticalCount = variances.filter((v) => v.severity === 'critical').length;
    if (criticalCount >= 3) {
      insights.push({
        accountId: 'systematic',
        accountName: 'Systematic Variance Issues',
        severity: 'critical',
        message: `${criticalCount} accounts show critical variances, suggesting systematic budgeting or operational issues.`,
        recommendation: 'Conduct comprehensive budget review. Evaluate forecasting methodology and underlying business assumptions.',
        impact: variances
          .filter((v) => v.severity === 'critical')
          .reduce((sum, v) => sum + Math.abs(v.variance), 0),
        confidence: 'high',
      });
    }

    return insights;
  }

  /**
   * Build hierarchical variance tree from flat items
   */
  buildVarianceTree(
    budgetItems: BudgetItem[],
    actualItems: ActualItem[],
    options?: VarianceEngineOptions
  ): VarianceCalculation[] {
    // Create lookup maps
    const budgetMap = new Map<string, BudgetItem>(
      budgetItems.map((item) => [item.accountId, item])
    );
    const actualMap = new Map<string, ActualItem>(
      actualItems.map((item) => [item.accountId, item])
    );

    // Get all unique account IDs
    const allAccountIds = new Set([
      ...budgetItems.map((b) => b.accountId),
      ...actualItems.map((a) => a.accountId),
    ]);

    // Calculate variances for all accounts
    const flatVariances: VarianceCalculation[] = [];

    for (const accountId of allAccountIds) {
      const budgetItem = budgetMap.get(accountId);
      const actualItem = actualMap.get(accountId);

      // Skip if both are missing (shouldn't happen)
      if (!budgetItem && !actualItem) continue;

      const accountName = budgetItem?.accountName || actualItem?.accountName || 'Unknown';
      const accountType = budgetItem?.accountType || actualItem?.accountType || 'expense';
      const accountCode = budgetItem?.accountCode || actualItem?.accountCode;
      const parentAccountId = budgetItem?.parentAccountId || actualItem?.parentAccountId;
      const period = budgetItem?.period || actualItem?.period || '';

      const budget = budgetItem?.amount || 0;
      const actual = actualItem?.amount || 0;

      // Skip zero variances if option is set
      if (!options?.includeZeroVariances && budget === 0 && actual === 0) {
        continue;
      }

      const { variance, variancePercent, direction } = this.calculateVariance(
        budget,
        actual,
        accountType
      );

      const severity = this.analyzeVarianceSeverity(
        variancePercent,
        accountType,
        direction
      );

      flatVariances.push({
        accountId,
        accountName,
        accountCode,
        accountType,
        period,
        budget,
        actual,
        variance,
        variancePercent,
        severity,
        direction,
        parentAccountId,
        level: 0, // Will be calculated when building hierarchy
        children: [],
      });
    }

    // Build hierarchy if requested
    if (options?.includeChildren) {
      return this.buildHierarchy(flatVariances);
    }

    return flatVariances;
  }

  /**
   * Build hierarchical structure from flat variance list
   */
  private buildHierarchy(
    flatVariances: VarianceCalculation[]
  ): VarianceCalculation[] {
    const varianceMap = new Map<string, VarianceCalculation>(
      flatVariances.map((v) => [v.accountId, { ...v, children: [] }])
    );

    const rootVariances: VarianceCalculation[] = [];

    for (const variance of varianceMap.values()) {
      if (!variance.parentAccountId) {
        // Root level account
        variance.level = 0;
        rootVariances.push(variance);
      } else {
        // Child account - attach to parent
        const parent = varianceMap.get(variance.parentAccountId);
        if (parent) {
          variance.level = (parent.level || 0) + 1;
          parent.children = parent.children || [];
          parent.children.push(variance);

          // Update parent totals
          parent.budget += variance.budget;
          parent.actual += variance.actual;
          parent.variance += variance.variance;

          // Recalculate parent variance percentage
          if (parent.budget !== 0) {
            parent.variancePercent = (parent.variance / Math.abs(parent.budget)) * 100;
          }

          // Recalculate parent severity
          const { direction } = this.calculateVariance(
            parent.budget,
            parent.actual,
            parent.accountType
          );
          parent.severity = this.analyzeVarianceSeverity(
            parent.variancePercent,
            parent.accountType,
            direction
          );
        } else {
          // Parent not found, treat as root
          variance.level = 0;
          rootVariances.push(variance);
        }
      }
    }

    return rootVariances;
  }

  /**
   * Calculate trend from historical variances
   */
  calculateTrend(historical: HistoricalVariance[]): VarianceTrend | undefined {
    if (historical.length < 2) {
      return undefined;
    }

    // Sort by period
    const sorted = [...historical].sort((a, b) => a.period.localeCompare(b.period));

    // Calculate average variance
    const averageVariance =
      sorted.reduce((sum, h) => sum + h.variancePercent, 0) / sorted.length;

    // Calculate volatility (standard deviation)
    const squaredDiffs = sorted.map((h) =>
      Math.pow(h.variancePercent - averageVariance, 2)
    );
    const volatility = Math.sqrt(
      squaredDiffs.reduce((sum, sq) => sum + sq, 0) / squaredDiffs.length
    );

    // Determine trend direction using linear regression slope
    const n = sorted.length;
    const sumX = (n * (n + 1)) / 2; // Sum of indices
    const sumY = sorted.reduce((sum, h) => sum + h.variancePercent, 0);
    const sumXY = sorted.reduce((sum, h, i) => sum + (i + 1) * h.variancePercent, 0);
    const sumX2 = (n * (n + 1) * (2 * n + 1)) / 6; // Sum of squared indices

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    let direction: 'improving' | 'declining' | 'stable';
    if (Math.abs(slope) < 0.5) {
      direction = 'stable';
    } else if (slope < 0) {
      // Variance getting smaller over time = improving
      direction = 'improving';
    } else {
      // Variance getting larger = declining
      direction = 'declining';
    }

    return {
      periods: sorted.map((h) => ({
        period: h.period,
        variance: h.variance,
        variancePercent: h.variancePercent,
      })),
      direction,
      averageVariance,
      volatility,
    };
  }

  /**
   * Main analysis method - orchestrates full variance analysis
   */
  async analyze(
    budgetItems: BudgetItem[],
    actualItems: ActualItem[],
    options?: VarianceEngineOptions
  ): Promise<VarianceAnalysisResult> {
    try {
      // Validate inputs
      if (!budgetItems || budgetItems.length === 0) {
        throw new VarianceCalculationError(
          'Budget items are required',
          'MISSING_BUDGET',
          { budgetItems }
        );
      }

      // Build variance tree
      const variances = this.buildVarianceTree(budgetItems, actualItems, options);

      // Generate insights if requested
      const insights =
        options?.generateInsights !== false ? this.generateInsights(variances) : [];

      // Calculate totals
      const totalBudget = budgetItems.reduce((sum, b) => sum + b.amount, 0);
      const totalActual = actualItems.reduce((sum, a) => sum + a.amount, 0);
      const totalVariance = totalActual - totalBudget;
      const totalVariancePercent =
        totalBudget !== 0 ? (totalVariance / Math.abs(totalBudget)) * 100 : 0;

      // Calculate summary statistics
      const criticalCount = variances.filter((v) => v.severity === 'critical').length;
      const warningCount = variances.filter((v) => v.severity === 'warning').length;
      const favorableCount = variances.filter((v) => v.severity === 'favorable').length;

      return {
        period: budgetItems[0]?.period || new Date().toISOString().slice(0, 7),
        totalBudget,
        totalActual,
        totalVariance,
        totalVariancePercent,
        variances,
        insights,
        summary: {
          criticalCount,
          warningCount,
          favorableCount,
          totalAccounts: variances.length,
        },
        generatedAt: new Date(),
      };
    } catch (error) {
      if (error instanceof VarianceCalculationError) {
        throw error;
      }
      throw new VarianceCalculationError(
        'Variance analysis failed',
        'ANALYSIS_ERROR',
        error
      );
    }
  }

  /**
   * Helper: Format currency
   */
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }

  /**
   * Helper: Identify top variance accounts by impact
   */
  private identifyTopVariances(
    variances: VarianceCalculation[],
    count: number
  ): string[] {
    return variances
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
      .slice(0, count)
      .map((v) => v.accountName);
  }
}

// Export singleton instance with default configuration
export const defaultVarianceEngine = new VarianceEngine();

// Export factory function for custom configurations
export function createVarianceEngine(
  options?: VarianceEngineOptions
): VarianceEngine {
  return new VarianceEngine(options);
}
