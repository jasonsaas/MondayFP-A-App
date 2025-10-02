/**
 * Variance Engine - Integration Helpers
 *
 * Utility functions for integrating variance engine with Monday.com and QuickBooks
 */

import { BudgetItem, ActualItem, AccountType } from './types';

/**
 * Transform Monday.com board items to budget items
 *
 * Assumes board structure:
 * - "Account Name" column (text)
 * - "Account Type" column (dropdown: revenue/expense)
 * - "Budget Amount" column (number)
 * - "Period" column (date or text)
 * - "Account Code" column (text, optional)
 * - "Parent Account" column (text, optional)
 */
export interface MondayBoardItem {
  id: string;
  name: string;
  column_values: {
    id: string;
    value: string;
  }[];
}

export function transformMondayBoardToBudgetItems(
  boardItems: MondayBoardItem[],
  period: string,
  columnMapping?: {
    accountName?: string;
    accountType?: string;
    budgetAmount?: string;
    accountCode?: string;
    parentAccount?: string;
  }
): BudgetItem[] {
  const mapping = {
    accountName: columnMapping?.accountName || 'account_name',
    accountType: columnMapping?.accountType || 'account_type',
    budgetAmount: columnMapping?.budgetAmount || 'budget_amount',
    accountCode: columnMapping?.accountCode || 'account_code',
    parentAccount: columnMapping?.parentAccount || 'parent_account',
  };

  return boardItems.map((item) => {
    const getColumnValue = (columnId: string) => {
      const column = item.column_values.find((col) => col.id === columnId);
      return column?.value ? JSON.parse(column.value) : null;
    };

    const accountName = getColumnValue(mapping.accountName)?.text || item.name;
    const accountTypeValue = getColumnValue(mapping.accountType)?.label || 'expense';
    const budgetAmount = parseFloat(getColumnValue(mapping.budgetAmount) || '0');
    const accountCode = getColumnValue(mapping.accountCode)?.text;
    const parentAccount = getColumnValue(mapping.parentAccount)?.text;

    // Map Monday dropdown values to AccountType
    const accountType: AccountType = mapToAccountType(accountTypeValue);

    return {
      accountId: item.id,
      accountName,
      accountCode,
      accountType,
      amount: budgetAmount,
      period,
      parentAccountId: parentAccount || undefined,
    };
  });
}

/**
 * Transform QuickBooks P&L report to actual items
 *
 * Handles QuickBooks API response structure from ProfitAndLoss report
 */
export interface QuickBooksPLRow {
  type?: string;
  Header?: {
    ColData: Array<{ value: string; id?: string }>;
  };
  Summary?: {
    ColData: Array<{ value: string }>;
  };
  Rows?: {
    Row: QuickBooksPLRow[];
  };
  ColData?: Array<{ value: string }>;
  group?: string;
}

export interface QuickBooksPLReport {
  Rows: {
    Row: QuickBooksPLRow[];
  };
  Header?: {
    StartPeriod: string;
    EndPeriod: string;
  };
}

export function transformQuickBooksPLToActualItems(
  plReport: QuickBooksPLReport,
  period: string
): ActualItem[] {
  const actualItems: ActualItem[] = [];

  function processRow(
    row: QuickBooksPLRow,
    parentAccountId?: string,
    parentAccountType?: AccountType
  ) {
    if (!row) return;

    // Handle section rows (Income, Expenses, etc.)
    if (row.type === 'Section' && row.Rows?.Row) {
      const sectionName = row.Header?.ColData?.[0]?.value || '';
      const accountType = determineSectionType(sectionName);

      row.Rows.Row.forEach((childRow) => {
        processRow(childRow, undefined, accountType);
      });
      return;
    }

    // Handle data rows
    if (row.type === 'Data' && row.ColData) {
      const accountName = row.ColData[0]?.value;
      const amountStr = row.ColData[1]?.value;

      if (!accountName || !amountStr) return;

      // Parse amount (remove commas, handle negatives)
      const amount = parseFloat(amountStr.replace(/,/g, '')) || 0;

      actualItems.push({
        accountId: generateAccountId(accountName),
        accountName,
        accountType: parentAccountType || 'expense',
        amount: Math.abs(amount), // Use absolute values
        period,
        parentAccountId,
      });
    }

    // Handle subtotal rows (category groupings)
    if (row.group === 'Category' && row.Header && row.Rows?.Row) {
      const categoryName = row.Header.ColData?.[0]?.value;
      const categoryId = generateAccountId(categoryName || '');

      row.Rows.Row.forEach((childRow) => {
        processRow(childRow, categoryId, parentAccountType);
      });
    }
  }

  // Process all rows
  plReport.Rows?.Row?.forEach((row) => processRow(row));

  return actualItems;
}

/**
 * Determine account type from QuickBooks section name
 */
function determineSectionType(sectionName: string): AccountType {
  const lowerName = sectionName.toLowerCase();

  if (lowerName.includes('income') || lowerName.includes('revenue')) {
    return 'revenue';
  }

  if (
    lowerName.includes('expense') ||
    lowerName.includes('cost') ||
    lowerName.includes('operating')
  ) {
    return 'expense';
  }

  if (lowerName.includes('asset')) {
    return 'asset';
  }

  if (lowerName.includes('liability')) {
    return 'liability';
  }

  if (lowerName.includes('equity')) {
    return 'equity';
  }

  return 'expense'; // Default to expense
}

