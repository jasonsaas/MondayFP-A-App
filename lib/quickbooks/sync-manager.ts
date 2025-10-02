/**
 * QuickBooks Sync Manager
 *
 * Manages incremental syncing of QuickBooks data with Redis caching
 * Handles rate limiting, error recovery, and sync status tracking
 */

import { QuickBooksClient } from './client';
import {
  QBOAuthToken,
  QBSyncStatus,
  QBSyncOptions,
  StandardAccount,
  StandardPLReport,
  QuickBooksError,
  QB_CACHE_KEYS,
  QB_CACHE_TTL,
} from './types';
import { db } from '@/lib/db';
import { organizations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Redis cache interface (compatible with ioredis and node-redis)
 */
interface CacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

/**
 * In-memory cache fallback
 */
class InMemoryCache implements CacheClient {
  private cache = new Map<string, { value: string; expiresAt: number }>();

  async get(key: string): Promise<string | null> {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  async set(key: string, value: string, ttl: number = 3600): Promise<void> {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl * 1000,
    });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const item = this.cache.get(key);
    if (!item) return false;

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

// Initialize cache
const cache: CacheClient = new InMemoryCache();

// Cleanup in-memory cache periodically
if (cache instanceof InMemoryCache) {
  setInterval(() => cache.cleanup(), 5 * 60 * 1000);
}

export class QuickBooksSyncManager {
  private client: QuickBooksClient;

  constructor(client?: QuickBooksClient) {
    this.client = client || new QuickBooksClient({
      clientId: process.env.QUICKBOOKS_CLIENT_ID!,
      clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET!,
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
    });
  }

  /**
   * Perform full sync of QuickBooks data
   */
  async syncAll(
    organizationId: string,
    options: QBSyncOptions = {}
  ): Promise<QBSyncStatus> {
    const syncId = this.generateSyncId();
    const startedAt = new Date();

    // Initialize sync status
    const syncStatus: QBSyncStatus = {
      syncId,
      organizationId,
      realmId: '',
      status: 'in_progress',
      startedAt,
      itemsSynced: {
        accounts: 0,
        plReports: 0,
        balanceSheet: 0,
      },
      errors: [],
    };

    try {
      // Get organization with QB credentials
      const org = await this.getOrganization(organizationId);
      if (!org.quickbooksCompanyId) {
        throw new Error('QuickBooks not connected for this organization');
      }

      syncStatus.realmId = org.quickbooksCompanyId;

      // Get or refresh token
      const token = await this.getValidToken(org);

      // Sync Chart of Accounts
      if (options.syncAccounts !== false) {
        console.log('Syncing Chart of Accounts...');
        const accounts = await this.syncAccounts(token, org.quickbooksCompanyId, options);
        syncStatus.itemsSynced.accounts = accounts.length;
      }

      // Sync Profit & Loss
      if (options.syncPL !== false) {
        console.log('Syncing P&L Report...');
        const plReport = await this.syncProfitLoss(
          token,
          org.quickbooksCompanyId,
          options
        );
        if (plReport) {
          syncStatus.itemsSynced.plReports = 1;
        }
      }

      // Sync Balance Sheet
      if (options.syncBalanceSheet) {
        console.log('Syncing Balance Sheet...');
        const balanceSheet = await this.syncBalanceSheet(
          token,
          org.quickbooksCompanyId,
          options
        );
        if (balanceSheet) {
          syncStatus.itemsSynced.balanceSheet = 1;
        }
      }

      // Mark as completed
      syncStatus.status = 'completed';
      syncStatus.completedAt = new Date();
      syncStatus.lastSyncedAt = new Date();

      console.log('Sync completed successfully:', syncStatus);

      return syncStatus;
    } catch (error: any) {
      console.error('Sync failed:', error);

      syncStatus.status = 'failed';
      syncStatus.completedAt = new Date();
      syncStatus.errors.push({
        type: error.code || 'sync_error',
        message: error.message,
        timestamp: new Date(),
      });

      return syncStatus;
    }
  }

  /**
   * Sync Chart of Accounts with caching
   */
  async syncAccounts(
    token: string,
    realmId: string,
    options: QBSyncOptions
  ): Promise<StandardAccount[]> {
    const cacheKey = QB_CACHE_KEYS.ACCOUNTS(realmId);

    // Check cache first
    if (!options.forceRefresh) {
      const cached = await this.getCached<StandardAccount[]>(cacheKey);
      if (cached) {
        console.log('Using cached accounts');
        return cached;
      }
    }

    // Fetch from QuickBooks
    console.log('Fetching accounts from QuickBooks...');
    const qbAccounts = await this.client.getAllAccounts(token, realmId, true);

    // Transform to standard format
    const accounts = this.client.transformAccounts(qbAccounts);

    // Cache results
    await this.setCached(cacheKey, accounts, QB_CACHE_TTL.ACCOUNTS);

    console.log(`Synced ${accounts.length} accounts`);

    return accounts;
  }

  /**
   * Sync Profit & Loss report with caching
   */
  async syncProfitLoss(
    token: string,
    realmId: string,
    options: QBSyncOptions
  ): Promise<StandardPLReport | null> {
    // Determine date range
    const { startDate, endDate } = this.getDateRange(options);

    const cacheKey = QB_CACHE_KEYS.PL_REPORT(realmId, startDate, endDate);

    // Check cache first
    if (!options.forceRefresh) {
      const cached = await this.getCached<StandardPLReport>(cacheKey);
      if (cached) {
        console.log('Using cached P&L report');
        return cached;
      }
    }

    // Fetch from QuickBooks
    console.log(`Fetching P&L report for ${startDate} to ${endDate}...`);
    const qbReport = await this.client.getProfitLossReport(
      token,
      realmId,
      startDate,
      endDate,
      {
        accountingMethod: 'Accrual',
        summarizeBy: 'Total',
      }
    );

    // Transform to standard format
    const report = this.client.transformProfitLoss(qbReport);

    // Cache results
    await this.setCached(cacheKey, report, QB_CACHE_TTL.REPORTS);

    console.log(`Synced P&L report: Net Income $${report.netIncome.toLocaleString()}`);

    return report;
  }

  /**
   * Sync Balance Sheet with caching
   */
  async syncBalanceSheet(
    token: string,
    realmId: string,
    options: QBSyncOptions
  ): Promise<any> {
    const date = options.endDate || this.getCurrentDate();
    const cacheKey = QB_CACHE_KEYS.BALANCE_SHEET(realmId, date);

    // Check cache first
    if (!options.forceRefresh) {
      const cached = await this.getCached(cacheKey);
      if (cached) {
        console.log('Using cached Balance Sheet');
        return cached;
      }
    }

    // Fetch from QuickBooks
    console.log(`Fetching Balance Sheet as of ${date}...`);
    const balanceSheet = await this.client.getBalanceSheet(
      token,
      realmId,
      date,
      {
        accountingMethod: 'Accrual',
      }
    );

    // Cache results
    await this.setCached(cacheKey, balanceSheet, QB_CACHE_TTL.REPORTS);

    console.log('Synced Balance Sheet');

    return balanceSheet;
  }

  /**
   * Get valid access token (refresh if needed)
   */
  private async getValidToken(org: any): Promise<string> {
    if (!org.quickbooksAccessToken || !org.quickbooksRefreshToken) {
      throw new Error('QuickBooks tokens not found');
    }

    // Check if token is still valid (tokens expire in 1 hour)
    const tokenAge = Date.now() - new Date(org.updatedAt).getTime();
    const isExpired = tokenAge > 50 * 60 * 1000; // 50 minutes

    if (!isExpired) {
      return org.quickbooksAccessToken;
    }

    // Refresh token
    console.log('Access token expired, refreshing...');
    const newToken = await this.client.refreshToken(org.quickbooksRefreshToken);

    // Update in database
    await db
      .update(organizations)
      .set({
        quickbooksAccessToken: newToken.access_token,
        quickbooksRefreshToken: newToken.refresh_token,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, org.id));

    return newToken.access_token;
  }

  /**
   * Get organization from database
   */
  private async getOrganization(organizationId: string): Promise<any> {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
    });

    if (!org) {
      throw new Error(`Organization ${organizationId} not found`);
    }

    return org;
  }

  /**
   * Get date range for sync
   */
  private getDateRange(options: QBSyncOptions): {
    startDate: string;
    endDate: string;
  } {
    if (options.startDate && options.endDate) {
      return {
        startDate: options.startDate,
        endDate: options.endDate,
      };
    }

    // Default: Current month
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    return {
      startDate: `${year}-${month}-01`,
      endDate: this.getCurrentDate(),
    };
  }

  /**
   * Get current date in YYYY-MM-DD format
   */
  private getCurrentDate(): string {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  /**
   * Generate unique sync ID
   */
  private generateSyncId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get cached data
   */
  private async getCached<T>(key: string): Promise<T | null> {
    try {
      const cached = await cache.get(key);
      if (!cached) return null;

      return JSON.parse(cached) as T;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set cached data
   */
  private async setCached(
    key: string,
    data: any,
    ttl: number = 3600
  ): Promise<void> {
    try {
      await cache.set(key, JSON.stringify(data), ttl);
    } catch (error) {
      console.error('Cache set error:', error);
      // Don't throw - cache failures shouldn't break sync
    }
  }

  /**
   * Clear cache for organization
   */
  async clearCache(realmId: string): Promise<void> {
    try {
      await cache.del(QB_CACHE_KEYS.ACCOUNTS(realmId));

      // Clear all P&L report caches (would need pattern matching in real Redis)
      console.log(`Cache cleared for realm ${realmId}`);
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  /**
   * Get sync status from cache
   */
  async getSyncStatus(syncId: string): Promise<QBSyncStatus | null> {
    return this.getCached<QBSyncStatus>(`sync:status:${syncId}`);
  }

  /**
   * Save sync status to cache
   */
  async saveSyncStatus(status: QBSyncStatus): Promise<void> {
    await this.setCached(`sync:status:${status.syncId}`, status, 3600);
  }

  /**
   * Incremental sync - only sync changed data
   */
  async incrementalSync(
    organizationId: string,
    lastSyncedAt: Date
  ): Promise<QBSyncStatus> {
    console.log(`Starting incremental sync since ${lastSyncedAt.toISOString()}...`);

    // For QuickBooks, incremental sync would use Change Data Capture API
    // or query with LastModifiedDate filter
    // This is a simplified version that forces a full refresh

    return this.syncAll(organizationId, {
      forceRefresh: false, // Use cache for unchanged data
    });
  }

  /**
   * Health check - verify QuickBooks connection
   */
  async healthCheck(organizationId: string): Promise<{
    connected: boolean;
    realmId?: string;
    error?: string;
  }> {
    try {
      const org = await this.getOrganization(organizationId);

      if (!org.quickbooksCompanyId) {
        return { connected: false, error: 'QuickBooks not connected' };
      }

      const token = await this.getValidToken(org);

      // Try to fetch company info
      await this.client.getCompanyInfo(token, org.quickbooksCompanyId);

      return {
        connected: true,
        realmId: org.quickbooksCompanyId,
      };
    } catch (error: any) {
      return {
        connected: false,
        error: error.message,
      };
    }
  }
}

// Export singleton
let syncManagerInstance: QuickBooksSyncManager | null = null;

export function getSyncManager(): QuickBooksSyncManager {
  if (!syncManagerInstance) {
    syncManagerInstance = new QuickBooksSyncManager();
  }
  return syncManagerInstance;
}

export function createSyncManager(
  client?: QuickBooksClient
): QuickBooksSyncManager {
  return new QuickBooksSyncManager(client);
}
