/**
 * GSC Daily Fetcher Service — ingestion multi-niveaux (PR1).
 *
 * Ingère GSC Search Analytics à 4 GRAINS explicites (1 table par grain → les RPC
 * ne mélangent jamais les grains). POURQUOI : la dimension `query` déclenche
 * l'anonymisation Google → totaux ~4× sous-capturés. On ne dérive PAS un total
 * d'un grain page/query.
 *
 *   property_total  date seule                → __seo_gsc_daily_property_total  (vérité volume globale)
 *   totals          date+country+device       → __seo_gsc_daily_totals          (vérité volume segmentée)
 *   pages           date+page+country+device  → __seo_gsc_daily_pages           (réactions par URL)
 *   queries         date+page+query+device    → __seo_gsc_daily (existant)      (détail secondaire)
 *
 * Best-practice (cf. plan PR1) :
 *  - Contrat Zod par ligne AVANT insert (robuste à la dérive d'API).
 *  - Fenêtre glissante (self-healing) : GSC révise J-1/J-2 → re-upsert N derniers jours.
 *  - `type: 'web'` explicite (Discover/Image = exclusion connue, hors V1).
 *  - Idempotence : upsert composite par grain.
 *  - Couverture (pure `gsc-coverage.ts`) logguée — no silent fallback.
 *
 * Fuseaux : la `date` stockée est le JOUR DE REPORTING GSC (ancré Pacific côté
 * Google) — on ne convertit pas. Ne JAMAIS comparer ce jour à un jour GA4
 * (Europe/Paris) sans alignement (cf. consommateurs).
 *
 * Réutilise GoogleCredentialsService (ENV `GSC_*` câblées dans crawl-budget-audit).
 * Refs: 20260613_seo_gsc_multilevel_grains.sql · packages/seo-types/src/observability.ts
 */
import { Injectable, Logger } from '@nestjs/common';
import { google, searchconsole_v1 } from 'googleapis';
import {
  GSCDailyPagesRowSchema,
  GSCDailyPropertyTotalRowSchema,
  GSCDailyTotalsRowSchema,
  type GSCDailyPagesRow,
  type GSCDailyPropertyTotalRow,
  type GSCDailyTotalsRow,
} from '@repo/seo-types';
import { GoogleCredentialsService } from './google-credentials.service';
import { SeoMonitoringRunsService } from './seo-monitoring-runs.service';
import {
  computeGlobalCoverage,
  DEFAULT_GSC_COVERAGE_MIN_RATIO,
  type GscCoverageResult,
} from './gsc-coverage';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { getEffectiveSupabaseKey } from '@common/utils';

export interface GscFetchOptions {
  date: string; // YYYY-MM-DD (jour de reporting GSC)
  /** Limit per request (max 25000 by GSC API). Default 5000. */
  rowLimit?: number;
  /** Liste de préfixes URL à fetcher en parallèle (grain `queries` legacy). */
  pagePrefixes?: string[];
  /** Dimensions du grain `queries` legacy. Défaut : page+query+device. */
  dimensions?: Array<'page' | 'query' | 'device' | 'country' | 'date'>;
  /** Dry run : pas d'INSERT en DB. */
  dryRun?: boolean;
}

export interface GscMultiGrainOptions {
  /** Dernier jour (ancre) au format YYYY-MM-DD. */
  date: string;
  /** Fenêtre glissante self-healing : re-upsert les N derniers jours (défaut 4). */
  rollingDays?: number;
  rowLimit?: number;
  dryRun?: boolean;
}

export type GscGrain = 'property_total' | 'totals' | 'pages' | 'queries';

export interface GscGrainResult {
  grain: GscGrain;
  rowsFetched: number;
  rowsInserted: number;
  schemaRejects: number;
}

export interface GscFetchResult {
  date: string;
  runId: string;
  rowsFetched: number;
  rowsInserted: number;
  apiCalls: number;
  durationSeconds: number;
  warnings: string[];
  /** Détail par grain (multi-niveaux). */
  perGrain?: GscGrainResult[];
  /** Couverture par jour de la fenêtre (pure, observabilité). */
  coverage?: GscCoverageResult[];
}

