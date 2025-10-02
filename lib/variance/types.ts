/**
 * Variance Analysis Type Definitions
 *
 * Comprehensive type system for financial variance analysis
 */

export type AccountType = 'revenue' | 'expense' | 'asset' | 'liability' | 'equity';

export type VarianceSeverity = 'critical' | 'warning' | 'normal' | 'favorable';

export type VarianceDirection = 'over' | 'under' | 'on_target';

export interface AccountHierarchy {
  id: string;
  name: string;
  code?: string;
  type: AccountType;
  parentId?: string;
  level: number;
  children?: AccountHierarchy[];
}

export interface BudgetItem {
  accountId: string;
  accountName: string;
  accountCode?: string;
  accountType: AccountType;
  amount: number;
  period: string; // ISO 8601 date or period identifier (e.g., "2024-01")
  parentAccountId?: string;
}

export interface ActualItem {
  accountId: string;
  accountName: string;
  accountCode?: string;
  accountType: AccountType;
  amount: number;
  period: string;
  parentAccountId?: string;
}

export interface VarianceCalculation {
  accountId: string;
  accountName: string;
  accountCode?: string;
  accountType: AccountType;
  period: string;
  budget: number;
  actual: number;
  variance: number; // Dollar variance (actual - budget)
  variancePercent: number; // Percentage variance
  severity: VarianceSeverity;
  direction: VarianceDirection;
  parentAccountId?: string;
  level: number;
  children?: VarianceCalculation[];
  insights?: string[];
  trend?: VarianceTrend;
}

export interface VarianceTrend {
  periods: {
    period: string;
    variance: number;
    variancePercent: number;
  }[];
  direction: 'improving' | 'declining' | 'stable';
  averageVariance: number;
  volatility: number; // Standard deviation of variance percentages
}

export interface VarianceThresholds {
  critical: number; // Default: 15%
  warning: number; // Default: 10%
  favorable: number; // Default: -5% (under budget for expenses)
}

export interface VarianceInsight {
  accountId: string;
  accountName: string;
  severity: VarianceSeverity;
  message: string;
  recommendation?: string;
  impact: number; // Dollar impact
  confidence: 'high' | 'medium' | 'low';
}

export interface VarianceAnalysisResult {
  period: string;
  totalBudget: number;
  totalActual: number;
  totalVariance: number;
  totalVariancePercent: number;
  variances: VarianceCalculation[];
  insights: VarianceInsight[];
  summary: {
    criticalCount: number;
    warningCount: number;
    favorableCount: number;
    totalAccounts: number;
  };
  generatedAt: Date;
  cacheKey?: string;
}

export interface VarianceEngineOptions {
  thresholds?: VarianceThresholds;
  includeZeroVariances?: boolean;
  includeChildren?: boolean;
  generateInsights?: boolean;
  includeTrends?: boolean;
  historicalPeriods?: number; // Number of periods to analyze for trends
}

export interface HistoricalVariance {
  period: string;
  budget: number;
  actual: number;
  variance: number;
  variancePercent: number;
}

// Error types
export class VarianceCalculationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'VarianceCalculationError';
  }
}

// Constants
export const DEFAULT_THRESHOLDS: VarianceThresholds = {
  critical: 15, // 15%
  warning: 10, // 10%
  favorable: -5, // 5% under budget
};

export const ACCOUNT_TYPE_MULTIPLIERS: Record<AccountType, number> = {
  revenue: -1, // For revenue, negative variance (less revenue) is bad
  expense: 1, // For expense, positive variance (more expense) is bad
  asset: 1,
  liability: -1,
  equity: -1,
};
