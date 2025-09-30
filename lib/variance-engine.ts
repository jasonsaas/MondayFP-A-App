export interface BudgetItem {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  budgetAmount: number;
  period: string;
  periodStartDate: Date;
  periodEndDate: Date;
  department?: string;
  costCenter?: string;
}

export interface ActualTransaction {
  id: string;
  amount: number;
  date: Date;
  category: string;
  subcategory?: string;
  department?: string;
  description?: string;
}

export interface VarianceResult {
  id: string;
  category: string;
  subcategory?: string;
  budgetAmount: number;
  actualAmount: number;
  variance: number;
  variancePercentage: number;
  varianceType: 'favorable' | 'unfavorable';
  severity: 'low' | 'medium' | 'high' | 'critical';
  trend?: 'improving' | 'worsening' | 'stable';
}

export interface VarianceAnalysis {
  id: string;
  name: string;
  totalBudget: number;
  totalActual: number;
  totalVariance: number;
  totalVariancePercentage: number;
  results: VarianceResult[];
  summary: {
    favorableCount: number;
    unfavorableCount: number;
    criticalCount: number;
    topVariances: VarianceResult[];
  };
}

export class VarianceEngine {
  
  calculateVariance(budgetAmount: number, actualAmount: number): {
    variance: number;
    variancePercentage: number;
    varianceType: 'favorable' | 'unfavorable';
  } {
    const variance = actualAmount - budgetAmount;
    const variancePercentage = budgetAmount !== 0 ? (variance / budgetAmount) * 100 : 0;
    
    // For expenses: negative variance (actual < budget) is favorable
    // For revenue: positive variance (actual > budget) is favorable
    // Assuming most items are expenses for now
    const varianceType = variance <= 0 ? 'favorable' : 'unfavorable';
    
    return {
      variance,
      variancePercentage,
      varianceType,
    };
  }

  calculateSeverity(variancePercentage: number): 'low' | 'medium' | 'high' | 'critical' {
    const absPercentage = Math.abs(variancePercentage);
    
    if (absPercentage <= 5) return 'low';
    if (absPercentage <= 15) return 'medium';
    if (absPercentage <= 30) return 'high';
    return 'critical';
  }

  aggregateActualsByCategory(
    transactions: ActualTransaction[],
    startDate: Date,
    endDate: Date
  ): Map<string, number> {
    const categoryTotals = new Map<string, number>();
    
    transactions
      .filter(t => t.date >= startDate && t.date <= endDate)
      .forEach(transaction => {
        const key = transaction.subcategory 
          ? `${transaction.category}::${transaction.subcategory}`
          : transaction.category;
        
        const current = categoryTotals.get(key) || 0;
        categoryTotals.set(key, current + transaction.amount);
      });
    
    return categoryTotals;
  }

  matchBudgetToActuals(
    budgetItems: BudgetItem[],
    actualsByCategory: Map<string, number>
  ): VarianceResult[] {
    const results: VarianceResult[] = [];
    
    budgetItems.forEach(budget => {
      const budgetKey = budget.subcategory 
        ? `${budget.category}::${budget.subcategory}`
        : budget.category;
      
      const actualAmount = actualsByCategory.get(budgetKey) || 0;
      
      const { variance, variancePercentage, varianceType } = this.calculateVariance(
        budget.budgetAmount,
        actualAmount
      );
      
      const severity = this.calculateSeverity(variancePercentage);
      
      results.push({
        id: budget.id,
        category: budget.category,
        subcategory: budget.subcategory,
        budgetAmount: budget.budgetAmount,
        actualAmount,
        variance,
        variancePercentage,
        varianceType,
        severity,
      });
    });
    
    return results;
  }

  generateAnalysisSummary(results: VarianceResult[]): VarianceAnalysis['summary'] {
    const favorableCount = results.filter(r => r.varianceType === 'favorable').length;
    const unfavorableCount = results.filter(r => r.varianceType === 'unfavorable').length;
    const criticalCount = results.filter(r => r.severity === 'critical').length;
    
    // Get top 5 variances by absolute percentage
    const topVariances = results
      .sort((a, b) => Math.abs(b.variancePercentage) - Math.abs(a.variancePercentage))
      .slice(0, 5);
    
    return {
      favorableCount,
      unfavorableCount,
      criticalCount,
      topVariances,
    };
  }

  runVarianceAnalysis(
    budgetItems: BudgetItem[],
    actualTransactions: ActualTransaction[],
    periodStartDate: Date,
    periodEndDate: Date,
    analysisName: string
  ): VarianceAnalysis {
    // Aggregate actuals by category
    const actualsByCategory = this.aggregateActualsByCategory(
      actualTransactions,
      periodStartDate,
      periodEndDate
    );
    
    // Match budget items to actuals and calculate variances
    const results = this.matchBudgetToActuals(budgetItems, actualsByCategory);
    
    // Calculate totals
    const totalBudget = budgetItems.reduce((sum, item) => sum + item.budgetAmount, 0);
    const totalActual = results.reduce((sum, result) => sum + result.actualAmount, 0);
    const totalVariance = totalActual - totalBudget;
    const totalVariancePercentage = totalBudget !== 0 ? (totalVariance / totalBudget) * 100 : 0;
    
    // Generate summary
    const summary = this.generateAnalysisSummary(results);
    
    return {
      id: crypto.randomUUID(),
      name: analysisName,
      totalBudget,
      totalActual,
      totalVariance,
      totalVariancePercentage,
      results,
      summary,
    };
  }

  identifyTrends(
    currentResults: VarianceResult[],
    previousResults: VarianceResult[]
  ): VarianceResult[] {
    return currentResults.map(current => {
      const previous = previousResults.find(p => p.category === current.category && p.subcategory === current.subcategory);
      
      if (!previous) {
        return current;
      }
      
      const currentAbsVariance = Math.abs(current.variancePercentage);
      const previousAbsVariance = Math.abs(previous.variancePercentage);
      
      let trend: 'improving' | 'worsening' | 'stable';
      
      if (currentAbsVariance < previousAbsVariance * 0.9) {
        trend = 'improving';
      } else if (currentAbsVariance > previousAbsVariance * 1.1) {
        trend = 'worsening';
      } else {
        trend = 'stable';
      }
      
      return {
        ...current,
        trend,
      };
    });
  }

  generateActionItems(result: VarianceResult): string[] {
    const actionItems: string[] = [];
    
    if (result.varianceType === 'unfavorable') {
      if (result.severity === 'critical') {
        actionItems.push('Immediate review required - variance exceeds 30%');
        actionItems.push('Investigate root causes and implement corrective actions');
        actionItems.push('Update forecast and budget if necessary');
      } else if (result.severity === 'high') {
        actionItems.push('Schedule review meeting with department head');
        actionItems.push('Analyze spending patterns and identify cost drivers');
      } else if (result.severity === 'medium') {
        actionItems.push('Monitor closely for next reporting period');
        actionItems.push('Review budget assumptions and actuals');
      }
    } else if (result.varianceType === 'favorable' && result.severity === 'critical') {
      actionItems.push('Verify actual amounts for accuracy');
      actionItems.push('Consider reallocating savings to other initiatives');
      actionItems.push('Update forecast to reflect new spending patterns');
    }
    
    if (result.trend === 'worsening') {
      actionItems.push('Trend analysis shows deteriorating performance');
      actionItems.push('Implement preventive measures to stop further variance');
    }
    
    return actionItems;
  }
}