// Discover/Image NON capturés (exclusion connue, hors V1) — `type` explicite.
const SEARCH_TYPE_WEB = 'web';

@Injectable()
export class GscDailyFetcherService {
  private readonly logger = new Logger(GscDailyFetcherService.name);
  private readonly supabase: SupabaseClient;
  private readonly coverageMinRatio: number;

  constructor(
    private readonly credentials: GoogleCredentialsService,
    private readonly runsService: SeoMonitoringRunsService,
    configService: ConfigService,
  ) {
    const url = configService.get<string>('SUPABASE_URL') || '';
    // ADR-028 Option D — fallback ANON_KEY en read-only (RLS protège les writes)
    const key = getEffectiveSupabaseKey();
    if (!url || !key) {
      this.logger.warn(
        'GscDailyFetcherService: SUPABASE_URL ou clé Supabase manquant — service will fail on first call',
      );
    }
    this.supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    // Param gouverné (pas de magic constant) — env override + défaut documenté.
    const raw = Number(configService.get<string>('SEO_GSC_COVERAGE_MIN_RATIO'));
    this.coverageMinRatio =
      Number.isFinite(raw) && raw > 0 && raw <= 1
        ? raw
        : DEFAULT_GSC_COVERAGE_MIN_RATIO;
  }

