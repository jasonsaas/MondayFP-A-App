/**
 * Sync Orchestrator - Replaces n8n workflows
 *
 * Simple, reliable sync orchestration for FP&A variance analysis
 * Runs entirely in Next.js - no external dependencies
 */

import { db } from '@/lib/db';
import { organizations, varianceSnapshots } from '@/lib/db/schema';
import { MondayClient } from '@/lib/monday/client';
import { QuickBooksClient } from '@/lib/quickbooks/client';
import { VarianceEngine } from '@/lib/variance/engine';
import { eq, desc } from 'drizzle-orm';

export interface SyncResult {
  success: boolean;
  organizationId: string;
  itemsProcessed: number;
  duration: number;
  error?: string;
  timestamp: Date;
  variances?: any[];
}

export interface SyncLog {
  id: string;
  organizationId: string;
  status: 'success' | 'error' | 'running';
  startedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
  recordsProcessed: number;
}

export class SyncOrchestrator {
  /**
   * Main sync method - replaces n8n workflow
   * Fetches budget from Monday, actuals from QuickBooks, calculates variances
   */
  async syncOrganization(organizationId: string): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      console.log(`🔄 Starting sync for organization ${organizationId}`);

      // 1. Get organization with credentials
      const [org] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);

      if (!org) {
        throw new Error(`Organization ${organizationId} not found`);
      }

      if (!org.mondayAccessToken) {
        throw new Error('Monday.com not connected');
      }

      if (!org.quickbooksAccessToken) {
        throw new Error('QuickBooks not connected');
      }

      // 2. Initialize clients
      const mondayClient = new MondayClient({ apiKey: org.mondayAccessToken });
      const qbClient = new QuickBooksClient({
        clientId: process.env.QUICKBOOKS_CLIENT_ID!,
        clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET!,
      });

      // 3. Fetch Monday budget data
      console.log('📊 Fetching Monday budget data...');
      const budgetData = await this.fetchMondayBudget(mondayClient, org);

      // 4. Fetch QuickBooks actuals
      console.log('💰 Fetching QuickBooks actuals...');
      const actualsData = await this.fetchQuickBooksActuals(
        qbClient,
        org.quickbooksCompanyId!,
        org.quickbooksAccessToken!
      );

      // 5. Calculate variances
      console.log('📈 Calculating variances...');
      const variances = await this.calculateVariances(budgetData, actualsData, org);

      // 6. Save to database
      console.log('💾 Saving variance snapshot...');
      const period = new Date().toISOString().slice(0, 7); // YYYY-MM
      await db.insert(varianceSnapshots).values({
        organizationId: org.id,
        boardId: org.settings?.defaultBoardId ? parseInt(org.settings.defaultBoardId) : 0,
        period,
        data: {
          budgetData,
          actualsData,
          variances,
          summary: this.calculateSummary(variances),
          lastSync: new Date(),
        },
      });

      // 7. Optionally update Monday board with variance results
      if (variances.length > 0 && org.settings?.defaultBoardId) {
        console.log('🔄 Updating Monday board...');
        await this.updateMondayBoard(mondayClient, org.settings.defaultBoardId, variances);
      }

      const duration = Date.now() - startTime;
      console.log(`✅ Sync complete in ${duration}ms - ${variances.length} items processed`);

      return {
        success: true,
        organizationId: org.id,
        itemsProcessed: variances.length,
        duration,
        timestamp: new Date(),
        variances,
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      console.error(`❌ Sync failed for ${organizationId}:`, errorMessage);

      return {
        success: false,
        organizationId,
        itemsProcessed: 0,
        duration,
        error: errorMessage,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Manual trigger method - for user-initiated syncs
   */
  async triggerManualSync(userId: string): Promise<SyncResult> {
    // Get user's organization
    const user = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, userId),
      with: {
        organization: true,
      },
    });

    if (!user?.organization) {
      throw new Error('Organization not found for user');
    }

    // Run sync
    return this.syncOrganization(user.organization.id);
  }

  /**
   * Check if sync is needed based on last sync time
   */
  async shouldSync(organizationId: string): Promise<boolean> {
    const lastSnapshot = await db
      .select()
      .from(varianceSnapshots)
      .where(eq(varianceSnapshots.organizationId, organizationId))
      .orderBy(desc(varianceSnapshots.createdAt))
      .limit(1);

    if (lastSnapshot.length === 0) {
      return true; // Never synced
    }

    const lastSync = lastSnapshot[0].createdAt;
    if (!lastSync) return true;

    const hoursSinceLastSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);
    return hoursSinceLastSync >= 4; // Sync if > 4 hours
  }

  /**
   * Fetch budget data from Monday.com board
   */
  private async fetchMondayBudget(client: MondayClient, org: any): Promise<any[]> {
    if (!org.settings?.defaultBoardId) {
      throw new Error('No default Monday board configured');
    }

    const boardId = parseInt(org.settings.defaultBoardId);
    const items = await client.getBoardItems(boardId);

    // Transform Monday items to budget format
    return items.map((item: any) => ({
      accountName: item.name,
      accountCode: item.column_values?.find((c: any) => c.id === 'account_code')?.text || '',
      budgetAmount: parseFloat(item.column_values?.find((c: any) => c.id === 'budget')?.text || '0'),
      category: item.column_values?.find((c: any) => c.id === 'category')?.text || 'General',
      monthlyItemId: item.id,
    }));
  }

  /**
   * Fetch actuals from QuickBooks
   */
  private async fetchQuickBooksActuals(
    client: QuickBooksClient,
    companyId: string,
    accessToken: string
  ): Promise<any[]> {
    // Get current month P&L
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const plReport = await client.getProfitLoss(
      companyId,
      accessToken,
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    // Transform QB P&L to actuals format
    const actuals: any[] = [];

    if (plReport.Rows?.Row) {
      this.extractAccountsFromRows(plReport.Rows.Row, actuals);
    }

    return actuals;
  }

  /**
   * Recursively extract accounts from QB report rows
   */
  private extractAccountsFromRows(rows: any[], actuals: any[], level = 0): void {
    for (const row of rows) {
      if (row.type === 'Data' && row.ColData) {
        const accountName = row.ColData[0]?.value || '';
        const amount = parseFloat(row.ColData[1]?.value || '0');

        if (accountName && amount !== 0) {
          actuals.push({
            accountName,
            actualAmount: amount,
          });
        }
      }

      // Recurse into subsections
      if (row.Rows?.Row) {
        this.extractAccountsFromRows(row.Rows.Row, actuals, level + 1);
      }
    }
  }

  /**
   * Calculate variances between budget and actuals
   */
  private async calculateVariances(budget: any[], actuals: any[], org: any): Promise<any[]> {
    const engine = new VarianceEngine({
      thresholds: org.settings?.thresholds || {
        warning: 10,
        critical: 15,
      },
    });

    const variances: any[] = [];

    // Match budget items with actuals
    for (const budgetItem of budget) {
      const actual = actuals.find(a =>
        a.accountName.toLowerCase().includes(budgetItem.accountName.toLowerCase()) ||
        budgetItem.accountName.toLowerCase().includes(a.accountName.toLowerCase())
      );

      const actualAmount = actual?.actualAmount || 0;
      const budgetAmount = budgetItem.budgetAmount || 0;

      const variance = engine.calculateVariance(budgetAmount, actualAmount, 'expense');
      const severity = engine.determineSeverity(variance.variancePercent);

      variances.push({
        accountName: budgetItem.accountName,
        accountCode: budgetItem.accountCode,
        category: budgetItem.category,
        budgetAmount,
        actualAmount,
        variance: variance.variance,
        variancePercent: variance.variancePercent,
        direction: variance.direction,
        severity,
        monthlyItemId: budgetItem.monthlyItemId,
      });
    }

    return variances.sort((a, b) => Math.abs(b.variancePercent) - Math.abs(a.variancePercent));
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(variances: any[]): any {
    const total = variances.reduce((sum, v) => sum + v.budgetAmount, 0);
    const totalActual = variances.reduce((sum, v) => sum + v.actualAmount, 0);
    const totalVariance = totalActual - total;
    const totalVariancePercent = total !== 0 ? (totalVariance / total) * 100 : 0;

    const critical = variances.filter(v => v.severity === 'critical').length;
    const warning = variances.filter(v => v.severity === 'warning').length;
    const normal = variances.filter(v => v.severity === 'normal').length;

    return {
      totalBudget: total,
      totalActual,
      totalVariance,
      totalVariancePercent,
      itemCount: variances.length,
      criticalCount: critical,
      warningCount: warning,
      normalCount: normal,
    };
  }

  /**
   * Update Monday board with variance data
   */
  private async updateMondayBoard(
    client: MondayClient,
    boardId: string,
    variances: any[]
  ): Promise<void> {
    // Only update items that have significant variances
    const significantVariances = variances.filter(v =>
      v.severity === 'critical' || v.severity === 'warning'
    );

    for (const variance of significantVariances.slice(0, 10)) { // Limit to top 10
      if (variance.monthlyItemId) {
        try {
          await client.updateItemColumn(
            parseInt(variance.monthlyItemId),
            'status',
            { label: variance.severity === 'critical' ? 'Critical' : 'Warning' }
          );

          await client.updateItemColumn(
            parseInt(variance.monthlyItemId),
            'actual',
            variance.actualAmount.toString()
          );

          await client.updateItemColumn(
            parseInt(variance.monthlyItemId),
            'variance',
            variance.variancePercent.toFixed(1) + '%'
          );
        } catch (error) {
          console.warn(`Failed to update Monday item ${variance.monthlyItemId}:`, error);
        }
      }
    }
  }

  /**
   * Sync all active organizations
   */
  async syncAllOrganizations(): Promise<SyncResult[]> {
    const activeOrgs = await db
      .select()
      .from(organizations)
      .where(eq(organizations.active, true));

    const results: SyncResult[] = [];

    for (const org of activeOrgs) {
      const shouldSync = await this.shouldSync(org.id);

      if (shouldSync) {
        const result = await this.syncOrganization(org.id);
        results.push(result);

        // Add delay between syncs to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.log(`⏭️  Skipping ${org.mondayAccountName} - sync not needed yet`);
      }
    }

    return results;
  }
}

// Export singleton instance
export const syncOrchestrator = new SyncOrchestrator();
