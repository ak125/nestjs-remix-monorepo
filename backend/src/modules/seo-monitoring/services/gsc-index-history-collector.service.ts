/**
 * GSC Index History Collector — PILOTE (PR3).
 *
 * Peuple `__seo_index_history` (jusqu'ici ORPHELINE → l'indexation n'était pas
 * observable en interne, d'où l'impossibilité de tracer la « chute d'indexation »
 * sans l'UI GSC live). Snapshot quotidien STRATIFIÉ et ÉCHANTILLONNÉ via l'API
 * URL Inspection — JAMAIS un recensement (quota 2 000/j·site, 600/min·site).
 *
 * Best-practice (cf. plan PR3) :
 *  - INERT-BY-DEFAULT : flag `SEO_INDEX_HISTORY_ENABLED` (strict === 'true', défaut
 *    false). Pattern supplier-truth — l'activation est une décision runtime séparée.
 *  - Quota borné : `SEO_INDEX_INSPECT_MAX_PER_RUN` (défaut 150 << 2 000/j) + pacing
 *    `SEO_INDEX_INSPECT_GAP_MS` (défaut 150ms → ~6,7/s << 600/min).
 *  - Échantillon stratifié pur (`gsc-index-sampler`) : r1_hub prioritaire, puis
 *    r2/r8/r3 round-robin. Strate dérivable de l'URL (aucune colonne ajoutée).
 *  - Idempotent : upsert onConflict (url, snapshot_date) — re-run même jour = sûr.
 *  - No silent fallback : creds absentes / flag off → warning explicite, jamais un
 *    silence ; chaque inspection en échec est comptée (warnings), pas avalée.
 *  - Sortie = TENDANCE par strate (statut/jour), pas « nombre exact indexé ».
 *
 * Réutilise GoogleCredentialsService (auth GSC) + SeoMonitoringRunsService
 * (source 'indexation' déjà déclarée). Lit les sitemaps live pour les pools d'URLs.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { getEffectiveSupabaseKey } from '@common/utils';
import { SITE_ORIGIN } from '@config/site.constants';
import { google } from 'googleapis';
import { GoogleCredentialsService } from './google-credentials.service';
import { SeoMonitoringRunsService } from './seo-monitoring-runs.service';
import {
  allocateStratifiedSample,
  mapCoverageToIndexStatus,
  DEFAULT_INDEX_INSPECT_MAX_PER_RUN,
  type IndexStrate,
} from './gsc-index-sampler';

export interface IndexHistoryFetchOptions {
  snapshotDate?: string; // YYYY-MM-DD (défaut: aujourd'hui UTC)
  maxPerRun?: number;
  dryRun?: boolean;
}

export interface IndexHistoryFetchResult {
  snapshotDate: string;
  runId: string;
  inspected: number;
  rowsInserted: number;
  byStatus: Record<string, number>;
  durationSeconds: number;
  warnings: string[];
}

/**
 * Sitemaps par strate (path relatif → base = SITE_ORIGIN canonique, JAMAIS de
 * domaine hardcodé). Cappés/spread avant échantillonnage.
 */
const STRATE_SITEMAPS: Array<{
  strate: IndexStrate;
  path: string;
  cap: number;
}> = [
  { strate: 'r1_hub', path: '/sitemap-categories.xml', cap: 200 },
  { strate: 'r2_pages', path: '/sitemap-pieces-1.xml', cap: 400 },
  { strate: 'r8_vehicle', path: '/sitemap-vehicules.xml', cap: 300 },
  { strate: 'r3_content', path: '/sitemap-blog.xml', cap: 200 },
];

@Injectable()
export class GscIndexHistoryCollectorService {
  private readonly logger = new Logger(GscIndexHistoryCollectorService.name);
  private readonly supabase: SupabaseClient;
  private readonly maxPerRun: number;
  private readonly gapMs: number;

  constructor(
    private readonly credentials: GoogleCredentialsService,
    private readonly runsService: SeoMonitoringRunsService,
    private readonly configService: ConfigService,
  ) {
    const url = configService.get<string>('SUPABASE_URL') || '';
    const key = getEffectiveSupabaseKey();
    if (!url || !key) {
      this.logger.warn(
        'GscIndexHistoryCollectorService: Supabase env manquant — fail on first call',
      );
    }
    this.supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const max = Number(
      configService.get<string>('SEO_INDEX_INSPECT_MAX_PER_RUN'),
    );
    this.maxPerRun =
      Number.isFinite(max) && max > 0 && max <= 2000
        ? max
        : DEFAULT_INDEX_INSPECT_MAX_PER_RUN;
    const gap = Number(configService.get<string>('SEO_INDEX_INSPECT_GAP_MS'));
    this.gapMs = Number.isFinite(gap) && gap >= 100 ? gap : 150;
  }

  /** Activation explicite (inert-by-default), pattern supplier-truth. */
  private isEnabled(): boolean {
    return (
      this.configService.get<string>('SEO_INDEX_HISTORY_ENABLED') === 'true'
    );
  }

