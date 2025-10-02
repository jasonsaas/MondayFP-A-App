/**
 * Variance Analysis Cache Layer
 *
 * Redis-based caching for variance analysis results
 * Supports TTL, cache invalidation, and cache warming
 */

import { VarianceAnalysisResult } from './types';

// Cache configuration
const CACHE_TTL = 3600; // 1 hour in seconds
const CACHE_PREFIX = 'variance:';

/**
 * Redis cache interface
 * In production, replace with actual Redis client (ioredis or node-redis)
 */
interface CacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

/**
 * In-memory cache fallback for development
 * Replace with Redis in production
 */
class InMemoryCache implements CacheClient {
  private cache = new Map<string, { value: string; expiresAt: number }>();

  async get(key: string): Promise<string | null> {
    const item = this.cache.get(key);
    if (!item) return null;

    // Check expiration
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  async set(key: string, value: string, ttl: number = CACHE_TTL): Promise<void> {
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

  // Cleanup expired entries periodically
  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

// Initialize cache client
// In production: import Redis from 'ioredis'; const cacheClient = new Redis(process.env.REDIS_URL);
const cacheClient: CacheClient = new InMemoryCache();

// Cleanup in-memory cache every 5 minutes
if (cacheClient instanceof InMemoryCache) {
  setInterval(() => cacheClient.cleanup(), 5 * 60 * 1000);
}

/**
 * Generate cache key for variance analysis
 */
export function generateCacheKey(
  organizationId: string,
  boardId: number | string,
  period: string
): string {
  return `${CACHE_PREFIX}${organizationId}:${boardId}:${period}`;
}

/**
 * Get variance analysis from cache
 */
export async function getCachedVariance(
  cacheKey: string
): Promise<VarianceAnalysisResult | null> {
  try {
    const cached = await cacheClient.get(cacheKey);
    if (!cached) return null;

    const result = JSON.parse(cached) as VarianceAnalysisResult;

    // Rehydrate dates
    result.generatedAt = new Date(result.generatedAt);

    return result;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
}

/**
 * Store variance analysis in cache
 */
export async function setCachedVariance(
  cacheKey: string,
  result: VarianceAnalysisResult,
  ttl: number = CACHE_TTL
): Promise<void> {
  try {
    // Add cache key to result
    result.cacheKey = cacheKey;

    const serialized = JSON.stringify(result);
    await cacheClient.set(cacheKey, serialized, ttl);
  } catch (error) {
    console.error('Cache set error:', error);
    // Don't throw - cache failures shouldn't break the app
  }
}

/**
 * Invalidate variance cache for a specific organization/board/period
 */
export async function invalidateVarianceCache(
  organizationId: string,
  boardId?: number | string,
  period?: string
): Promise<void> {
  try {
    if (boardId && period) {
      // Invalidate specific cache entry
      const cacheKey = generateCacheKey(organizationId, boardId, period);
      await cacheClient.del(cacheKey);
    } else {
      // In production with Redis, use SCAN to find and delete matching keys
      console.warn('Bulk cache invalidation not implemented for in-memory cache');
      // TODO: Implement pattern-based deletion with Redis
      // const pattern = `${CACHE_PREFIX}${organizationId}:*`;
      // await deleteByPattern(pattern);
    }
  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
}

/**
 * Check if variance cache exists
 */
export async function varianceCacheExists(cacheKey: string): Promise<boolean> {
  try {
    return await cacheClient.exists(cacheKey);
  } catch (error) {
    console.error('Cache exists check error:', error);
    return false;
  }
}

/**
 * Cache statistics for monitoring
 */
export async function getCacheStats(): Promise<{
  type: string;
  size?: number;
  keys?: string[];
}> {
  if (cacheClient instanceof InMemoryCache) {
    return {
      type: 'in-memory',
      size: (cacheClient as any).cache.size,
      keys: Array.from((cacheClient as any).cache.keys()),
    };
  }

  return {
    type: 'redis',
  };
}

/**
 * Production Redis setup helper
 * Uncomment and configure when deploying to production
 */
/*
import Redis from 'ioredis';

export function createRedisCache(): CacheClient {
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  return {
    async get(key: string) {
      return await redis.get(key);
    },
    async set(key: string, value: string, ttl: number = CACHE_TTL) {
      await redis.setex(key, ttl, value);
    },
    async del(key: string) {
      await redis.del(key);
    },
    async exists(key: string) {
      const result = await redis.exists(key);
      return result === 1;
    },
  };
}
*/
