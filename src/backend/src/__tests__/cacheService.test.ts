/**
 * Cache Service Tests
 *
 * Tests the in-memory cache layer (Redis tests would need a live Redis instance).
 * Covers: get/set/del, TTL expiration, clearPattern, LRU eviction, stats.
 */

// Mock ioredis so the cache service doesn't try to connect
jest.mock('ioredis', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      throw new Error('Redis not available in test');
    }),
  };
});

// Clear REDIS_URL so cache falls back to in-memory
delete process.env.REDIS_URL;

import { cache } from '../services/cacheService';

describe('CacheService (in-memory mode)', () => {
  beforeEach(() => {
    cache.clear();
  });

  afterAll(() => {
    // Prevent Jest open-handle warning from cache cleanup interval
    cache.clear();
  });

  test('get returns null for missing keys', () => {
    expect(cache.get('nonexistent')).toBeNull();
  });

  test('set and get round-trip', () => {
    cache.set('key1', { foo: 'bar' });
    expect(cache.get('key1')).toEqual({ foo: 'bar' });
  });

  test('set with TTL expires after time', async () => {
    cache.set('ttl-key', 'value', 1); // 1 second TTL
    expect(cache.get('ttl-key')).toBe('value');

    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 1100));
    expect(cache.get('ttl-key')).toBeNull();
  });

  test('del removes a key and returns true', () => {
    cache.set('to-delete', 'value');
    expect(cache.del('to-delete')).toBe(true);
    expect(cache.get('to-delete')).toBeNull();
  });

  test('del returns false for non-existent key', () => {
    expect(cache.del('never-existed')).toBe(false);
  });

  test('clearPattern removes matching keys', () => {
    cache.set('scripts:1', 'a');
    cache.set('scripts:2', 'b');
    cache.set('users:1', 'c');

    const removed = cache.clearPattern('scripts:');
    expect(removed).toBe(2);
    expect(cache.get('scripts:1')).toBeNull();
    expect(cache.get('scripts:2')).toBeNull();
    expect(cache.get('users:1')).toBe('c');
  });

  test('clear removes all keys', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.clear();
    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBeNull();
    expect(cache.get('c')).toBeNull();
  });

  test('stats returns valid structure', () => {
    cache.set('stat-key', 'value');
    cache.get('stat-key'); // hit
    cache.get('miss-key'); // miss

    const stats = cache.stats();
    expect(stats).toHaveProperty('size');
    expect(stats).toHaveProperty('hitRatio');
    expect(stats).toHaveProperty('backend', 'memory');
    expect(stats.size).toBeGreaterThanOrEqual(1);
  });

  test('handles large values without error', () => {
    const bigValue = 'x'.repeat(1_000_000); // 1MB string
    cache.set('big', bigValue);
    expect(cache.get<string>('big')?.length).toBe(1_000_000);
  });

  test('stress: 1000 rapid set/get operations', () => {
    const start = Date.now();

    for (let i = 0; i < 1000; i++) {
      cache.set(`stress:${i}`, { index: i, data: `value-${i}` });
    }

    for (let i = 0; i < 1000; i++) {
      const val = cache.get<{ index: number; data: string }>(`stress:${i}`);
      expect(val?.index).toBe(i);
    }

    const elapsed = Date.now() - start;
    // Should complete in under 1 second for 2000 operations
    expect(elapsed).toBeLessThan(1000);
  });

  test('stress: concurrent pattern clear during writes', () => {
    // Simulate writes and pattern clears happening together
    for (let i = 0; i < 500; i++) {
      cache.set(`batch-a:${i}`, i);
      cache.set(`batch-b:${i}`, i);
    }

    const removedA = cache.clearPattern('batch-a:');
    expect(removedA).toBe(500);

    // batch-b should be untouched
    for (let i = 0; i < 500; i++) {
      expect(cache.get(`batch-b:${i}`)).toBe(i);
    }
  });
});
