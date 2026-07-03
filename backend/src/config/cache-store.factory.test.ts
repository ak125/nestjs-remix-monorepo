import { createCache } from 'cache-manager';

import { CacheTTL, CACHE_STRATEGIES, getTTLMs } from './cache-ttl.config';
import { boundedMemoryCache } from './cache-store.factory';

/**
 * Characterization tests for the cache-manager v5 → v6 / Keyv migration (PR-9f.cache).
 *
 * These lock in the behaviour the 9 `CacheModule.register` sites and their
 * `@Inject(CACHE_MANAGER)` consumers relied on under v5, proving the migration is
 * behaviour-neutral:
 *   - TTL numbers are forwarded verbatim in **milliseconds** (v5 and v6 both ms).
 *   - The former `max` LRU bound is preserved via Keyv `lruSize`.
 *   - A miss is falsy, so every consumer's `if (cached)` recomputes exactly as before.
 *
 * They also guard the cross-subsystem invariant that the seconds-based `CacheTTL`
 * enum (shared with the ioredis `CacheService`) is NOT touched by this migration.
 */

// `boundedMemoryCache` returns the broad `CacheModuleOptions` shape; feed it straight
// into cache-manager's `createCache` — the same call the @nestjs/cache-manager provider
// makes internally — to exercise the real store at runtime.
const buildCache = (opts: ReturnType<typeof boundedMemoryCache>) =>
  createCache(opts as unknown as Parameters<typeof createCache>[0]);

describe('boundedMemoryCache (cache-manager v6 / Keyv store factory)', () => {
  it('forwards the TTL verbatim as the cache-level default (milliseconds)', () => {
    const opts = boundedMemoryCache(1234, 50);
    expect(opts.ttl).toBe(1234);
    expect(Array.isArray(opts.stores)).toBe(true);
  });

  it('maps the former `max` onto Keyv lruSize (bounded eviction)', async () => {
    // lruSize 2: a third insertion evicts the least-recently-used entry.
    const cache = buildCache(boundedMemoryCache(60_000, 2));
    await cache.set('a', { v: 1 });
    await cache.set('b', { v: 2 });
    await cache.set('c', { v: 3 });

    expect(await cache.get('a')).toBeFalsy(); // evicted
    expect(await cache.get('b')).toEqual({ v: 2 });
    expect(await cache.get('c')).toEqual({ v: 3 });
  });

  it('returns a falsy miss so consumer `if (cached)` recomputes (v5-equivalent control flow)', async () => {
    const cache = buildCache(boundedMemoryCache(60_000, 10));
    const miss = await cache.get('absent');
    expect(miss).toBeFalsy();
    // Every CACHE_MANAGER consumer branches on truthiness; null and undefined are equivalent here.
    expect(miss ? 'hit' : 'recompute').toBe('recompute');
  });

  it('round-trips set/get, removes via del, and empties via clear()', async () => {
    const cache = buildCache(boundedMemoryCache(60_000, 10));
    await cache.set('k', { hello: 'world' });
    expect(await cache.get('k')).toEqual({ hello: 'world' });

    await cache.del('k');
    expect(await cache.get('k')).toBeFalsy();

    await cache.set('x', 1);
    await cache.set('y', 2);
    await cache.clear(); // v6 rename of v5 reset()
    expect(await cache.get('x')).toBeFalsy();
    expect(await cache.get('y')).toBeFalsy();
  });

  it('treats the TTL number as milliseconds, not seconds (entry expires)', async () => {
    // 60 ms TTL: present immediately, gone after 120 ms. If the number were treated
    // as seconds the entry would still be present — this distinguishes ms from s.
    const cache = buildCache(boundedMemoryCache(60, 10));
    await cache.set('exp', { v: 9 });
    expect(await cache.get('exp')).toEqual({ v: 9 });

    await new Promise((r) => setTimeout(r, 120));
    expect(await cache.get('exp')).toBeFalsy();
  });
});

describe('cross-subsystem TTL invariant (do NOT convert the seconds enum)', () => {
  it('keeps CacheTTL in seconds (shared with ioredis CacheService setex/expire)', () => {
    expect(CacheTTL.ONE_HOUR).toBe(3600);
    expect(CacheTTL.FIVE_MINUTES).toBe(300);
    expect(CacheTTL.THIRTY_MINUTES).toBe(1800);
  });

  it('getTTLMs converts seconds → ms at the call site (× 1000), enum untouched', () => {
    const strategy = CACHE_STRATEGIES.AUTH.RESET_TOKEN; // ttl: ONE_HOUR (3600 s)
    expect(strategy.ttl).toBe(3600);
    expect(getTTLMs(strategy)).toBe(3_600_000);
  });
});
