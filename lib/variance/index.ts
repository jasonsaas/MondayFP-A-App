/**
 * Variance Analysis Module
 *
 * Production-ready financial variance analysis engine
 * Exports all public APIs for variance calculation and analysis
 */

// Core engine
export {
  VarianceEngine,
  defaultVarianceEngine,
  createVarianceEngine,
} from './engine';

// Type definitions
export type {
  AccountType,
  VarianceSeverity,
  VarianceDirection,
  AccountHierarchy,
  BudgetItem,
  ActualItem,
  VarianceCalculation,
  VarianceTrend,
  VarianceThresholds,
  VarianceInsight,
  VarianceAnalysisResult,
  VarianceEngineOptions,
  HistoricalVariance,
} from './types';

export {
  VarianceCalculationError,
  DEFAULT_THRESHOLDS,
  ACCOUNT_TYPE_MULTIPLIERS,
} from './types';

// Cache utilities
export {
  generateCacheKey,
  getCachedVariance,
  setCachedVariance,
  invalidateVarianceCache,
  varianceCacheExists,
  getCacheStats,
} from './cache';
