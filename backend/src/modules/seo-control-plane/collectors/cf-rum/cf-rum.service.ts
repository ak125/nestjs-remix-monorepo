/**
 * CfRumCollectorService — Layer 1 Collector (Cloudflare GraphQL RUM Web Vitals).
 *
 * ADR-064 §Architecture L1 — PR-2A-2.5. Lit l'API Cloudflare GraphQL Analytics
 * account-scoped (`rumPageloadEventsAdaptiveGroups` + `rumPerformanceEventsAdaptiveGroups`)
 * 1 fois/jour à 01:00 UTC (RUM buffered ~30 min après minuit, ABR favorise daily)
 * et insère des snapshots agrégés par (jour, tier, path_group) dans
 * `__seo_snapshot_cf_rum`.
 *
 * Pourquoi cette source complémentaire de cf-analytics (Source C) :
 *   - cf-analytics = edge-server (status codes, cache, origin perf) → infra-perf
 *   - cf-rum       = edge-RUM utilisateur réel (LCP/CLS/INP) → UX-perf
 *
 * Cadence q-daily (≠ Q5min cf-analytics) :
 *   - RUM buffer ~30 min ; ABR ramène la résolution à 1 j pour fenêtres >7 j
 *   - Q5min gaspillerait le quota GraphQL et fournirait du bruit sur faibles
 *     échantillons RUM
 *
 * Discipline 4-layer : aucune lecture L2/L3, aucune écriture L4. Pure ingestion.
 *
 * Robustesse :
 *   - 2 queries GraphQL séparées (pageload + performance) → si performance
 *     échoue (schéma CF évolue), les visits/pageviews sont toujours upsertées
 *     avec percentiles=null (canon `feedback_no_silent_skip_on_governance_critical_jobs`
 *     — on log l'erreur mais on ne suppress pas la donnée volume).
 *   - UPSERT idempotent sur (bucket_start, tier, path_group) — retry safe.
 *   - Skip explicite si CLOUDFLARE_API_TOKEN ou CLOUDFLARE_ACCOUNT_ID manquant
 *     (preprod fresh → graceful, surface dans le run result).
 *
 * @see feedback_seo_control_plane_layered_architecture
 * @see feedback_slo_must_be_multi_source (source C' = edge-RUM)
 * @see feedback_gsc_is_secondary_signal_only (CF RUM = monitoring primaire CWV)
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { SupabaseBaseService } from '../../../../database/services/supabase-base.service';
import { CriticalityLoaderService } from '../../services/criticality-loader.service';
import {
  PATH_GROUP_OTHER,
  PATH_GROUP_TOTAL,
  type CfRumJobData,
  type CfRumRunResult,
  type CfRumSnapshot,
  type CfRumTierBucket,
} from './cf-rum.types';

const CF_GRAPHQL_ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql';

/**
 * Pageload events query — visits, pageviews par jour × pagePath.
 * Schéma CF GraphQL stable (publiquement documenté).
 */
const GRAPHQL_PAGELOAD_QUERY = `
query SeoControlPlaneCfRumPageload($accountTag: String!, $from: Date!, $to: Date!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      rumPageloadEventsAdaptiveGroups(
        filter: { date_geq: $from, date_lt: $to }
        limit: 10000
        orderBy: [count_DESC]
      ) {
        dimensions {
          date
          requestPath
        }
        count
        sum {
          visits
        }
      }
    }
  }
}`;

/**
 * Performance events query — Core Web Vitals percentiles par jour × pagePath.
 * NOTE schéma : les noms exacts des champs `quantiles` peuvent évoluer côté CF.
 * Si le schéma diverge, le service log l'erreur et continue avec les seules
 * données pageload (visits/pageviews). Voir `fetchPerformance` ci-dessous.
 */
const GRAPHQL_PERFORMANCE_QUERY = `
query SeoControlPlaneCfRumPerformance($accountTag: String!, $from: Date!, $to: Date!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      rumPerformanceEventsAdaptiveGroups(
        filter: { date_geq: $from, date_lt: $to }
        limit: 10000
        orderBy: [count_DESC]
      ) {
        dimensions {
          date
          requestPath
        }
        count
        quantiles {
          performanceLargestContentfulPaintPathP50
          performanceLargestContentfulPaintPathP75
          performanceLargestContentfulPaintPathP95
          performanceCumulativeLayoutShiftP50
          performanceCumulativeLayoutShiftP75
          performanceCumulativeLayoutShiftP95
          performanceInteractionToNextPaintP50
          performanceInteractionToNextPaintP75
          performanceInteractionToNextPaintP95
          performanceFirstContentfulPaintP75
          performanceTimeToFirstByteP75
        }
      }
    }
  }
}`;