  /**
   * Fenêtre glissante multi-grain — point d'entrée du job daily.
   * Re-upsert les `rollingDays` derniers jours (self-healing : GSC révise J-1/J-2),
   * chacun aux 4 grains, + couverture. Un seul run loggué pour la fenêtre.
   */
  async fetchAndPersistMultiGrain(
    options: GscMultiGrainOptions,
  ): Promise<GscFetchResult> {
    const startedAt = Date.now();
    const rollingDays = Math.max(1, options.rollingDays ?? 4);
    const result: GscFetchResult = {
      date: options.date,
      runId: '',
      rowsFetched: 0,
      rowsInserted: 0,
      apiCalls: 0,
      durationSeconds: 0,
      warnings: [],
      perGrain: [],
      coverage: [],
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
    const rowLimit = options.rowLimit ?? 5000;
    const runId = await this.runsService.logStarted(this.supabase, {
      source: 'gsc',
      scope: `${siteUrl}@${options.date}~${rollingDays}d`,
    });
    result.runId = runId;
    const sc = google.searchconsole({ version: 'v1', auth });

    const grainTotals: Record<string, GscGrainResult> = {};
    const accGrain = (g: GscGrainResult) => {
      const cur = (grainTotals[g.grain] ??= {
        grain: g.grain,
        rowsFetched: 0,
        rowsInserted: 0,
        schemaRejects: 0,
      });
      cur.rowsFetched += g.rowsFetched;
      cur.rowsInserted += g.rowsInserted;
      cur.schemaRejects += g.schemaRejects;
    };

    try {
      for (const date of rollingWindowDates(options.date, rollingDays)) {
        const day = await this.fetchDay(sc, siteUrl, date, rowLimit, {
          dryRun: options.dryRun,
        });
        result.apiCalls += day.apiCalls;
        result.rowsFetched += day.grains.reduce((s, g) => s + g.rowsFetched, 0);
        result.rowsInserted += day.grains.reduce(
          (s, g) => s + g.rowsInserted,
          0,
        );
        day.grains.forEach(accGrain);
        if (day.coverage) {
          result.coverage!.push(day.coverage);
          if (day.coverage.status !== 'ok') {
            // No silent fallback : un gap de couverture est observable.
            this.logger.warn(
              `⚠️ GSC coverage ${date}: ${day.coverage.status} (pages/total impr=${day.coverage.pagesVsPropertyImpr ?? 'n/a'}, min=${day.coverage.minRatio})`,
            );
            result.warnings.push(`coverage_${day.coverage.status}:${date}`);
          }
        }
        if (day.schemaRejects > 0) {
          result.warnings.push(`schema_rejects:${date}=${day.schemaRejects}`);
        }
      }

      result.perGrain = Object.values(grainTotals);
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
        `✅ GSC multi-grain ${options.date} (${rollingDays}d): ${result.rowsInserted} rows, ${result.apiCalls} calls in ${result.durationSeconds}s`,
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
      this.logger.error(
        `❌ GSC multi-grain ${options.date} failed: ${message}`,
      );
      throw err;
    }
  }

  /** Un jour, les 4 grains + couverture. */
  private async fetchDay(
    sc: searchconsole_v1.Searchconsole,
    siteUrl: string,
    date: string,
    rowLimit: number,
    opts: { dryRun?: boolean },
  ): Promise<{
    grains: GscGrainResult[];
    coverage: GscCoverageResult | null;
    apiCalls: number;
    schemaRejects: number;
  }> {
    let apiCalls = 0;
    let schemaRejects = 0;
    const grains: GscGrainResult[] = [];

    // 1) property_total (aucune dimension → 1 ligne agrégée)
    const ptRaw = await this.query(sc, siteUrl, date, [], rowLimit);
    apiCalls += ptRaw.apiCalls;
    const ptRow = ptRaw.rows[0];
    const ptParsed = GSCDailyPropertyTotalRowSchema.safeParse({
      date,
      clicks: ptRow?.clicks ?? 0,
      impressions: ptRow?.impressions ?? 0,
      ctr: ptRow?.ctr ?? 0,
      position: ptRow?.position ?? 0,
    });
    let propertyTotalForCoverage: GSCDailyPropertyTotalRow | null = null;
    if (ptParsed.success) {
      propertyTotalForCoverage = ptParsed.data;
      const ins = await this.upsert(
        '__seo_gsc_daily_property_total',
        [ptParsed.data],
        'date',
        opts.dryRun,
      );
      grains.push({
        grain: 'property_total',
        rowsFetched: ptRaw.rows.length,
        rowsInserted: ins,
        schemaRejects: 0,
      });
    } else {
      schemaRejects += 1;
      grains.push({
        grain: 'property_total',
        rowsFetched: ptRaw.rows.length,
        rowsInserted: 0,
        schemaRejects: 1,
      });
    }

    // 2) totals (date+country+device)
    const tRaw = await this.query(
      sc,
      siteUrl,
      date,
      ['country', 'device'],
      rowLimit,
    );
    apiCalls += tRaw.apiCalls;
    const totalsRows: GSCDailyTotalsRow[] = [];
    for (const r of tRaw.rows) {
      const k = r.keys ?? [];
      const parsed = GSCDailyTotalsRowSchema.safeParse({
        date,
        country: (k[0] ?? 'zzz').toLowerCase(),
        device: (k[1] ?? 'all').toLowerCase(),
        clicks: r.clicks ?? 0,
        impressions: r.impressions ?? 0,
        ctr: r.ctr ?? 0,
        position: r.position ?? 0,
      });
      if (parsed.success) totalsRows.push(parsed.data);
      else schemaRejects += 1;
    }
    grains.push({
      grain: 'totals',
      rowsFetched: tRaw.rows.length,
      rowsInserted: await this.upsert(
        '__seo_gsc_daily_totals',
        totalsRows,
        'date,country,device',
        opts.dryRun,
      ),
      schemaRejects: tRaw.rows.length - totalsRows.length,
    });

    // 3) pages (date+page+country+device)
    const pRaw = await this.query(
      sc,
      siteUrl,
      date,
      ['page', 'country', 'device'],
      rowLimit,
    );
    apiCalls += pRaw.apiCalls;
    const pageRows: GSCDailyPagesRow[] = [];
    for (const r of pRaw.rows) {
      const k = r.keys ?? [];
      const parsed = GSCDailyPagesRowSchema.safeParse({
        date,
        page: k[0] ?? '',
        country: (k[1] ?? 'zzz').toLowerCase(),
        device: (k[2] ?? 'all').toLowerCase(),
        clicks: r.clicks ?? 0,
        impressions: r.impressions ?? 0,
        ctr: r.ctr ?? 0,
        position: r.position ?? 0,
      });
      if (parsed.success) pageRows.push(parsed.data);
      else schemaRejects += 1;
    }
    grains.push({
      grain: 'pages',
      rowsFetched: pRaw.rows.length,
      rowsInserted: await this.upsert(
        '__seo_gsc_daily_pages',
        pageRows,
        'date,page,country,device',
        opts.dryRun,
      ),
      schemaRejects: pRaw.rows.length - pageRows.length,
    });

    // 4) queries (legacy, détail secondaire — réutilise fetchAndPersist)
    const q = await this.fetchAndPersist({
      date,
      rowLimit,
      dryRun: opts.dryRun,
    });
    apiCalls += q.apiCalls;
    grains.push({
      grain: 'queries',
      rowsFetched: q.rowsFetched,
      rowsInserted: q.rowsInserted,
      schemaRejects: 0,
    });

    // Couverture GLOBALE (pure) : Σpages vs property_total.
    const coverage = computeGlobalCoverage(
      date,
      propertyTotalForCoverage,
      pageRows,
      this.coverageMinRatio,
    );

    return { grains, coverage, apiCalls, schemaRejects };
  }

  /** Une requête GSC paginée pour un grain donné (dimensions). `type: 'web'`. */
  private async query(
    sc: searchconsole_v1.Searchconsole,
    siteUrl: string,
    date: string,
    dimensions: Array<'page' | 'query' | 'device' | 'country' | 'date'>,
    rowLimit: number,
  ): Promise<{ rows: searchconsole_v1.Schema$ApiDataRow[]; apiCalls: number }> {
    const rows: searchconsole_v1.Schema$ApiDataRow[] = [];
    let startRow = 0;
    let apiCalls = 0;
    let keepGoing = true;
    while (keepGoing) {
      apiCalls += 1;
      const resp = await sc.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: date,
          endDate: date,
          type: SEARCH_TYPE_WEB,
          dimensions: dimensions.length ? dimensions : undefined,
          rowLimit,
          startRow,
        },
      });
      const batch = resp.data.rows ?? [];
      rows.push(...batch);
      if (batch.length < rowLimit) keepGoing = false;
      else startRow += rowLimit;
    }
    return { rows, apiCalls };
  }

  /** Upsert idempotent par grain. Retourne le nombre de lignes upsertées. */
  private async upsert(
    table: string,
    rows: Array<Record<string, unknown>>,
    onConflict: string,
    dryRun?: boolean,
  ): Promise<number> {
    if (dryRun || rows.length === 0) return 0;
    let inserted = 0;
    const batchSize = 1000;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await this.supabase
        .from(table)
        .upsert(batch, { onConflict, ignoreDuplicates: false });
      if (error) throw new Error(`upsert ${table}: ${error.message}`);
      inserted += batch.length;
    }
    return inserted;
  }

  /**
   * Grain `queries` (legacy, détail secondaire) — back-compat conservée.
   * Reste appelable seul ; n'est PLUS la source des totaux.
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
              type: SEARCH_TYPE_WEB,
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
          if (rows.length < rowLimit) keepGoing = false;
          else startRow += rowLimit;
        }
      }

      result.rowsFetched = allRows.length;
      if (!options.dryRun && allRows.length > 0) {
        result.rowsInserted = await this.upsert(
          '__seo_gsc_daily',
          allRows,
          'date,page,query,device',
          false,
        );
      }
      result.durationSeconds = (Date.now() - startedAt) / 1000;
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.durationSeconds = (Date.now() - startedAt) / 1000;
      this.logger.error(`❌ GSC queries-grain ${options.date}: ${message}`);
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

/** Liste des jours [anchor-(n-1) .. anchor] inclus, ISO YYYY-MM-DD. */
function rollingWindowDates(anchor: string, n: number): string[] {
  const out: string[] = [];
  const end = new Date(`${anchor}T00:00:00Z`).getTime();
  for (let i = n - 1; i >= 0; i--) {
    out.push(new Date(end - i * 86_400_000).toISOString().slice(0, 10));
  }
  return out;
}
