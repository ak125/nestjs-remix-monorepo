/**
 * PR-SBD-1 Task 4 — SeoControlService
 *
 * Orchestrates snapshot assembly for the SEO Business Control Dashboard.
 *
 * Industry-standard patterns applied :
 *   - Cache per-block (5 distinct Redis keys, TTL différenciés) — refresh d'un
 *     bloc n'invalide pas les autres. Réduit JSONB-bloat et coût SWR.
 *   - Lineage : snapshot_id (UUID v4) + snapshot_hash (sha256 fast-json-stable-stringify)
 *     + generated_from (versions RPC / decisions / impact_score / rules catalog).
 *   - Audit access dedupé Redis SET NX EX 900 (1 event/user/range/15min).
 *   - Zod fail-loud parse sur snapshot final (anti-bricolage).
 *   - Decisions injectées via SeoControlDecisionsService TS pur (rule_ids + role_id).
 *   - 5 sub-RPCs appelées en parallèle (Promise.all) sur cache miss.
 *
 * Refs :
 *   - .claude/plans/verifier-existant-avant-et-ethereal-firefly.md Task 4
 *   - packages/seo-types/src/control-dashboard.ts (Zod contract)
 *   - backend/supabase/migrations/20260518_seo_control_002_rpcs.sql (5 RPCs v1)
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import stableStringify from 'fast-json-stable-stringify';
import {
  addDaysIso,
  assessPeriodComparability,
  computeDayCoverage,
  SeoControlSnapshotSchema,
  type DayCoverage,
  type GscComparability,
  type Range,
  type SeoControlSnapshot,
} from '@repo/seo-types';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CacheService } from '../../../cache/cache.service';
import { SeoControlDecisionsService } from './seo-control-decisions.service';

type BlockKey = 'traffic' | 'losers' | 'lowctr' | 'alerts' | 'conversion';

/**
 * TTL per block (seconds) — differentiated by data volatility :
 *   alerts : 5min  (volatile, can resolve any minute)
 *   losers : 30min (sensible, day-over-day relevance)
 *   others : 1h    (GSC/GA4 daily, stable)
 */
const BLOCK_TTL_SECONDS: Record<BlockKey, number> = {
  traffic: 60 * 60,
  losers: 30 * 60,
  lowctr: 60 * 60,
  alerts: 5 * 60,
  conversion: 60 * 60,
};

const AUDIT_DEDUPE_TTL_SECONDS = 15 * 60; // 1 event/user/range/15min

@Injectable()
export class SeoControlService extends SupabaseBaseService {
  // logger inherited from SupabaseBaseService (protected readonly logger)

  constructor(
    configService: ConfigService,
    private readonly cache: CacheService,
    private readonly decisions: SeoControlDecisionsService,
  ) {
    super(configService);
  }

