// backend/src/modules/rm/services/rm-alternatives.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { CacheService } from '@cache/cache.service';
import {
  CACHE_STRATEGIES,
  getCacheKey,
} from '../../../config/cache-ttl.config';
import type { AlternativesV2Response } from '../dto/alternatives-v2.dto';

// TTLs, jeton de version (v4) et périmètre de génération déclarés dans
// CACHE_STRATEGIES.RM.ALTERNATIVES (A2 + A3, 2026-09-02) — plus de littéral local.
// Succès = 24 h : les alternatives dérivent de la compatibilité TecDoc, qui ne
// bouge qu'à l'import catalogue. À 300 s sur une cardinalité 54 k × 9 k, le
// taux de hit était structurellement ~0 (498 k appels RPC, 2 795 blocs/appel).
// L'invalidation ne vient pas de l'expiration mais du bump de génération
// (`cache:gen:catalog`) à l'activation pricing : clé `alt:v4:g{gen}:{type}:{pg}`.
const STRATEGY = CACHE_STRATEGIES.RM.ALTERNATIVES;
const CACHE_TTL_SECONDS = STRATEGY.ttl;
// Error-path TTL kept low so a transient RPC failure does not poison the cache.
// Long-TTL caching of empty responses was the amplifier behind the soft-404 R2
// smoke regression detected 2026-05-19 (stale anon publishable key → 'Invalid
// API key' on every RPC → 300s cache of [] → 5min false-empty).
const CACHE_TTL_ERROR_SECONDS = CACHE_STRATEGIES.RM.ALTERNATIVES_ERROR.ttl;
// Limit canonique = borne haute du contrôleur (clamp 1..24). La RPC borne
// elle-même à LEAST(6, p_limit) véhicules / LEAST(8, p_limit) gammes / 4 modèles :
// une seule entrée de cache par (type_id, pg_id) sert donc tous les limits par
// tranche préfixe, sans multiplier la cardinalité (NO-GO 6c du plan massdoc).
const RPC_CANONICAL_LIMIT = 24;

interface RpcPayload {
  alternativeVehicles: unknown[];
  alternativeGammes: unknown[];
  relatedModels: unknown[];
}

const EMPTY_PAYLOAD: RpcPayload = {
  alternativeVehicles: [],
  alternativeGammes: [],
  relatedModels: [],
};

function isRpcPayload(value: unknown): value is RpcPayload {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.alternativeVehicles) &&
    Array.isArray(v.alternativeGammes) &&
    Array.isArray(v.relatedModels)
  );
}

/**
 * Soft-404 R2 alternatives service.
 *
 * Canon repo (203 services dans le codebase) :
 *   - `extends SupabaseBaseService` (pas d'injection constructor)
 *   - lectures via `this.callRpc(...)` (jamais `.from()` direct)
 *
 * Le ranking multi-tier compat-aware (vehicles/gammes/relatedModels) vit
 * dans la fonction Postgres `get_soft_404_alternatives` (SECURITY DEFINER,
 * bypass RLS — ADR-021 hardening + ADR-028 Option D preprod READ_ONLY).
 *
 * Ce service est un thin wrapper :
 *   1. Cache-aside Redis (TTL CACHE_STRATEGIES.RM.ALTERNATIVES), clé sans limit
 *   2. Appel RPC unique (1 round-trip) au limit canonique
 *   3. Tranche préfixe au limit demandé + etag sha256 canonical JSON (replay-safe)
 */
@Injectable()
export class RmAlternativesService extends SupabaseBaseService {
  protected readonly logger = new Logger(RmAlternativesService.name);

  constructor(private readonly cache: CacheService) {
    super();
  }

