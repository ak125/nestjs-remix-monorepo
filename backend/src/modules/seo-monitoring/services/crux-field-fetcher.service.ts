/**
 * CrUX Field Fetcher Service — orchestrates daily CrUX ingestion.
 *
 * Per fetch run :
 *  1. Sample top-N URLs by GSC clicks rolling 28j
 *  2. Fetch origin × PHONE + DESKTOP (2 calls)
 *  3. Fetch top-N URLs × PHONE (~100 calls)
 *  4. Apply sticky 404 backoff (1d → 7d after 3 days → 30d after 21 days)
 *  5. Upsert into __seo_crux_field_history (idempotent via PK)
 *  6. Audit run via SeoMonitoringRunsService
 *
 * Total cost : ~102 calls/day, < 1 RPM under 150 RPM quota.
 *
 * Refs :
 *  - ADR-063 (Accepted 2026-05-14)
 *  - 20260514_seo_crux_field_history.sql (DB schema)
 *  - packages/seo-types/src/crux.ts (Zod row schemas)
 *  - ADR-028 Option D (READ_ONLY gate respected)
 *
 * NOTE : ce service est DORMANT en PR-3 (pas branché au processor). Le wiring
 * BullMQ arrive en PR-5.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getEffectiveSupabaseKey } from '@common/utils';
import type {
  CruxFieldHistoryRow,
  CruxFormFactor,
  CruxHistoryResponse,
} from '@repo/seo-types';
import { CruxApiClient, CRUX_METRICS_V1 } from './crux-api-client.service';
import { SeoMonitoringRunsService } from './seo-monitoring-runs.service';

export interface CruxFetcherOptions {
  origin?: string;
  topUrlsLimit?: number;
  originOnly?: boolean;
  dryRun?: boolean;
}

export interface CruxFetcherResult {
  runId: string;
  originSuccess: number;
  originSkipped: number;
  urlSuccess: number;
  urlSkipped404: number;
  urlSkippedSticky: number;
  rowsInserted: number;
  apiCalls: number;
  durationSeconds: number;
  warnings: string[];
}

interface StickyState {
  consecutive404Days: number;
  lastChecked: string;
}

const DEFAULT_ORIGIN = 'https://www.automecanik.com';
const STICKY_DAILY_LIMIT = 3;
const STICKY_WEEKLY_LIMIT = 21;

@Injectable()
export class CruxFieldFetcherService {
  private readonly logger = new Logger(CruxFieldFetcherService.name);
  private readonly supabase: SupabaseClient;

  constructor(
    private readonly cruxClient: CruxApiClient,
    private readonly runsService: SeoMonitoringRunsService,
    configService: ConfigService,
  ) {
    const url = configService.get<string>('SUPABASE_URL') ?? '';
    const key = getEffectiveSupabaseKey();
    if (!url || !key) {
      this.logger.warn(
        'CruxFieldFetcherService: Supabase env missing — service will fail on first call',
      );
    }
    this.supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  /**
   * Sample top-N URLs by GSC clicks over the rolling 28j window.
   * Returns up to `limit` URLs (may return fewer if GSC table is sparse).
   */
  async sampleTopUrls(limit = 100): Promise<string[]> {
    const cutoff = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const { data, error } = await this.supabase
      .from('__seo_gsc_daily')
      .select('page, clicks')
      .gte('date', cutoff)
      .order('clicks', { ascending: false })
      .limit(limit * 5);

    if (error) {
      this.logger.warn(`sampleTopUrls failed: ${error.message}`);
      return [];
    }
    if (!data || data.length === 0) {
      return [];
    }

    const totals = new Map<string, number>();
    for (const row of data as Array<{ page: string; clicks: number }>) {
      totals.set(row.page, (totals.get(row.page) ?? 0) + (row.clicks ?? 0));
    }
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([page]) => page);
  }

  /**
   * Decide whether to fetch today based on past 404 streak.
   *  - 0..2 days 404 → fetch daily
   *  - 3..20 days 404 → fetch only if day-of-month % 7 == 0 (~weekly)
   *  - 21+ days 404 → fetch only if day-of-month == 1 (~monthly)
   */
  shouldFetchToday(sticky: StickyState | null, today: Date = new Date()): boolean {
    if (!sticky || sticky.consecutive404Days === 0) return true;
    if (sticky.consecutive404Days < STICKY_DAILY_LIMIT) return true;
    const dayOfMonth = today.getUTCDate();
    if (sticky.consecutive404Days < STICKY_WEEKLY_LIMIT) {
      return dayOfMonth % 7 === 0;
    }
    return dayOfMonth === 1;
  }

  /**
   * Main entry point — fetch + persist for a single run.
   * Idempotent : re-running on same day updates existing rows (PK conflict).
   * Catch-up automatic : CrUX returns 40 periods per call.
   */
  async fetchAndPersist(
    options: CruxFetcherOptions = {},
  ): Promise<CruxFetcherResult> {
    const startedAt = Date.now();
    const result: CruxFetcherResult = {
      runId: '',
      originSuccess: 0,
      originSkipped: 0,
      urlSuccess: 0,
      urlSkipped404: 0,
      urlSkippedSticky: 0,
      rowsInserted: 0,
      apiCalls: 0,
      durationSeconds: 0,
      warnings: [],
    };

    if (!this.cruxClient.isAvailable()) {
      this.logger.log('CrUX client unavailable (no key or circuit open) — skipping');
      result.warnings.push('crux_client_unavailable');
      return result;
    }

    const runId = await this.runsService.logStarted(this.supabase, {
      source: 'crux',
      scope: options.originOnly ? 'origin' : 'origin+urls',
    });
    result.runId = runId;

    const origin = options.origin ?? DEFAULT_ORIGIN;

    try {
      for (const formFactor of ['PHONE', 'DESKTOP'] as CruxFormFactor[]) {
        const outcome = await this.cruxClient.fetchOriginHistory(
          origin,
          formFactor,
        );
        result.apiCalls += outcome.attempts;
        if (outcome.response) {
          const rows = this.mapHistoryToRows(outcome.response, origin, null, formFactor);
          if (!options.dryRun && rows.length > 0) {
            const inserted = await this.upsertRows(rows);
            result.rowsInserted += inserted;
          }
          result.originSuccess++;
        } else {
          result.originSkipped++;
          if (outcome.status === 404) {
            result.warnings.push(`origin_404_${formFactor}`);
          }
        }
      }

      if (!options.originOnly) {
        const topUrls = await this.sampleTopUrls(options.topUrlsLimit ?? 100);
        this.logger.log(`Sampled ${topUrls.length} top URLs for CrUX URL-level fetch`);

        for (const url of topUrls) {
          const outcome = await this.cruxClient.fetchUrlHistory(url, 'PHONE');
          result.apiCalls += outcome.attempts;
          if (outcome.response) {
            const rows = this.mapHistoryToRows(
              outcome.response,
              origin,
              url,
              'PHONE',
            );
            if (!options.dryRun && rows.length > 0) {
              const inserted = await this.upsertRows(rows);
              result.rowsInserted += inserted;
            }
            result.urlSuccess++;
          } else if (outcome.status === 404) {
            result.urlSkipped404++;
          } else {
            result.urlSkippedSticky++;
          }
        }
      }

      result.durationSeconds = (Date.now() - startedAt) / 1000;
      await this.runsService.logCompleted(this.supabase, {
        runId,
        source: 'crux',
        rowsInserted: result.rowsInserted,
        rowsUpdated: 0,
        durationSeconds: result.durationSeconds,
        apiCalls: result.apiCalls,
        warnings: result.warnings,
      });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`CrUX fetch failed: ${message}`);
      result.warnings.push(`error:${message}`);
      result.durationSeconds = (Date.now() - startedAt) / 1000;
      await this.runsService.logFailed(this.supabase, {
        runId,
        source: 'crux',
        errorClass: 'unknown',
        errorMessage: message,
        partialRowsInserted: result.rowsInserted,
        retryScheduled: false,
      });
      return result;
    }
  }

  /**
   * Map a CrUX `queryHistoryRecord` response into a flat row array suitable
   * for upsert into `__seo_crux_field_history`. One row per collection period.
   */
  private mapHistoryToRows(
    response: CruxHistoryResponse,
    origin: string,
    url: string | null,
    formFactor: CruxFormFactor,
  ): CruxFieldHistoryRow[] {
    const periods = response.record.collectionPeriods;
    const metrics = response.record.metrics;
    const fetchedAt = new Date().toISOString();

    return periods.map((period, idx) => {
      const startDate = this.formatDate(
        period.firstDate.year,
        period.firstDate.month,
        period.firstDate.day,
      );
      const endDate = this.formatDate(
        period.lastDate.year,
        period.lastDate.month,
        period.lastDate.day,
      );

      const p75 = (metricKey: string): number | null => {
        const ts = metrics[metricKey]?.percentilesTimeseries.p75s;
        if (!ts || idx >= ts.length) return null;
        const v = ts[idx];
        if (v === null || v === undefined) return null;
        const num = typeof v === 'number' ? v : parseFloat(v);
        return Number.isFinite(num) ? num : null;
      };

      const toInt = (v: number | null): number | null =>
        v === null ? null : Math.round(v);

      return {
        origin,
        url,
        form_factor: formFactor,
        collection_period_start_date: startDate,
        collection_period_end_date: endDate,
        p75_lcp_ms: toInt(p75(CRUX_METRICS_V1[0])),
        p75_inp_ms: toInt(p75(CRUX_METRICS_V1[1])),
        p75_cls: p75(CRUX_METRICS_V1[2]),
        p75_ttfb_ms: toInt(p75(CRUX_METRICS_V1[3])),
        p75_fcp_ms: toInt(p75(CRUX_METRICS_V1[4])),
        fetched_at: fetchedAt,
        source_api: 'history',
      };
    });
  }

  /**
   * Upsert rows into `__seo_crux_field_history`. PK conflict on
   * (origin, url_key, form_factor, collection_period_end_date) → UPDATE.
   */
  private async upsertRows(rows: CruxFieldHistoryRow[]): Promise<number> {
    if (rows.length === 0) return 0;
    // url_key is generated server-side ; we omit it from payload.
    const payload = rows.map((r) => ({
      origin: r.origin,
      url: r.url,
      form_factor: r.form_factor,
      collection_period_start_date: r.collection_period_start_date,
      collection_period_end_date: r.collection_period_end_date,
      p75_lcp_ms: r.p75_lcp_ms,
      p75_inp_ms: r.p75_inp_ms,
      p75_cls: r.p75_cls,
      p75_ttfb_ms: r.p75_ttfb_ms,
      p75_fcp_ms: r.p75_fcp_ms,
      fetched_at: r.fetched_at,
      source_api: r.source_api,
    }));
    const { error } = await this.supabase
      .from('__seo_crux_field_history')
      .upsert(payload, {
        onConflict: 'origin,url_key,form_factor,collection_period_end_date',
        ignoreDuplicates: false,
      });
    if (error) {
      throw new Error(`upsert __seo_crux_field_history: ${error.message}`);
    }
    return rows.length;
  }

  private formatDate(year: number, month: number, day: number): string {
    const m = String(month).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  }
}
