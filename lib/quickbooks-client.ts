import { IntuitOAuthClient } from 'intuit-oauth';

export interface QBAccount {
  id: string;
  name: string;
  accountType: string;
  accountSubType?: string;
  classification: string;
  balance?: number;
  active: boolean;
}

export interface QBTransaction {
  id: string;
  type: 'Expense' | 'Purchase' | 'JournalEntry' | 'Bill' | 'Check';
  amount: number;
  date: string;
  description?: string;
  account: {
    id: string;
    name: string;
  };
  vendor?: {
    id: string;
    name: string;
  };
  customer?: {
    id: string;
    name: string;
  };
  department?: {
    id: string;
    name: string;
  };
  class?: {
    id: string;
    name: string;
  };
  memo?: string;
}

export interface QBProfitAndLoss {
  reportName: string;
  startDate: string;
  endDate: string;
  currency: string;
  columns: QBReportColumn[];
  rows: QBReportRow[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
}

export interface QBReportColumn {
  type: string;
  metadata: {
    name: string;
    value: string;
  }[];
}

export interface QBReportRow {
  type: 'Section' | 'Data';
  group?: string;
  summary?: {
    name: string;
    value: number;
  };
  colData?: Array<{
    value: string;
    id?: string;
  }>;
}

export class QuickBooksClient {
  private oauthClient: IntuitOAuthClient;
  private accessToken: string;
  private realmId: string;
  private baseUrl: string;

  constructor(accessToken: string, realmId: string, sandbox = true) {
    this.accessToken = accessToken;
    this.realmId = realmId;
    this.baseUrl = sandbox 
      ? 'https://sandbox-quickbooks.api.intuit.com'
      : 'https://quickbooks.api.intuit.com';
    
    this.oauthClient = new IntuitOAuthClient({
      clientId: process.env.QUICKBOOKS_CLIENT_ID!,
      clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET!,
      environment: sandbox ? 'sandbox' : 'production',
      redirectUri: process.env.QUICKBOOKS_REDIRECT_URI!,
    });
  }

  private async makeRequest(endpoint: string) {
    try {
      const url = `${this.baseUrl}/v3/company/${this.realmId}/${endpoint}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`QuickBooks API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('QuickBooks API request failed:', error);
      throw error;
    }
  }

  async getAccounts(): Promise<QBAccount[]> {
    try {
      const data = await this.makeRequest("query?query=SELECT * FROM Account");
      
      if (!data.QueryResponse?.Account) {
        return [];
      }

      return data.QueryResponse.Account.map((account: any) => ({
        id: account.Id,
        name: account.Name,
        accountType: account.AccountType,
        accountSubType: account.AccountSubType,
        classification: account.Classification,
        balance: account.CurrentBalance || 0,
        active: account.Active,
      }));
    } catch (error) {
      console.error('Error fetching accounts:', error);
      throw new Error('Failed to fetch QuickBooks accounts');
    }
  }

  async getExpenses(startDate: string, endDate: string): Promise<QBTransaction[]> {
    try {
      const query = `SELECT * FROM Purchase WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}'`;
      const data = await this.makeRequest(`query?query=${encodeURIComponent(query)}`);
      
      const transactions: QBTransaction[] = [];
      
      if (data.QueryResponse?.Purchase) {
        data.QueryResponse.Purchase.forEach((purchase: any) => {
          if (purchase.Line) {
            purchase.Line.forEach((line: any) => {
              if (line.DetailType === 'AccountBasedExpenseLineDetail') {
                transactions.push({
                  id: `${purchase.Id}-${line.Id}`,
                  type: 'Purchase',
                  amount: parseFloat(line.Amount),
                  date: purchase.TxnDate,
                  description: line.Description || purchase.PrivateNote,
                  account: {
                    id: line.AccountBasedExpenseLineDetail.AccountRef.value,
                    name: line.AccountBasedExpenseLineDetail.AccountRef.name,
                  },
                  vendor: purchase.EntityRef ? {
                    id: purchase.EntityRef.value,
                    name: purchase.EntityRef.name,
                  } : undefined,
                  memo: purchase.PrivateNote,
                });
              }
            });
          }
        });
      }

      return transactions;
    } catch (error) {
      console.error('Error fetching expenses:', error);
      throw new Error('Failed to fetch QuickBooks expenses');
    }
  }

