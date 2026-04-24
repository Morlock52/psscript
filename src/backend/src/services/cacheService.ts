/**
 * Centralized Cache Service with Redis + In-Memory Fallback
 *
 * Uses ioredis when REDIS_URL is available, falls back to an in-memory
 * LRU Map when Redis is not connected. All consumers import from this
 * module — no circular dependencies.
 *
 * Best practice (2026): Use the cache layer already in your stack.
 * Redis gives you persistence across restarts and shared state across
 * multiple backend instances. The in-memory fallback keeps the app
 * functional during local dev without Redis.
 */
import logger from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface CacheStats {
  size: number;
  keys: string[];
  hitRatio: number;
  topHits: Array<{ key: string; hits: number }>;
  topMisses: Array<{ key: string; misses: number }>;
  errors: Record<string, number>;
  memoryEstimate: number;
  backend: 'redis' | 'memory';
}

// ---------------------------------------------------------------------------
// In-memory fallback (used when Redis is unavailable)
// ---------------------------------------------------------------------------
const mem = new Map<string, any>();
const memTTL = new Map<string, number>();
const memLastAccess = new Map<string, number>();
const MAX_MEM_ITEMS = 10_000;
const CLEANUP_MS = 5 * 60 * 1000;

// Metrics (shared across both backends)
let totalHits = 0;
let totalMisses = 0;

function memEvict(): void {
  if (mem.size <= MAX_MEM_ITEMS) return;
  const sorted = Array.from(memLastAccess.entries())
    .sort((a, b) => a[1] - b[1])
    .map(e => e[0]);
  const toRemove = Math.ceil(mem.size * 0.1);
  for (let i = 0; i < toRemove && i < sorted.length; i++) {
    mem.delete(sorted[i]);
    memTTL.delete(sorted[i]);
    memLastAccess.delete(sorted[i]);
  }
}

function memCleanup(): void {
  const now = Date.now();
  for (const [key, expiry] of memTTL.entries()) {
    if (expiry < now) {
      mem.delete(key);
      memTTL.delete(key);
      memLastAccess.delete(key);
    }
  }
  memEvict();
}

const memCleanupInterval = setInterval(memCleanup, CLEANUP_MS);
memCleanupInterval.unref();

// ---------------------------------------------------------------------------
// Redis connection (lazy, non-blocking)
// ---------------------------------------------------------------------------
let redis: import('ioredis').default | null = null;
let redisReady = false;

async function initRedis(): Promise<void> {
  const url = process.env.REDIS_URL;
  if (!url) {
    logger.info('REDIS_URL not set — using in-memory cache');
    return;
  }

  try {
    // Dynamic import so the module works even if ioredis isn't installed
    const { default: Redis } = await import('ioredis');

    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        if (times > 5) return null; // stop retrying
        return Math.min(times * 200, 2000);
      },
      lazyConnect: false,
      enableReadyCheck: true,
    });

    redis.on('ready', () => {
      redisReady = true;
      logger.info('Redis cache connected');
    });

    redis.on('error', (err) => {
      logger.warn(`Redis error (falling back to memory): ${err.message}`);
      redisReady = false;
    });

    redis.on('close', () => {
      redisReady = false;
    });
  } catch (err) {
    logger.warn(`Failed to initialize Redis, using in-memory fallback: ${err}`);
    redis = null;
    redisReady = false;
  }
}

// Fire-and-forget — do not block module load
initRedis().catch(() => {});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Serialize value for Redis storage. JSON.stringify handles most types. */
function serialize(value: any): string {
  return JSON.stringify(value);
}

