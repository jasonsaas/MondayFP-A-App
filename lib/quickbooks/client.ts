/**
 * QuickBooks Online API Client
 *
 * Production-ready client for QuickBooks Online API v3
 * Handles OAuth token refresh, rate limiting, and data transformation
 */

import {
  QBOAuthToken,
  QBAccount,
  QBAccountsResponse,
  QBProfitLossReport,
  QBBalanceSheetReport,
  StandardAccount,
  StandardPLReport,
  StandardPLLineItem,
  QuickBooksError,
  QB_RATE_LIMITS,
  QB_API_ENDPOINTS,
  QBReportRow,
} from './types';

export interface QBClientOptions {
  clientId: string;
  clientSecret: string;
  environment?: 'sandbox' | 'production';
  minorVersion?: number;
  timeout?: number;
}

export class QuickBooksClient {
  private clientId: string;
  private clientSecret: string;
  private environment: 'sandbox' | 'production';
  private minorVersion: number;
  private timeout: number;
  private baseUrl: string;
  private authUrl: string;

  // Rate limiting
  private requestCount = 0;
  private requestResetTime: Date;

  constructor(options: QBClientOptions) {
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.environment = options.environment || 'production';
    this.minorVersion = options.minorVersion || 65;
    this.timeout = options.timeout || 30000;

    this.baseUrl =
      this.environment === 'production'
        ? QB_API_ENDPOINTS.PRODUCTION
        : QB_API_ENDPOINTS.SANDBOX;
    this.authUrl = QB_API_ENDPOINTS.AUTH;

    this.requestResetTime = new Date(Date.now() + 60000);
  }

  /**
   * Refresh OAuth access token
   */
  async refreshToken(refreshToken: string): Promise<QBOAuthToken> {
    try {
      const credentials = Buffer.from(
        `${this.clientId}:${this.clientSecret}`
      ).toString('base64');

      const response = await fetch(`${this.authUrl}/oauth2/v1/tokens/bearer`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new QuickBooksError(
          error.error_description || 'Token refresh failed',
          error.error || 'token_refresh_error',
          response.status,
          undefined,
          false // Token refresh errors are not retryable
        );
      }

      const tokenData = await response.json();

      return {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_type: tokenData.token_type,
        expires_in: tokenData.expires_in,
        x_refresh_token_expires_in: tokenData.x_refresh_token_expires_in,
        created_at: Math.floor(Date.now() / 1000),
        realm_id: '', // Will be set by caller
      };
    } catch (error: any) {
      if (error instanceof QuickBooksError) throw error;

      throw new QuickBooksError(
        'Failed to refresh token',
        'token_refresh_error',
        undefined,
        error.message,
        false
      );
    }
  }

  /**
   * Fetch Chart of Accounts
   */
  async getAccounts(
    token: string,
    realmId: string,
    options?: {
      startPosition?: number;
      maxResults?: number;
      activeOnly?: boolean;
    }
  ): Promise<{ accounts: QBAccount[]; hasMore: boolean }> {
    const startPosition = options?.startPosition || 1;
    const maxResults = options?.maxResults || 1000;

    let query = `SELECT * FROM Account`;

    if (options?.activeOnly) {
      query += ` WHERE Active = true`;
    }

    query += ` STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`;

    const response = await this.executeQuery<QBAccountsResponse>(
      token,
      realmId,
      query
    );

    const accounts = response.QueryResponse.Account || [];
    const totalCount = response.QueryResponse.totalCount || accounts.length;
    const hasMore = startPosition + accounts.length < totalCount;

    return { accounts, hasMore };
  }

