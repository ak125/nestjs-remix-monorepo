// backend/src/modules/rm/services/rm-alternatives.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { CacheService } from '@cache/cache.service';
import { findClusterFor } from './gamme-clusters.const';
import type {
  AlternativesV2Response,
  AlternativeVehicle,
  AlternativeGamme,
  RelatedModel,
} from '../dto/alternatives-v2.dto';

const CACHE_TTL_SECONDS = 300;
const CACHE_KEY_PREFIX = 'alt';
const CACHE_KEY_VERSION = 'v1';
const TIER_WEIGHT = { 1: 1.0, 2: 0.8, 3: 0.5 } as const;

interface VehicleCandidate {
  type_id: string;
  type_name: string;
  type_alias: string | null;
  type_fuel: string;
  type_power_ps: string;
  type_year_from: string;
  type_year_to: string;
  modele_id: number;
  modele_name: string;
  modele_alias: string;
  modele_parent: number | null;
  marque_id: number;
  marque_name: string;
  marque_alias: string;
  power_ps_num: number;
}

interface VehicleTarget {
  target_type_id: number;
  target_modele_id: number;
  target_modele_parent: number | null;
  target_marque_id: number;
  target_power_ps: number;
}

@Injectable()
export class RmAlternativesService {
  private readonly logger = new Logger(RmAlternativesService.name);

  constructor(
    private readonly supabase: SupabaseBaseService,
    private readonly cache: CacheService,
  ) {}

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

    const [target, gammeRows] = await Promise.all([
      this.loadTarget(type_id),
      this.fetchCompatibleGammes(type_id, pg_id, limit * 2),
    ]);

    const gammes = this.rankGammes(gammeRows, pg_id).slice(
      0,
      Math.min(8, limit),
    );

    if (!target) {
      const empty = this.buildResponse([], gammes, []);
      await this.cache.set(cacheKey, JSON.stringify(empty), CACHE_TTL_SECONDS);
      return empty;
    }

    const [vehicleCands, modelRows] = await Promise.all([
      this.fetchVehicleCandidates(target, pg_id, limit * 3),
      this.fetchRelatedModels(target, pg_id, 4),
    ]);

    const vehicles = this.rankVehicles(vehicleCands, target).slice(
      0,
      Math.min(6, limit),
    );
    const models = await this.attachRepresentativeTypes(
      modelRows,
      pg_id,
      target,
    );