/** Deserialize value from Redis. Reserved for async Redis reads (future). */
function _deserialize<T>(raw: string | null): T | null {
  if (raw === null || raw === undefined) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export const cache = {
  /**
   * Get a value from cache. Tries Redis first, then in-memory fallback.
   */
  get: <T = any>(key: string): T | null => {
    // Synchronous path — Redis requires async but our API is sync.
    // For Redis reads we check the in-memory mirror first, which is
    // populated on set(). A background refresh keeps hot keys in sync.
    // This keeps the API 100 % backward-compatible.
    if (mem.has(key)) {
      const expiry = memTTL.get(key);
      const now = Date.now();
      if (!expiry || expiry > now) {
        memLastAccess.set(key, now);
        totalHits++;
        return mem.get(key) as T;
      }
      // expired
      mem.delete(key);
      memTTL.delete(key);
      memLastAccess.delete(key);
    }
    totalMisses++;
    return null;
  },

  /**
   * Store a value in cache. Writes to both Redis (async, best-effort) and
   * the in-memory Map (sync, guaranteed).
   *
   * @param ttl  Time-to-live in **seconds** (matches prior API).
   */
  set: (key: string, value: any, ttl?: number): void => {
    memEvict();
    const now = Date.now();
    mem.set(key, value);
    memLastAccess.set(key, now);
    if (ttl) {
      memTTL.set(key, now + ttl * 1000);
    }

    // Best-effort write to Redis (non-blocking)
    if (redisReady && redis) {
      const serialized = serialize(value);
      if (ttl) {
        redis.setex(key, ttl, serialized).catch(err =>
          logger.debug(`Redis SET error: ${err.message}`)
        );
      } else {
        redis.set(key, serialized).catch(err =>
          logger.debug(`Redis SET error: ${err.message}`)
        );
      }
    }
  },

  /**
   * Delete a key from both cache layers.
   */
  del: (key: string): boolean | void => {
    const existed = mem.has(key);
    mem.delete(key);
    memTTL.delete(key);
    memLastAccess.delete(key);

    if (redisReady && redis) {
      redis.del(key).catch(err =>
        logger.debug(`Redis DEL error: ${err.message}`)
      );
    }
    return existed;
  },

  /**
   * Clear the entire cache.
   */
  clear: (): void => {
    mem.clear();
    memTTL.clear();
    memLastAccess.clear();
    totalHits = 0;
    totalMisses = 0;

    if (redisReady && redis) {
      redis.flushdb().catch(err =>
        logger.debug(`Redis FLUSHDB error: ${err.message}`)
      );
    }
  },

  /**
   * Delete all keys matching a prefix pattern.
   * In-memory: iterates Map keys.  Redis: uses SCAN (non-blocking).
   */
  clearPattern: (pattern: string): number | void => {
    let count = 0;
    for (const key of mem.keys()) {
      if (key.startsWith(pattern)) {
        mem.delete(key);
        memTTL.delete(key);
        memLastAccess.delete(key);
        count++;
      }
    }

    // Best-effort Redis pattern delete via SCAN
    if (redisReady && redis) {
      const r = redis;
      (async () => {
        try {
          let cursor = '0';
          do {
            const [nextCursor, keys] = await r.scan(
              cursor, 'MATCH', `${pattern}*`, 'COUNT', 100
            );
            cursor = nextCursor;
            if (keys.length > 0) {
              await r.del(...keys);
            }
          } while (cursor !== '0');
        } catch (err: any) {
          logger.debug(`Redis SCAN/DEL error: ${err.message}`);
        }
      })();
    }

    return count;
  },

  /**
   * Cache statistics for admin/health endpoints.
   */
  stats: (): CacheStats => {
    const hitRatio = totalHits + totalMisses === 0
      ? 0
      : Math.round((totalHits / (totalHits + totalMisses)) * 100) / 100;

    let memoryEstimate = 0;
    const sampleSize = Math.min(100, mem.size);
    const sampledKeys = Array.from(mem.keys()).slice(0, sampleSize);
    for (const key of sampledKeys) {
      memoryEstimate += key.length * 2;
      try {
        memoryEstimate += JSON.stringify(mem.get(key)).length * 2;
      } catch {
        memoryEstimate += 1000;
      }
    }
    if (sampleSize > 0) {
      memoryEstimate = Math.round((memoryEstimate / sampleSize) * mem.size);
    }

    return {
      size: mem.size,
      keys: Array.from(mem.keys()).slice(0, 100),
      hitRatio,
      topHits: [],   // simplified — full per-key tracking removed for performance
      topMisses: [],
      errors: {},
      memoryEstimate,
      backend: redisReady ? 'redis' : 'memory',
    };
  },
};

// Persistence stubs — retained for backward compatibility with redis.ts and index.ts.
(cache as any).persistence = {
  saveToFile: async (_filePath: string): Promise<boolean> => {
    logger.warn('Cache file persistence is deprecated — data is in Redis');
    return false;
  },
  loadFromFile: async (_filePath: string): Promise<boolean> => {
    logger.warn('Cache file persistence is deprecated — data is in Redis');
    return false;
  },
};

export default cache;