/**
 * Map Monday dropdown value to AccountType
 */
function mapToAccountType(value: string): AccountType {
  const lowerValue = value.toLowerCase();

  if (lowerValue.includes('revenue') || lowerValue.includes('income')) {
    return 'revenue';
  }

  if (lowerValue.includes('expense') || lowerValue.includes('cost')) {
    return 'expense';
  }

  if (lowerValue.includes('asset')) {
    return 'asset';
  }

  if (lowerValue.includes('liability')) {
    return 'liability';
  }

  if (lowerValue.includes('equity')) {
    return 'equity';
  }

  return 'expense'; // Default
}

/**
 * Generate consistent account ID from account name
 */
function generateAccountId(accountName: string): string {
  return accountName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Match Monday budget items with QuickBooks actual items
 *
 * Handles cases where account names don't match exactly
 */
export function matchBudgetWithActuals(
  budgetItems: BudgetItem[],
  actualItems: ActualItem[]
): {
  matched: Array<{ budget: BudgetItem; actual: ActualItem }>;
  unmatchedBudget: BudgetItem[];
  unmatchedActual: ActualItem[];
} {
  const matched: Array<{ budget: BudgetItem; actual: ActualItem }> = [];
  const unmatchedBudget: BudgetItem[] = [];
  const unmatchedActual: ActualItem[] = [...actualItems];

  for (const budget of budgetItems) {
    // Try exact ID match first
    let actualIndex = unmatchedActual.findIndex(
      (a) => a.accountId === budget.accountId
    );

    // Try exact name match
    if (actualIndex === -1) {
      actualIndex = unmatchedActual.findIndex(
        (a) => a.accountName.toLowerCase() === budget.accountName.toLowerCase()
      );
    }

    // Try fuzzy name match (remove spaces, punctuation)
    if (actualIndex === -1) {
      const normalizedBudgetName = budget.accountName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      actualIndex = unmatchedActual.findIndex(
        (a) =>
          a.accountName.toLowerCase().replace(/[^a-z0-9]/g, '') ===
          normalizedBudgetName
      );
    }

    if (actualIndex !== -1) {
      matched.push({
        budget,
        actual: unmatchedActual[actualIndex],
      });
      unmatchedActual.splice(actualIndex, 1);
    } else {
      unmatchedBudget.push(budget);
    }
  }

  return {
    matched,
    unmatchedBudget,
    unmatchedActual,
  };
}

/**
 * Convert period string to QuickBooks date format
 */
export function formatPeriodForQuickBooks(
  period: string
): { startDate: string; endDate: string } {
  // Handle "YYYY-MM" format
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [year, month] = period.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of month

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };
  }

  // Handle "YYYY-QX" format (quarters)
  if (/^\d{4}-Q[1-4]$/.test(period)) {
    const [year, quarter] = period.split('-');
    const q = parseInt(quarter.replace('Q', ''));
    const startMonth = (q - 1) * 3;
    const endMonth = startMonth + 2;

    const startDate = new Date(parseInt(year), startMonth, 1);
    const endDate = new Date(parseInt(year), endMonth + 1, 0);

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };
  }

  // Handle "YYYY" format (full year)
  if (/^\d{4}$/.test(period)) {
    return {
      startDate: `${period}-01-01`,
      endDate: `${period}-12-31`,
    };
  }

  throw new Error(`Unsupported period format: ${period}`);
}

/**
 * Complete integration example
 */
export async function performVarianceAnalysisFromSources(
  mondayBoardId: string,
  period: string,
  mondayApiKey: string,
  quickbooksRealmId: string,
  quickbooksAccessToken: string
): Promise<any> {
  // 1. Fetch budget from Monday.com
  const mondayResponse = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: {
      'Authorization': mondayApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `
        query {
          boards(ids: ${mondayBoardId}) {
            items_page {
              items {
                id
                name
                column_values {
                  id
                  value
                }
              }
            }
          }
        }
      `,
    }),
  });

  const mondayData = await mondayResponse.json();
  const mondayItems = mondayData.data.boards[0].items_page.items;

  // Transform to budget items
  const budgetItems = transformMondayBoardToBudgetItems(mondayItems, period);

  // 2. Fetch actuals from QuickBooks
  const { startDate, endDate } = formatPeriodForQuickBooks(period);

  const qbResponse = await fetch(
    `https://quickbooks.api.intuit.com/v3/company/${quickbooksRealmId}/reports/ProfitAndLoss?` +
      `start_date=${startDate}&end_date=${endDate}`,
    {
      headers: {
        'Authorization': `Bearer ${quickbooksAccessToken}`,
        'Accept': 'application/json',
      },
    }
  );

  const plReport = await qbResponse.json();

  // Transform to actual items
  const actualItems = transformQuickBooksPLToActualItems(plReport, period);

  // 3. Analyze variances
  const { VarianceEngine } = await import('./engine');
  const engine = new VarianceEngine();

  const result = await engine.analyze(budgetItems, actualItems, {
    generateInsights: true,
    includeChildren: true,
  });

  return result;
}