  async fetchAndPersist(
    options: IndexHistoryFetchOptions = {},
  ): Promise<IndexHistoryFetchResult> {
    const startedAt = Date.now();
    const snapshotDate =
      options.snapshotDate ?? new Date().toISOString().slice(0, 10);
    const result: IndexHistoryFetchResult = {
      snapshotDate,
      runId: '',
      inspected: 0,
      rowsInserted: 0,
      byStatus: {},
      durationSeconds: 0,
      warnings: [],
    };

    if (!this.isEnabled()) {
      this.logger.log(
        '🛑 SEO_INDEX_HISTORY_ENABLED=false — index snapshot skipped',
      );
      result.warnings.push('index_history_disabled');
      return result;
    }
    if (!this.credentials.isMonitoringEnabled()) {
      result.warnings.push('monitoring_disabled');
      return result;
    }
    const auth = this.credentials.getGSCAuth();
    if (!auth) {
      result.warnings.push('credentials_missing');
      return result;
    }

    const siteUrl = this.credentials.getGSCSiteUrl();
    const budget = options.maxPerRun ?? this.maxPerRun;
    const runId = await this.runsService.logStarted(this.supabase, {
      source: 'indexation',
      scope: `${siteUrl}@${snapshotDate}~${budget}`,
    });
    result.runId = runId;

    const sc = google.searchconsole({ version: 'v1', auth });

    try {
      // 1) pools par strate depuis les sitemaps live (spread → cap)
      const pools: Partial<Record<IndexStrate, string[]>> = {};
      for (const { strate, path, cap } of STRATE_SITEMAPS) {
        try {
          pools[strate] = spread(
            await fetchSitemapLocs(`${SITE_ORIGIN}${path}`),
            cap,
          );
        } catch (e) {
          result.warnings.push(
            `sitemap_fetch_failed:${strate}:${e instanceof Error ? e.message : e}`,
          );
        }
      }

      // 2) échantillon stratifié borné (pur, déterministe)
      const sample = allocateStratifiedSample(pools, budget);
      if (sample.length === 0) {
        result.warnings.push('empty_sample');
      }

      // 3) inspections paced (quota-safe) + mapping
      const rows: Array<Record<string, unknown>> = [];
      for (const { url } of sample) {
        try {
          const resp = await sc.urlInspection.index.inspect({
            requestBody: { inspectionUrl: url, siteUrl },
          });
          result.inspected += 1;
          const idx = resp.data.inspectionResult?.indexStatusResult ?? {};
          const { status, isIndexed } = mapCoverageToIndexStatus({
            verdict: idx.verdict,
            coverageState: idx.coverageState,
          });
          result.byStatus[status] = (result.byStatus[status] ?? 0) + 1;
          rows.push({
            url,
            index_status: status,
            snapshot_date: snapshotDate,
            source: 'gsc_inspection',
            last_indexed_at: isIndexed ? new Date().toISOString() : null,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (/quota|rate limit|429/i.test(msg)) {
            this.logger.warn(
              `⚠️ URL Inspection quota atteint après ${result.inspected} — arrêt propre`,
            );
            result.warnings.push(`quota_reached_at:${result.inspected}`);
            break; // arrêt propre, on persiste ce qu'on a
          }
          result.warnings.push('inspect_error');
        }
        if (this.gapMs > 0) await sleep(this.gapMs);
      }

      // 4) upsert idempotent (url, snapshot_date)
      if (!options.dryRun && rows.length > 0) {
        const batchSize = 500;
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          const { error } = await this.supabase
            .from('__seo_index_history')
            .upsert(batch, {
              onConflict: 'url,snapshot_date',
              ignoreDuplicates: false,
            });
          if (error)
            throw new Error(`upsert __seo_index_history: ${error.message}`);
          result.rowsInserted += batch.length;
        }
      }

      result.durationSeconds = (Date.now() - startedAt) / 1000;
      await this.runsService.logCompleted(this.supabase, {
        runId,
        source: 'indexation',
        rowsInserted: result.rowsInserted,
        rowsUpdated: 0,
        durationSeconds: result.durationSeconds,
        apiCalls: result.inspected,
        warnings: result.warnings,
      });
      this.logger.log(
        `✅ Index snapshot ${snapshotDate}: ${result.inspected} inspectées, ${result.rowsInserted} lignes (${JSON.stringify(result.byStatus)})`,
      );
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.durationSeconds = (Date.now() - startedAt) / 1000;
      await this.runsService.logFailed(this.supabase, {
        runId,
        source: 'indexation',
        errorClass: /quota/i.test(message) ? 'quota_exceeded' : 'unknown',
        errorMessage: message,
        partialRowsInserted: result.rowsInserted,
        retryScheduled: false,
      });
      this.logger.error(`❌ Index snapshot ${snapshotDate} failed: ${message}`);
      throw err;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Récupère les <loc> d'un sitemap (HTTP GET, regex — pas de parseur lourd). */
async function fetchSitemapLocs(url: string): Promise<string[]> {
  const r = await fetch(url, {
    headers: { 'User-Agent': 'automecanik-index-collector/1.0' },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const xml = await r.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

/** Échantillonne `arr` en `n` URLs régulièrement espacées (spread déterministe). */
function spread(arr: string[], n: number): string[] {
  if (arr.length <= n) return arr;
  const step = arr.length / n;
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}
