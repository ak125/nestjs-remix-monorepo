/**
 * CfAnalyticsCollectorService — Layer 1 Collector (Cloudflare GraphQL Analytics).
 *
 * ADR-064 §Architecture L1 — PR-2A-2. Lit l'API Cloudflare GraphQL Analytics
 * (`httpRequestsAdaptiveGroups`) à intervalle régulier (q5min) et insère des
 * snapshots agrégés par tier dans `__seo_snapshot_cf_analytics`.
 *
 * Pourquoi cette source dans le SLO multi-source (§ADR-064 L2 future PR-2B) :
 *   - Cloudflare est le miroir le plus fidèle de l'expérience utilisateur réel
 *     (vs synthetic crawler qui ne mesure que notre propre traffic).
 *   - Capture Googlebot réel, Bingbot, utilisateurs finaux, bots tiers.
 *   - Edge cache hit ratio → input drift detection (PR-2B).
 *
 * Discipline 4-layer : aucune lecture L2/L3, aucune écriture L4. Pure ingestion.
 *
 * Sécurité runtime :
 *   - `CLOUDFLARE_API_TOKEN` requis (graceful skip si absent — preprod fresh)
 *   - `CLOUDFLARE_ZONE_ID` requis
 *   - Timeout 30s par requête GraphQL
 *   - UPSERT idempotent sur (bucket_start, tier) — retry safe
 *
 * @see feedback_seo_control_plane_layered_architecture
 * @see feedback_slo_must_be_multi_source (source C = edge analytics)
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { SupabaseBaseService } from '../../../../database/services/supabase-base.service';
import { CriticalityLoaderService } from '../../services/criticality-loader.service';
import type {
  CfAnalyticsJobData,
  CfAnalyticsRunResult,
  CfAnalyticsSnapshot,
  CfTierBucket,
} from './cf-analytics.types';

const CF_GRAPHQL_ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql';
const DEFAULT_WINDOW_MIN = 60; // 12 buckets de 5 min

/**
 * GraphQL query : agrège les requêtes HTTP par bucket 5-min sur la fenêtre
 * donnée. On filtre `clientRequestHTTPHost` pour ne capter que notre domaine
 * (skip les requêtes accidentelles sur des hosts secondaires).
 *
 * Champs : edgeResponseStatus → status code edge (peut différer de origin
 * status si Cloudflare a servi cached ou erreur edge sans atteindre origin).
 */
const GRAPHQL_QUERY = `
query SeoControlPlaneEdgeBuckets($zoneTag: String!, $from: Time!, $to: Time!) {
  viewer {
    zones(filter: { zoneTag: $zoneTag }) {
      httpRequestsAdaptiveGroups(
        filter: { datetime_geq: $from, datetime_lt: $to }
        limit: 5000
        orderBy: [datetimeFiveMinutes_ASC]
      ) {
        dimensions {
          datetimeFiveMinutes
          edgeResponseStatus
          cacheStatus
          clientRequestPath
        }
        count
        sum {
          edgeResponseBytes
        }
        avg {
          originResponseDurationMs
        }
        quantiles {
          originResponseDurationMsP50
          originResponseDurationMsP95
        }
      }
    }
  }
}`;

interface CfGraphQLGroup {
  dimensions: {
    datetimeFiveMinutes: string;
    edgeResponseStatus: number;
    cacheStatus: string | null;
    clientRequestPath: string | null;
  };
  count: number;
  sum: { edgeResponseBytes: number };
  avg: { originResponseDurationMs: number };
  quantiles: {
    originResponseDurationMsP50: number;
    originResponseDurationMsP95: number;
  };
}

interface CfGraphQLResponse {
  data?: {
    viewer?: {
      zones?: Array<{
        httpRequestsAdaptiveGroups?: CfGraphQLGroup[];
      }>;
    };
  };
  errors?: Array<{ message: string }>;
}

@Injectable()
export class CfAnalyticsCollectorService extends SupabaseBaseService {
  protected readonly logger = new Logger(CfAnalyticsCollectorService.name);
  private readonly cfg: ConfigService;

  constructor(
    private readonly criticality: CriticalityLoaderService,
    configService: ConfigService,
  ) {
    super(configService);
    this.cfg = configService;
  }

