/**
 * Typed cache constants for `RmAlternativesService` (soft-404 R2 alternatives).
 *
 * Hoisted from `rm-alternatives.service.ts` to make the cache discipline
 * declarative and invariant-testable.
 *
 * Failure modes these constants prevent :
 *
 *   1. **Long-TTL poisoning of empty payloads** (incident 2026-05-19,
 *      run 26104292014). When the upstream Supabase key was rotated but the
 *      deployment secret was not, every RPC returned `Invalid API key`, the
 *      service caught the error, returned an empty payload, and cached it
 *      for 5 min. Recovery was unbounded until the secret was re-synced.
 *      Fix : error/empty path uses `CACHE_TTL_ERROR_SECONDS` (≤30s).
 *
 *   2. **Cache-key reuse across breaking changes**. `CACHE_KEY_VERSION` is a
 *      one-time reset knob ; bumping it invalidates every key under the
 *      previous version. v1 → v2 was PR #633, v2 → v3 was PR #637.
 *
 * Linked memory : `feedback_no_long_ttl_cache_on_error_paths` — never cache
 * an error/empty result at the same TTL as a success result.
 */

/** Success-path TTL : 5 min. Free to tune up to hours. */
export const CACHE_TTL_SOFT_404_SUCCESS_SECONDS = 300;

/**
 * Error / empty-payload TTL : 30 s. **Invariant ≤ 30 s** — see file header.
 * Tuning this above 30 s is a regression and the invariant test will fail.
 */
export const CACHE_TTL_SOFT_404_ERROR_SECONDS = 30;

/**
 * Cache-key namespace prefix. Stable across versions ; the version suffix
 * isolates breaking changes.
 */
export const CACHE_KEY_PREFIX_SOFT_404 = 'alt';

/**
 * Cache-key version. Bump when the cached payload shape changes OR to flush
 * all entries (e.g. recovery from a poisoning event). History :
 *   - v1 → v2 (PR #633) : reset stale empties from the `.from()` era.
 *   - v2 → v3 (PR #637) : reset stale empties from the rotated-anon-key era.
 */
export const CACHE_KEY_VERSION_SOFT_404 = 'v3';
