// backend/src/modules/rm/services/rm-alternatives.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { CacheService } from '@cache/cache.service';
import type { AlternativesV2Response } from '../dto/alternatives-v2.dto';
import {
  CACHE_TTL_SOFT_404_SUCCESS_SECONDS,
  CACHE_TTL_SOFT_404_ERROR_SECONDS,
  CACHE_KEY_PREFIX_SOFT_404,
  CACHE_KEY_VERSION_SOFT_404,
} from './soft-404-cache.constants';

interface RpcPayload {
  alternativeVehicles: unknown[];
  alternativeGammes: unknown[];
  relatedModels: unknown[];
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
 *   1. Cache-aside Redis 5 min
 *   2. Appel RPC unique (1 round-trip)
 *   3. Calcul etag sha256 canonical JSON (replay-safe)
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
    const cacheKey = `${CACHE_KEY_PREFIX_SOFT_404}:${type_id}:${pg_id}:${CACHE_KEY_VERSION_SOFT_404}`;

    const cached = await this.cache.get(cacheKey);
    if (cached) {
      try {
        return typeof cached === 'string'
          ? (JSON.parse(cached) as AlternativesV2Response)
          : (cached as AlternativesV2Response);
      } catch {
        this.logger.warn(`Cache parse error for ${cacheKey}, recomputing`);
      }
    }

    // Inline literal (instead of const) so check-rpc-allowlist-coverage.sh's
    // static parser picks it up — variable RPC names slip past the gate and
    // only fail at runtime (incident root cause for run 26101726823).
    const { data, error } = await this.callRpc<RpcPayload>(
      'get_soft_404_alternatives',
      { p_type_id: type_id, p_pg_id: pg_id, p_limit: limit },
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
      const empty = this.buildResponse({
        alternativeVehicles: [],
        alternativeGammes: [],
        relatedModels: [],
      });
      // Short TTL on error path: thundering-herd protection without long-window
      // cache poisoning. If the underlying issue clears (key re-synced, RLS
      // policy fixed, transient timeout), recovery is bounded to 30s.
      await this.cache.set(
        cacheKey,
        JSON.stringify(empty),
        CACHE_TTL_SOFT_404_ERROR_SECONDS,
      );
      return empty;
    }

    const response = this.buildResponse(data);
    await this.cache.set(
      cacheKey,
      JSON.stringify(response),
      CACHE_TTL_SOFT_404_SUCCESS_SECONDS,
    );
    return response;
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
