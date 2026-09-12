/**
 * GA4 Daily Fetcher Service
 *
 * Ingère les sessions/conversions/bounce GA4 quotidiens dans `__seo_ga4_daily`.
 * Segmentation par groupe URL pour éviter le sampling sur volumes élevés.
 *
 * Réutilise le client BetaAnalyticsDataClient déjà configuré dans
 * GoogleCredentialsService (lui-même aligné sur url-audit.service.ts:50).
 *
 * 2026-09-11 — rattrapage des trous (cf. audit/seo-sept-leviers-2026-09-11.md) :
 *  - `fetchAndPersistWindow` : planifie la date d'ancre + les jours ABSENTS de la
 *    fenêtre de rattrapage (`ingestion-date-planner.ts`). Avant : 1 seule date
 *    par run → tout jour sans run était perdu définitivement.
 *  - Pagination `offset`/`rowCount` (avant : `limit` sans pagination = troncature muette).
 *  - Réponse vide = avertissement explicite, rien n'est écrit (jamais un faux zéro).
 *  - `dryRun` : aucune écriture, journal compris ; `fetched_at` rafraîchi.
 *  Limite assumée : un jour GA4 est « présent » dès qu'une ligne existe ; un
 *  upsert multi-lots interrompu reste journalisé `ingestion_run_failed`.
 *
 * Refs:
 * - ADR-025-seo-department-architecture
 * - 20260425_seo_observability_timeseries.sql (table cible)
 * - packages/seo-types/src/observability.ts (GA4DailyRowSchema)
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { addDaysIso, enumerateDatesIso, isIsoDate } from '@repo/seo-types';
import { getEffectiveSupabaseKey } from '@common/utils';
import { SITE_HOSTNAME } from '@config/site.constants';
import { GoogleCredentialsService } from './google-credentials.service';
import {
  runtimeIdentity,
  SeoMonitoringRunsService,
} from './seo-monitoring-runs.service';
import {
  INGESTION_MAX_LOOKBACK_DAYS,
  ingestionWindow,
  planIngestionDates,
  resolveIngestionConfig,
  type IngestionConfig,
  type IngestionPlan,
} from './ingestion-date-planner';
import {
  classifyIngestionError,
  IngestionDbError,
  isSystemicIngestionError,
  type IngestionErrorClass,
} from './ingestion-error-classifier';

export interface Ga4FetchOptions {
  date: string; // YYYY-MM-DD
  /** Filtres pagePath (regex) pour segmenter et éviter sampling. */
  pagePathPatterns?: string[];
  /** Nombre de rows max par page de résultats. GA4 limite ~250k tokens/property/jour. */
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

export interface Ga4WindowOptions {
  /** Ancre = dernier jour éligible (YYYY-MM-DD). */
  anchorDate: string;
  rollingDays?: number;
  lookbackDays?: number;
  maxBackfillDays?: number;
  /** Plancher (jamais sous `SEO_GA4_BACKFILL_FLOOR_DATE`). */
  floorDate?: string;
  rowLimit?: number;
  dryRun?: boolean;
  /** Plan seul : lectures DB de présence, 0 appel GA4, 0 écriture. */
  planOnly?: boolean;
  triggeredBy?: 'scheduler' | 'api' | 'manual' | 'cli';
}

export interface Ga4WindowResult extends Ga4FetchResult {
  dryRun: boolean;
  dates: {
    window: IngestionPlan['window'];
    refresh: string[];
    backfill: string[];
    deferred: string[];
    ingested: string[];
    empty: string[];
    failed: Array<{
      date: string;
      errorClass: IngestionErrorClass;
      message: string;
    }>;
  };
}

type Ga4Client = NonNullable<
  ReturnType<GoogleCredentialsService['getGA4Client']>
>;

/** Identifiant de run d'une exécution sans écriture (aucun journal émis). */
const DRY_RUN_ID = 'dry-run';
/** Lectures de présence par date menées en parallèle (index PK date). */
const PRESENCE_PROBE_CONCURRENCY = 8;