  async getJournalEntries(startDate: string, endDate: string): Promise<QBTransaction[]> {
    try {
      const query = `SELECT * FROM JournalEntry WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}'`;
      const data = await this.makeRequest(`query?query=${encodeURIComponent(query)}`);
      
      const transactions: QBTransaction[] = [];
      
      if (data.QueryResponse?.JournalEntry) {
        data.QueryResponse.JournalEntry.forEach((entry: any) => {
          if (entry.Line) {
            entry.Line.forEach((line: any) => {
              if (line.DetailType === 'JournalEntryLineDetail' && line.JournalEntryLineDetail.PostingType === 'Debit') {
                transactions.push({
                  id: `${entry.Id}-${line.Id}`,
                  type: 'JournalEntry',
                  amount: parseFloat(line.Amount),
                  date: entry.TxnDate,
                  description: line.Description || entry.PrivateNote,
                  account: {
                    id: line.JournalEntryLineDetail.AccountRef.value,
                    name: line.JournalEntryLineDetail.AccountRef.name,
                  },
                  department: line.JournalEntryLineDetail.DepartmentRef ? {
                    id: line.JournalEntryLineDetail.DepartmentRef.value,
                    name: line.JournalEntryLineDetail.DepartmentRef.name,
                  } : undefined,
                  class: line.JournalEntryLineDetail.ClassRef ? {
                    id: line.JournalEntryLineDetail.ClassRef.value,
                    name: line.JournalEntryLineDetail.ClassRef.name,
                  } : undefined,
                  memo: entry.PrivateNote,
                });
              }
            });
          }
        });
      }

      return transactions;
    } catch (error) {
      console.error('Error fetching journal entries:', error);
      throw new Error('Failed to fetch QuickBooks journal entries');
    }
  }

  async getAllTransactions(startDate: string, endDate: string): Promise<QBTransaction[]> {
    try {
      const [expenses, journalEntries] = await Promise.all([
        this.getExpenses(startDate, endDate),
        this.getJournalEntries(startDate, endDate),
      ]);

      return [...expenses, ...journalEntries].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    } catch (error) {
      console.error('Error fetching all transactions:', error);
      throw new Error('Failed to fetch QuickBooks transactions');
    }
  }

  async getCompanyInfo() {
    try {
      const data = await this.makeRequest("companyinfo/1");
      return data.QueryResponse?.CompanyInfo?.[0];
    } catch (error) {
      console.error('Error fetching company info:', error);
      throw new Error('Failed to fetch QuickBooks company information');
    }
  }

  async getProfitAndLoss(startDate: string, endDate: string): Promise<QBProfitAndLoss> {
    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        accounting_method: 'Accrual',
      });

      const data = await this.makeRequest(`reports/ProfitAndLoss?${params.toString()}`);

      if (!data.Rows) {
        throw new Error('Invalid P&L report response from QuickBooks');
      }

      // Parse the complex nested structure from QuickBooks
      let totalRevenue = 0;
      let totalExpenses = 0;
      let netIncome = 0;

      const rows: QBReportRow[] = data.Rows.Row.map((row: any) => {
        if (row.type === 'Section') {
          // Section rows contain summary data for revenue/expenses
          const summaryValue = parseFloat(row.Summary?.ColData?.[0]?.value || '0');

          // Identify revenue and expense sections
          if (row.group === 'Income' || row.Header?.ColData?.[0]?.value?.includes('Income')) {
            totalRevenue += summaryValue;
          } else if (row.group === 'Expenses' || row.Header?.ColData?.[0]?.value?.includes('Expense')) {
            totalExpenses += summaryValue;
          }

          return {
            type: 'Section' as const,
            group: row.group || row.Header?.ColData?.[0]?.value,
            summary: {
              name: row.Summary?.ColData?.[0]?.value || '',
              value: summaryValue,
            },
          };
        } else {
          // Data rows contain individual line items
          return {
            type: 'Data' as const,
            colData: row.ColData?.map((col: any) => ({
              value: col.value || '',
              id: col.id,
            })),
          };
        }
      });

      // Net income is typically the last row or calculated as revenue - expenses
      const lastRow = data.Rows.Row[data.Rows.Row.length - 1];
      if (lastRow?.Summary?.ColData?.[0]?.value) {
        netIncome = parseFloat(lastRow.Summary.ColData[0].value);
      } else {
        netIncome = totalRevenue - totalExpenses;
      }

      return {
        reportName: data.Header?.ReportName || 'Profit and Loss',
        startDate: data.Header?.StartPeriod || startDate,
        endDate: data.Header?.EndPeriod || endDate,
        currency: data.Header?.Currency || 'USD',
        columns: data.Columns?.Column || [],
        rows,
        totalRevenue,
        totalExpenses,
        netIncome,
      };
    } catch (error) {
      console.error('Error fetching P&L report:', error);
      throw new Error('Failed to fetch QuickBooks P&L report');
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    x_refresh_token_expires_in: number;
  }> {
    try {
      const authResponse = await this.oauthClient.refreshUsingToken(refreshToken);
      const token = authResponse.getToken();

      console.log('QuickBooks token refreshed successfully');

      return {
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_in: token.expires_in || 3600,
        x_refresh_token_expires_in: token.x_refresh_token_expires_in || 8726400,
      };
    } catch (error) {
      console.error('Error refreshing QuickBooks token:', error);
      throw new Error('Failed to refresh QuickBooks access token');
    }
  }
}