  /**
   * Assemble snapshot for the given range :
   *   1. Fetch each block in parallel (cache hit OR RPC fallback)
   *   2. Inject decisions on every applicable row
   *   3. Build lineage (snapshot_id + snapshot_hash + generated_from)
   *   4. Zod parse fail-loud
   *   5. Log access (deduped Redis SET NX 15min)
   */
  async getSnapshot(
    range: Range,
    adminUserId: string | null,
  ): Promise<SeoControlSnapshot> {
    const days = range === '7d' ? 7 : 28;
    const nowIso = new Date().toISOString();

    const [
      gscComparability,
      trafficRaw,
      losersRaw,
      lowCtrRaw,
      alertsRaw,
      conversionRaw,
    ] = await Promise.all([
      // Non caché : lecture ≤ 2N lignes, doit refléter la dernière ingestion.
      this.gscWindowComparability(days, nowIso),
      this.getBlock<unknown>('traffic', range, () =>
        this.invokeRpc('rpc_seo_traffic_v1', {
          p_window_days: days,
          p_now: nowIso,
        }),
      ),
      this.getBlock<unknown[]>('losers', range, () =>
        this.invokeRpc('rpc_seo_top_losers_v1', {
          p_window_days: days,
          p_now: nowIso,
          p_limit: 20,
        }),
      ),
      this.getBlock<unknown[]>('lowctr', range, () =>
        this.invokeRpc('rpc_seo_low_ctr_v1', {
          p_window_days: days,
          p_now: nowIso,
          p_min_impressions: 100,
          p_max_ctr: 0.01,
          p_limit: 50,
        }),
      ),
      this.getBlock<unknown[]>('alerts', range, () =>
        this.invokeRpc('rpc_seo_alerts_v1', {
          p_now: nowIso,
          p_limit: 50,
        }),
      ),
      this.getBlock<unknown[] | null>('conversion', range, () =>
        this.invokeRpc('rpc_seo_conversion_v1', {
          p_window_days: days,
          p_now: nowIso,
          p_limit: 20,
        }),
      ),
    ]);

    // Inject decisions on each applicable row
    const losersArr = (losersRaw as any[] | null | undefined) ?? [];
    const lowCtrArr = (lowCtrRaw as any[] | null | undefined) ?? [];
    const alertsArr = (alertsRaw as any[] | null | undefined) ?? [];
    const conversionArr = conversionRaw as any[] | null | undefined;

    // Fenêtres non comparables (jours manquants) : delta inconnu et perdants non
    // calculés — l'écart mesurerait le trou d'ingestion, pas le trafic. Rendu
    // observable via `gscComparability` (raison + jours manquants), pas un silence.
    const comparable = gscComparability.comparable;
    const trafficWindow =
      comparable || trafficRaw == null
        ? trafficRaw
        : {
            ...(trafficRaw as Record<string, unknown>),
            delta_vs_previous: {
              clicks_pct: null,
              impressions_pct: null,
              direction: 'unknown',
              change_severity: 'info',
            },
          };

    const enriched = {
      gscComparability,
      trafficWindow,
      topLosers: (comparable ? losersArr : []).map((r: any) => ({
        ...r,
        decisions: this.decisions.deriveLoser(r),
      })),
      lowCtrOpportunities: lowCtrArr.map((r: any) => ({
        ...r,
        decisions: this.decisions.deriveLowCtr(r),
      })),
      technicalAlerts: alertsArr.map((r: any) => ({
        ...r,
        decisions: this.decisions.deriveAlert(r),
      })),
      conversionGap:
        conversionArr == null
          ? null
          : conversionArr.map((r: any) => ({
              ...r,
              decisions: this.decisions.deriveConversion(r),
            })),
    };

    // Lineage : snapshot_id + generated_from (no hash yet — computed after payload built)
    const lineageBase = {
      snapshot_id: randomUUID(), // v4 V1, v7 V2 backlog
      generated_at: nowIso,
      generated_from: {
        rpc_versions: {
          traffic: 'v1' as const,
          losers: 'v1' as const,
          low_ctr: 'v1' as const,
          alerts: 'v1' as const,
          conversion: 'v1' as const,
        },
        decision_service_version: 'v1' as const,
        impact_score_version: 'v1' as const,
        rules_catalog_version: 'v1' as const,
      },
    };

    const payloadWithoutHash = {
      ...lineageBase,
      range,
      window_days: days,
      ...enriched,
    };

    // snapshot_hash = sha256(stable-stringify of payload sans hash) — replay-safe
    const snapshotHash = createHash('sha256')
      .update(stableStringify(payloadWithoutHash))
      .digest('hex');

    const finalPayload = { ...payloadWithoutHash, snapshot_hash: snapshotHash };

    // Zod fail-loud parse — anti-bricolage, crash explicit if shape drift
    const parsed = SeoControlSnapshotSchema.parse(finalPayload);

    // Audit access (deduped 15min via Redis SET NX) — fire-and-forget OK
    void this.logAccessDeduped(adminUserId, range);

    return parsed;
  }

  /**
   * Couverture jours des fenêtres comparées par rpc_seo_traffic_v1 /
   * rpc_seo_top_losers_v1 : courante [J-N, J-1], précédente [J-2N, J-N-1]
   * (bornes `p_now::DATE - N` inclusives, `p_now::DATE` exclue — dates UTC).
   *
   * Présence lue sur `__seo_gsc_daily_property_total` (1 ligne/jour) plutôt que
   * sur `__seo_gsc_daily` lu par les RPC (≈30 M lignes/mois). Seul le marqueur
   * `commit_version` prouve que les autres grains du jour ont été écrits : il est
   * posé EN DERNIER par l'ingesteur. Une ligne sans marqueur (ancien ingesteur,
   * qui écrivait le total propriété EN PREMIER, ou réécriture interrompue) ne
   * rend pas le jour confirmé → fenêtre non comparable. Erreur de lecture (dont
   * schéma sans `commit_version`) → exception (même contrat fail-loud que
   * invokeRpc), jamais « comparable » par défaut.
   */
  private async gscWindowComparability(
    days: number,
    nowIso: string,
  ): Promise<GscComparability> {
    const today = nowIso.slice(0, 10);
    const current = {
      from: addDaysIso(today, -days),
      to: addDaysIso(today, -1),
    };
    const previous = {
      from: addDaysIso(today, -2 * days),
      to: addDaysIso(today, -days - 1),
    };
    const { data, error } = await this.supabase
      .from('__seo_gsc_daily_property_total')
      .select('date, commit_version')
      .gte('date', previous.from)
      .lte('date', current.to)
      .limit(1000);
    if (error) {
      this.logger.error('GSC day presence read failed', error);
      throw error;
    }
    const rows = (data ?? []) as Array<{
      date: string;
      commit_version: number | null;
    }>;
    const presentDates = rows.map((r) => String(r.date));
    const confirmedDates = rows
      .filter(
        (r) => r.commit_version !== null && r.commit_version !== undefined,
      )
      .map((r) => String(r.date));
    const cur = computeDayCoverage({
      ...current,
      presentDates,
      confirmedDates,
    });
    const prev = computeDayCoverage({
      ...previous,
      presentDates,
      confirmedDates,
    });
    const verdict = assessPeriodComparability(cur, prev);
    const toWindow = (c: DayCoverage) => ({
      from: c.from,
      to: c.to,
      days_expected: c.daysExpected,
      days_present: c.daysPresent,
      days_confirmed: c.daysConfirmed,
      missing_dates: c.missingDates,
      unconfirmed_dates: c.unconfirmedDates,
    });
    return {
      comparable: verdict.comparable,
      reason: 'reason' in verdict ? verdict.reason : null,
      source: '__seo_gsc_daily_property_total',
      current: toWindow(cur),
      previous: toWindow(prev),
    };
  }

