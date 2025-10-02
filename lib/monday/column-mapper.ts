/**
 * Monday.com Column Mapper
 *
 * Smart detection and mapping of Monday board columns
 * Automatically identifies budget, actual, and variance columns
 */

import {
  MondayColumn,
  MondayColumnType,
  ColumnMapping,
  DetectedColumn,
} from './types';

/**
 * Smart column detection based on title keywords
 */
export class ColumnMapper {
  private columns: MondayColumn[];

  constructor(columns: MondayColumn[]) {
    this.columns = columns.filter((c) => !c.archived);
  }

  /**
   * Auto-detect all relevant columns
   */
  detectColumns(): ColumnMapping {
    const mapping: ColumnMapping = {};

    // Detect budget column
    const budgetColumn = this.detectBudgetColumn();
    if (budgetColumn) {
      mapping.budgetColumn = budgetColumn.id;
    }

    // Detect actual column
    const actualColumn = this.detectActualColumn();
    if (actualColumn) {
      mapping.actualColumn = actualColumn.id;
    }

    // Detect variance columns (if they exist)
    const varianceColumn = this.detectVarianceColumn();
    if (varianceColumn) {
      mapping.varianceColumn = varianceColumn.id;
    }

    const variancePercentColumn = this.detectVariancePercentColumn();
    if (variancePercentColumn) {
      mapping.variancePercentColumn = variancePercentColumn.id;
    }

    const severityColumn = this.detectSeverityColumn();
    if (severityColumn) {
      mapping.severityColumn = severityColumn.id;
    }

    // Detect account type column
    const accountTypeColumn = this.detectAccountTypeColumn();
    if (accountTypeColumn) {
      mapping.accountTypeColumn = accountTypeColumn.id;
    }

    // Detect period column
    const periodColumn = this.detectPeriodColumn();
    if (periodColumn) {
      mapping.periodColumn = periodColumn.id;
    }

    // Detect account code column
    const accountCodeColumn = this.detectAccountCodeColumn();
    if (accountCodeColumn) {
      mapping.accountCodeColumn = accountCodeColumn.id;
    }

    // Detect notes column
    const notesColumn = this.detectNotesColumn();
    if (notesColumn) {
      mapping.notesColumn = notesColumn.id;
    }

    return mapping;
  }

  /**
   * Get detailed detection results with confidence scores
   */
  getDetailedDetection(): DetectedColumn[] {
    const detected: DetectedColumn[] = [];

    const detectors = [
      { method: this.detectBudgetColumn.bind(this), purpose: 'budgetColumn' as const },
      { method: this.detectActualColumn.bind(this), purpose: 'actualColumn' as const },
      { method: this.detectVarianceColumn.bind(this), purpose: 'varianceColumn' as const },
      { method: this.detectVariancePercentColumn.bind(this), purpose: 'variancePercentColumn' as const },
      { method: this.detectSeverityColumn.bind(this), purpose: 'severityColumn' as const },
      { method: this.detectAccountTypeColumn.bind(this), purpose: 'accountTypeColumn' as const },
      { method: this.detectPeriodColumn.bind(this), purpose: 'periodColumn' as const },
      { method: this.detectAccountCodeColumn.bind(this), purpose: 'accountCodeColumn' as const },
      { method: this.detectNotesColumn.bind(this), purpose: 'notesColumn' as const },
    ];

    for (const detector of detectors) {
      const result = detector.method();
      if (result) {
        detected.push({
          id: result.column.id,
          title: result.column.title,
          type: result.column.type,
          confidence: result.confidence,
          purpose: detector.purpose,
        });
      }
    }

    return detected;
  }

  /**
   * Validate column mapping
   */
  validateMapping(mapping: ColumnMapping): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required columns
    if (!mapping.budgetColumn) {
      errors.push('Budget column is required but not found');
    }

    // Validate column types
    if (mapping.budgetColumn) {
      const column = this.getColumn(mapping.budgetColumn);
      if (column && !this.isNumericColumn(column)) {
        errors.push(`Budget column "${column.title}" must be a numeric type`);
      }
    }

    if (mapping.actualColumn) {
      const column = this.getColumn(mapping.actualColumn);
      if (column && !this.isNumericColumn(column)) {
        errors.push(`Actual column "${column.title}" must be a numeric type`);
      }
    }