interface CfPageloadGroup {
  dimensions: {
    date: string;          // 'YYYY-MM-DD'
    requestPath: string | null;
  };
  count: number;
  sum: { visits: number };
}

interface CfPerformanceGroup {
  dimensions: {
    date: string;
    requestPath: string | null;
  };
  count: number;
  quantiles: {
    performanceLargestContentfulPaintPathP50: number | null;
    performanceLargestContentfulPaintPathP75: number | null;
    performanceLargestContentfulPaintPathP95: number | null;
    performanceCumulativeLayoutShiftP50: number | null;
    performanceCumulativeLayoutShiftP75: number | null;
    performanceCumulativeLayoutShiftP95: number | null;
    performanceInteractionToNextPaintP50: number | null;
    performanceInteractionToNextPaintP75: number | null;
    performanceInteractionToNextPaintP95: number | null;
    performanceFirstContentfulPaintP75: number | null;
    performanceTimeToFirstByteP75: number | null;
  };
}

interface CfGraphQLResponse<T> {
  data?: {
    viewer?: {
      accounts?: Array<Record<string, T[]>>;
    };
  };
  errors?: Array<{ message: string }>;
}

/** Normalise un pagePath en path_group (1er segment ou '/'). */
export function normalizePathGroup(rawPath: string | null | undefined): string {
  if (!rawPath || rawPath === '/' || rawPath === '') return '/';
  const stripped = rawPath.split('?')[0].split('#')[0];
  const segments = stripped.split('/').filter(Boolean);
  if (segments.length === 0) return '/';
  // Sécurité : segment vide ou suspect → fallback.
  const first = segments[0];
  if (!/^[a-z0-9._-]+$/i.test(first)) return PATH_GROUP_OTHER;
  return `/${first}/*`;
}

/** Convertit un CLS float (0..1+ typique) en milli-entier pour stockage BIGINT. */
function clsToMilli(cls: number | null | undefined): number | null {
  if (cls === null || cls === undefined || !Number.isFinite(cls)) return null;
  return Math.round(cls * 1000);
}

/** Convertit un float ms en entier ms ; null si non-fini. */
function msToInt(ms: number | null | undefined): number | null {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return null;
  return Math.round(ms);
}

@Injectable()
export class CfRumCollectorService extends SupabaseBaseService {
  protected readonly logger = new Logger(CfRumCollectorService.name);
  private readonly cfg: ConfigService;

  constructor(
    private readonly criticality: CriticalityLoaderService,
    configService: ConfigService,
  ) {
    super(configService);
    this.cfg = configService;
  }

