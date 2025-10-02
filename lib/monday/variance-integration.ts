/**
 * Monday.com Variance Integration
 *
 * High-level integration between Monday boards and variance engine
 * Handles reading budget data and writing back variance results
 */

import { MondayClient } from './client';
import { ColumnMapper, parseColumnValue, formatColumnValue } from './column-mapper';
import { ColumnMapping, MondayItem, BatchUpdateItem } from './types';
import { VarianceEngine } from '@/lib/variance/engine';
import { BudgetItem, ActualItem, VarianceCalculation } from '@/lib/variance/types';

export interface VarianceIntegrationOptions {
  mondayApiKey: string;
  organizationId: string;
  boardId: string;
  period: string;
  columnMapping?: ColumnMapping;
  autoDetectColumns?: boolean;
  createMissingColumns?: boolean;
  writeBackResults?: boolean;
}

export class MondayVarianceIntegration {
  private client: MondayClient;
  private engine: VarianceEngine;
  private options: VarianceIntegrationOptions;

  constructor(options: VarianceIntegrationOptions) {
    this.options = {
      autoDetectColumns: true,
      createMissingColumns: true,
      writeBackResults: true,
      ...options,
    };

    this.client = new MondayClient({ apiKey: options.mondayApiKey });
    this.engine = new VarianceEngine();
  }

  /**
   * Main method: Read budget data, calculate variances, write back results
   */
  async performVarianceAnalysis() {
    console.log('=== Starting Monday Variance Integration ===');

    // Step 1: Get board data
    console.log('Step 1: Fetching board data...');
    const board = await this.client.getBoard(this.options.boardId);
    console.log(`✓ Board: ${board.name} (${board.items_page?.items.length || 0} items)`);

    // Step 2: Auto-detect or use provided column mapping
    console.log('Step 2: Detecting columns...');
    const columnMapping = await this.getColumnMapping(board);
    console.log('✓ Column mapping:', columnMapping);

    // Step 3: Validate column mapping
    const mapper = new ColumnMapper(board.columns);
    const validation = mapper.validateMapping(columnMapping);

    if (!validation.valid) {
      throw new Error(`Invalid column mapping: ${validation.errors.join(', ')}`);
    }

    if (validation.warnings.length > 0) {
      console.warn('⚠ Warnings:', validation.warnings);
    }

    // Step 4: Create missing variance columns if needed
    if (this.options.createMissingColumns) {
      console.log('Step 3: Checking variance columns...');
      await this.ensureVarianceColumns(board, columnMapping);
    }

    // Step 5: Extract budget and actual items
    console.log('Step 4: Extracting budget and actual data...');
    const { budgetItems, actualItems } = this.extractBudgetActualData(
      board.items_page?.items || [],
      columnMapping
    );
    console.log(`✓ Budget items: ${budgetItems.length}`);
    console.log(`✓ Actual items: ${actualItems.length}`);

    // Step 6: Calculate variances
    console.log('Step 5: Calculating variances...');
    const result = await this.engine.analyze(budgetItems, actualItems, {
      generateInsights: true,
      includeChildren: false,
    });
    console.log('✓ Variance analysis complete');
    console.log(`  - Total variance: $${result.totalVariance.toLocaleString()}`);
    console.log(`  - Critical: ${result.summary.criticalCount}`);
    console.log(`  - Warnings: ${result.summary.warningCount}`);
    console.log(`  - Insights: ${result.insights.length}`);

    // Step 7: Write results back to Monday
    if (this.options.writeBackResults) {
      console.log('Step 6: Writing results back to Monday...');
      await this.writeVarianceResults(
        board.items_page?.items || [],
        result.variances,
        columnMapping
      );
      console.log('✓ Results written to board');
    }

    console.log('=== Variance Integration Complete ===');

    return result;
  }

  /**
   * Get or detect column mapping
   */
  private async getColumnMapping(board: any): Promise<ColumnMapping> {
    if (this.options.columnMapping) {
      return this.options.columnMapping;
    }

    if (this.options.autoDetectColumns) {
      const mapper = new ColumnMapper(board.columns);
      const mapping = mapper.detectColumns();

      // Log detection results
      const detailed = mapper.getDetailedDetection();
      console.log('Auto-detected columns:');
      detailed.forEach((d) => {
        console.log(`  - ${d.purpose}: "${d.title}" (${d.confidence} confidence)`);
      });

      return mapping;
    }

    throw new Error('Column mapping required when autoDetectColumns is false');
  }

  /**
   * Ensure variance columns exist on the board
   */
  private async ensureVarianceColumns(
    board: any,
    columnMapping: ColumnMapping
  ): Promise<void> {
    const needsColumns =
      !columnMapping.varianceColumn ||
      !columnMapping.variancePercentColumn ||
      !columnMapping.severityColumn;

    if (!needsColumns) {
      console.log('✓ All variance columns already exist');
      return;
    }

    console.log('Creating missing variance columns...');
    const newColumns = await this.client.createVarianceColumns(
      this.options.boardId,
      board.columns
    );

    // Update column mapping
    if (!columnMapping.varianceColumn) {
      columnMapping.varianceColumn = newColumns.varianceColumn.id;
    }
    if (!columnMapping.variancePercentColumn) {
      columnMapping.variancePercentColumn = newColumns.variancePercentColumn.id;
    }
    if (!columnMapping.severityColumn) {
      columnMapping.severityColumn = newColumns.severityColumn.id;
    }

    console.log('✓ Variance columns created');
  }

