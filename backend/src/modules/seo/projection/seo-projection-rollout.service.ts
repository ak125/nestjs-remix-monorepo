/**
 * ADR-059 Phase B PR-7b — SeoProjectionRolloutService.
 *
 * Lecture du feature flag `seo_projection_read_v1` pour % rollout.
 *
 * **Advisory-only (ADR-059 §"GrowthBook advisory-only, never runtime-critical")** :
 *   - Runtime ne bloque JAMAIS sur lookup feature flag
 *   - Safe fallback : last cached state (Redis-like in-memory snapshot < 5min)
 *   - If cache expired : deterministic default = `false` (legacy path)
 *   - Circuit breaker : 3 failures → open 60s → bypass GrowthBook + return default
 *
 * 0 modification page Remix obligatoire — c'est l'appelant qui décide
 * d'utiliser ce service comme advisory toggle.
 *
 * Pour PR-7b initial : implémentation autonome (pas de dep GrowthBook SDK
 * obligatoire). Le client GrowthBook réel pourra être branché via DI dans
 * un PR followup quand l'instance self-hosted sera deployée.
 */
import { Injectable, Logger } from '@nestjs/common';


// ────────────────────────────────────────────────────────────────────────────
// Circuit breaker (anti runtime-critical dependency)
// ────────────────────────────────────────────────────────────────────────────

const CIRCUIT_FAIL_THRESHOLD = 3;
const CIRCUIT_OPEN_DURATION_MS = 60_000;
const CACHE_TTL_MS = 5 * 60_000; // 5 min — per ADR-059 §"GrowthBook advisory-only"

export const FALLBACK_DEFAULT_FLAG_VALUE = false;
export const FLAG_NAME = 'seo_projection_read_v1';


type CircuitState = 'closed' | 'open';

interface CachedFlag {
  value: boolean;
  fetched_at: number;
}


export interface RolloutDecision {
  /** Effective value to use at call site. */
  enabled: boolean;
  /** Provenance for observability + tests. */
  source: 'live' | 'cache' | 'circuit_open' | 'default';
  /** Last error if any (null on success). */
  last_error: string | null;
}


/**
 * Pluggable lookup function : remplaçable par un vrai GrowthBook client SDK
 * en DI ou PR followup. Doit retourner un boolean ou throw.
 */
export type FlagLookupFn = (flagName: string) => Promise<boolean>;


@Injectable()
export class SeoProjectionRolloutService {
  private readonly rolloutLogger = new Logger(SeoProjectionRolloutService.name);

  private failureCount = 0;
  private circuitState: CircuitState = 'closed';
  private circuitOpenedAt = 0;
  private cache: CachedFlag | null = null;

  /**
   * Lookup function injection. Default = throws (caller MUST inject a real
   * lookup via setLookup or DI). Sans lookup, fallback systematic.
   */
  private lookup: FlagLookupFn | null = null;

  setLookup(fn: FlagLookupFn): void {
    this.lookup = fn;
  }

  /**
   * Lit la décision rollout pour le flag canonique.
   *
   * **JAMAIS bloquant** : retourne en moins de quelques ms même si GrowthBook
   * unavailable. Cohérent ADR-059 §"Pages ne bloquent jamais sur lookup".
   */
  async getRolloutDecision(): Promise<RolloutDecision> {
    // ── Circuit OPEN : bypass entirely
    if (this.circuitState === 'open') {
      if (Date.now() - this.circuitOpenedAt < CIRCUIT_OPEN_DURATION_MS) {
        return {
          enabled: this.cacheFresh()
            ? (this.cache as CachedFlag).value
            : FALLBACK_DEFAULT_FLAG_VALUE,
          source: this.cacheFresh() ? 'cache' : 'circuit_open',
          last_error: 'circuit_breaker_open',
        };
      }
      // Probe : try once after window
      this.circuitState = 'closed';
      this.failureCount = 0;
    }

    // ── No lookup configured → deterministic default
    if (!this.lookup) {
      return {
        enabled: this.cacheFresh()
          ? (this.cache as CachedFlag).value
          : FALLBACK_DEFAULT_FLAG_VALUE,
        source: this.cacheFresh() ? 'cache' : 'default',
        last_error: null,
      };
    }

    // ── Live lookup
    try {
      const value = await this.lookup(FLAG_NAME);
      this.cache = { value, fetched_at: Date.now() };
      this.failureCount = 0;
      return { enabled: value, source: 'live', last_error: null };
    } catch (err) {
      const message = (err as Error).message;
      this.rolloutLogger.warn(
        `GrowthBook lookup failed (${this.failureCount + 1}/${CIRCUIT_FAIL_THRESHOLD}): ${message}`,
      );
      this.failureCount += 1;
      if (this.failureCount >= CIRCUIT_FAIL_THRESHOLD) {
        this.circuitState = 'open';
        this.circuitOpenedAt = Date.now();
        this.rolloutLogger.error(
          `GrowthBook circuit breaker OPEN for ${CIRCUIT_OPEN_DURATION_MS}ms. Pages will use cache OR legacy default.`,
        );
      }
      if (this.cacheFresh()) {
        return {
          enabled: (this.cache as CachedFlag).value,
          source: 'cache',
          last_error: message,
        };
      }
      return {
        enabled: FALLBACK_DEFAULT_FLAG_VALUE,
        source: 'default',
        last_error: message,
      };
    }
  }

  /** Test helpers — read internal state without exposing in production API. */
  getCircuitState(): CircuitState {
    return this.circuitState;
  }

  resetForTests(): void {
    this.failureCount = 0;
    this.circuitState = 'closed';
    this.circuitOpenedAt = 0;
    this.cache = null;
    this.lookup = null;
  }

  private cacheFresh(): boolean {
    if (!this.cache) return false;
    return Date.now() - this.cache.fetched_at < CACHE_TTL_MS;
  }
}
