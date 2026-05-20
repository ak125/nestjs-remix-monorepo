import {
  CACHE_TTL_SOFT_404_ERROR_SECONDS,
  CACHE_TTL_SOFT_404_SUCCESS_SECONDS,
  CACHE_KEY_PREFIX_SOFT_404,
  CACHE_KEY_VERSION_SOFT_404,
} from '../soft-404-cache.constants';

/**
 * Declarative invariants for the soft-404 cache discipline.
 *
 * If any of these break, the regression detected by run 26104292014
 * (5min poisoning of empty payloads under a rotated Supabase key) can
 * recur. Treat as load-bearing.
 */
describe('soft-404 cache constants — invariants', () => {
  it('error TTL is ≤ 30 seconds (no long-TTL poisoning on error path)', () => {
    expect(CACHE_TTL_SOFT_404_ERROR_SECONDS).toBeLessThanOrEqual(30);
  });

  it('success TTL is strictly greater than error TTL', () => {
    expect(CACHE_TTL_SOFT_404_SUCCESS_SECONDS).toBeGreaterThan(
      CACHE_TTL_SOFT_404_ERROR_SECONDS,
    );
  });

  it('error TTL is strictly positive (no caching at all would be cheaper than 0s)', () => {
    expect(CACHE_TTL_SOFT_404_ERROR_SECONDS).toBeGreaterThan(0);
  });

  it('cache key prefix is the canonical `alt` namespace', () => {
    expect(CACHE_KEY_PREFIX_SOFT_404).toBe('alt');
  });

  it('cache key version is a non-empty short tag', () => {
    expect(CACHE_KEY_VERSION_SOFT_404).toMatch(/^v\d+$/);
  });
});
