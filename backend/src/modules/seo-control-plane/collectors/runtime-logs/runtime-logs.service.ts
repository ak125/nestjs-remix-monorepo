/**
 * RuntimeLogsCollectorService — Layer 1 Collector (Source A : runtime errors).
 *
 * ADR-064 §Architecture L1 — PR-2A-3. Scanne `__error_logs` (rows écrites par
 * `notify503ToErrorLog` dans les loaders Remix) sur la fenêtre glissante,
 * agrège par bucket 5-min × tier, et upsert dans `__seo_snapshot_runtime_logs`.
 *
 * Source A du SLO multi-source pondéré (PR-2B Evaluators future) :
 *   - Source A (runtime, ce service)     — vrai trafic, vrai erreur observée
 *   - Source B (synthetic, PR-2A-1)      — ground truth fetch
 *   - Source C (CF analytics, PR-2A-2)   — edge truth, capture Googlebot
 *   - Source D (GSC coverage, PR-2A-4)   — signal secondaire, J-2 retard
 *
 * Discipline 4-layer : aucune lecture L2/L3, aucune écriture L4. Pure ingestion.
 *
 * @see feedback_slo_must_be_multi_source (4 sources pondérées)
 * @see feedback_seo_control_plane_layered_architecture (no cross-layer reads)
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { SupabaseBaseService } from '../../../../database/services/supabase-base.service';
import { CriticalityLoaderService } from '../../services/criticality-loader.service';
import type {
  RuntimeLogsJobData,
  RuntimeLogsRunResult,
  RuntimeLogsSnapshot,
  RuntimeTierBucket,
} from './runtime-logs.types';

const DEFAULT_WINDOW_MIN = 60;

interface ErrorLogRow {
  err_id: string;
  err_status: number;
  err_url: string | null;
  err_subject: string | null;
  err_created_at: string;
}

@Injectable()
export class RuntimeLogsCollectorService extends SupabaseBaseService {
  protected readonly logger = new Logger(RuntimeLogsCollectorService.name);
  private readonly cfg: ConfigService;

  constructor(
    private readonly criticality: CriticalityLoaderService,
    configService: ConfigService,
  ) {
    super(configService);
    this.cfg = configService;
  }

  async run(job: RuntimeLogsJobData): Promise<RuntimeLogsRunResult> {
    const startedAtMs = Date.now();
    const runId = randomUUID();
    const windowMinutes = job.windowMinutes ?? DEFAULT_WINDOW_MIN;
    const now = Date.now();
    const from = new Date(now - windowMinutes * 60_000);
    const to = new Date(now);

    const result: RuntimeLogsRunResult = {
      run_id: runId,
      started_at: new Date(startedAtMs).toISOString(),
      finished_at: '',
      duration_ms: 0,
      triggered_by: job.triggeredBy,
      window_minutes: windowMinutes,
      rows_scanned: 0,
      buckets_emitted: 0,
      rows_upserted: 0,
      totals_period: { total_events: 0, http_5xx_count: 0 },
    };

    this.logger.log(
      `📋 runtime-logs run starting (run_id=${runId} window=${windowMinutes}min from=${from.toISOString()} triggeredBy=${job.triggeredBy})`,
    );

    let rows: ErrorLogRow[];
    try {
      rows = await this.fetchErrorLogs(from, to);
    } catch (err) {
      this.logger.error(
        `❌ __error_logs fetch failed: ${this.errMsg(err)} — aborting run`,
      );
      result.skipped = 'no_supabase';
      result.errorMessage = this.errMsg(err);
      return this.finalize(result, startedAtMs);
    }

    result.rows_scanned = rows.length;
    const snapshots = this.aggregateByBucketAndTier(rows, runId);
    result.buckets_emitted = snapshots.length;

    for (const s of snapshots) {
      if (s.tier === 'total') {
        result.totals_period.total_events += s.total_events;
        result.totals_period.http_5xx_count += s.http_5xx_count;
      }
    }

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

  private async fetchErrorLogs(from: Date, to: Date): Promise<ErrorLogRow[]> {
    const PAGE = 1000;
    const all: ErrorLogRow[] = [];
    let offset = 0;
    while (true) {
      const { data, error } = await this.supabase
        .from('__error_logs')
        .select('err_id, err_status, err_url, err_subject, err_created_at')
        .gte('err_created_at', from.toISOString())
        .lt('err_created_at', to.toISOString())
        .like('err_subject', 'LOADER_%')
        .order('err_created_at', { ascending: true })
        .range(offset, offset + PAGE - 1);
      if (error) throw new Error(`Supabase select error: ${error.message}`);
      const batch = (data ?? []) as ErrorLogRow[];
      all.push(...batch);
      if (batch.length < PAGE) break;
      offset += PAGE;
      if (offset >= 50_000) {
        this.logger.warn(
          `⚠ __error_logs window returned ≥ 50k rows — truncating. Consider tightening window or investigating error storm.`,
        );
        break;
      }
    }
    return all;
  }

  private aggregateByBucketAndTier(
    rows: ErrorLogRow[],
    runId: string,
  ): RuntimeLogsSnapshot[] {
    const map = new Map<string, Map<RuntimeTierBucket, Aggregate>>();
    const fetchedAt = new Date().toISOString();

    for (const row of rows) {
      const bucketStart = this.floor5Min(row.err_created_at);
      const tierResult = row.err_url
        ? this.criticality.classify(this.toPath(row.err_url))
        : null;
      const targets: RuntimeTierBucket[] = ['total'];
      if (
        tierResult === 'tier0' ||
        tierResult === 'tier1' ||
        tierResult === 'tier2'
      ) {
        targets.push(tierResult);
      }
      let perBucket = map.get(bucketStart);
      if (!perBucket) {
        perBucket = new Map();
        map.set(bucketStart, perBucket);
      }
      for (const tier of targets) {
        let agg = perBucket.get(tier);
        if (!agg) {
          agg = freshAggregate();
          perBucket.set(tier, agg);
        }
        agg.total += 1;
        if (row.err_status >= 500) agg.http_5xx += 1;
        else if (row.err_status >= 400) agg.http_4xx += 1;
        if (row.err_subject) {
          agg.subjects[row.err_subject] =
            (agg.subjects[row.err_subject] ?? 0) + 1;
        }
      }
    }

    const out: RuntimeLogsSnapshot[] = [];
    for (const [bucketStart, byTier] of map) {
      for (const [tier, agg] of byTier) {
        out.push({
          bucket_start: bucketStart,
          tier,
          total_events: agg.total,
          http_4xx_count: agg.http_4xx,
          http_5xx_count: agg.http_5xx,
          subjects_breakdown: agg.subjects,
          run_id: runId,
          fetched_at: fetchedAt,
        });
      }
    }
    return out;
  }

  private async persist(snapshots: RuntimeLogsSnapshot[]): Promise<void> {
    if (snapshots.length === 0) return;
    const { error } = await this.supabase
      .from('__seo_snapshot_runtime_logs')
      .upsert(snapshots, { onConflict: 'bucket_start,tier' });
    if (error) throw new Error(`Supabase upsert error: ${error.message}`);
  }

  /**
   * Normalize err_url (full URL or already-path) to a leading-slash path
   * suitable for `criticality.classify()`. Bad URLs fall back to raw string.
   */
  private toPath(urlOrPath: string): string {
    try {
      return new URL(urlOrPath).pathname;
    } catch {
      return urlOrPath.startsWith('/') ? urlOrPath : `/${urlOrPath}`;
    }
  }

  private floor5Min(iso: string): string {
    const ms = new Date(iso).getTime();
    const floored = Math.floor(ms / 300_000) * 300_000;
    return new Date(floored).toISOString();
  }

  private finalize(
    r: RuntimeLogsRunResult,
    startedAtMs: number,
  ): RuntimeLogsRunResult {
    r.finished_at = new Date().toISOString();
    r.duration_ms = Date.now() - startedAtMs;
    this.logger.log(
      `✅ runtime-logs run ${r.run_id} done in ${r.duration_ms}ms — ` +
        `${r.rows_scanned} rows scanned, ${r.buckets_emitted} buckets, ` +
        `${r.rows_upserted} upserted (total 5xx=${r.totals_period.http_5xx_count}/${r.totals_period.total_events})` +
        (r.skipped ? ` [skipped: ${r.skipped}]` : ''),
    );
    return r;
  }

  private errMsg(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}

interface Aggregate {
  total: number;
  http_4xx: number;
  http_5xx: number;
  subjects: Record<string, number>;
}

function freshAggregate(): Aggregate {
  return { total: 0, http_4xx: 0, http_5xx: 0, subjects: {} };
}