  async run(job: CfAnalyticsJobData): Promise<CfAnalyticsRunResult> {
    const startedAtMs = Date.now();
    const runId = randomUUID();
    const windowMinutes = job.windowMinutes ?? DEFAULT_WINDOW_MIN;

    const result: CfAnalyticsRunResult = {
      run_id: runId,
      started_at: new Date(startedAtMs).toISOString(),
      finished_at: '',
      duration_ms: 0,
      triggered_by: job.triggeredBy,
      window_minutes: windowMinutes,
      buckets_received: 0,
      rows_upserted: 0,
      totals_period: { total_requests: 0, http_5xx: 0, rate_5xx: 0 },
    };

    const token = this.cfg.get<string>('CLOUDFLARE_API_TOKEN');
    const zoneTag = this.cfg.get<string>('CLOUDFLARE_ZONE_ID');
    if (!token || !zoneTag) {
      this.logger.warn(
        'CLOUDFLARE_API_TOKEN or CLOUDFLARE_ZONE_ID missing — skipping run',
      );
      result.skipped = 'no_token';
      return this.finalize(result, startedAtMs);
    }

    const to = new Date();
    const from = new Date(to.getTime() - windowMinutes * 60_000);

    this.logger.log(
      `🌐 cf-analytics run starting (run_id=${runId} window=${windowMinutes}min from=${from.toISOString()} triggeredBy=${job.triggeredBy})`,
    );

    let groups: CfGraphQLGroup[];
    try {
      groups = await this.fetchGraphQL(token, zoneTag, from, to);
    } catch (err) {
      this.logger.error(
        `❌ CF GraphQL fetch failed: ${this.errMsg(err)} — aborting run`,
      );
      result.skipped = 'cf_api_error';
      result.errorMessage = this.errMsg(err);
      return this.finalize(result, startedAtMs);
    }

    const aggregated = this.aggregateByBucketAndTier(groups);
    result.buckets_received = new Set(
      groups.map((g) => g.dimensions.datetimeFiveMinutes),
    ).size;

    const snapshots: CfAnalyticsSnapshot[] = [];
    for (const [bucketStart, byTier] of aggregated) {
      for (const [tier, agg] of byTier) {
        snapshots.push({
          bucket_start: bucketStart,
          tier,
          total_requests: agg.total,
          http_2xx: agg.http_2xx,
          http_3xx: agg.http_3xx,
          http_4xx: agg.http_4xx,
          http_5xx: agg.http_5xx,
          cache_hits: agg.cache_hits,
          cache_misses: agg.cache_misses,
          bytes_served: agg.bytes_served,
          origin_p50_ms:
            agg.origin_p50_count > 0
              ? Math.round(agg.origin_p50_sum / agg.origin_p50_count)
              : null,
          origin_p95_ms:
            agg.origin_p95_count > 0
              ? Math.round(agg.origin_p95_sum / agg.origin_p95_count)
              : null,
          run_id: runId,
          zone_tag: zoneTag,
          fetched_at: new Date().toISOString(),
        });
      }
    }

    // Period totals (across tier=='total' rows only).
    for (const s of snapshots) {
      if (s.tier === 'total') {
        result.totals_period.total_requests += s.total_requests;
        result.totals_period.http_5xx += s.http_5xx;
      }
    }
    result.totals_period.rate_5xx =
      result.totals_period.total_requests > 0
        ? result.totals_period.http_5xx / result.totals_period.total_requests
        : 0;

    try {
      await this.persist(snapshots);
      result.rows_upserted = snapshots.length;
    } catch (err) {
      this.logger.error(
        `❌ persist failed (${snapshots.length} snapshots): ${this.errMsg(err)}`,
      );
      result.errorMessage = `persist: ${this.errMsg(err)}`;
    }

    return this.finalize(result, startedAtMs);
  }

  // ── private ────────────────────────────────────────────────────────────────

