/**
 * QuickBooks Online API Types
 *
 * Type definitions for QuickBooks Online API v3
 */

export type QBReportType = 'ProfitAndLoss' | 'BalanceSheet' | 'CashFlow';

export type QBAccountType =
  | 'Income'
  | 'Expense'
  | 'Cost of Goods Sold'
  | 'Asset'
  | 'Liability'
  | 'Equity';

export type QBAccountSubType =
  | 'SalesOfProductIncome'
  | 'ServiceFeeIncome'
  | 'OtherPrimaryIncome'
  | 'AdvertisingPromotional'
  | 'LegalProfessionalFees'
  | 'OfficeGeneralAdministrativeExpenses'
  | 'RentOrLeaseOfBuildings'
  | 'Supplies'
  | 'Travel'
  | string;

// OAuth Token
export interface QBOAuthToken {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
  created_at: number; // Unix timestamp
  realm_id: string; // Company ID
}

// Account from Chart of Accounts
export interface QBAccount {
  Id: string;
  Name: string;
  FullyQualifiedName: string;
  AcctNum?: string;
  Active: boolean;
  Classification: string;
  AccountType: QBAccountType;
  AccountSubType?: QBAccountSubType;
  CurrentBalance: number;
  CurrentBalanceWithSubAccounts?: number;
  CurrencyRef?: {
    value: string;
    name: string;
  };
  ParentRef?: {
    value: string;
    name: string;
  };
  SubAccount?: boolean;
  SyncToken: string;
  MetaData: {
    CreateTime: string;
    LastUpdatedTime: string;
  };
}

// Chart of Accounts Response
export interface QBAccountsResponse {
  QueryResponse: {
    Account: QBAccount[];
    startPosition: number;
    maxResults: number;
    totalCount?: number;
  };
  time: string;
}

// Report Column
export interface QBReportColumn {
  ColTitle?: string;
  ColType: string;
  MetaData?: Array<{
    Name: string;
    Value: string;
  }>;
}

// Report Row Data
export interface QBReportColData {
  value: string;
  id?: string;
  href?: string;
}

// Report Row
export interface QBReportRow {
  type?: 'Section' | 'Data' | 'Group';
  group?: string;
  Header?: {
    ColData: QBReportColData[];
  };
  Rows?: {
    Row: QBReportRow[];
  };
  ColData?: QBReportColData[];
  Summary?: {
    ColData: QBReportColData[];
  };
}

// Profit & Loss Report
export interface QBProfitLossReport {
  Header: {
    Time: string;
    ReportName: string;
    DateMacro?: string;
    ReportBasis: string;
    StartPeriod?: string;
    EndPeriod?: string;
    Currency?: string;
    Option?: Array<{
      Name: string;
      Value: string;
    }>;
  };
  Columns: {
    Column: QBReportColumn[];
  };
  Rows: {
    Row: QBReportRow[];
  };
}

// Balance Sheet Report
export interface QBBalanceSheetReport {
  Header: {
    Time: string;
    ReportName: string;
    ReportBasis: string;
    StartPeriod?: string;
    EndPeriod?: string;
    Currency?: string;
  };
  Columns: {
    Column: QBReportColumn[];
  };
  Rows: {
    Row: QBReportRow[];
  };
}

// Standardized Account Structure
export interface StandardAccount {
  id: string;
  name: string;
  fullyQualifiedName: string;
  accountNumber?: string;
  type: 'revenue' | 'expense' | 'asset' | 'liability' | 'equity';
  subType?: string;
  balance: number;
  active: boolean;
  parentId?: string;
  isSubAccount: boolean;
  currency?: string;
  lastUpdated: Date;
}

// Standardized P&L Line Item
export interface StandardPLLineItem {
  accountId?: string;
  accountName: string;
  accountType: 'revenue' | 'expense' | 'cogs';
  amount: number;
  parentName?: string;
  level: number;
  isSubtotal: boolean;
}

// Standardized P&L Report
export interface StandardPLReport {
  period: {
    startDate: string;
    endDate: string;
  };
  currency: string;
  totalRevenue: number;
  totalExpenses: number;
  totalCOGS: number;
  netIncome: number;
  lineItems: StandardPLLineItem[];
  generatedAt: Date;
}

// Sync Status
export interface QBSyncStatus {
  syncId: string;
  organizationId: string;
  realmId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  itemsSynced: {
    accounts: number;
    plReports: number;
    balanceSheet: number;
  };
  errors: Array<{
    type: string;
    message: string;
    timestamp: Date;
  }>;
  lastSyncedAt?: Date;
}

// Sync Options
export interface QBSyncOptions {
  syncAccounts?: boolean;
  syncPL?: boolean;
  syncBalanceSheet?: boolean;
  startDate?: string;
  endDate?: string;
  incrementalOnly?: boolean;
  forceRefresh?: boolean;
}

// QuickBooks API Error
export interface QBApiError {
  Error: Array<{
    Message: string;
    Detail: string;
    code: string;
    element?: string;
  }>;
  time: string;
}

export class QuickBooksError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public detail?: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'QuickBooksError';
  }
}

// Rate Limit Constants
export const QB_RATE_LIMITS = {
  REQUESTS_PER_MINUTE: 500,
  REQUESTS_PER_APP_PER_COMPANY: 500,
  CONCURRENT_REQUESTS: 10,
  RETRY_DELAY_MS: 1000,
  MAX_RETRIES: 3,
};

// API Endpoints
export const QB_API_ENDPOINTS = {
  SANDBOX: 'https://sandbox-quickbooks.api.intuit.com',
  PRODUCTION: 'https://quickbooks.api.intuit.com',
  AUTH: 'https://oauth.platform.intuit.com',
};

// Cache Keys
export const QB_CACHE_KEYS = {
  ACCOUNTS: (realmId: string) => `qb:accounts:${realmId}`,
  PL_REPORT: (realmId: string, startDate: string, endDate: string) =>
    `qb:pl:${realmId}:${startDate}:${endDate}`,
  BALANCE_SHEET: (realmId: string, date: string) =>
    `qb:bs:${realmId}:${date}`,
  TOKEN: (realmId: string) => `qb:token:${realmId}`,
};

// Cache TTL (in seconds)
export const QB_CACHE_TTL = {
  ACCOUNTS: 3600, // 1 hour
  REPORTS: 1800, // 30 minutes
  TOKEN: 3000, // 50 minutes (tokens expire in 1 hour)
};
