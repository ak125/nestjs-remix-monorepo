/**
 * GSC Daily Fetcher Service
 *
 * Ingère les Search Analytics quotidiens dans `__seo_gsc_daily`.
 * Pagination par préfixe URL pour tenir le quota sur 50k pages.
 *
 * Réutilise les credentials existants (cf. GoogleCredentialsService) qui
 * lisent les conventions ENV déjà câblées dans crawl-budget-audit.service.ts.
 *
 * Refs:
 * - ADR-025-seo-department-architecture
 * - 20260425_seo_observability_timeseries.sql (table cible)
 * - packages/seo-types/src/observability.ts (GSCDailyRowSchema)
 * - packages/seo-types/src/intelligence.ts (event_log payloads)
 */
import { Injectable, Logger } from '@nestjs/common';
import { google, searchconsole_v1 } from 'googleapis';
import { GoogleCredentialsService } from './google-credentials.service';
import { SeoMonitoringRunsService } from './seo-monitoring-runs.service';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

export interface GscFetchOptions {
  date: string; // YYYY-MM-DD
  /** Limit per request (max 25000 by GSC API). Default 5000. */
  rowLimit?: number;
  /** Liste de préfixes URL à fetcher en parallèle. Si non fourni, fetch global. */
  pagePrefixes?: string[];
  /** Dimensions à fetcher. Défaut : page+query+device (granularité maximale typique). */
  dimensions?: Array<'page' | 'query' | 'device' | 'country' | 'date'>;
  /** Dry run : pas d'INSERT en DB, juste log les rows. Utile en debug. */
  dryRun?: boolean;
}

export interface GscFetchResult {
  date: string;
  runId: string;
  rowsFetched: number;
  rowsInserted: number;
  apiCalls: number;
  durationSeconds: number;
  warnings: string[];
}

@Injectable()
export class GscDailyFetcherService {
  private readonly logger = new Logger(GscDailyFetcherService.name);
  private readonly supabase: SupabaseClient;

  constructor(
    private readonly credentials: GoogleCredentialsService,
    private readonly runsService: SeoMonitoringRunsService,
    configService: ConfigService,
  ) {
    const url = configService.get<string>('SUPABASE_URL');
    const key = configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) {
      throw new Error(
        'GscDailyFetcherService: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant',
      );
    }
    this.supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  /**
   * Fetch GSC daily for a given date and persist into __seo_gsc_daily.
   *
   * Returns early with status='disabled' if monitoring kill-switch off
   * or credentials missing — no exception, schedulers continue gracefully.
   */
  async fetchAndPersist(options: GscFetchOptions): Promise<GscFetchResult> {
    const startedAt = Date.now();
    const result: GscFetchResult = {
      date: options.date,
      runId: '',
      rowsFetched: 0,
      rowsInserted: 0,
      apiCalls: 0,
      durationSeconds: 0,
      warnings: [],
    };

    if (!this.credentials.isMonitoringEnabled()) {
      this.logger.log('🛑 SEO_MONITORING_ENABLED=false — fetch GSC skipped');
      result.warnings.push('monitoring_disabled');
      return result;
    }

    const auth = this.credentials.getGSCAuth();
    if (!auth) {
      result.warnings.push('credentials_missing');
      return result;
    }

    const siteUrl = this.credentials.getGSCSiteUrl();
    const dimensions = options.dimensions ?? ['page', 'query', 'device'];
    const rowLimit = options.rowLimit ?? 5000;

    const runId = await this.runsService.logStarted(this.supabase, {
      source: 'gsc',
      scope: `${siteUrl}@${options.date}`,
      expectedPages: options.pagePrefixes?.length,
    });
    result.runId = runId;

    const sc = google.searchconsole({ version: 'v1', auth });
    const allRows: Array<Record<string, unknown>> = [];

    try {
      const prefixes = options.pagePrefixes ?? [''];
      for (const prefix of prefixes) {
        const filters: searchconsole_v1.Schema$ApiDimensionFilter[] = [];
        if (prefix) {
          filters.push({
            dimension: 'page',
            operator: 'contains',
            expression: prefix,
          });
        }

        let startRow = 0;
        let keepGoing = true;
        while (keepGoing) {
          result.apiCalls += 1;
          const resp = await sc.searchanalytics.query({
            siteUrl,
            requestBody: {
              startDate: options.date,
              endDate: options.date,
              dimensions,
              rowLimit,
              startRow,
              dimensionFilterGroups: filters.length ? [{ filters }] : undefined,
            },
          });

          const rows = resp.data.rows ?? [];
          for (const row of rows) {
            const dims = row.keys ?? [];
            allRows.push({
              date: options.date,
              page: dims[dimensions.indexOf('page' as const)] ?? '',
              query: dims[dimensions.indexOf('query' as const)] ?? '',
              device: (
                dims[dimensions.indexOf('device' as const)] ?? 'all'
              ).toLowerCase(),
              clicks: row.clicks ?? 0,
              impressions: row.impressions ?? 0,
              ctr: row.ctr ?? 0,
              position: row.position ?? 0,
            });
          }

          if (rows.length < rowLimit) {
            keepGoing = false;
          } else {
            startRow += rowLimit;
          }
        }
      }

      result.rowsFetched = allRows.length;

      if (!options.dryRun && allRows.length > 0) {
        const batchSize = 1000;
        for (let i = 0; i < allRows.length; i += batchSize) {
          const batch = allRows.slice(i, i + batchSize);
          const { error } = await this.supabase
            .from('__seo_gsc_daily')
            .upsert(batch, {
              onConflict: 'date,page,query,device',
              ignoreDuplicates: false,
            });
          if (error) {
            throw new Error(`upsert __seo_gsc_daily: ${error.message}`);
          }
          result.rowsInserted += batch.length;
        }
      }

      result.durationSeconds = (Date.now() - startedAt) / 1000;
      await this.runsService.logCompleted(this.supabase, {
        runId,
        source: 'gsc',
        rowsInserted: result.rowsInserted,
        rowsUpdated: 0,
        durationSeconds: result.durationSeconds,
        apiCalls: result.apiCalls,
        warnings: result.warnings,
      });
      this.logger.log(
        `✅ GSC fetch ${options.date} : ${result.rowsFetched} rows in ${result.durationSeconds}s (${result.apiCalls} calls)`,
      );
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const errorClass = this.classifyError(message);
      result.durationSeconds = (Date.now() - startedAt) / 1000;
      await this.runsService.logFailed(this.supabase, {
        runId,
        source: 'gsc',
        errorClass,
        errorMessage: message,
        partialRowsInserted: result.rowsInserted,
        retryScheduled: errorClass === 'quota_exceeded',
      });
      this.logger.error(`❌ GSC fetch ${options.date} failed: ${message}`);
      throw err;
    }
  }

  private classifyError(
    msg: string,
  ): 'quota_exceeded' | 'auth_failure' | 'network' | 'unknown' {
    const lower = msg.toLowerCase();
    if (lower.includes('quota')) return 'quota_exceeded';
    if (
      lower.includes('unauth') ||
      lower.includes('forbidden') ||
      lower.includes('invalid_grant')
    )
      return 'auth_failure';
    if (
      lower.includes('econnreset') ||
      lower.includes('etimedout') ||
      lower.includes('socket')
    )
      return 'network';
    return 'unknown';
  }
}