  async compute(
    type_id: number,
    pg_id: number,
    limit: number,
  ): Promise<AlternativesV2Response> {
    const generation = await this.cache.getGeneration(STRATEGY.generation);
    const cacheKey = getCacheKey(STRATEGY, `${type_id}:${pg_id}`, generation);

    const cached = await this.cache.get(cacheKey);
    if (cached) {
      const payload = this.parseCachedPayload(cached, cacheKey);
      if (payload) {
        return this.buildResponse(this.sliceToLimit(payload, limit));
      }
    }

    // Inline literal (instead of const) so check-rpc-allowlist-coverage.sh's
    // static parser picks it up — variable RPC names slip past the gate and
    // only fail at runtime (incident root cause for run 26101726823).
    const { data, error } = await this.callRpc<RpcPayload>(
      'get_soft_404_alternatives',
      { p_type_id: type_id, p_pg_id: pg_id, p_limit: RPC_CANONICAL_LIMIT },
      { source: 'api' as const },
    );

    if (error || !data) {
      // Auth/permission failures get ERROR level — they signal infra config drift
      // (e.g. rotated key not synced to deployment secrets) and need pager-grade
      // visibility, not the same WARN as a benign empty result.
      const isAuthFailure =
        /invalid api key|jwt|permission denied|unauthorized/i.test(
          error?.message ?? '',
        );
      const logLevel = isAuthFailure ? 'error' : 'warn';
      this.logger[logLevel](
        `RPC get_soft_404_alternatives failed for type=${type_id} pg=${pg_id}: ${
          error?.message ?? 'no data'
        }`,
      );
      // Short TTL on error path: thundering-herd protection without long-window
      // cache poisoning. If the underlying issue clears (key re-synced, RLS
      // policy fixed, transient timeout), recovery is bounded to 30s.
      await this.cache.set(
        cacheKey,
        JSON.stringify(EMPTY_PAYLOAD),
        CACHE_TTL_ERROR_SECONDS,
      );
      return this.buildResponse(EMPTY_PAYLOAD);
    }

    await this.cache.set(cacheKey, JSON.stringify(data), CACHE_TTL_SECONDS);
    return this.buildResponse(this.sliceToLimit(data, limit));
  }

  /**
   * Canonical JSON : clés triées récursivement. Utilisé pour l'etag.
   * Mémoire `feedback_deterministic_input_hash_canonical_json`.
   */
  canonicalize(input: unknown): string {
    if (input === null || typeof input !== 'object') {
      return JSON.stringify(input);
    }
    if (Array.isArray(input)) {
      return '[' + input.map((v) => this.canonicalize(v)).join(',') + ']';
    }
    const keys = Object.keys(input as Record<string, unknown>).sort();
    return (
      '{' +
      keys
        .map(
          (k) => JSON.stringify(k) + ':' + this.canonicalize((input as any)[k]),
        )
        .join(',') +
      '}'
    );
  }

  /**
   * Tranche préfixe : reproduit exactement `LEAST(n, p_limit)` de la RPC sur
   * le payload calculé au limit canonique. `relatedModels` est borné à 4 par
   * la RPC indépendamment de `p_limit` — jamais tranché.
   */
  private sliceToLimit(payload: RpcPayload, limit: number): RpcPayload {
    return {
      alternativeVehicles: payload.alternativeVehicles.slice(0, limit),
      alternativeGammes: payload.alternativeGammes.slice(0, limit),
      relatedModels: payload.relatedModels,
    };
  }

  private parseCachedPayload(
    cached: unknown,
    cacheKey: string,
  ): RpcPayload | null {
    try {
      const parsed: unknown =
        typeof cached === 'string' ? JSON.parse(cached) : cached;
      if (isRpcPayload(parsed)) return parsed;
      this.logger.warn(`Cache shape mismatch for ${cacheKey}, recomputing`);
    } catch {
      this.logger.warn(`Cache parse error for ${cacheKey}, recomputing`);
    }
    return null;
  }

  private buildResponse(payload: RpcPayload): AlternativesV2Response {
    const etag =
      'sha256-' +
      createHash('sha256').update(this.canonicalize(payload)).digest('hex');
    return {
      success: true,
      version: 'v2',
      etag,
      alternativeVehicles: payload.alternativeVehicles as any,
      alternativeGammes: payload.alternativeGammes as any,
      relatedModels: payload.relatedModels as any,
    };
  }
}