  /**
   * Fetch all accounts with pagination
   */
  async getAllAccounts(
    token: string,
    realmId: string,
    activeOnly = true
  ): Promise<QBAccount[]> {
    const allAccounts: QBAccount[] = [];
    let startPosition = 1;
    let hasMore = true;

    while (hasMore) {
      const { accounts, hasMore: more } = await this.getAccounts(
        token,
        realmId,
        {
          startPosition,
          maxResults: 1000,
          activeOnly,
        }
      );

      allAccounts.push(...accounts);
      startPosition += accounts.length;
      hasMore = more;

      // Add delay to avoid rate limits
      if (hasMore) {
        await this.sleep(200);
      }
    }

    return allAccounts;
  }

  /**
   * Fetch Profit & Loss Report
   */
  async getProfitLossReport(
    token: string,
    realmId: string,
    startDate: string,
    endDate: string,
    options?: {
      accountingMethod?: 'Accrual' | 'Cash';
      summarizeBy?: 'Month' | 'Quarter' | 'Year' | 'Total';
    }
  ): Promise<QBProfitLossReport> {
    const accountingMethod = options?.accountingMethod || 'Accrual';
    const summarizeBy = options?.summarizeBy || 'Total';

    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      accounting_method: accountingMethod,
      summarize_column_by: summarizeBy,
    });

    const response = await this.makeRequest<QBProfitLossReport>(
      'GET',
      `/v3/company/${realmId}/reports/ProfitAndLoss?${params}`,
      token
    );

    return response;
  }

  /**
   * Fetch Balance Sheet Report
   */
  async getBalanceSheet(
    token: string,
    realmId: string,
    date: string,
    options?: {
      accountingMethod?: 'Accrual' | 'Cash';
    }
  ): Promise<QBBalanceSheetReport> {
    const accountingMethod = options?.accountingMethod || 'Accrual';

    const params = new URLSearchParams({
      report_date: date,
      accounting_method: accountingMethod,
    });

    const response = await this.makeRequest<QBBalanceSheetReport>(
      'GET',
      `/v3/company/${realmId}/reports/BalanceSheet?${params}`,
      token
    );

    return response;
  }

  /**
   * Transform QB accounts to standard format
   */
  transformAccounts(qbAccounts: QBAccount[]): StandardAccount[] {
    return qbAccounts.map((account) => ({
      id: account.Id,
      name: account.Name,
      fullyQualifiedName: account.FullyQualifiedName,
      accountNumber: account.AcctNum,
      type: this.mapAccountType(account.AccountType),
      subType: account.AccountSubType,
      balance: account.CurrentBalance || 0,
      active: account.Active,
      parentId: account.ParentRef?.value,
      isSubAccount: account.SubAccount || false,
      currency: account.CurrencyRef?.value || 'USD',
      lastUpdated: new Date(account.MetaData.LastUpdatedTime),
    }));
  }

  /**
   * Transform P&L report to standard format
   */
  transformProfitLoss(report: QBProfitLossReport): StandardPLReport {
    const lineItems: StandardPLLineItem[] = [];
    let totalRevenue = 0;
    let totalExpenses = 0;
    let totalCOGS = 0;

    // Process report rows
    this.processReportRows(report.Rows.Row, lineItems, 0);

    // Calculate totals from line items
    lineItems.forEach((item) => {
      if (item.accountType === 'revenue') {
        totalRevenue += item.amount;
      } else if (item.accountType === 'expense') {
        totalExpenses += item.amount;
      } else if (item.accountType === 'cogs') {
        totalCOGS += item.amount;
      }
    });

    const netIncome = totalRevenue - totalExpenses - totalCOGS;

    return {
      period: {
        startDate: report.Header.StartPeriod || '',
        endDate: report.Header.EndPeriod || '',
      },
      currency: report.Header.Currency || 'USD',
      totalRevenue,
      totalExpenses,
      totalCOGS,
      netIncome,
      lineItems,
      generatedAt: new Date(),
    };
  }

  /**
   * Process report rows recursively
   */
  private processReportRows(
    rows: QBReportRow[],
    lineItems: StandardPLLineItem[],
    level: number,
    parentName?: string
  ): void {
    for (const row of rows) {
      // Handle section rows (Income, Expenses, etc.)
      if (row.type === 'Section' && row.Rows?.Row) {
        const sectionName = row.Header?.ColData?.[0]?.value || '';
        this.processReportRows(row.Rows.Row, lineItems, level + 1, sectionName);
        continue;
      }

      // Handle data rows
      if (row.ColData && row.ColData.length > 0) {
        const accountName = row.ColData[0]?.value;
        const amountStr = row.ColData[1]?.value;

        if (!accountName || !amountStr) continue;

        const amount = this.parseAmount(amountStr);

        lineItems.push({
          accountId: row.ColData[0]?.id,
          accountName,
          accountType: this.mapAccountTypeFromSection(parentName),
          amount,
          parentName,
          level,
          isSubtotal: false,
        });
      }

      // Handle summary rows (subtotals)
      if (row.Summary?.ColData) {
        const summaryName = row.Header?.ColData?.[0]?.value;
        const summaryAmount = row.Summary.ColData[1]?.value;

        if (summaryName && summaryAmount) {
          lineItems.push({
            accountName: summaryName,
            accountType: this.mapAccountTypeFromSection(parentName),
            amount: this.parseAmount(summaryAmount),
            parentName,
            level,
            isSubtotal: true,
          });
        }
      }

      // Recursively process nested rows
      if (row.Rows?.Row) {
        this.processReportRows(row.Rows.Row, lineItems, level + 1, parentName);
      }
    }
  }

  /**
   * Execute query against QuickBooks API
   */
  private async executeQuery<T>(
    token: string,
    realmId: string,
    query: string
  ): Promise<T> {
    const encodedQuery = encodeURIComponent(query);
    return this.makeRequest<T>(
      'GET',
      `/v3/company/${realmId}/query?query=${encodedQuery}`,
      token
    );
  }

  /**
   * Make HTTP request to QuickBooks API
   */
  private async makeRequest<T>(
    method: string,
    path: string,
    token: string,
    body?: any,
    attemptCount = 0
  ): Promise<T> {
    // Check rate limit
    await this.checkRateLimit();

    try {
      const url = `${this.baseUrl}${path}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      };

      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Increment request count
      this.requestCount++;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw await this.createApiError(response, errorData);
      }

      const data = await response.json();

      // Check for QuickBooks error in response
      if (data.Fault) {
        throw this.createQBFaultError(data.Fault);
      }

      return data;
    } catch (error: any) {
      // Handle retryable errors
      if (
        error instanceof QuickBooksError &&
        error.retryable &&
        attemptCount < QB_RATE_LIMITS.MAX_RETRIES
      ) {
        const delay = this.calculateRetryDelay(attemptCount);
        console.log(
          `Retrying QuickBooks request after ${delay}ms (attempt ${attemptCount + 1}/${QB_RATE_LIMITS.MAX_RETRIES})`
        );
        await this.sleep(delay);
        return this.makeRequest<T>(method, path, token, body, attemptCount + 1);
      }

      throw error;
    }
  }

  /**
   * Check and enforce rate limits
   */
  private async checkRateLimit(): Promise<void> {
    const now = new Date();

    // Reset counter if minute has passed
    if (now >= this.requestResetTime) {
      this.requestCount = 0;
      this.requestResetTime = new Date(now.getTime() + 60000);
    }

    // Wait if we're at the limit
    if (this.requestCount >= QB_RATE_LIMITS.REQUESTS_PER_MINUTE) {
      const waitTime = this.requestResetTime.getTime() - now.getTime();
      console.log(`Rate limit reached, waiting ${waitTime}ms...`);
      await this.sleep(waitTime);

      // Reset after waiting
      this.requestCount = 0;
      this.requestResetTime = new Date(Date.now() + 60000);
    }
  }

  /**
   * Create API error from response
   */
  private async createApiError(
    response: Response,
    errorData: any
  ): Promise<QuickBooksError> {
    const statusCode = response.status;

    // Token expired (401)
    if (statusCode === 401) {
      return new QuickBooksError(
        'Access token expired',
        'token_expired',
        statusCode,
        'Please refresh your access token',
        false
      );
    }

    // Rate limit (429)
    if (statusCode === 429) {
      return new QuickBooksError(
        'Rate limit exceeded',
        'rate_limit_exceeded',
        statusCode,
        'Too many requests',
        true
      );
    }

    // Server errors (500-599)
    if (statusCode >= 500) {
      return new QuickBooksError(
        'QuickBooks server error',
        'server_error',
        statusCode,
        errorData.message || response.statusText,
        true
      );
    }

    // Client errors (400-499)
    return new QuickBooksError(
      errorData.error || 'QuickBooks API error',
      errorData.error_description || 'api_error',
      statusCode,
      errorData.message,
      false
    );
  }

  /**
   * Create error from QuickBooks Fault response
   */
  private createQBFaultError(fault: any): QuickBooksError {
    const error = fault.Error?.[0];
    if (!error) {
      return new QuickBooksError('Unknown QuickBooks error', 'unknown_error');
    }

    return new QuickBooksError(
      error.Message || 'QuickBooks API error',
      error.code || 'api_error',
      undefined,
      error.Detail,
      false
    );
  }

  /**
   * Map QuickBooks account type to standard type
   */
  private mapAccountType(
    qbType: string
  ): 'revenue' | 'expense' | 'asset' | 'liability' | 'equity' {
    const typeMap: Record<string, any> = {
      Income: 'revenue',
      Expense: 'expense',
      'Cost of Goods Sold': 'expense',
      'Other Expense': 'expense',
      Asset: 'asset',
      'Other Current Asset': 'asset',
      'Fixed Asset': 'asset',
      'Other Asset': 'asset',
      Liability: 'liability',
      'Other Current Liability': 'liability',
      'Long Term Liability': 'liability',
      Equity: 'equity',
    };

    return typeMap[qbType] || 'expense';
  }

  /**
   * Map section name to account type
   */
  private mapAccountTypeFromSection(
    sectionName?: string
  ): 'revenue' | 'expense' | 'cogs' {
    if (!sectionName) return 'expense';

    const lowerSection = sectionName.toLowerCase();

    if (
      lowerSection.includes('income') ||
      lowerSection.includes('revenue')
    ) {
      return 'revenue';
    }

    if (lowerSection.includes('cost of goods sold')) {
      return 'cogs';
    }

    return 'expense';
  }

  /**
   * Parse amount string to number
   */
  private parseAmount(amountStr: string): number {
    // Remove currency symbols, commas, and parentheses
    const cleaned = amountStr.replace(/[$,()]/g, '').trim();

    // Handle negative values in parentheses
    const isNegative = amountStr.includes('(') && amountStr.includes(')');

    const amount = parseFloat(cleaned) || 0;
    return isNegative ? -amount : amount;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attemptCount: number): number {
    return QB_RATE_LIMITS.RETRY_DELAY_MS * Math.pow(2, attemptCount);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get company info
   */
  async getCompanyInfo(token: string, realmId: string): Promise<any> {
    return this.makeRequest('GET', `/v3/company/${realmId}/companyinfo/${realmId}`, token);
  }

  /**
   * Get preferences
   */
  async getPreferences(token: string, realmId: string): Promise<any> {
    return this.makeRequest('GET', `/v3/company/${realmId}/preferences`, token);
  }
}

// Export singleton factory
export function createQuickBooksClient(
  options?: Partial<QBClientOptions>
): QuickBooksClient {
  return new QuickBooksClient({
    clientId: options?.clientId || process.env.QUICKBOOKS_CLIENT_ID!,
    clientSecret: options?.clientSecret || process.env.QUICKBOOKS_CLIENT_SECRET!,
    environment: options?.environment || (process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'),
    minorVersion: options?.minorVersion || 65,
    timeout: options?.timeout || 30000,
  });
}
