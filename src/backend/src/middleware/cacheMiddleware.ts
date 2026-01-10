/**
 * API Response Caching Middleware
 * Implements multi-layer caching with ETags and Redis
 * Based on 2026 best practices from tech review
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import redis from '../utils/redis-client';
import logger from '../utils/logger';

interface CacheOptions {
  ttl?: number; // Time to live in seconds (default: 300)
  varyBy?: string[]; // Headers to vary cache by (e.g., ['user-id', 'accept-language'])
  excludeQuery?: string[]; // Query parameters to exclude from cache key
  cacheControl?: string; // Custom Cache-Control header
}

/**
 * Generate cache key from request
 */
function generateCacheKey(req: Request, options: CacheOptions): string {
  const baseKey = `cache:${req.path}`;

  // Include query parameters (excluding specified ones)
  const queryParams = { ...req.query };
  if (options.excludeQuery) {
    options.excludeQuery.forEach(param => delete queryParams[param]);
  }
  const queryString = JSON.stringify(queryParams);

  // Include vary headers
  const varyHeaders: Record<string, any> = {};
  if (options.varyBy) {
    options.varyBy.forEach(header => {
      varyHeaders[header] = req.get(header);
    });
  }
  const varyString = JSON.stringify(varyHeaders);

  // Combine all parts
  const keyData = `${baseKey}:${queryString}:${varyString}`;

  return `${baseKey}:${crypto.createHash('md5').update(keyData).digest('hex')}`;
}

/**
 * Generate ETag from response data
 */
function generateETag(data: any): string {
  const dataString = typeof data === 'string' ? data : JSON.stringify(data);
  return crypto.createHash('md5').update(dataString).digest('hex');
}

/**
 * Caching middleware factory
 */
export function cacheMiddleware(options: CacheOptions = {}) {
  const ttl = options.ttl || 300; // Default 5 minutes
  const cacheControl = options.cacheControl || `public, max-age=${ttl}`;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    try {
      const cacheKey = generateCacheKey(req, options);

      // Check Redis cache
      const cached = await redis.get(cacheKey);

      if (cached) {
        const data = JSON.parse(cached);
        const etag = generateETag(data);

        // Check client ETag (304 Not Modified)
        if (req.headers['if-none-match'] === etag) {
          logger.debug(`Cache hit (304): ${cacheKey}`);
          return res.status(304).end();
        }

        // Return cached data
        logger.debug(`Cache hit (200): ${cacheKey}`);
        return res
          .set('Cache-Control', cacheControl)
          .set('ETag', etag)
          .set('X-Cache', 'HIT')
          .json(data);
      }

      // Cache miss - capture response
      const originalJson = res.json.bind(res);

      res.json = function(data: any) {
        // Store in Redis
        redis.setex(cacheKey, ttl, JSON.stringify(data))
          .catch(err => logger.error('Redis cache write error:', err));

        const etag = generateETag(data);

        logger.debug(`Cache miss: ${cacheKey}`);

        // Send response with cache headers
        return originalJson(data)
          .set('Cache-Control', cacheControl)
          .set('ETag', etag)
          .set('X-Cache', 'MISS');
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error:', error);
      // Don't block request on cache errors
      next();
    }
  };
}

/**
 * Cache invalidation helper
 */
export async function invalidateCache(pattern: string): Promise<number> {
  try {
    const keys = await redis.keys(`cache:${pattern}*`);
    if (keys.length === 0) {
      return 0;
    }

    await redis.del(...keys);
    logger.info(`Invalidated ${keys.length} cache entries for pattern: ${pattern}`);
    return keys.length;
  } catch (error) {
    logger.error('Cache invalidation error:', error);
    return 0;
  }
}

/**
 * Cache warming helper for frequently accessed data
 */
export async function warmCache(
  key: string,
  data: any,
  ttl: number = 300
): Promise<void> {
  try {
    await redis.setex(`cache:${key}`, ttl, JSON.stringify(data));
    logger.info(`Cache warmed: ${key}`);
  } catch (error) {
    logger.error('Cache warming error:', error);
  }
}

/**
 * Predefined cache configurations for different endpoints
 */
export const CachePresets = {
  // Short cache for frequently changing data
  SHORT: { ttl: 60, cacheControl: 'public, max-age=60' },

  // Medium cache for semi-static data
  MEDIUM: { ttl: 300, cacheControl: 'public, max-age=300' },

  // Long cache for static data
  LONG: { ttl: 3600, cacheControl: 'public, max-age=3600' },

  // User-specific cache
  USER: {
    ttl: 300,
    varyBy: ['authorization'],
    cacheControl: 'private, max-age=300'
  },

  // Analysis results (long cache, user-specific)
  ANALYSIS: {
    ttl: 3600,
    varyBy: ['authorization'],
    cacheControl: 'private, max-age=3600'
  },

  // Public scripts (medium cache)
  PUBLIC_SCRIPTS: {
    ttl: 300,
    excludeQuery: ['_t'], // Exclude timestamp cache busters
    cacheControl: 'public, max-age=300'
  }
};

export default cacheMiddleware;