@Injectable()
export class Ga4DailyFetcherService {
  private readonly logger = new Logger(Ga4DailyFetcherService.name);
  private readonly supabase: SupabaseClient;
  private readonly ingestion: IngestionConfig;

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
    const { config, invalidKeys } = resolveIngestionConfig('ga4', (k) =>
      configService.get<string>(k),
    );
    if (invalidKeys.length > 0) {
      this.logger.warn(
        `⚠️ GA4 ingestion : variables invalides ${invalidKeys.join(', ')} — défauts documentés appliqués`,
      );
    }
    this.ingestion = config;
  }

  /** Configuration gouvernée résolue (lecture seule — CLI/diagnostic). */
  get ingestionConfig(): Readonly<IngestionConfig> {
    return this.ingestion;
  }

  /** Une date (déclenchement admin `POST run/ga4`). */
  async fetchAndPersist(options: Ga4FetchOptions): Promise<Ga4FetchResult> {
    const startedAt = Date.now();
    const dryRun = options.dryRun === true;
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

    const runId = dryRun
      ? DRY_RUN_ID
      : await this.runsService.logStarted(this.supabase, {
          source: 'ga4',
          scope: `${property}@${options.date}`,
          expectedPages: options.pagePathPatterns?.length,
          extra: { runtime: runtimeIdentity() },
        });
    result.runId = runId;
    const fetchedAt = new Date().toISOString();

    try {
      const day = await this.fetchDate(
        client,
        property,
        options.date,
        options.pagePathPatterns ?? [''],
        options.rowLimit ?? 100000,
        result.warnings,
      );
      result.apiCalls += day.apiCalls;
      result.rowsFetched = day.rows.length;
      if (day.rows.length === 0)
        result.warnings.push(this.emptyWarning(options.date, day));
      result.rowsInserted = await this.upsertRows(day.rows, {
        dryRun,
        fetchedAt,
      });

      result.durationSeconds = (Date.now() - startedAt) / 1000;
      if (!dryRun) {
        await this.runsService.logCompleted(this.supabase, {
          runId,
          source: 'ga4',
          rowsInserted: result.rowsInserted,
          rowsUpdated: 0,
          durationSeconds: result.durationSeconds,
          apiCalls: result.apiCalls,
          warnings: result.warnings,
        });
      }
      this.logger.log(
        `✅ GA4 fetch ${options.date}${dryRun ? ' [dry-run]' : ''} : ${result.rowsFetched} rows in ${result.durationSeconds}s`,
      );
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.durationSeconds = (Date.now() - startedAt) / 1000;
      if (!dryRun) {
        await this.runsService.logFailed(this.supabase, {
          runId,
          source: 'ga4',
          errorClass: classifyIngestionError(err),
          errorMessage: message,
          partialRowsInserted: result.rowsInserted,
          retryScheduled: false,
        });
      }
      this.logger.error(`❌ GA4 fetch ${options.date} failed: ${message}`);
      throw err;
    }
  }

  /**
   * Job daily + rattrapage CLI : ancre (refresh) + jours absents de la fenêtre
   * de rattrapage, plafonnés par run. Un seul run journalisé.
   */
  async fetchAndPersistWindow(
    options: Ga4WindowOptions,
  ): Promise<Ga4WindowResult> {
    const startedAt = Date.now();
    const dryRun = options.dryRun === true || options.planOnly === true;
    const result: Ga4WindowResult = {
      date: options.anchorDate,
      runId: '',
      rowsFetched: 0,
      rowsInserted: 0,
      apiCalls: 0,
      durationSeconds: 0,
      warnings: [],
      dryRun,
      dates: {
        window: null,
        refresh: [],
        backfill: [],
        deferred: [],
        ingested: [],
        empty: [],
        failed: [],
      },
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

    const params = this.resolvePlanParams(options);
    const baseExtra = {
      runtime: runtimeIdentity(),
      triggered_by: options.triggeredBy ?? null,
      anchor_date: options.anchorDate,
    };
    const runId = dryRun
      ? DRY_RUN_ID
      : await this.runsService.logStarted(this.supabase, {
          source: 'ga4',
          scope: `${property}@${options.anchorDate}`,
          extra: baseExtra,
        });
    result.runId = runId;
    const fetchedAt = new Date().toISOString();
    const rowLimit = options.rowLimit ?? 100000;
    const { dates } = result;

    try {
      const window = ingestionWindow(
        options.anchorDate,
        params.lookbackDays,
        params.floorDate,
      );
      // Présence lue seulement sur les candidats au rattrapage (hors refresh).
      const present = window
        ? await this.readPresentDates(
            window.from,
            addDaysIso(options.anchorDate, -params.rollingDays),
          )
        : new Set<string>();
      const plan = planIngestionDates({
        ...params,
        anchorDate: options.anchorDate,
        committedDates: present,
      });
      dates.window = plan.window;
      dates.refresh = plan.refresh;
      dates.backfill = plan.backfill;
      dates.deferred = plan.deferred;
      if (plan.deferred.length > 0) {
        result.warnings.push(`deferred:${plan.deferred.length}`);
      }

      if (!options.planOnly) {
        for (const date of [...plan.refresh, ...plan.backfill]) {
          try {
            const day = await this.fetchDate(
              client,
              property,
              date,
              [''],
              rowLimit,
              result.warnings,
            );
            result.apiCalls += day.apiCalls;
            result.rowsFetched += day.rows.length;
            if (day.rows.length === 0) {
              dates.empty.push(date);
              result.warnings.push(this.emptyWarning(date, day));
              continue;
            }
            result.rowsInserted += await this.upsertRows(day.rows, {
              dryRun,
              fetchedAt,
            });
            dates.ingested.push(date);
          } catch (err) {
            const errorClass = classifyIngestionError(err);
            const message = err instanceof Error ? err.message : String(err);
            dates.failed.push({ date, errorClass, message });
            result.warnings.push(`failed:${date}:${errorClass}`);
            if (isSystemicIngestionError(errorClass)) throw err;
            this.logger.warn(
              `⚠️ GA4 ${date} non ingéré (${errorClass}) — replanifié au prochain run : ${message}`,
            );
          }
        }
      }

      result.durationSeconds = (Date.now() - startedAt) / 1000;
      const extra = { ...baseExtra, dates: this.journalDates(result) };
      if (!dryRun) {
        if (dates.failed.length > 0) {
          const first = dates.failed[0];
          await this.runsService.logFailed(this.supabase, {
            runId,
            source: 'ga4',
            errorClass: first.errorClass,
            errorMessage: `${dates.failed.length} jour(s) en échec — ${first.date}: ${first.message}`,
            partialRowsInserted: result.rowsInserted,
            retryScheduled: false,
            extra,
          });
        } else {
          await this.runsService.logCompleted(this.supabase, {
            runId,
            source: 'ga4',
            rowsInserted: result.rowsInserted,
            rowsUpdated: 0,
            durationSeconds: result.durationSeconds,
            apiCalls: result.apiCalls,
            warnings: result.warnings,
            extra,
          });
        }
      }
      this.logger.log(
        `${dates.failed.length ? '⚠️' : '✅'} GA4 window ${options.anchorDate}${dryRun ? ' [dry-run]' : ''}: ` +
          `refresh=${dates.refresh.length} backfill=${dates.backfill.length} deferred=${dates.deferred.length} ` +
          `ingested=${dates.ingested.length} empty=${dates.empty.length} failed=${dates.failed.length} — ` +
          `${result.rowsInserted} rows in ${result.durationSeconds}s`,
      );
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.durationSeconds = (Date.now() - startedAt) / 1000;
      if (!dryRun) {
        await this.runsService.logFailed(this.supabase, {
          runId,
          source: 'ga4',
          errorClass: classifyIngestionError(err),
          errorMessage: message,
          partialRowsInserted: result.rowsInserted,
          retryScheduled: false,
          extra: { ...baseExtra, dates: this.journalDates(result) },
        });
      }
      this.logger.error(
        `❌ GA4 window ${options.anchorDate} failed: ${message}`,
      );
      throw err;
    }
  }

  /**
   * Lignes GA4 d'une date, paginées (`offset` jusqu'à `rowCount`), filtrées sur
   * le hostname de PROD. `warnings` reçoit le repli keyEvents→conversions.
   */
  private async fetchDate(
    client: Ga4Client,
    property: string,
    date: string,
    segments: string[],
    rowLimit: number,
    warnings: string[],
  ): Promise<{
    rows: Array<Record<string, unknown>>;
    apiCalls: number;
    emptyReason: string | null;
  }> {
    const allRows: Array<Record<string, unknown>> = [];
    let apiCalls = 0;
    let emptyReason: string | null = null;

    // GA4 moderne : la métrique `conversions` est remplacée par `keyEvents`
    // (rename Google 2024). On lit `keyEvents` et on l'écrit dans la colonne
    // `conversions` (compat — sémantique = nombre de key events). Fallback
    // gracieux + loggué vers la métrique legacy `conversions` si la propriété
    // rejette `keyEvents` (no silent fallback). NB NON-RÉTROACTIF : un event
    // marqué key event aujourd'hui n'alimente que les jours suivants.
    let keyEventsFallback = warnings.includes(
      'keyEvents_unavailable_fallback_conversions',
    );

    // Garde anti-pollution : ne compter que le trafic du hostname de PROD.
    // GA4 reçoit aussi des hits hostname=localhost (navigateurs headless E2E/
    // Lighthouse de la CI, géo datacenter) qui faussaient sessions/bounce.
    // Cf. mémoire ga4_prod_tag_not_env_gated_ci_localhost_pollution + PR #1115.
    const hostNameFilter = {
      filter: {
        fieldName: 'hostName',
        stringFilter: {
          matchType: 'EXACT' as const,
          value: SITE_HOSTNAME,
        },
      },
    };

    for (const pattern of segments) {
      // Combine le filtre hostname (toujours) avec le filtre pagePath (si segment).
      const dimensionFilter = pattern
        ? {
            andGroup: {
              expressions: [
                hostNameFilter,
                {
                  filter: {
                    fieldName: 'pagePath',
                    stringFilter: {
                      matchType: 'CONTAINS' as const,
                      value: pattern,
                    },
                  },
                },
              ],
            },
          }
        : hostNameFilter;
      const mkReq = (metric: string, offset: number) => ({
        property,
        dateRanges: [{ startDate: date, endDate: date }],
        dimensions: [
          { name: 'pagePath' },
          { name: 'sessionDefaultChannelGroup' },
        ],
        metrics: [
          { name: 'sessions' },
          { name: metric },
          { name: 'bounceRate' },
          { name: 'averageSessionDuration' },
        ],
        dimensionFilter,
        limit: rowLimit,
        ...(offset > 0 ? { offset } : {}),
      });

      let offset = 0;
      for (;;) {
        apiCalls += 1;
        let resp;
        try {
          [resp] = await client.runReport(
            mkReq(keyEventsFallback ? 'conversions' : 'keyEvents', offset),
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (
            !keyEventsFallback &&
            /keyevents|valid metric|metric/i.test(msg)
          ) {
            this.logger.warn(
              `[ga4] métrique keyEvents rejetée (${msg}) — fallback legacy conversions`,
            );
            warnings.push('keyEvents_unavailable_fallback_conversions');
            keyEventsFallback = true;
            apiCalls += 1;
            [resp] = await client.runReport(mkReq('conversions', offset));
          } else {
            throw e;
          }
        }

        const rows = resp.rows ?? [];
        for (const row of rows) {
          const dims = row.dimensionValues ?? [];
          const mets = row.metricValues ?? [];
          allRows.push({
            date,
            page: dims[0]?.value ?? '',
            channel: (dims[1]?.value ?? 'organic').toLowerCase(),
            sessions: parseInt(mets[0]?.value ?? '0', 10),
            // colonne `conversions` = nb de GA4 key events (source : metric keyEvents).
            conversions: parseInt(mets[1]?.value ?? '0', 10),
            bounce_rate: mets[2]?.value ? parseFloat(mets[2].value) : null,
            avg_session_duration: mets[3]?.value
              ? parseFloat(mets[3].value)
              : null,
          });
        }
        if (rows.length === 0) {
          emptyReason = resp.metadata?.emptyReason ?? emptyReason;
          break;
        }
        offset += rows.length;
        const rowCount = Number(resp.rowCount ?? 0);
        if (!Number.isFinite(rowCount) || offset >= rowCount) break;
      }
    }
    return { rows: allRows, apiCalls, emptyReason };
  }

  /** Upsert idempotent `(date, page, channel)`, `fetched_at` rafraîchi. */
  private async upsertRows(
    rows: Array<Record<string, unknown>>,
    ctx: { dryRun: boolean; fetchedAt: string },
  ): Promise<number> {
    if (ctx.dryRun || rows.length === 0) return 0;
    let inserted = 0;
    const batchSize = 1000;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows
        .slice(i, i + batchSize)
        .map((r) => ({ ...r, fetched_at: ctx.fetchedAt }));
      const { error } = await this.supabase
        .from('__seo_ga4_daily')
        .upsert(batch, { onConflict: 'date,page,channel' });
      if (error) {
        throw new IngestionDbError(
          '__seo_ga4_daily',
          error.code,
          error.message,
        );
      }
      inserted += batch.length;
    }
    return inserted;
  }

  /**
   * Dates de [from, to] ayant au moins une ligne (1 lecture indexée par date,
   * concurrence bornée — pas de SELECT DISTINCT via PostgREST).
   */
  private async readPresentDates(
    from: string,
    to: string,
  ): Promise<Set<string>> {
    const present = new Set<string>();
    if (from > to) return present;
    const candidates = enumerateDatesIso(from, to);
    for (let i = 0; i < candidates.length; i += PRESENCE_PROBE_CONCURRENCY) {
      const slice = candidates.slice(i, i + PRESENCE_PROBE_CONCURRENCY);
      const found = await Promise.all(
        slice.map(async (date) => {
          const { data, error } = await this.supabase
            .from('__seo_ga4_daily')
            .select('date')
            .eq('date', date)
            .limit(1);
          if (error) {
            throw new IngestionDbError(
              '__seo_ga4_daily',
              error.code,
              error.message,
            );
          }
          return (data ?? []).length > 0 ? date : null;
        }),
      );
      for (const d of found) if (d) present.add(d);
    }
    return present;
  }

  private emptyWarning(
    date: string,
    day: { emptyReason: string | null },
  ): string {
    return `ga4_empty:${date}${day.emptyReason ? `:${day.emptyReason}` : ''}`;
  }

  private resolvePlanParams(options: Ga4WindowOptions): IngestionConfig {
    const cfg = this.ingestion;
    const intOr = (v: number | undefined, fallback: number, min: number) => {
      if (v === undefined) return fallback;
      if (!Number.isInteger(v) || v < min || v > INGESTION_MAX_LOOKBACK_DAYS) {
        throw new Error(`GA4 ingestion : surcharge invalide (${v})`);
      }
      return v;
    };
    const floorDate = options.floorDate ?? cfg.floorDate;
    if (!isIsoDate(options.anchorDate) || !isIsoDate(floorDate)) {
      throw new Error(
        `GA4 ingestion : dates invalides (anchor=${options.anchorDate}, floor=${floorDate})`,
      );
    }
    if (floorDate < cfg.floorDate) {
      throw new Error(
        `GA4 ingestion : plancher ${floorDate} antérieur au plancher gouverné ${cfg.floorDate}`,
      );
    }
    const rollingDays = intOr(options.rollingDays, cfg.rollingDays, 0);
    return {
      rollingDays,
      lookbackDays: intOr(
        options.lookbackDays,
        Math.max(cfg.lookbackDays, rollingDays),
        1,
      ),
      maxBackfillPerRun: intOr(
        options.maxBackfillDays,
        cfg.maxBackfillPerRun,
        0,
      ),
      floorDate,
    };
  }

  private journalDates(result: Ga4WindowResult) {
    const d = result.dates;
    return {
      window: d.window,
      refresh: d.refresh,
      backfill: d.backfill,
      deferred_count: d.deferred.length,
      ingested: d.ingested,
      empty: d.empty,
      failed: d.failed.map((f) => ({
        date: f.date,
        error_class: f.errorClass,
      })),
    };
  }
}
