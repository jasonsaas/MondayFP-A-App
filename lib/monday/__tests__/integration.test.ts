/**
 * Monday.com Integration Tests
 *
 * Integration tests for Monday client, column mapper, and variance integration
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MondayClient } from '../client';
import { ColumnMapper } from '../column-mapper';
import { MondayBoard, MondayColumn } from '../types';

// Mock data
const mockBoard: MondayBoard = {
  id: '123456789',
  name: 'Test Budget Board',
  columns: [
    { id: 'text_1', title: 'Item Name', type: 'text', archived: false },
    { id: 'numbers_1', title: 'Budget', type: 'numbers', archived: false },
    { id: 'numbers_2', title: 'Actual', type: 'numbers', archived: false },
    { id: 'dropdown_1', title: 'Account Type', type: 'dropdown', archived: false },
    { id: 'status_1', title: 'Status', type: 'status', archived: false },
  ],
  items_page: {
    items: [
      {
        id: '111',
        name: 'Salaries',
        column_values: [
          { id: 'numbers_1', value: '10000', text: '10000', type: 'numbers' },
          { id: 'numbers_2', value: '12000', text: '12000', type: 'numbers' },
          { id: 'dropdown_1', value: '{"label":"Expense"}', text: 'Expense', type: 'dropdown' },
        ],
      },
      {
        id: '222',
        name: 'Revenue',
        column_values: [
          { id: 'numbers_1', value: '50000', text: '50000', type: 'numbers' },
          { id: 'numbers_2', value: '45000', text: '45000', type: 'numbers' },
          { id: 'dropdown_1', value: '{"label":"Revenue"}', text: 'Revenue', type: 'dropdown' },
        ],
      },
    ],
  },
};

describe('ColumnMapper', () => {
  let mapper: ColumnMapper;

  beforeEach(() => {
    mapper = new ColumnMapper(mockBoard.columns);
  });

  describe('detectColumns', () => {
    it('should detect budget column', () => {
      const mapping = mapper.detectColumns();
      expect(mapping.budgetColumn).toBe('numbers_1');
    });

    it('should detect actual column', () => {
      const mapping = mapper.detectColumns();
      expect(mapping.actualColumn).toBe('numbers_2');
    });

    it('should detect account type column', () => {
      const mapping = mapper.detectColumns();
      expect(mapping.accountTypeColumn).toBe('dropdown_1');
    });
  });

  describe('getDetailedDetection', () => {
    it('should return confidence scores', () => {
      const detailed = mapper.getDetailedDetection();

      const budgetDetection = detailed.find((d) => d.purpose === 'budgetColumn');
      expect(budgetDetection).toBeDefined();
      expect(budgetDetection?.confidence).toBe('high');
    });

    it('should include column titles', () => {
      const detailed = mapper.getDetailedDetection();

      const budgetDetection = detailed.find((d) => d.purpose === 'budgetColumn');
      expect(budgetDetection?.title).toBe('Budget');
    });
  });

  describe('validateMapping', () => {
    it('should validate correct mapping', () => {
      const mapping = {
        budgetColumn: 'numbers_1',
        actualColumn: 'numbers_2',
      };

      const validation = mapper.validateMapping(mapping);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should error on missing budget column', () => {
      const mapping = {
        budgetColumn: undefined,
        actualColumn: 'numbers_2',
      };

      const validation = mapper.validateMapping(mapping as any);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should error on non-numeric budget column', () => {
      const mapping = {
        budgetColumn: 'text_1', // Text column, not numeric
        actualColumn: 'numbers_2',
      };

      const validation = mapper.validateMapping(mapping);
      expect(validation.valid).toBe(false);
    });

    it('should warn on missing variance columns', () => {
      const mapping = {
        budgetColumn: 'numbers_1',
        actualColumn: 'numbers_2',
      };

      const validation = mapper.validateMapping(mapping);
      expect(validation.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('getNumericColumns', () => {
    it('should return only numeric columns', () => {
      const numericColumns = mapper.getNumericColumns();
      expect(numericColumns).toHaveLength(2);
      expect(numericColumns.every((c) => c.type === 'numbers')).toBe(true);
    });
  });

  describe('getStatusColumns', () => {
    it('should return only status columns', () => {
      const statusColumns = mapper.getStatusColumns();
      expect(statusColumns).toHaveLength(1);
      expect(statusColumns[0].type).toBe('status');
    });
  });
});

describe('MondayClient - Rate Limiting', () => {
  // Note: These tests require actual API credentials to run
  // They are skipped by default and should be run manually

  it.skip('should handle rate limits with retries', async () => {
    const client = new MondayClient({
      apiKey: process.env.MONDAY_API_KEY!,
      retryAttempts: 3,
      retryDelay: 100, // Faster for testing
    });

    // This would trigger rate limits in real scenario
    const promises = [];
    for (let i = 0; i < 100; i++) {
      promises.push(client.getBoard('123456789'));
    }

    await expect(Promise.all(promises)).resolves.toBeDefined();
  });

  it.skip('should chunk batch updates', async () => {
    const client = new MondayClient({
      apiKey: process.env.MONDAY_API_KEY!,
    });

    // Create 100 updates
    const updates = Array.from({ length: 100 }, (_, i) => ({
      itemId: `${i}`,
      columnValues: { test: `value_${i}` },
    }));

    // Should automatically chunk into groups of 25
    await expect(
      client.batchUpdateItems('123456789', updates)
    ).resolves.toBeUndefined();
  });
});

describe('Column Value Parsing', () => {
  it('should parse numeric column values', () => {
    const { parseColumnValue } = require('../column-mapper');
    expect(parseColumnValue('10000', 'numbers')).toBe('10000');
    expect(parseColumnValue('null', 'numbers')).toBeNull();
  });

  it('should parse status column values', () => {
    const { parseColumnValue } = require('../column-mapper');
    const statusValue = '{"label":"Critical"}';
    expect(parseColumnValue(statusValue, 'status')).toBe('Critical');
  });

  it('should parse dropdown column values', () => {
    const { parseColumnValue } = require('../column-mapper');
    const dropdownValue = '{"label":"Expense"}';
    expect(parseColumnValue(dropdownValue, 'dropdown')).toBe('Expense');
  });

  it('should handle null values', () => {
    const { parseColumnValue } = require('../column-mapper');
    expect(parseColumnValue(null, 'numbers')).toBeNull();
    expect(parseColumnValue(null, 'text')).toBeNull();
  });
});

describe('Column Value Formatting', () => {
  it('should format numeric values', () => {
    const { formatColumnValue } = require('../column-mapper');
    expect(formatColumnValue(10000, 'numbers')).toBe('10000');
    expect(formatColumnValue(null, 'numbers')).toBeNull();
  });

  it('should format status values', () => {
    const { formatColumnValue } = require('../column-mapper');
    const formatted = formatColumnValue('Critical', 'status');
    expect(formatted).toContain('label');
    expect(formatted).toContain('Critical');
  });

  it('should format text values', () => {
    const { formatColumnValue } = require('../column-mapper');
    expect(formatColumnValue('Hello', 'text')).toBe('Hello');
  });
});

describe('Integration Workflow', () => {
  it('should extract budget and actual data from board items', () => {
    const mapper = new ColumnMapper(mockBoard.columns);
    const mapping = mapper.detectColumns();

    const items = mockBoard.items_page?.items || [];

    // Extract budget amounts
    const budgetAmounts = items.map((item) => {
      const budgetValue = item.column_values.find(
        (cv) => cv.id === mapping.budgetColumn
      );
      return parseFloat(budgetValue?.value || '0');
    });

    expect(budgetAmounts).toEqual([10000, 50000]);
  });

  it('should extract actual amounts from board items', () => {
    const mapper = new ColumnMapper(mockBoard.columns);
    const mapping = mapper.detectColumns();

    const items = mockBoard.items_page?.items || [];

    // Extract actual amounts
    const actualAmounts = items.map((item) => {
      const actualValue = item.column_values.find(
        (cv) => cv.id === mapping.actualColumn
      );
      return parseFloat(actualValue?.value || '0');
    });

    expect(actualAmounts).toEqual([12000, 45000]);
  });

  it('should identify account types from board items', () => {
    const mapper = new ColumnMapper(mockBoard.columns);
    const mapping = mapper.detectColumns();

    const items = mockBoard.items_page?.items || [];

    // Extract account types
    const accountTypes = items.map((item) => {
      const typeValue = item.column_values.find(
        (cv) => cv.id === mapping.accountTypeColumn
      );

      if (!typeValue?.value) return 'expense';

      const parsed = JSON.parse(typeValue.value);
      const label = parsed.label?.toLowerCase() || '';

      return label.includes('revenue') ? 'revenue' : 'expense';
    });

    expect(accountTypes).toEqual(['expense', 'revenue']);
  });
});

describe('Error Handling', () => {
  it('should handle missing columns gracefully', () => {
    const emptyBoard: MondayBoard = {
      id: '123',
      name: 'Empty Board',
      columns: [],
    };

    const mapper = new ColumnMapper(emptyBoard.columns);
    const mapping = mapper.detectColumns();

    expect(mapping.budgetColumn).toBeUndefined();
    expect(mapping.actualColumn).toBeUndefined();
  });

  it('should handle archived columns', () => {
    const boardWithArchived: MondayBoard = {
      id: '123',
      name: 'Test',
      columns: [
        { id: 'numbers_1', title: 'Budget', type: 'numbers', archived: true },
        { id: 'numbers_2', title: 'Actual', type: 'numbers', archived: false },
      ],
    };

    const mapper = new ColumnMapper(boardWithArchived.columns);
    const numericColumns = mapper.getNumericColumns();

    // Should exclude archived columns
    expect(numericColumns).toHaveLength(1);
    expect(numericColumns[0].id).toBe('numbers_2');
  });
});
