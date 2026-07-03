/**
 * Shared in-memory cache-store factory for `CacheModule.register(...)`.
 *
 * Background — cache-manager v6 (used by `@nestjs/cache-manager@3`) replaced the
 * built-in `store`/`max` register options with Keyv-backed stores. Two consequences
 * the register sites must account for:
 *   1. `max` (the historical LRU bound) is NOT honoured by Keyv — the equivalent is
 *      `lruSize` on the `CacheableMemory` store.
 *   2. The store is passed as `stores: [Keyv]`, not the inline `{ store, max }` of v5.
 *
 * This factory is the single place that maps our historical `{ ttl, max }` options
 * onto the v6 shape (the canonical `new Keyv({ store: new CacheableMemory(...) })`
 * pattern from the cache-manager v6 docs), so every register site stays one
 * declarative call instead of re-deriving the Keyv wiring. The result is consumed by
 * `CacheModule.register(...)`; that assignability is enforced by `tsc` at each of the
 * 9 call sites (the `typecheck` CI gate).
 *
 * Units — cache-manager has ALWAYS taken TTL in **milliseconds** (v5 and v6 alike),
 * so `ttlMs` is forwarded verbatim: this migration is behaviour-neutral. The
 * seconds-based `CacheTTL` enum (shared with the ioredis `CacheService`, whose
 * `setex`/`expire` require seconds) is intentionally NOT involved here — converting
 * it would corrupt that subsystem. See {@link ./cache-ttl.config.ts}.
 */
import { CacheableMemory } from 'cacheable';
import { Keyv } from 'keyv';

import type { CacheModuleOptions } from '@nestjs/cache-manager';

/**
 * Build `CacheModule.register` options for a bounded in-memory (LRU) store.
 *
 * @param ttlMs      Default entry TTL in milliseconds. Forwarded verbatim — pass the
 *                   exact numeric value the site used under cache-manager v5.
 * @param maxEntries LRU bound (former `max`), mapped to Keyv `lruSize`.
 */
export function boundedMemoryCache(
  ttlMs: number,
  maxEntries: number,
): CacheModuleOptions {
  // Canonical cache-manager v6 in-memory store: a Keyv backed by CacheableMemory, which
  // honours `lruSize` (the former `max`).
  const store = new Keyv({
    store: new CacheableMemory({ ttl: ttlMs, lruSize: maxEntries }),
  });
  // `keyv` ships dual `.d.ts` (ESM) / `.d.cts` (CJS) type declarations. Production `tsc`
  // (whole-program, classic `Node` resolution) reads the single `types` entry and
  // validates this shape end-to-end. But ts-jest's per-file program can load the `keyv`
  // copy reached through `cacheable` (CJS `.d.cts`) AND the direct import (`.d.ts`) as
  // two *unrelated* nominal `Keyv` types — which would otherwise leak into every
  // consumer module's `CacheModule.register(...)` type-check. Returning `CacheModuleOptions`
  // keeps that raw identity inside this one file; the cast bridges only the ts-jest
  // artifact, never a real structural mismatch (the runtime store is unchanged).
  return {
    stores: [store] as unknown as NonNullable<CacheModuleOptions['stores']>,
    ttl: ttlMs,
  };
}