  async run(job: CfRumJobData): Promise<CfRumRunResult> {
    const startedAtMs = Date.now();
    const runId = randomUUID();

    // Fenêtre par défaut = jour UTC J-1 complet.
    const bucketDate = job.bucketDateOverride ?? this.yesterdayUtc();
    const fromDate = bucketDate;
    const toDate = this.nextDayUtc(bucketDate);
    const bucketStartIso = `${bucketDate}T00:00:00.000Z`;

    const result: CfRumRunResult = {
      run_id: runId,
      started_at: new Date(startedAtMs).toISOString(),
      finished_at: '',
      duration_ms: 0,
      triggered_by: job.triggeredBy,
      bucket_date: bucketDate,
      pageload_events: 0,
      performance_events: 0,
      rows_upserted: 0,
      totals_period: {
        visits: 0,
        pageviews: 0,
        lcp_p75_ms: null,
        cls_p75_milli: null,
        inp_p75_ms: null,
      },
    };

    const token =
      this.cfg.get<string>('CLOUDFLARE_ANALYTICS_TOKEN') ??
      this.cfg.get<string>('CLOUDFLARE_API_TOKEN');
    const accountTag = this.cfg.get<string>('CLOUDFLARE_ACCOUNT_ID');
    if (!token) {
      this.logger.warn(
        'CLOUDFLARE_API_TOKEN/CLOUDFLARE_ANALYTICS_TOKEN missing — skipping cf-rum run',
      );
      result.skipped = 'no_token';
      return this.finalize(result, startedAtMs);
    }
    if (!accountTag) {
      this.logger.warn(
        'CLOUDFLARE_ACCOUNT_ID missing — skipping cf-rum run (rum* datasets are account-scoped)',
      );
      result.skipped = 'no_account_id';
      return this.finalize(result, startedAtMs);
    }

    this.logger.log(
      `🌐 cf-rum run starting (run_id=${runId} bucket=${bucketDate} triggeredBy=${job.triggeredBy})`,
    );

    // 1) Pageload events — visits/pageviews. Échec ici = abort run (signal volume critique).
    let pageloadGroups: CfPageloadGroup[];
    try {
      pageloadGroups = await this.fetchPageload(
        token,
        accountTag,
        fromDate,
        toDate,
      );
    } catch (err) {
      this.logger.error(
        `❌ CF GraphQL pageload fetch failed: ${this.errMsg(err)} — aborting run`,
      );
      result.skipped = 'cf_api_error';
      result.errorMessage = this.errMsg(err);
      return this.finalize(result, startedAtMs);
    }
    result.pageload_events = pageloadGroups.length;

    // 2) Performance events — CWV percentiles. Échec ici = non-bloquant
    //    (on persiste quand même les volumes avec percentiles=null).
    let performanceGroups: CfPerformanceGroup[] = [];
    try {
      performanceGroups = await this.fetchPerformance(
        token,
        accountTag,
        fromDate,
        toDate,
      );
      result.performance_events = performanceGroups.length;
    } catch (err) {
      this.logger.warn(
        `⚠️ CF GraphQL performance fetch failed (non-fatal — volumes still upserted): ${this.errMsg(err)}`,
      );
      result.errorMessage = `performance: ${this.errMsg(err)}`;
    }

    // 3) Agrégation cross-dataset par (tier, path_group).
    const aggregated = this.aggregate(pageloadGroups, performanceGroups);

    // 4) Build snapshots — flatten Map → rows.
    const snapshots: CfRumSnapshot[] = [];
    for (const [tier, byPath] of aggregated) {
      for (const [pathGroup, agg] of byPath) {
        snapshots.push({
          bucket_start: bucketStartIso,
          tier,
          path_group: pathGroup,
          visit_count: agg.visits,
          pageview_count: agg.pageviews,
          sample_count: agg.samples,
          lcp_p50_ms: agg.lcp_p50_ms,
          lcp_p75_ms: agg.lcp_p75_ms,
          lcp_p95_ms: agg.lcp_p95_ms,
          cls_p50_milli: agg.cls_p50_milli,
          cls_p75_milli: agg.cls_p75_milli,
          cls_p95_milli: agg.cls_p95_milli,
          inp_p50_ms: agg.inp_p50_ms,
          inp_p75_ms: agg.inp_p75_ms,
          inp_p95_ms: agg.inp_p95_ms,
          fcp_p75_ms: agg.fcp_p75_ms,
          ttfb_p75_ms: agg.ttfb_p75_ms,
          metrics_extra: {},
          run_id: runId,
          account_tag: accountTag,
          fetched_at: new Date().toISOString(),
        });
      }
    }

    // 5) Totals period = rollup (tier='total', path_group='total').
    const totalRow = snapshots.find(
      (s) => s.tier === 'total' && s.path_group === PATH_GROUP_TOTAL,
    );
    if (totalRow) {
      result.totals_period.visits = totalRow.visit_count;
      result.totals_period.pageviews = totalRow.pageview_count;
      result.totals_period.lcp_p75_ms = totalRow.lcp_p75_ms;
      result.totals_period.cls_p75_milli = totalRow.cls_p75_milli;
      result.totals_period.inp_p75_ms = totalRow.inp_p75_ms;
    }

    // 6) Persist.
    try {
      await this.persist(snapshots);
      result.rows_upserted = snapshots.length;
    } catch (err) {
      this.logger.error(
        `❌ persist failed (${snapshots.length} snapshots): ${this.errMsg(err)}`,
      );
      result.errorMessage = `${result.errorMessage ? `${result.errorMessage} | ` : ''}persist: ${this.errMsg(err)}`;
    }

    return this.finalize(result, startedAtMs);
  }

  // ── private ────────────────────────────────────────────────────────────────

  private async fetchPageload(
    token: string,
    accountTag: string,
    fromDate: string,
    toDate: string,
  ): Promise<CfPageloadGroup[]> {
    const json = await this.graphqlRequest<CfPageloadGroup>(
      token,
      GRAPHQL_PAGELOAD_QUERY,
      { accountTag, from: fromDate, to: toDate },
    );
    const groups =
      json.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups;
    if (!groups) {
      throw new Error(
        'CF GraphQL response missing rumPageloadEventsAdaptiveGroups',
      );
    }
    return groups;
  }

