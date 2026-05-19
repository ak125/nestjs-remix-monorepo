// backend/src/modules/rm/services/rm-alternatives.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { CacheService } from '@cache/cache.service';
import type {
  AlternativesV2Response,
  AlternativeVehicle,
  AlternativeGamme,
  RelatedModel,
} from '../dto/alternatives-v2.dto';

const CACHE_TTL_SECONDS = 300;
const CACHE_KEY_PREFIX = 'alt';
// v2 invalidates v1 entries cached by the legacy direct-query path
// (which returned empty arrays under preprod's anon-key RLS).
const CACHE_KEY_VERSION = 'v2';
const RPC_NAME = 'get_soft_404_alternatives';

interface RpcAlternativeVehicle {
  type_id?: unknown;
  type_name?: unknown;
  type_alias?: unknown;
  type_fuel?: unknown;
  type_power_ps?: unknown;
  type_year_from?: unknown;
  type_year_to?: unknown;
  modele_id?: unknown;
  modele_name?: unknown;
  modele_alias?: unknown;
  marque_id?: unknown;
  marque_name?: unknown;
  marque_alias?: unknown;
  tier?: unknown;
}

interface RpcAlternativeGamme {
  pg_id?: unknown;
  pg_name?: unknown;
  pg_alias?: unknown;
  pg_pic?: unknown;
  piece_count?: unknown;
  tier?: unknown;
}

interface RpcPayload {
  alternativeVehicles?: RpcAlternativeVehicle[] | null;
  alternativeGammes?: RpcAlternativeGamme[] | null;
  relatedModels?: RelatedModel[] | null;
}

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

    const { data, error } = await this.supabase.rpc(RPC_NAME as never, {
      p_type_id: type_id,
      p_pg_id: pg_id,
      p_limit: limit,
    } as never);

    if (error) {
      // No silent fallback : surface the error so the controller logs the stack
      // and returns a real 5xx. The loader's fetchJsonOrNull turns 5xx into null
      // and renders the page with the gamme-only fallback (graceful degrade).
      throw new Error(
        `${RPC_NAME} failed (type=${type_id}, pg=${pg_id}): ${error.message}`,
      );
    }

    const payload = (data ?? {}) as RpcPayload;
    const response = this.buildResponse(
      this.coerceVehicles(payload.alternativeVehicles ?? []),
      this.coerceGammes(payload.alternativeGammes ?? []),
      payload.relatedModels ?? [],
    );

    await this.cache.set(cacheKey, JSON.stringify(response), CACHE_TTL_SECONDS);
    return response;
  }

  private coerceTier(t: unknown): 1 | 2 | 3 {
    const n = typeof t === 'number' ? t : parseInt(String(t), 10);
    return n === 1 || n === 2 ? (n as 1 | 2) : 3;
  }

  private coerceVehicles(items: RpcAlternativeVehicle[]): AlternativeVehicle[] {
    return items.map((v) => ({
      type_id: String(v.type_id ?? ''),
      type_name: String(v.type_name ?? ''),
      type_alias: v.type_alias == null ? null : String(v.type_alias),
      type_fuel: String(v.type_fuel ?? ''),
      type_power_ps: String(v.type_power_ps ?? ''),
      type_year_from: String(v.type_year_from ?? ''),
      type_year_to: String(v.type_year_to ?? ''),
      modele_id: Number(v.modele_id),
      modele_name: String(v.modele_name ?? ''),
      modele_alias: String(v.modele_alias ?? ''),
      marque_id: Number(v.marque_id),
      marque_name: String(v.marque_name ?? ''),
      marque_alias: String(v.marque_alias ?? ''),
      tier: this.coerceTier(v.tier),
    }));
  }

  private coerceGammes(items: RpcAlternativeGamme[]): AlternativeGamme[] {
    return items.map((g) => ({
      pg_id: Number(g.pg_id),
      pg_name: String(g.pg_name ?? ''),
      pg_alias: String(g.pg_alias ?? ''),
      pg_pic: g.pg_pic == null ? null : String(g.pg_pic),
      piece_count: Number(g.piece_count) || 0,
      tier: this.coerceTier(g.tier),
    }));
  }

  canonicalize(input: unknown): string {
    if (input === null || typeof input !== 'object')
      return JSON.stringify(input);
    if (Array.isArray(input))
      return '[' + input.map((v) => this.canonicalize(v)).join(',') + ']';
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

  private buildResponse(
    vehicles: AlternativeVehicle[],
    gammes: AlternativeGamme[],
    models: RelatedModel[],
  ): AlternativesV2Response {
    const payload = {
      alternativeVehicles: vehicles,
      alternativeGammes: gammes,
      relatedModels: models,
    };
    const etag =
      'sha256-' +
      createHash('sha256').update(this.canonicalize(payload)).digest('hex');
    return {
      success: true,
      version: 'v2',
      etag,
      ...payload,
    };
  }
}