  /**
   * Per-block cache layer.
   * Cache hit → return cached value.
   * Cache miss → call RPC, cache result with block-specific TTL.
   */
  private async getBlock<T>(
    block: BlockKey,
    range: Range,
    fetcher: () => Promise<T>,
  ): Promise<T> {
    const key = `seo-control:${block}:${range}`;
    const cached = await this.cache.get<T>(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }
    const fresh = await fetcher();
    await this.cache.set(key, fresh, BLOCK_TTL_SECONDS[block]);
    return fresh;
  }

  /**
   * Called by SWR BullMQ scheduled job to refresh a single block in background
   * (at TTL/2 to keep the cache warm without dog-pile).
   */
  async refreshBlock(block: BlockKey, range: Range): Promise<void> {
    const days = range === '7d' ? 7 : 28;
    const nowIso = new Date().toISOString();
    const key = `seo-control:${block}:${range}`;
    let data: unknown;
    switch (block) {
      case 'traffic':
        data = await this.invokeRpc('rpc_seo_traffic_v1', {
          p_window_days: days,
          p_now: nowIso,
        });
        break;
      case 'losers':
        data = await this.invokeRpc('rpc_seo_top_losers_v1', {
          p_window_days: days,
          p_now: nowIso,
          p_limit: 20,
        });
        break;
      case 'lowctr':
        data = await this.invokeRpc('rpc_seo_low_ctr_v1', {
          p_window_days: days,
          p_now: nowIso,
          p_min_impressions: 100,
          p_max_ctr: 0.01,
          p_limit: 50,
        });
        break;
      case 'alerts':
        data = await this.invokeRpc('rpc_seo_alerts_v1', {
          p_now: nowIso,
          p_limit: 50,
        });
        break;
      case 'conversion':
        data = await this.invokeRpc('rpc_seo_conversion_v1', {
          p_window_days: days,
          p_now: nowIso,
          p_limit: 20,
        });
        break;
    }
    await this.cache.set(key, data, BLOCK_TTL_SECONDS[block]);
  }

  /**
   * Audit access log with Redis SET NX dedupe :
   *   - First call in 15min window for (user, range) → INSERT __seo_event_log
   *   - Subsequent calls within window → skip (no row written)
   *
   * Prevents event_log pollution while keeping daily dashboard_view count
   * accurate for Phase B gate calculation.
   */
  private async logAccessDeduped(
    adminUserId: string | null,
    range: Range,
  ): Promise<void> {
    const userKey = adminUserId ?? 'anon';
    const dedupeKey = `dashboard-view-dedupe:${userKey}:${range}`;
    const wasSet = await this.cache.setNx(
      dedupeKey,
      '1',
      AUDIT_DEDUPE_TTL_SECONDS,
    );
    if (!wasSet) {
      return; // already logged within 15min window
    }
    try {
      await this.supabase.from('__seo_event_log').insert({
        event_type: 'dashboard_view',
        severity: 'info',
        entity_url: null,
        payload: {
          dashboard: 'seo-control',
          range,
          admin_user_id: adminUserId,
          viewed_at: new Date().toISOString(),
        },
      });
    } catch (err) {
      this.logger.error('dashboard_view audit insert failed', err as Error);
    }
  }

  /**
   * Thin wrapper around the inherited callRpc() (SupabaseBaseService) for
   * fail-loud semantics : throws on error instead of returning { data, error }.
   *
   * MUST use callRpc (not this.supabase.rpc direct) per the RPC Safety Gate,
   * whose logic is inline in .github/workflows/ci.yml (job `rpc-gate-check`).
   * Direct supabase.rpc bypasses the governance RpcGateService.
   */
  private async invokeRpc<T>(
    name: string,
    params: Record<string, unknown>,
  ): Promise<T> {
    const { data, error } = await this.callRpc<T>(name, params);
    if (error) {
      this.logger.error(`RPC ${name} failed`, error);
      throw error;
    }
    return data as T;
  }
}
