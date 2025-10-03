import Redis from 'ioredis';

/**
 * Redis Client with Upstash Support and In-Memory Fallback
 *
 * Features:
 * - Upstash Redis support for production (serverless-friendly)
 * - Local Redis for development
 * - In-memory fallback if Redis unavailable
 * - Cache warming on startup
 */

let redis: Redis | null = null;
let redisAvailable = false;

// In-memory cache fallback
const memoryCache = new Map<string, { value: string; expiry: number }>();

/**
 * Clean up expired memory cache entries
 */
function cleanMemoryCache() {
  const now = Date.now();
  for (const [key, data] of memoryCache.entries()) {
    if (now > data.expiry) {
      memoryCache.delete(key);
    }
  }
}

// Cleanup every minute
if (typeof setInterval !== 'undefined') {
  setInterval(cleanMemoryCache, 60 * 1000);
}

/**
 * Get Redis client (with Upstash support)
 */
export function getRedisClient(): Redis {
  if (redis) {
    return redis;
  }

  // Check for Upstash Redis URL (production)
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  // Use Upstash if configured, otherwise use standard Redis
  const connectionString = upstashUrl && upstashToken
    ? `rediss://default:${upstashToken}@${upstashUrl.replace('https://', '')}`
    : redisUrl;

  console.log(`🔄 Connecting to Redis: ${upstashUrl ? 'Upstash' : 'Local'}`);

  redis = new Redis(connectionString, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
      if (times > 3) {
        console.warn('⚠️ Redis connection failed after 3 retries, falling back to memory cache');
        redisAvailable = false;
        return null; // Stop retrying
      }
      const delay = Math.min(times * 50, 2000);
      console.log(`Redis connection retry #${times}, waiting ${delay}ms`);
      return delay;
    },
    reconnectOnError: (err: Error) => {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        return true; // Reconnect when Redis is in readonly mode
      }
      return false;
    },
    lazyConnect: true,
    enableReadyCheck: true,
    enableOfflineQueue: true,
    // Upstash-specific: use TLS for Upstash connections
    tls: upstashUrl ? {} : undefined,
  });

  redis.on('error', (error: Error) => {
    console.error('❌ Redis connection error:', error.message);
    redisAvailable = false;
  });

  redis.on('connect', () => {
    console.log('✅ Redis connected successfully');
    redisAvailable = true;
  });

  redis.on('ready', () => {
    console.log('✅ Redis ready to accept commands');
    redisAvailable = true;

    // Warm cache on startup
    warmCache().catch((err) => {
      console.error('Cache warming failed:', err);
    });
  });

  redis.on('close', () => {
    console.log('🔌 Redis connection closed');
    redisAvailable = false;
  });

  redis.on('reconnecting', () => {
    console.log('🔄 Redis reconnecting...');
  });

  // Connect immediately
  redis.connect().catch((err: Error) => {
    console.error('❌ Redis initial connection failed:', err.message);
    console.warn('⚠️ Falling back to in-memory cache');
    redisAvailable = false;
  });

  return redis;
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  return redisAvailable;
}

/**
 * Close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    redisAvailable = false;
  }
}

/**
 * Get cached value (with fallback to memory)
 */
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    if (redisAvailable && redis) {
      const data = await redis.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } else {
      // Fallback to memory cache
      const cached = memoryCache.get(key);
      if (!cached) return null;

      // Check expiry
      if (Date.now() > cached.expiry) {
        memoryCache.delete(key);
        return null;
      }

      return JSON.parse(cached.value) as T;
    }
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
}

/**
 * Set cached value (with fallback to memory)
 */
export async function setCached(
  key: string,
  value: any,
  expirySeconds: number = 3600
): Promise<boolean> {
  try {
    const serialized = JSON.stringify(value);

    if (redisAvailable && redis) {
      await redis.setex(key, expirySeconds, serialized);
      return true;
    } else {
      // Fallback to memory cache
      const expiry = Date.now() + (expirySeconds * 1000);
      memoryCache.set(key, { value: serialized, expiry });
      return true;
    }
  } catch (error) {
    console.error('Cache set error:', error);
    return false;
  }
}

/**
 * Delete cached value (with fallback to memory)
 */
export async function deleteCached(key: string): Promise<boolean> {
  try {
    if (redisAvailable && redis) {
      await redis.del(key);
    } else {
      memoryCache.delete(key);
    }
    return true;
  } catch (error) {
    console.error('Cache delete error:', error);
    return false;
  }
}

/**
 * Invalidate keys by pattern (with fallback to memory)
 */
export async function invalidatePattern(pattern: string): Promise<number> {
  try {
    if (redisAvailable && redis) {
      const keys = await redis.keys(pattern);
      if (keys.length === 0) return 0;
      await redis.del(...keys);
      return keys.length;
    } else {
      // Fallback to memory cache - convert glob pattern to regex
      const regex = new RegExp(
        '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
      );

      let count = 0;
      for (const key of memoryCache.keys()) {
        if (regex.test(key)) {
          memoryCache.delete(key);
          count++;
        }
      }
      return count;
    }
  } catch (error) {
    console.error('Cache invalidate pattern error:', error);
    return 0;
  }
}

/**
 * Get memory cache size (for monitoring)
 */
export function getMemoryCacheSize(): number {
  return memoryCache.size;
}

/**
 * Clear all memory cache
 */
export function clearMemoryCache(): void {
  memoryCache.clear();
}

/**
 * Warm cache on startup
 * Pre-populate frequently accessed data
 */
async function warmCache(): Promise<void> {
  console.log('🔥 Warming cache...');

  try {
    // TODO: Add cache warming logic here
    // Example: Pre-load frequently accessed organizations, settings, etc.

    // const orgs = await db.select().from(organizations).where(eq(organizations.active, true));
    // for (const org of orgs) {
    //   await setCached(`org:${org.id}`, org, 3600);
    // }

    console.log('✅ Cache warming complete');
  } catch (error) {
    console.error('❌ Cache warming failed:', error);
  }
}