  /**
   * Extract budget and actual data from board items
   */
  private extractBudgetActualData(
    items: MondayItem[],
    columnMapping: ColumnMapping
  ): {
    budgetItems: BudgetItem[];
    actualItems: ActualItem[];
  } {
    const budgetItems: BudgetItem[] = [];
    const actualItems: ActualItem[] = [];

    for (const item of items) {
      // Get column values
      const budgetValue = this.getColumnValue(
        item,
        columnMapping.budgetColumn || ''
      );
      const actualValue = this.getColumnValue(
        item,
        columnMapping.actualColumn || ''
      );
      const accountType = this.getColumnValue(
        item,
        columnMapping.accountTypeColumn || ''
      );
      const accountCode = this.getColumnValue(
        item,
        columnMapping.accountCodeColumn || ''
      );

      // Parse budget amount
      const budgetAmount = parseFloat(budgetValue || '0') || 0;

      // Create budget item
      budgetItems.push({
        accountId: item.id,
        accountName: item.name,
        accountCode: accountCode || undefined,
        accountType: this.parseAccountType(accountType),
        amount: budgetAmount,
        period: this.options.period,
      });

      // Create actual item if actual value exists
      if (actualValue) {
        const actualAmount = parseFloat(actualValue) || 0;

        actualItems.push({
          accountId: item.id,
          accountName: item.name,
          accountCode: accountCode || undefined,
          accountType: this.parseAccountType(accountType),
          amount: actualAmount,
          period: this.options.period,
        });
      }
    }

    return { budgetItems, actualItems };
  }

  /**
   * Write variance results back to Monday board
   */
  private async writeVarianceResults(
    items: MondayItem[],
    variances: VarianceCalculation[],
    columnMapping: ColumnMapping
  ): Promise<void> {
    // Create lookup map of variances by account ID
    const varianceMap = new Map(
      variances.map((v) => [v.accountId, v])
    );

    // Build batch update
    const updates: BatchUpdateItem[] = [];

    for (const item of items) {
      const variance = varianceMap.get(item.id);
      if (!variance) continue;

      const columnValues: Record<string, any> = {};

      // Add variance dollar amount
      if (columnMapping.varianceColumn) {
        columnValues[columnMapping.varianceColumn] = variance.variance.toFixed(2);
      }

      // Add variance percentage
      if (columnMapping.variancePercentColumn) {
        columnValues[columnMapping.variancePercentColumn] =
          variance.variancePercent.toFixed(2);
      }

      // Add severity status
      if (columnMapping.severityColumn) {
        const severityIndex = this.getSeverityIndex(variance.severity);
        columnValues[columnMapping.severityColumn] = JSON.stringify({
          label: severityIndex.toString(),
        });
      }

      // Add notes/insights
      if (columnMapping.notesColumn && variance.insights) {
        const notes = variance.insights.join('\n');
        columnValues[columnMapping.notesColumn] = notes;
      }

      updates.push({
        itemId: item.id,
        columnValues,
      });
    }

    // Execute batch update
    if (updates.length > 0) {
      await this.client.batchUpdateItems(this.options.boardId, updates);
    }
  }

  /**
   * Get column value from item
   */
  private getColumnValue(item: MondayItem, columnId: string): string | null {
    if (!columnId) return null;

    const columnValue = item.column_values.find((cv) => cv.id === columnId);
    if (!columnValue) return null;

    return parseColumnValue(columnValue.value, columnValue.type);
  }

  /**
   * Parse account type from string
   */
  private parseAccountType(value: string | null): 'revenue' | 'expense' {
    if (!value) return 'expense';

    const lower = value.toLowerCase();
    if (lower.includes('revenue') || lower.includes('income')) {
      return 'revenue';
    }

    return 'expense';
  }

  /**
   * Get severity index for status column
   */
  private getSeverityIndex(severity: string): number {
    const { VARIANCE_STATUS_LABELS } = require('./types');

    switch (severity) {
      case 'critical':
        return VARIANCE_STATUS_LABELS.critical.index;
      case 'warning':
        return VARIANCE_STATUS_LABELS.warning.index;
      case 'favorable':
        return VARIANCE_STATUS_LABELS.favorable.index;
      default:
        return VARIANCE_STATUS_LABELS.normal.index;
    }
  }

  /**
   * Setup webhook for automatic recalculation
   */
  async setupWebhook(): Promise<void> {
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/monday`;

    console.log(`Setting up webhook: ${webhookUrl}`);

    await this.client.createWebhook(
      this.options.boardId,
      webhookUrl,
      'change_column_value'
    );

    console.log('✓ Webhook created successfully');
  }
}

/**
 * Helper function to run variance integration
 */
export async function runMondayVarianceIntegration(
  options: VarianceIntegrationOptions
) {
  const integration = new MondayVarianceIntegration(options);
  return await integration.performVarianceAnalysis();
}