    const response = this.buildResponse(vehicles, gammes, models);
    await this.cache.set(cacheKey, JSON.stringify(response), CACHE_TTL_SECONDS);
    return response;
  }

  /**
   * Returns the Supabase query client.
   * The injected `SupabaseBaseService` instance exposes the client via `.client`
   * (as set up in tests) or `.supabase` (the actual protected property).
   */
  private getClient(): any {
    return (
      (this.supabase as any).client ??
      (this.supabase as any).supabase ??
      this.supabase
    );
  }

  private async loadTarget(type_id: number): Promise<VehicleTarget | null> {
    const sb = this.getClient();
    const { data, error } = await sb
      .from('auto_type')
      .select('type_modele_id, type_marque_id, type_power_ps')
      .eq('type_id_i', type_id)
      .single();
    if (error || !data) return null;
    const modele_id = parseInt(String(data.type_modele_id), 10);
    if (Number.isNaN(modele_id)) return null;

    const { data: modele } = await sb
      .from('auto_modele')
      .select('modele_parent, modele_marque_id')
      .eq('modele_id', modele_id)
      .single();
    return {
      target_type_id: type_id,
      target_modele_id: modele_id,
      target_modele_parent: (modele as any)?.modele_parent ?? null,
      target_marque_id: parseInt(String(data.type_marque_id), 10),
      target_power_ps: parseInt(String(data.type_power_ps), 10) || 0,
    };
  }

  private async fetchVehicleCandidates(
    target: VehicleTarget,
    pg_id: number,
    raw_limit: number,
  ): Promise<VehicleCandidate[]> {
    const sb = this.getClient();
    const { data: compat } = await sb
      .from('pieces_relation_type')
      .select('rtp_type_id')
      .eq('rtp_pg_id', pg_id)
      .limit(2000);

    const compat_ids = (compat ?? [])
      .map((r: any) => parseInt(String(r.rtp_type_id), 10))
      .filter(Boolean);
    if (compat_ids.length === 0) return [];

    const { data: types } = await sb
      .from('auto_type')
      .select(
        'type_id, type_id_i, type_name, type_alias, type_fuel, type_power_ps, type_year_from, type_year_to, type_modele_id, type_marque_id, type_display, type_relfollow',
      )
      .in('type_id_i', compat_ids.slice(0, 1500))
      .eq('type_marque_id', String(target.target_marque_id))
      .eq('type_display', '1')
      .eq('type_relfollow', '1')
      .limit(raw_limit);

    if (!types || types.length === 0) return [];

    const modele_ids = Array.from(
      new Set(types.map((t: any) => parseInt(String(t.type_modele_id), 10))),
    );
    const { data: modeles } = await sb
      .from('auto_modele')
      .select(
        'modele_id, modele_name, modele_alias, modele_marque_id, modele_parent',
      )
      .in('modele_id', modele_ids);

    const modele_index = new Map<number, any>(
      (modeles ?? []).map((m: any) => [m.modele_id, m]),
    );

    const { data: marque } = await sb
      .from('auto_marque')
      .select('marque_id, marque_name, marque_alias')
      .eq('marque_id', target.target_marque_id)
      .single();

    return types
      .filter(
        (t: any) => parseInt(String(t.type_id_i), 10) !== target.target_type_id,
      )
      .map((t: any) => {
        const m = modele_index.get(parseInt(String(t.type_modele_id), 10));
        if (!m) return null;
        return {
          type_id: String(t.type_id),
          type_name: String(t.type_name),
          type_alias: t.type_alias ?? null,
          type_fuel: String(t.type_fuel ?? ''),
          type_power_ps: String(t.type_power_ps ?? ''),
          type_year_from: String(t.type_year_from ?? ''),
          type_year_to: String(t.type_year_to ?? ''),
          modele_id: m.modele_id,
          modele_name: m.modele_name,
          modele_alias: m.modele_alias,
          modele_parent: m.modele_parent,
          marque_id: (marque as any)?.marque_id ?? target.target_marque_id,
          marque_name: (marque as any)?.marque_name ?? '',
          marque_alias: (marque as any)?.marque_alias ?? '',
          power_ps_num: parseInt(String(t.type_power_ps), 10) || 0,
        } as VehicleCandidate;
      })
      .filter(
        (v: VehicleCandidate | null): v is VehicleCandidate => v !== null,
      );
  }

  rankVehicles(
    candidates: VehicleCandidate[],
    target: VehicleTarget,
  ): AlternativeVehicle[] {
    const seen_modeles = new Set<number>();
    return candidates
      .map((c) => {
        const tier: 1 | 2 | 3 =
          c.modele_id === target.target_modele_id
            ? 1
            : target.target_modele_parent !== null &&
                c.modele_parent === target.target_modele_parent
              ? 2
              : 3;
        const power_proximity =
          1 -
          Math.min(1, Math.abs(c.power_ps_num - target.target_power_ps) / 500);
        const score = TIER_WEIGHT[tier] * Math.max(0.1, power_proximity);
        return { c, tier, score };
      })
      .sort(
        (a, b) => b.score - a.score || a.c.type_id.localeCompare(b.c.type_id),
      )
      .filter(({ c }) => {
        if (seen_modeles.has(c.modele_id)) return false;
        seen_modeles.add(c.modele_id);
        return true;
      })
      .map(({ c, tier }) => ({
        type_id: c.type_id,
        type_name: c.type_name,
        type_alias: c.type_alias,
        type_fuel: c.type_fuel,
        type_power_ps: c.type_power_ps,
        type_year_from: c.type_year_from,
        type_year_to: c.type_year_to,
        modele_id: c.modele_id,
        modele_name: c.modele_name,
        modele_alias: c.modele_alias,
        marque_id: c.marque_id,
        marque_name: c.marque_name,
        marque_alias: c.marque_alias,
        tier,
      }));
  }

  private async fetchCompatibleGammes(
    type_id: number,
    exclude_pg_id: number,
    raw_limit: number,
  ): Promise<
    Array<{
      pg_id: number;
      pg_name: string;
      pg_alias: string;
      pg_pic: string | null;
      pg_top: string;
      piece_count: number;
    }>
  > {
    const sb = this.getClient();
    const { data: rels } = await sb
      .from('pieces_relation_type')
      .select('rtp_pg_id')
      .eq('rtp_type_id', type_id)
      .limit(2000);

    const counts = new Map<number, number>();
    (rels ?? []).forEach((r: any) => {
      const id = parseInt(String(r.rtp_pg_id), 10);
      if (!id || id === exclude_pg_id) return;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    });
    const pg_ids = Array.from(counts.keys()).slice(0, raw_limit);
    if (pg_ids.length === 0) return [];

    const { data: gammes } = await sb
      .from('pieces_gamme')
      .select('pg_id, pg_name, pg_alias, pg_pic, pg_top, pg_display')
      .in('pg_id', pg_ids)
      .eq('pg_display', '1');

    return (gammes ?? []).map((g: any) => ({
      pg_id: g.pg_id,
      pg_name: g.pg_name,
      pg_alias: g.pg_alias,
      pg_pic: g.pg_pic,
      pg_top: g.pg_top,
      piece_count: counts.get(g.pg_id) ?? 0,
    }));
  }

  rankGammes(
    rows: Array<{
      pg_id: number;
      pg_name: string;
      pg_alias: string;
      pg_pic: string | null;
      pg_top: string;
      piece_count: number;
    }>,
    reference_pg_id: number,
  ): AlternativeGamme[] {
    const cluster = findClusterFor(reference_pg_id);
    const cluster_members = new Set(cluster?.member_pg_ids ?? []);
    const cluster_parent = cluster?.parent_pg_id ?? null;

    return rows
      .map((r) => {
        const tier: 1 | 2 | 3 = cluster_members.has(r.pg_id)
          ? 1
          : cluster_parent !== null && r.pg_id === cluster_parent
            ? 2
            : 3;
        const popularity = Math.log(1 + r.piece_count);
        const top_boost = r.pg_top === '1' ? 1.2 : 1.0;
        const score = TIER_WEIGHT[tier] * popularity * top_boost;
        return { r, tier, score };
      })
      .sort((a, b) => b.score - a.score || a.r.pg_id - b.r.pg_id)
      .map(({ r, tier }) => ({
        pg_id: r.pg_id,
        pg_name: r.pg_name,
        pg_alias: r.pg_alias,
        pg_pic: r.pg_pic,
        piece_count: r.piece_count,
        tier,
      }));
  }

  private async fetchRelatedModels(
    target: VehicleTarget,
    pg_id: number,
    limit: number,
  ): Promise<
    Array<{ modele_id: number; modele_name: string; modele_alias: string }>
  > {
    const sb = this.getClient();
    const { data: compat_types } = await sb
      .from('pieces_relation_type')
      .select('rtp_type_id')
      .eq('rtp_pg_id', pg_id)
      .limit(2000);
    const compat_type_ids = (compat_types ?? []).map((r: any) =>
      parseInt(String(r.rtp_type_id), 10),
    );
    if (compat_type_ids.length === 0) return [];

    const { data: types } = await sb
      .from('auto_type')
      .select('type_modele_id')
      .in('type_id_i', compat_type_ids.slice(0, 2000))
      .eq('type_marque_id', String(target.target_marque_id))
      .eq('type_display', '1')
      .eq('type_relfollow', '1');

    const modele_ids = Array.from(
      new Set(
        (types ?? [])
          .map((t: any) => parseInt(String(t.type_modele_id), 10))
          .filter((id: number) => id && id !== target.target_modele_id),
      ),
    );
    if (modele_ids.length === 0) return [];

    const { data: modeles } = await sb
      .from('auto_modele')
      .select('modele_id, modele_name, modele_alias, modele_display')
      .in('modele_id', modele_ids)
      .eq('modele_display', 1)
      .limit(limit);

    return (modeles ?? []).map((m: any) => ({
      modele_id: m.modele_id,
      modele_name: m.modele_name,
      modele_alias: m.modele_alias,
    }));
  }

  private async attachRepresentativeTypes(
    modeles: Array<{
      modele_id: number;
      modele_name: string;
      modele_alias: string;
    }>,
    pg_id: number,
    target: VehicleTarget,
  ): Promise<RelatedModel[]> {
    if (modeles.length === 0) return [];
    const sb = this.getClient();

    // Fetch marque once — all related models share the same target_marque_id
    const { data: marque } = await sb
      .from('auto_marque')
      .select('marque_id, marque_name, marque_alias')
      .eq('marque_id', target.target_marque_id)
      .single();
    const marqueInfo = {
      marque_id: (marque as any)?.marque_id ?? target.target_marque_id,
      marque_name: String((marque as any)?.marque_name ?? ''),
      marque_alias: String((marque as any)?.marque_alias ?? ''),
    };

    const result: RelatedModel[] = [];
    for (const m of modeles) {
      const { data: types } = await sb
        .from('auto_type')
        .select('type_id, type_alias, type_modele_id, type_marque_id')
        .eq('type_modele_id', String(m.modele_id))
        .eq('type_display', '1')
        .eq('type_relfollow', '1')
        .limit(50);
      if (!types || types.length === 0) continue;
      const type_ids = types.map((t: any) => parseInt(String(t.type_id), 10));
      const { data: rels } = await sb
        .from('pieces_relation_type')
        .select('rtp_type_id')
        .in('rtp_type_id', type_ids)
        .eq('rtp_pg_id', pg_id);
      const reliable = (rels ?? [])
        .map((r: any) => parseInt(String(r.rtp_type_id), 10))
        .reduce((acc: Map<number, number>, id: number) => {
          acc.set(id, (acc.get(id) ?? 0) + 1);
          return acc;
        }, new Map<number, number>());
      if (reliable.size === 0) continue;
      const best = [...reliable.entries()].sort(
        (a, b) => b[1] - a[1] || a[0] - b[0],
      )[0];
      const rep = types.find(
        (t: any) => parseInt(String(t.type_id), 10) === best[0],
      );
      if (!rep) continue;
      result.push({
        modele_id: m.modele_id,
        modele_name: m.modele_name,
        modele_alias: m.modele_alias,
        marque_id: marqueInfo.marque_id,
        marque_name: marqueInfo.marque_name,
        marque_alias: marqueInfo.marque_alias,
        representative_type_id: String((rep as any).type_id),
        representative_type_alias: String((rep as any).type_alias ?? ''),
      });
    }
    return result;
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