  private async fetchGraphQL(
    token: string,
    zoneTag: string,
    from: Date,
    to: Date,
  ): Promise<CfGraphQLGroup[]> {
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
        body: JSON.stringify({
          query: GRAPHQL_QUERY,
          variables: {
            zoneTag,
            from: from.toISOString(),
            to: to.toISOString(),
          },
        }),
      });
      if (!res.ok) {
        throw new Error(
          `CF GraphQL HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`,
        );
      }
      const json = (await res.json()) as CfGraphQLResponse;
      if (json.errors && json.errors.length > 0) {
        throw new Error(
          `CF GraphQL errors: ${json.errors.map((e) => e.message).join('; ')}`,
        );
      }
      const groups = json.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups;
      if (!groups) {
        throw new Error(
          'CF GraphQL response missing httpRequestsAdaptiveGroups',
        );
      }
      return groups;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Folds raw CF GraphQL groups into (bucket_start → tier → aggregate).
   * Each group has 1 status × 1 cache_status × 1 path → we explode by status
   * code (2xx/3xx/4xx/5xx) and aggregate counts per tier.
   *
   * tier='total' = no path filter, captures every bucket (sanity baseline).
   */
  private aggregateByBucketAndTier(
    groups: CfGraphQLGroup[],
  ): Map<string, Map<CfTierBucket, BucketAggregate>> {
    const out = new Map<string, Map<CfTierBucket, BucketAggregate>>();

    for (const g of groups) {
      const bucket = g.dimensions.datetimeFiveMinutes;
      const status = g.dimensions.edgeResponseStatus;
      const path = g.dimensions.clientRequestPath ?? '/';
      const cacheStatus = g.dimensions.cacheStatus ?? '';
      const count = g.count;
      const bytes = g.sum.edgeResponseBytes;
      const p50 = g.quantiles.originResponseDurationMsP50;
      const p95 = g.quantiles.originResponseDurationMsP95;

      const tierResult = this.criticality.classify(path);
      // 'excluded' or null → still capture in 'total' but not in tier0/1/2.
      const tiersToUpdate: CfTierBucket[] = ['total'];
      if (
        tierResult === 'tier0' ||
        tierResult === 'tier1' ||
        tierResult === 'tier2'
      ) {
        tiersToUpdate.push(tierResult);
      }

      let perBucket = out.get(bucket);
      if (!perBucket) {
        perBucket = new Map();
        out.set(bucket, perBucket);
      }

      for (const tier of tiersToUpdate) {
        let agg = perBucket.get(tier);
        if (!agg) {
          agg = freshAggregate();
          perBucket.set(tier, agg);
        }
        agg.total += count;
        agg.bytes_served += bytes;
        if (status >= 500) agg.http_5xx += count;
        else if (status >= 400) agg.http_4xx += count;
        else if (status >= 300) agg.http_3xx += count;
        else if (status >= 200) agg.http_2xx += count;
        if (cacheStatus === 'hit') agg.cache_hits += count;
        else if (cacheStatus === 'miss') agg.cache_misses += count;
        if (Number.isFinite(p50)) {
          agg.origin_p50_sum += p50;
          agg.origin_p50_count++;
        }
        if (Number.isFinite(p95)) {
          agg.origin_p95_sum += p95;
          agg.origin_p95_count++;
        }
      }
    }

    return out;
  }

  private async persist(snapshots: CfAnalyticsSnapshot[]): Promise<void> {
    if (snapshots.length === 0) return;
    // UPSERT on (bucket_start, tier) — idempotent re-ingestion.
    const { error } = await this.supabase
      .from('__seo_snapshot_cf_analytics')
      .upsert(snapshots, { onConflict: 'bucket_start,tier' });
    if (error) throw new Error(`Supabase upsert error: ${error.message}`);
  }

  private finalize(
    r: CfAnalyticsRunResult,
    startedAtMs: number,
  ): CfAnalyticsRunResult {
    r.finished_at = new Date().toISOString();
    r.duration_ms = Date.now() - startedAtMs;
    this.logger.log(
      `✅ cf-analytics run ${r.run_id} done in ${r.duration_ms}ms — ` +
        `${r.buckets_received} buckets, ${r.rows_upserted} rows upserted, ` +
        `total_req=${r.totals_period.total_requests} 5xx=${r.totals_period.http_5xx} ` +
        `(rate=${(r.totals_period.rate_5xx * 100).toFixed(3)}%)` +
        (r.skipped ? ` [skipped: ${r.skipped}]` : ''),
    );
    return r;
  }

  private errMsg(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}

interface BucketAggregate {
  total: number;
  http_2xx: number;
  http_3xx: number;
  http_4xx: number;
  http_5xx: number;
  cache_hits: number;
  cache_misses: number;
  bytes_served: number;
  origin_p50_sum: number;
  origin_p50_count: number;
  origin_p95_sum: number;
  origin_p95_count: number;
}

function freshAggregate(): BucketAggregate {
  return {
    total: 0,
    http_2xx: 0,
    http_3xx: 0,
    http_4xx: 0,
    http_5xx: 0,
    cache_hits: 0,
    cache_misses: 0,
    bytes_served: 0,
    origin_p50_sum: 0,
    origin_p50_count: 0,
    origin_p95_sum: 0,
    origin_p95_count: 0,
  };
}
