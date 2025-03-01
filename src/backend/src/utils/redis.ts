import Redis from 'ioredis';
import logger from './logger';

// Create Redis client
const redisClient = process.env.REDIS_URL 
  ? new Redis(process.env.REDIS_URL)
  : new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

redisClient.on('error', (err: Error) => {
  logger.error('Redis error:', err);
});

redisClient.on('connect', () => {
  logger.info('Connected to Redis');
});

/**
 * Set a key in Redis cache with optional expiry
 */
export const setCache = async (
  key: string, 
  value: any, 
  expiry: number = 3600
): Promise<void> => {
  try {
    const serialized = JSON.stringify(value);
    await redisClient.set(key, serialized, 'EX', expiry);
  } catch (error) {
    logger.error('Redis setCache error:', error);
  }
};

/**
 * Get a value from Redis cache
 */
export const getCache = async <T>(key: string): Promise<T | null> => {
  try {
    const data = await redisClient.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (error) {
    logger.error('Redis getCache error:', error);
    return null;
  }
};

/**
 * Delete a key from Redis cache
 */
export const deleteCache = async (key: string): Promise<void> => {
  try {
    await redisClient.del(key);
  } catch (error) {
    logger.error('Redis deleteCache error:', error);
  }
};

/**
 * Invalidate cache keys by pattern
 */
export const invalidateByPattern = async (pattern: string): Promise<void> => {
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(...keys);
      logger.debug(`Invalidated ${keys.length} cache keys matching pattern: ${pattern}`);
    }
  } catch (error) {
    logger.error('Redis invalidateByPattern error:', error);
  }
};

export default redisClient;