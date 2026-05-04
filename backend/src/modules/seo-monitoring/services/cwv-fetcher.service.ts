/**
 * Core Web Vitals Fetcher Service
 *
 * Ingère les Core Web Vitals (LCP, CLS, INP, TTFB) via PageSpeed Insights API
 * dans `__seo_cwv_daily`. Sample top 1k pages (pas 50k pour rester gratuit
 * sous le quota 25k req/jour).
 *
 * PageSpeed Insights API : pas de Service Account requis (clé API simple
 * ou anonyme avec quotas réduits). Ici on utilise le Service Account
 * standard pour cohérence.
 *
 * Refs:
 * - ADR-025-seo-department-architecture
 * - 20260425_seo_observability_timeseries.sql (table cible)
 * - packages/seo-types/src/observability.ts (CWVDailyRowSchema)
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { getEffectiveSupabaseKey } from '@common/utils';
import { google } from 'googleapis';
import { GoogleCredentialsService } from './google-credentials.service';
import { SeoMonitoringRunsService } from './seo-monitoring-runs.service';

export interface CwvFetchOptions {
  /** Liste d'URLs à auditer. Sample top 1k recommandé. */
  pages: string[];
  /** Stratégie PageSpeed : mobile (défaut) ou desktop. */
  strategy?: 'mobile' | 'desktop';
  /** Date du snapshot (YYYY-MM-DD). Default: today. */
  date?: string;
  dryRun?: boolean;
}

export interface CwvFetchResult {
  date: string;
  runId: string;
  pagesAudited: number;
  rowsInserted: number;
  durationSeconds: number;
  warnings: string[];
}

@Injectable()
export class CwvFetcherService {
  private readonly logger = new Logger(CwvFetcherService.name);
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
        'CwvFetcherService: Supabase env missing — service will fail on first call',
      );
    }
    this.supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  async fetchAndPersist(options: CwvFetchOptions): Promise<CwvFetchResult> {
    const startedAt = Date.now();
    const date = options.date ?? new Date().toISOString().slice(0, 10);
    const result: CwvFetchResult = {
      date,
      runId: '',
      pagesAudited: 0,
      rowsInserted: 0,
      durationSeconds: 0,
      warnings: [],
    };

    if (!this.credentials.isMonitoringEnabled()) {
      result.warnings.push('monitoring_disabled');
      return result;
    }

    const auth = this.credentials.getGSCAuth(); // PageSpeed accepte le même SA
    if (!auth) {
      result.warnings.push('credentials_missing');
      return result;
    }

    const runId = await this.runsService.logStarted(this.supabase, {
      source: 'cwv',
      scope: `${date}@${options.pages.length}pages`,
      expectedPages: options.pages.length,
    });
    result.runId = runId;

    const pagespeed = google.pagespeedonline({ version: 'v5', auth });
    const allRows: Array<Record<string, unknown>> = [];
    const strategy = options.strategy ?? 'mobile';

    try {
      // Pages auditées en série pour éviter le burst quota
      for (const pageUrl of options.pages) {
        try {
          const resp = await pagespeed.pagespeedapi.runpagespeed({
            url: pageUrl,
            strategy,
            category: ['performance'],
          });

          const audits = resp.data.lighthouseResult?.audits ?? {};
          const lcp = parseAuditValue(audits['largest-contentful-paint']);
          const cls = parseAuditValue(audits['cumulative-layout-shift']);
          const inp = parseAuditValue(audits['interaction-to-next-paint']);
          const ttfb = parseAuditValue(audits['server-response-time']);
          const fid = parseAuditValue(audits['max-potential-fid']);

          allRows.push({
            date,
            page: pageUrl,
            lcp,
            fid,
            cls,
            inp,
            ttfb,
          });
          result.pagesAudited += 1;
        } catch (innerErr) {
          const innerMsg =
            innerErr instanceof Error ? innerErr.message : String(innerErr);
          result.warnings.push(
            `page_failed:${pageUrl}:${innerMsg.slice(0, 100)}`,
          );
        }
      }

      if (!options.dryRun && allRows.length > 0) {
        const { error } = await this.supabase
          .from('__seo_cwv_daily')
          .upsert(allRows, { onConflict: 'date,page' });
        if (error) {
          throw new Error(`upsert __seo_cwv_daily: ${error.message}`);
        }
        result.rowsInserted = allRows.length;
      }

      result.durationSeconds = (Date.now() - startedAt) / 1000;
      await this.runsService.logCompleted(this.supabase, {
        runId,
        source: 'cwv',
        rowsInserted: result.rowsInserted,
        rowsUpdated: 0,
        durationSeconds: result.durationSeconds,
        apiCalls: result.pagesAudited,
        warnings: result.warnings,
      });
      this.logger.log(
        `✅ CWV fetch ${date} : ${result.pagesAudited}/${options.pages.length} pages OK in ${result.durationSeconds}s`,
      );
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.durationSeconds = (Date.now() - startedAt) / 1000;
      await this.runsService.logFailed(this.supabase, {
        runId,
        source: 'cwv',
        errorClass: 'unknown',
        errorMessage: message,
        partialRowsInserted: result.rowsInserted,
        retryScheduled: false,
      });
      throw err;
    }
  }
}

/**
 * Helper : extrait la valeur numérique d'un audit Lighthouse (numericValue ou null).
 */
function parseAuditValue(audit: unknown): number | null {
  if (!audit || typeof audit !== 'object') return null;
  const a = audit as { numericValue?: number };
  return typeof a.numericValue === 'number' ? a.numericValue : null;
}
