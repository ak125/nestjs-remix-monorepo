// backend/src/modules/rm/services/rm-alternatives.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { CacheService } from '@cache/cache.service';
import type { AlternativesV2Response } from '../dto/alternatives-v2.dto';

const CACHE_TTL_SECONDS = 300;
const CACHE_KEY_PREFIX = 'alt';
// v1 → v2 (2026-05-19) : v1 entries were populated with empty arrays during the
// window where the service ran the direct `.from().select()` path under preprod's
// anon key (PR #595→#618 timeline). Redis-preprod uses appendonly + named volume,
// so those empty entries survive deploys and short-circuit the new RPC path.
// Bumping the version forces a cache miss → RPC call → real data.
const CACHE_KEY_VERSION = 'v2';
const RPC_NAME = 'get_soft_404_alternatives';

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
    const cacheKey = `${CACHE_KEY_PREFIX}:${type_id}:${pg_id}:${CACHE_KEY_VERSION}`;

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

    const { data, error } = await this.callRpc<RpcPayload>(
      RPC_NAME,
      { p_type_id: type_id, p_pg_id: pg_id, p_limit: limit },
      { source: 'api' as const },
    );

    if (error || !data) {
      this.logger.warn(
        `RPC ${RPC_NAME} failed for type=${type_id} pg=${pg_id}: ${
          error?.message ?? 'no data'
        }`,
      );
      const empty = this.buildResponse({
        alternativeVehicles: [],
        alternativeGammes: [],
        relatedModels: [],
      });
      await this.cache.set(cacheKey, JSON.stringify(empty), CACHE_TTL_SECONDS);
      return empty;
    }

    const response = this.buildResponse(data);
    await this.cache.set(cacheKey, JSON.stringify(response), CACHE_TTL_SECONDS);
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