  private async fetchPerformance(
    token: string,
    accountTag: string,
    fromDate: string,
    toDate: string,
  ): Promise<CfPerformanceGroup[]> {
    const json = await this.graphqlRequest<CfPerformanceGroup>(
      token,
      GRAPHQL_PERFORMANCE_QUERY,
      { accountTag, from: fromDate, to: toDate },
    );
    const groups =
      json.data?.viewer?.accounts?.[0]?.rumPerformanceEventsAdaptiveGroups;
    if (!groups) {
      throw new Error(
        'CF GraphQL response missing rumPerformanceEventsAdaptiveGroups',
      );
    }
    return groups;
  }

  private async graphqlRequest<T>(
    token: string,
    query: string,
    variables: Record<string, string>,
  ): Promise<CfGraphQLResponse<T>> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30_000);
    try {
      const res = await fetch(CF_GRAPHQL_ENDPOINT, {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
      });
      if (!res.ok) {
        throw new Error(
          `CF GraphQL HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`,
        );
      }
      const json = (await res.json()) as CfGraphQLResponse<T>;
      if (json.errors && json.errors.length > 0) {
        throw new Error(
          `CF GraphQL errors: ${json.errors.map((e) => e.message).join('; ')}`,
        );
      }
      return json;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Agrège pageload + performance groups en (tier × path_group) → rollups.
   *
   * Pour chaque path raw :
   *   - Tier déterminé par criticality.classify() : 'tier0'|'tier1'|'tier2'|'excluded'|null
   *   - Path-group normalisé par normalizePathGroup() : '/pieces/*' etc.
   *
   * Lignes produites par path raw :
   *   - (tier='total', path_group='total')     — grand total
   *   - (tier=<X>,     path_group='total')     — total par tier (sauf 'excluded'/null)
   *   - (tier='total', path_group=<G>)         — total par section
   *   - (tier=<X>,     path_group=<G>)         — drill-down complet (sauf excluded)
   *
   * Pour les percentiles, on **prend le max p75 observé** sur les groups raw
   * agrégés dans la même cellule. C'est conservateur (worst-case) et évite
   * d'avoir à recalculer un percentile pondéré depuis des sous-percentiles
   * (mathématiquement non-trivial sans la distribution complète).
   *
   * Cf. plan §Risques : si CF expose plus tard une API exposant l'histogramme
   * brut, on pourra recalculer un vrai p75 pondéré côté Postgres.
   */
  private aggregate(
    pageload: CfPageloadGroup[],
    performance: CfPerformanceGroup[],
  ): Map<CfRumTierBucket, Map<string, RumAggregate>> {
    const out = new Map<CfRumTierBucket, Map<string, RumAggregate>>();

    // 1) Volume (pageload).
    for (const g of pageload) {
      const path = g.dimensions.requestPath ?? '/';
      const tier = this.tierOf(path);
      const pathGroup = normalizePathGroup(path);

      for (const [t, pg] of this.cellsFor(tier, pathGroup)) {
        const cell = this.ensureCell(out, t, pg);
        cell.pageviews += g.count;
        cell.visits += g.sum.visits;
      }
    }

    // 2) Web vitals (performance).
    for (const g of performance) {
      const path = g.dimensions.requestPath ?? '/';
      const tier = this.tierOf(path);
      const pathGroup = normalizePathGroup(path);
      const q = g.quantiles;

      for (const [t, pg] of this.cellsFor(tier, pathGroup)) {
        const cell = this.ensureCell(out, t, pg);
        cell.samples += g.count;
        // Conservative aggregation : on garde le worst-case observed.
        cell.lcp_p50_ms = maxNullable(cell.lcp_p50_ms, msToInt(q.performanceLargestContentfulPaintPathP50));
        cell.lcp_p75_ms = maxNullable(cell.lcp_p75_ms, msToInt(q.performanceLargestContentfulPaintPathP75));
        cell.lcp_p95_ms = maxNullable(cell.lcp_p95_ms, msToInt(q.performanceLargestContentfulPaintPathP95));
        cell.cls_p50_milli = maxNullable(cell.cls_p50_milli, clsToMilli(q.performanceCumulativeLayoutShiftP50));
        cell.cls_p75_milli = maxNullable(cell.cls_p75_milli, clsToMilli(q.performanceCumulativeLayoutShiftP75));
        cell.cls_p95_milli = maxNullable(cell.cls_p95_milli, clsToMilli(q.performanceCumulativeLayoutShiftP95));
        cell.inp_p50_ms = maxNullable(cell.inp_p50_ms, msToInt(q.performanceInteractionToNextPaintP50));
        cell.inp_p75_ms = maxNullable(cell.inp_p75_ms, msToInt(q.performanceInteractionToNextPaintP75));
        cell.inp_p95_ms = maxNullable(cell.inp_p95_ms, msToInt(q.performanceInteractionToNextPaintP95));
        cell.fcp_p75_ms = maxNullable(cell.fcp_p75_ms, msToInt(q.performanceFirstContentfulPaintP75));
        cell.ttfb_p75_ms = maxNullable(cell.ttfb_p75_ms, msToInt(q.performanceTimeToFirstByteP75));
      }
    }

    return out;
  }

  /**
   * Tier d'un path. Retourne 'total' sentinel pour 'excluded'/null (capté
   * uniquement dans les cellules tier='total').
   */
  private tierOf(path: string): CfRumTierBucket | 'excluded' | null {
    const t = this.criticality.classify(path);
    return t;
  }

  /**
   * Pour un (tier, pathGroup) donné, retourne les cellules de rollup à
   * mettre à jour. Discipline :
   *   - tier 'excluded' ou null → uniquement (total, total) + (total, pathGroup)
   *   - tier 'tier0'|'tier1'|'tier2' → 4 cellules (total/total, total/pg, t/total, t/pg)
   */
  private cellsFor(
    tier: CfRumTierBucket | 'excluded' | null,
    pathGroup: string,
  ): Array<[CfRumTierBucket, string]> {
    const cells: Array<[CfRumTierBucket, string]> = [
      ['total', PATH_GROUP_TOTAL],
      ['total', pathGroup],
    ];
    if (tier === 'tier0' || tier === 'tier1' || tier === 'tier2') {
      cells.push([tier, PATH_GROUP_TOTAL]);
      cells.push([tier, pathGroup]);
    }
    return cells;
  }

  private ensureCell(
    out: Map<CfRumTierBucket, Map<string, RumAggregate>>,
    tier: CfRumTierBucket,
    pathGroup: string,
  ): RumAggregate {
    let byPath = out.get(tier);
    if (!byPath) {
      byPath = new Map();
      out.set(tier, byPath);
    }
    let cell = byPath.get(pathGroup);
    if (!cell) {
      cell = freshAggregate();
      byPath.set(pathGroup, cell);
    }
    return cell;
  }

  private async persist(snapshots: CfRumSnapshot[]): Promise<void> {
    if (snapshots.length === 0) return;
    const { error } = await this.supabase
      .from('__seo_snapshot_cf_rum')
      .upsert(snapshots, { onConflict: 'bucket_start,tier,path_group' });
    if (error) throw new Error(`Supabase upsert error: ${error.message}`);
  }

  private finalize(
    r: CfRumRunResult,
    startedAtMs: number,
  ): CfRumRunResult {
    r.finished_at = new Date().toISOString();
    r.duration_ms = Date.now() - startedAtMs;
    this.logger.log(
      `✅ cf-rum run ${r.run_id} done in ${r.duration_ms}ms — ` +
        `bucket=${r.bucket_date} pageload_events=${r.pageload_events} ` +
        `perf_events=${r.performance_events} rows=${r.rows_upserted} ` +
        `visits=${r.totals_period.visits} lcp_p75=${r.totals_period.lcp_p75_ms ?? 'null'}ms ` +
        `cls_p75=${r.totals_period.cls_p75_milli ?? 'null'}/1000 ` +
        `inp_p75=${r.totals_period.inp_p75_ms ?? 'null'}ms` +
        (r.skipped ? ` [skipped: ${r.skipped}]` : ''),
    );
    return r;
  }

  private errMsg(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }

  /** Retourne le jour UTC J-1 au format 'YYYY-MM-DD'. */
  private yesterdayUtc(): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  /** Retourne le lendemain (UTC) d'une date 'YYYY-MM-DD'. */
  private nextDayUtc(date: string): string {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }
}

interface RumAggregate {
  visits: number;
  pageviews: number;
  samples: number;
  lcp_p50_ms: number | null;
  lcp_p75_ms: number | null;
  lcp_p95_ms: number | null;
  cls_p50_milli: number | null;
  cls_p75_milli: number | null;
  cls_p95_milli: number | null;
  inp_p50_ms: number | null;
  inp_p75_ms: number | null;
  inp_p95_ms: number | null;
  fcp_p75_ms: number | null;
  ttfb_p75_ms: number | null;
}

function freshAggregate(): RumAggregate {
  return {
    visits: 0,
    pageviews: 0,
    samples: 0,
    lcp_p50_ms: null,
    lcp_p75_ms: null,
    lcp_p95_ms: null,
    cls_p50_milli: null,
    cls_p75_milli: null,
    cls_p95_milli: null,
    inp_p50_ms: null,
    inp_p75_ms: null,
    inp_p95_ms: null,
    fcp_p75_ms: null,
    ttfb_p75_ms: null,
  };
}

function maxNullable(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.max(a, b);
}