    if (mapping.severityColumn) {
      const column = this.getColumn(mapping.severityColumn);
      if (column && column.type !== 'status') {
        warnings.push(`Severity column "${column.title}" should be a status type`);
      }
    }

    if (mapping.accountTypeColumn) {
      const column = this.getColumn(mapping.accountTypeColumn);
      if (column && column.type !== 'dropdown' && column.type !== 'status') {
        warnings.push(`Account type column "${column.title}" should be a dropdown or status type`);
      }
    }

    // Warnings for missing optional columns
    if (!mapping.actualColumn) {
      warnings.push('Actual column not found - variance calculation may be limited');
    }

    if (!mapping.varianceColumn) {
      warnings.push('Variance column not found - results will not be written back to board');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Detect budget column
   */
  private detectBudgetColumn(): { column: MondayColumn; confidence: 'high' | 'medium' | 'low' } | null {
    const keywords = {
      high: ['budget', 'budgeted', 'planned'],
      medium: ['forecast', 'target', 'goal'],
      low: ['estimated', 'projected'],
    };

    return this.detectColumnByKeywords(keywords, ['numbers']);
  }

  /**
   * Detect actual column
   */
  private detectActualColumn(): { column: MondayColumn; confidence: 'high' | 'medium' | 'low' } | null {
    const keywords = {
      high: ['actual', 'actuals', 'spent', 'expense'],
      medium: ['real', 'current', 'ytd'],
      low: ['amount'],
    };

    return this.detectColumnByKeywords(keywords, ['numbers']);
  }

  /**
   * Detect variance dollar column
   */
  private detectVarianceColumn(): { column: MondayColumn; confidence: 'high' | 'medium' | 'low' } | null {
    const keywords = {
      high: ['variance ($)', 'variance', 'variance (dollar)'],
      medium: ['diff', 'difference', 'delta'],
      low: ['var'],
    };

    return this.detectColumnByKeywords(keywords, ['numbers']);
  }

  /**
   * Detect variance percent column
   */
  private detectVariancePercentColumn(): { column: MondayColumn; confidence: 'high' | 'medium' | 'low' } | null {
    const keywords = {
      high: ['variance (%)', 'variance percent', 'variance (%)'],
      medium: ['variance pct', '% variance'],
      low: ['%'],
    };

    return this.detectColumnByKeywords(keywords, ['numbers']);
  }

  /**
   * Detect severity/status column
   */
  private detectSeverityColumn(): { column: MondayColumn; confidence: 'high' | 'medium' | 'low' } | null {
    const keywords = {
      high: ['severity', 'status', 'health'],
      medium: ['priority', 'alert'],
      low: ['flag'],
    };

    return this.detectColumnByKeywords(keywords, ['status', 'dropdown']);
  }

  /**
   * Detect account type column
   */
  private detectAccountTypeColumn(): { column: MondayColumn; confidence: 'high' | 'medium' | 'low' } | null {
    const keywords = {
      high: ['account type', 'type', 'category type'],
      medium: ['category', 'classification'],
      low: ['group'],
    };

    return this.detectColumnByKeywords(keywords, ['dropdown', 'status', 'text']);
  }

  /**
   * Detect period column
   */
  private detectPeriodColumn(): { column: MondayColumn; confidence: 'high' | 'medium' | 'low' } | null {
    const keywords = {
      high: ['period', 'month', 'fiscal period'],
      medium: ['date', 'quarter', 'year'],
      low: ['time'],
    };

    return this.detectColumnByKeywords(keywords, ['date', 'text']);
  }

  /**
   * Detect account code column
   */
  private detectAccountCodeColumn(): { column: MondayColumn; confidence: 'high' | 'medium' | 'low' } | null {
    const keywords = {
      high: ['account code', 'code', 'account #'],
      medium: ['id', 'account id', 'gl code'],
      low: ['number'],
    };

    return this.detectColumnByKeywords(keywords, ['text', 'numbers']);
  }

  /**
   * Detect notes/insights column
   */
  private detectNotesColumn(): { column: MondayColumn; confidence: 'high' | 'medium' | 'low' } | null {
    const keywords = {
      high: ['notes', 'insights', 'comments'],
      medium: ['remarks', 'description'],
      low: ['info'],
    };

    return this.detectColumnByKeywords(keywords, ['long_text', 'text']);
  }

  /**
   * Generic column detection by keywords
   */
  private detectColumnByKeywords(
    keywords: {
      high: string[];
      medium: string[];
      low: string[];
    },
    allowedTypes: MondayColumnType[]
  ): { column: MondayColumn; confidence: 'high' | 'medium' | 'low' } | null {
    // Try high confidence keywords first
    for (const keyword of keywords.high) {
      const column = this.findColumnByTitle(keyword, allowedTypes);
      if (column) {
        return { column, confidence: 'high' };
      }
    }

    // Try medium confidence keywords
    for (const keyword of keywords.medium) {
      const column = this.findColumnByTitle(keyword, allowedTypes);
      if (column) {
        return { column, confidence: 'medium' };
      }
    }

    // Try low confidence keywords
    for (const keyword of keywords.low) {
      const column = this.findColumnByTitle(keyword, allowedTypes);
      if (column) {
        return { column, confidence: 'low' };
      }
    }

    return null;
  }

  /**
   * Find column by title keyword
   */
  private findColumnByTitle(
    keyword: string,
    allowedTypes: MondayColumnType[]
  ): MondayColumn | null {
    const lowerKeyword = keyword.toLowerCase();

    return (
      this.columns.find((col) => {
        const lowerTitle = col.title.toLowerCase();
        const typeMatches = allowedTypes.includes(col.type);
        const titleMatches = lowerTitle.includes(lowerKeyword);

        return typeMatches && titleMatches;
      }) || null
    );
  }

  /**
   * Get column by ID
   */
  private getColumn(columnId: string): MondayColumn | null {
    return this.columns.find((c) => c.id === columnId) || null;
  }

  /**
   * Check if column is numeric type
   */
  private isNumericColumn(column: MondayColumn): boolean {
    return column.type === 'numbers';
  }

  /**
   * Get all numeric columns
   */
  getNumericColumns(): MondayColumn[] {
    return this.columns.filter((c) => this.isNumericColumn(c));
  }

  /**
   * Get all text columns
   */
  getTextColumns(): MondayColumn[] {
    return this.columns.filter((c) => c.type === 'text' || c.type === 'long_text');
  }

  /**
   * Get all status columns
   */
  getStatusColumns(): MondayColumn[] {
    return this.columns.filter((c) => c.type === 'status');
  }

  /**
   * Suggest column mapping manually
   */
  suggestMapping(): {
    suggested: ColumnMapping;
    numericColumns: MondayColumn[];
    statusColumns: MondayColumn[];
    textColumns: MondayColumn[];
  } {
    return {
      suggested: this.detectColumns(),
      numericColumns: this.getNumericColumns(),
      statusColumns: this.getStatusColumns(),
      textColumns: this.getTextColumns(),
    };
  }
}

/**
 * Parse column value based on type
 */
export function parseColumnValue(
  value: string | null,
  type: MondayColumnType
): any {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);

    switch (type) {
      case 'numbers':
        return parsed || null;

      case 'text':
      case 'long_text':
        return parsed || null;

      case 'status':
      case 'dropdown':
        return parsed?.label || parsed?.text || null;

      case 'date':
        return parsed?.date || null;

      case 'people':
        return parsed?.personsAndTeams || [];

      default:
        return parsed;
    }
  } catch {
    return value;
  }
}

/**
 * Format value for Monday column update
 */
export function formatColumnValue(
  value: any,
  type: MondayColumnType
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  switch (type) {
    case 'numbers':
      return value.toString();

    case 'text':
    case 'long_text':
      return value.toString();

    case 'status':
      // Status columns use label index
      return JSON.stringify({ label: value });

    case 'dropdown':
      return JSON.stringify({ labels: [value] });

    case 'date':
      return JSON.stringify({ date: value });

    default:
      return JSON.stringify(value);
  }
}

/**
 * Create column mapping from user input
 */
export function createCustomMapping(
  columns: MondayColumn[],
  userMapping: Partial<ColumnMapping>
): ColumnMapping {
  const mapper = new ColumnMapper(columns);
  const autoDetected = mapper.detectColumns();

  return {
    ...autoDetected,
    ...userMapping,
  };
}
