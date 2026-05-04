/**
 * GA4 Daily Fetcher Service
 *
 * Ingère les sessions/conversions/bounce GA4 quotidiens dans `__seo_ga4_daily`.
 * Segmentation par groupe URL pour éviter le sampling sur volumes élevés.
 *
 * Réutilise le client BetaAnalyticsDataClient déjà configuré dans
 * GoogleCredentialsService (lui-même aligné sur url-audit.service.ts:50).
 *
 * Refs:
 * - ADR-025-seo-department-architecture
 * - 20260425_seo_observability_timeseries.sql (table cible)
 * - packages/seo-types/src/observability.ts (GA4DailyRowSchema)
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { getEffectiveSupabaseKey } from '@common/utils';
import { GoogleCredentialsService } from './google-credentials.service';
import { SeoMonitoringRunsService } from './seo-monitoring-runs.service';

export interface Ga4FetchOptions {
  date: string; // YYYY-MM-DD
  /** Filtres pagePath (regex) pour segmenter et éviter sampling. */
  pagePathPatterns?: string[];
  /** Nombre de rows max par segment. GA4 limite ~250k tokens/property/jour. */
  rowLimit?: number;
  dryRun?: boolean;
}

export interface Ga4FetchResult {
  date: string;
  runId: string;
  rowsFetched: number;
  rowsInserted: number;
  apiCalls: number;
  durationSeconds: number;
  warnings: string[];
}

@Injectable()
export class Ga4DailyFetcherService {
  private readonly logger = new Logger(Ga4DailyFetcherService.name);
  private readonly supabase: SupabaseClient;

  constructor(
    private readonly credentials: GoogleCredentialsService,
    private readonly runsService: SeoMonitoringRunsService,
    configService: ConfigService,
  ) {
    const url = configService.get<string>('SUPABASE_URL') || '';
    // ADR-028 Option D — fallback to ANON_KEY in read-only mode (RLS protects writes)
    const key = getEffectiveSupabaseKey();
    if (!url || !key) {
      this.logger.warn(
        'Ga4DailyFetcherService: SUPABASE_URL ou clé Supabase manquant — service will fail on first call',
      );
    }
    this.supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  async fetchAndPersist(options: Ga4FetchOptions): Promise<Ga4FetchResult> {
    const startedAt = Date.now();
    const result: Ga4FetchResult = {
      date: options.date,
      runId: '',
      rowsFetched: 0,
      rowsInserted: 0,
      apiCalls: 0,
      durationSeconds: 0,
      warnings: [],
    };

    if (!this.credentials.isMonitoringEnabled()) {
      this.logger.log('🛑 SEO_MONITORING_ENABLED=false — fetch GA4 skipped');
      result.warnings.push('monitoring_disabled');
      return result;
    }

    const client = this.credentials.getGA4Client();
    const property = this.credentials.getGA4PropertyName();
    if (!client || !property) {
      result.warnings.push('credentials_missing');
      return result;
    }

    const runId = await this.runsService.logStarted(this.supabase, {
      source: 'ga4',
      scope: `${property}@${options.date}`,
      expectedPages: options.pagePathPatterns?.length,
    });
    result.runId = runId;

    const segments = options.pagePathPatterns ?? [''];
    const rowLimit = options.rowLimit ?? 100000;
    const allRows: Array<Record<string, unknown>> = [];

    try {
      for (const pattern of segments) {
        result.apiCalls += 1;
        const [resp] = await client.runReport({
          property,
          dateRanges: [{ startDate: options.date, endDate: options.date }],
          dimensions: [
            { name: 'pagePath' },
            { name: 'sessionDefaultChannelGroup' },
          ],
          metrics: [
            { name: 'sessions' },
            { name: 'conversions' },
            { name: 'bounceRate' },
            { name: 'averageSessionDuration' },
          ],
          dimensionFilter: pattern
            ? {
                filter: {
                  fieldName: 'pagePath',
                  stringFilter: { matchType: 'CONTAINS', value: pattern },
                },
              }
            : undefined,
          limit: rowLimit,
        });

        for (const row of resp.rows ?? []) {
          const dims = row.dimensionValues ?? [];
          const mets = row.metricValues ?? [];
          allRows.push({
            date: options.date,
            page: dims[0]?.value ?? '',
            channel: (dims[1]?.value ?? 'organic').toLowerCase(),
            sessions: parseInt(mets[0]?.value ?? '0', 10),
            conversions: parseInt(mets[1]?.value ?? '0', 10),
            bounce_rate: mets[2]?.value ? parseFloat(mets[2].value) : null,
            avg_session_duration: mets[3]?.value
              ? parseFloat(mets[3].value)
              : null,
          });
        }
      }

      result.rowsFetched = allRows.length;

      if (!options.dryRun && allRows.length > 0) {
        const batchSize = 1000;
        for (let i = 0; i < allRows.length; i += batchSize) {
          const batch = allRows.slice(i, i + batchSize);
          const { error } = await this.supabase
            .from('__seo_ga4_daily')
            .upsert(batch, { onConflict: 'date,page,channel' });
          if (error) {
            throw new Error(`upsert __seo_ga4_daily: ${error.message}`);
          }
          result.rowsInserted += batch.length;
        }
      }

      result.durationSeconds = (Date.now() - startedAt) / 1000;
      await this.runsService.logCompleted(this.supabase, {
        runId,
        source: 'ga4',
        rowsInserted: result.rowsInserted,
        rowsUpdated: 0,
        durationSeconds: result.durationSeconds,
        apiCalls: result.apiCalls,
        warnings: result.warnings,
      });
      this.logger.log(
        `✅ GA4 fetch ${options.date} : ${result.rowsFetched} rows in ${result.durationSeconds}s`,
      );
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.durationSeconds = (Date.now() - startedAt) / 1000;
      await this.runsService.logFailed(this.supabase, {
        runId,
        source: 'ga4',
        errorClass: this.classifyError(message),
        errorMessage: message,
        partialRowsInserted: result.rowsInserted,
        retryScheduled: false,
      });
      this.logger.error(`❌ GA4 fetch ${options.date} failed: ${message}`);
      throw err;
    }
  }

  private classifyError(
    msg: string,
  ): 'quota_exceeded' | 'auth_failure' | 'network' | 'unknown' {
    const lower = msg.toLowerCase();
    if (lower.includes('quota') || lower.includes('rate limit'))
      return 'quota_exceeded';
    if (
      lower.includes('unauth') ||
      lower.includes('permission_denied') ||
      lower.includes('invalid_grant')
    )
      return 'auth_failure';
    if (lower.includes('econnreset') || lower.includes('socket'))
      return 'network';
    return 'unknown';
  }
}
