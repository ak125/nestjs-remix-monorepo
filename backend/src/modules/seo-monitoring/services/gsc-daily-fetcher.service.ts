/**
 * GSC Daily Fetcher Service — ingestion multi-niveaux (PR1) + rattrapage des trous.
 *
 * Ingère GSC Search Analytics à 5 GRAINS explicites (1 table par grain → les RPC
 * ne mélangent jamais les grains). POURQUOI : la dimension `query` déclenche
 * l'anonymisation Google → totaux ~4× sous-capturés. On ne dérive PAS un total
 * d'un grain page/query.
 *
 *   property_total  date seule                → __seo_gsc_daily_property_total  (vérité volume globale + marqueur de commit)
 *   totals          date+country+device       → __seo_gsc_daily_totals          (vérité volume segmentée)
 *   pages           date+page+country+device  → __seo_gsc_daily_pages           (détail segmenté, LOSSY)
 *   page_totals     date+page                 → __seo_gsc_daily_page_totals     (grain page FIDÈLE)
 *   queries         date+page+query+device    → __seo_gsc_daily (existant)      (détail secondaire)
 *
 * Contrat d'un jour (2026-09-11, cf. audit/seo-sept-leviers-2026-09-11.md) :
 *  - Dates planifiées par `ingestion-date-planner.ts` : fenêtre glissante toujours
 *    re-traitée + jours NON commités de la fenêtre de rattrapage (plafonnés/run).
 *    Avant : fenêtre fixe J-3..J-6 → tout arrêt > 3 jours = trou définitif.
 *  - Finalité prouvée par 1 sonde `dataState: 'all'` (`gsc-finality.ts`) : un jour
 *    non finalisé n'est JAMAIS écrit (avant : 0 ligne → `property_total = 0`).
 *  - `property_total` est upserté EN DERNIER avec `commit_version` : un jour n'est
 *    commité que si tous les grains sont persistés ; un échec en cours de jour
 *    laisse le jour non commité → replanifié au run suivant. Le marqueur d'un
 *    jour déjà commité est RETIRÉ avant la 1re écriture de grain (reprise
 *    interrompue ≠ jour certifié par l'ancienne ligne).
 *  - `dryRun` / `planOnly` : AUCUNE écriture, journal compris (avant : le journal
 *    `__seo_event_log` était écrit même en dry-run).
 *  - `fetched_at` rafraîchi à chaque upsert (avant : date du 1er insert seulement).
 *  - Contrat Zod par ligne AVANT insert ; `type: 'web'` explicite (Discover/Image
 *    = exclusion connue, hors V1) ; idempotence = upsert composite par grain.
 *
 * Fuseaux : la `date` stockée est le JOUR DE REPORTING GSC (ancré Pacific côté
 * Google) — on ne convertit pas. Ne JAMAIS comparer ce jour à un jour GA4
 * (Europe/Paris) sans alignement (cf. consommateurs).
 *
 * Réutilise GoogleCredentialsService (ENV `GSC_*` câblées dans crawl-budget-audit).
 * Refs: 20260613_seo_gsc_multilevel_grains.sql · 20260911_seo_gsc_multilevel_page_totals.sql
 *       packages/seo-types/src/observability.ts
 */
import { Injectable, Logger } from '@nestjs/common';
import { google, searchconsole_v1 } from 'googleapis';
import {
  addDaysIso,
  enumerateDatesIso,
  GSC_INGEST_COMMIT_VERSION,
  GSC_PAGE_TOTALS_MIN_RATIO_DEFAULT,
  GSCDailyPageTotalsRowSchema,
  GSCDailyPagesRowSchema,
  GSCDailyPropertyTotalRowSchema,
  GSCDailyTotalsRowSchema,
  isIsoDate,
  type GSCDailyPageTotalsRow,
  type GSCDailyPagesRow,
  type GSCDailyPropertyTotalRow,
  type GSCDailyTotalsRow,
} from '@repo/seo-types';
import { GoogleCredentialsService } from './google-credentials.service';
import {
  runtimeIdentity,
  SeoMonitoringRunsService,
} from './seo-monitoring-runs.service';
import {
  computeGlobalCoverage,
  DEFAULT_GSC_COVERAGE_MIN_RATIO,
  type GscCoverageResult,
} from './gsc-coverage';
import {
  INGESTION_MAX_LOOKBACK_DAYS,
  ingestionWindow,
  planIngestionDates,
  resolveIngestionConfig,
  type IngestionConfig,
  type IngestionPlan,
} from './ingestion-date-planner';
import {
  parseFinalityProbe,
  resolveGscDayDecision,
  type GscDayDecision,
  type GscFinalityProbe,
} from './gsc-finality';
import {
  classifyIngestionError,
  IngestionDbError,
  IngestionSchemaError,
  isSystemicIngestionError,
  type IngestionErrorClass,
} from './ingestion-error-classifier';
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

export type IngestionTrigger = 'scheduler' | 'api' | 'manual' | 'cli';

export interface GscMultiGrainOptions {
  /** Ancre = dernier jour éligible au format YYYY-MM-DD. */
  date: string;
  /** Surcharge de la fenêtre glissante (défaut : `SEO_GSC_ROLLING_DAYS`). 0 = CLI. */
  rollingDays?: number;
  /** Surcharge du lookback (défaut : `SEO_GSC_BACKFILL_LOOKBACK_DAYS`). */
  lookbackDays?: number;
  /** Surcharge du plafond de rattrapage (défaut : `SEO_GSC_BACKFILL_MAX_DAYS_PER_RUN`). */
  maxBackfillDays?: number;
  /** Plancher (jamais sous `SEO_GSC_BACKFILL_FLOOR_DATE`). */
  floorDate?: string;
  rowLimit?: number;
  /** Lit GSC mais n'écrit RIEN (ni données ni journal). */
  dryRun?: boolean;
  /** Plan seul : 1 lecture DB + 1 sonde API de finalité, 0 écriture. */
  planOnly?: boolean;
  triggeredBy?: IngestionTrigger;
}

export type GscGrain =
  | 'property_total'
  | 'totals'
  | 'pages'
  | 'page_totals'
  | 'queries';

export interface GscGrainResult {
  grain: GscGrain;
  rowsFetched: number;
  rowsInserted: number;
  schemaRejects: number;
}

export interface GscDateFailure {
  date: string;
  errorClass: IngestionErrorClass;
  message: string;
}

/** Compte-rendu par date d'un run multi-grain (journalisé, sans secret). */
export interface GscIngestionDatesReport {
  window: IngestionPlan['window'];
  refresh: string[];
  backfill: string[];
  deferred: string[];
  /** Décision de finalité par date planifiée. */
  decisions: Record<string, GscDayDecision['kind']>;
  /** Tous grains lus (+ écrits hors dry-run) et marqueur posé. */
  ingested: string[];
  /** Jour finalisé sans aucune donnée → zéro explicite commité. */
  realZero: string[];
  notFinal: string[];
  /** Finalité non prouvée (métadonnée absente ou requête finale vide). */
  finalityUnknown: string[];
  failed: GscDateFailure[];
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
  /** Couverture du grain page FIDÈLE par jour ingéré (observabilité). */
  coverage?: GscCoverageResult[];
  /** Couverture du grain segmenté lossy (information, n'émet pas d'alerte). */
  segmentedCoverage?: GscCoverageResult[];
  /** Compte-rendu par date (runs multi-grain). */
  dates?: GscIngestionDatesReport;
  dryRun?: boolean;
}

// Discover/Image NON capturés (exclusion connue, hors V1) — `type` explicite.
const SEARCH_TYPE_WEB = 'web';
/** Identifiant de run d'une exécution sans écriture (aucun journal émis). */
export const DRY_RUN_ID = 'dry-run';
/** Plafond supabase-js : une lecture qui l'atteint est tronquée. */
const SUPABASE_ROW_CAP = 1000;

type GscDimension = 'page' | 'query' | 'device' | 'country' | 'date';

interface DayOutcome {
  status: 'ingested' | 'final_rows_missing';
  grains: GscGrainResult[];
  coverage: GscCoverageResult | null;
  segmentedCoverage: GscCoverageResult | null;
  apiCalls: number;
  schemaRejects: number;
}

@Injectable()
export class GscDailyFetcherService {
  private readonly logger = new Logger(GscDailyFetcherService.name);
  private readonly supabase: SupabaseClient;
  private readonly coverageMinRatio: number;
  private readonly pageTotalsMinRatio: number;
  private readonly ingestion: IngestionConfig;

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
    // Params gouvernés (pas de magic constant) — env override + défauts documentés.
    this.coverageMinRatio = this.readRatio(
      configService,
      'SEO_GSC_COVERAGE_MIN_RATIO',
      DEFAULT_GSC_COVERAGE_MIN_RATIO,
    );
    this.pageTotalsMinRatio = this.readRatio(
      configService,
      'SEO_GSC_PAGE_TOTALS_MIN_RATIO',
      GSC_PAGE_TOTALS_MIN_RATIO_DEFAULT,
    );
    const { config, invalidKeys } = resolveIngestionConfig('gsc', (k) =>
      configService.get<string>(k),
    );
    if (invalidKeys.length > 0) {
      this.logger.warn(
        `⚠️ GSC ingestion : variables invalides ${invalidKeys.join(', ')} — défauts documentés appliqués`,
      );
    }
    this.ingestion = config;
  }

  /** Configuration gouvernée résolue (lecture seule — CLI/diagnostic). */
  get ingestionConfig(): Readonly<IngestionConfig> {
    return this.ingestion;
  }

  /**
   * Point d'entrée du job daily et du rattrapage CLI : planifie les dates
   * (refresh + trous), prouve la finalité, ingère chaque jour aux 5 grains et
   * pose le marqueur de commit en dernier. Un seul run journalisé.
   */
  async fetchAndPersistMultiGrain(
    options: GscMultiGrainOptions,
  ): Promise<GscFetchResult> {
    const startedAt = Date.now();
    const dryRun = options.dryRun === true || options.planOnly === true;
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
      segmentedCoverage: [],
      dryRun,
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

    const plan = this.resolvePlanParams(options);
    const siteUrl = this.credentials.getGSCSiteUrl();
    const rowLimit = options.rowLimit ?? 5000;
    const baseExtra = {
      runtime: runtimeIdentity(),
      triggered_by: options.triggeredBy ?? null,
      anchor_date: options.date,
    };
    const runId = dryRun
      ? DRY_RUN_ID
      : await this.runsService.logStarted(this.supabase, {
          source: 'gsc',
          scope: `${siteUrl}@${options.date}`,
          extra: baseExtra,
        });
    result.runId = runId;
    const sc = google.searchconsole({ version: 'v1', auth });
    const fetchedAt = new Date().toISOString();

    const report: GscIngestionDatesReport = {
      window: null,
      refresh: [],
      backfill: [],
      deferred: [],
      decisions: {},
      ingested: [],
      realZero: [],
      notFinal: [],
      finalityUnknown: [],
      failed: [],
    };
    result.dates = report;

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
      const window = ingestionWindow(
        options.date,
        plan.lookbackDays,
        plan.floorDate,
      );
      const committed = window
        ? await this.readCommittedDates(window.from, window.to)
        : new Set<string>();
      const datesPlan = planIngestionDates({
        ...plan,
        anchorDate: options.date,
        committedDates: committed,
      });
      report.window = datesPlan.window;
      report.refresh = datesPlan.refresh;
      report.backfill = datesPlan.backfill;
      report.deferred = datesPlan.deferred;
      if (datesPlan.deferred.length > 0) {
        result.warnings.push(`deferred:${datesPlan.deferred.length}`);
      }

      const planned = [...datesPlan.refresh, ...datesPlan.backfill];
      if (planned.length > 0) {
        const probe = await this.probeFinality(sc, siteUrl, planned);
        result.apiCalls += 1;
        for (const d of planned) {
          report.decisions[d] = resolveGscDayDecision(d, probe).kind;
        }

        if (!options.planOnly) {
          for (const date of planned) {
            await this.processDate(sc, siteUrl, date, rowLimit, probe, {
              dryRun,
              fetchedAt,
              result,
              report,
              accGrain,
            });
          }
        }
      }

      result.perGrain = Object.values(grainTotals);
      result.durationSeconds = (Date.now() - startedAt) / 1000;
      const datesExtra = { ...baseExtra, dates: this.journalDates(report) };

      if (!dryRun) {
        if (report.failed.length > 0) {
          const first = report.failed[0];
          await this.runsService.logFailed(this.supabase, {
            runId,
            source: 'gsc',
            errorClass: first.errorClass,
            errorMessage: `${report.failed.length} jour(s) en échec — ${first.date}: ${first.message}`,
            partialRowsInserted: result.rowsInserted,
            // Pas de retry immédiat : les jours non commités sont replanifiés
            // par le run suivant (fenêtre de rattrapage).
            retryScheduled: false,
            extra: datesExtra,
          });
        } else {
          await this.runsService.logCompleted(this.supabase, {
            runId,
            source: 'gsc',
            rowsInserted: result.rowsInserted,
            rowsUpdated: 0,
            durationSeconds: result.durationSeconds,
            apiCalls: result.apiCalls,
            warnings: result.warnings,
            extra: datesExtra,
          });
        }
      }
      this.logger.log(
        `${report.failed.length ? '⚠️' : '✅'} GSC multi-grain ${options.date}${dryRun ? ' [dry-run]' : ''}: ` +
          `refresh=${report.refresh.length} backfill=${report.backfill.length} deferred=${report.deferred.length} ` +
          `ingested=${report.ingested.length} real_zero=${report.realZero.length} not_final=${report.notFinal.length} ` +
          `finality_unknown=${report.finalityUnknown.length} failed=${report.failed.length} — ` +
          `${result.rowsInserted} rows, ${result.apiCalls} calls in ${result.durationSeconds}s`,
      );
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const errorClass = classifyIngestionError(err);
      result.durationSeconds = (Date.now() - startedAt) / 1000;
      if (!dryRun) {
        await this.runsService.logFailed(this.supabase, {
          runId,
          source: 'gsc',
          errorClass,
          errorMessage: message,
          partialRowsInserted: result.rowsInserted,
          retryScheduled: false,
          extra: { ...baseExtra, dates: this.journalDates(report) },
        });
      }
      this.logger.error(
        `❌ GSC multi-grain ${options.date} failed (${errorClass}): ${message}`,
      );
      throw err;
    }
  }

  /** Traite une date planifiée selon sa décision de finalité. */
  private async processDate(
    sc: searchconsole_v1.Searchconsole,
    siteUrl: string,
    date: string,
    rowLimit: number,
    probe: GscFinalityProbe,
    ctx: {
      dryRun: boolean;
      fetchedAt: string;
      result: GscFetchResult;
      report: GscIngestionDatesReport;
      accGrain: (g: GscGrainResult) => void;
    },
  ): Promise<void> {
    const { result, report } = ctx;
    const decision = resolveGscDayDecision(date, probe);
    if (decision.kind === 'skip_not_final') {
      report.notFinal.push(date);
      result.warnings.push(`not_final:${date}`);
      return;
    }
    if (decision.kind === 'skip_finality_unknown') {
      report.finalityUnknown.push(date);
      result.warnings.push(`finality_unknown:${date}`);
      return;
    }

    try {
      if (decision.kind === 'real_zero') {
        // Jour finalisé sans aucune impression : zéro EXPLICITE et commité.
        const inserted = await this.upsert(
          '__seo_gsc_daily_property_total',
          [
            {
              date,
              clicks: 0,
              impressions: 0,
              ctr: 0,
              position: 0,
              commit_version: GSC_INGEST_COMMIT_VERSION,
            },
          ],
          'date',
          ctx,
        );
        result.rowsInserted += inserted;
        report.realZero.push(date);
        result.warnings.push(`real_zero:${date}`);
        return;
      }

      const day = await this.fetchDay(sc, siteUrl, date, rowLimit, ctx);
      result.apiCalls += day.apiCalls;
      result.rowsFetched += day.grains.reduce((s, g) => s + g.rowsFetched, 0);
      result.rowsInserted += day.grains.reduce((s, g) => s + g.rowsInserted, 0);
      day.grains.forEach(ctx.accGrain);
      if (day.schemaRejects > 0) {
        result.warnings.push(`schema_rejects:${date}=${day.schemaRejects}`);
      }
      if (day.status === 'final_rows_missing') {
        // Données annoncées par la sonde mais requête finale vide : finalité
        // non prouvée → rien écrit, jour replanifié.
        report.finalityUnknown.push(date);
        result.warnings.push(`final_rows_missing:${date}`);
        return;
      }
      report.ingested.push(date);
      if (day.coverage) {
        result.coverage!.push(day.coverage);
        if (day.coverage.status !== 'ok') {
          // No silent fallback : un gap de couverture du grain fidèle est observable.
          this.logger.warn(
            `⚠️ GSC coverage ${date}: ${day.coverage.status} (page_totals/total clics=${day.coverage.pagesVsPropertyClicks ?? 'n/a'}, impr=${day.coverage.pagesVsPropertyImpr ?? 'n/a'}, min=${day.coverage.minRatio})`,
          );
          result.warnings.push(`coverage_${day.coverage.status}:${date}`);
        }
      }
      if (day.segmentedCoverage) {
        result.segmentedCoverage!.push(day.segmentedCoverage);
      }
    } catch (err) {
      const errorClass = classifyIngestionError(err);
      const message = err instanceof Error ? err.message : String(err);
      report.failed.push({ date, errorClass, message });
      result.warnings.push(`failed:${date}:${errorClass}`);
      if (isSystemicIngestionError(errorClass)) {
        // Quota/auth/schéma : les jours suivants échoueraient pareil → arrêt.
        throw err;
      }
      this.logger.warn(
        `⚠️ GSC ${date} non commité (${errorClass}) — replanifié au prochain run : ${message}`,
      );
    }
  }

  /** Un jour : les 5 grains, couverture, puis marqueur de commit en dernier. */
  private async fetchDay(
    sc: searchconsole_v1.Searchconsole,
    siteUrl: string,
    date: string,
    rowLimit: number,
    ctx: { dryRun: boolean; fetchedAt: string },
  ): Promise<DayOutcome> {
    let apiCalls = 0;
    let schemaRejects = 0;
    const grains: GscGrainResult[] = [];

    // 1) property_total (aucune dimension → 1 ligne agrégée), requête `final`.
    //    Lu d'abord (couverture), écrit en DERNIER (marqueur de commit).
    const ptRaw = await this.query(sc, siteUrl, date, [], rowLimit);
    apiCalls += ptRaw.apiCalls;
    const ptRow = ptRaw.rows[0];
    if (!ptRow) {
      return {
        status: 'final_rows_missing',
        grains,
        coverage: null,
        segmentedCoverage: null,
        apiCalls,
        schemaRejects,
      };
    }
    const ptParsed = GSCDailyPropertyTotalRowSchema.safeParse({
      date,
      clicks: ptRow.clicks ?? 0,
      impressions: ptRow.impressions ?? 0,
      ctr: ptRow.ctr ?? 0,
      position: ptRow.position ?? 0,
    });
    if (!ptParsed.success) {
      throw new IngestionSchemaError(
        `property_total ${date} hors contrat : ${ptParsed.error.message}`,
      );
    }
    const propertyTotal: GSCDailyPropertyTotalRow = ptParsed.data;

    // Avant la 1re écriture de grain : une reprise interrompue ne doit pas rester
    // certifiée par la ligne property_total d'un run antérieur.
    await this.uncommitDay(date, ctx);

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
        ctx,
      ),
      schemaRejects: tRaw.rows.length - totalsRows.length,
    });

    // 3) pages (date+page+country+device) — détail segmenté, LOSSY
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
        ctx,
      ),
      schemaRejects: pRaw.rows.length - pageRows.length,
    });

    // 4) page_totals (date+page, agrégation byPage) — grain page FIDÈLE
    const ptPagesRaw = await this.query(sc, siteUrl, date, ['page'], rowLimit, {
      aggregationType: 'byPage',
    });
    apiCalls += ptPagesRaw.apiCalls;
    const pageTotalRows: GSCDailyPageTotalsRow[] = [];
    for (const r of ptPagesRaw.rows) {
      const parsed = GSCDailyPageTotalsRowSchema.safeParse({
        date,
        page: r.keys?.[0] ?? '',
        clicks: r.clicks ?? 0,
        impressions: r.impressions ?? 0,
        ctr: r.ctr ?? 0,
        position: r.position ?? 0,
      });
      if (parsed.success) pageTotalRows.push(parsed.data);
      else schemaRejects += 1;
    }
    grains.push({
      grain: 'page_totals',
      rowsFetched: ptPagesRaw.rows.length,
      rowsInserted: await this.upsert(
        '__seo_gsc_daily_page_totals',
        pageTotalRows,
        'date,page',
        ctx,
      ),
      schemaRejects: ptPagesRaw.rows.length - pageTotalRows.length,
    });

    // 5) queries (legacy, détail secondaire)
    const q = await this.fetchQueryGrainRows(sc, siteUrl, date, rowLimit);
    apiCalls += q.apiCalls;
    grains.push({
      grain: 'queries',
      rowsFetched: q.rows.length,
      rowsInserted: await this.upsert(
        '__seo_gsc_daily',
        q.rows,
        'date,page,query,device',
        ctx,
      ),
      schemaRejects: 0,
    });

    // Couvertures GLOBALES (pures) : grain fidèle (alerte) + segmenté (info).
    const coverage = computeGlobalCoverage(
      date,
      propertyTotal,
      pageTotalRows,
      this.pageTotalsMinRatio,
      'page_totals',
    );
    const segmentedCoverage = computeGlobalCoverage(
      date,
      propertyTotal,
      pageRows,
      this.coverageMinRatio,
      'segmented_pages',
    );

    // 6) property_total EN DERNIER + marqueur : le jour n'est commité que si
    //    tous les grains précédents ont été persistés sans erreur.
    grains.push({
      grain: 'property_total',
      rowsFetched: ptRaw.rows.length,
      rowsInserted: await this.upsert(
        '__seo_gsc_daily_property_total',
        [{ ...propertyTotal, commit_version: GSC_INGEST_COMMIT_VERSION }],
        'date',
        ctx,
      ),
      schemaRejects: 0,
    });

    return {
      status: 'ingested',
      grains,
      coverage,
      segmentedCoverage,
      apiCalls,
      schemaRejects,
    };
  }

  /**
   * Retire le marqueur de commit d'un jour avant de réécrire ses grains. Sans
   * cela, une panne en cours de réécriture laisse des grains partiellement
   * remplacés sous le marqueur du run précédent, que les lecteurs certifiants
   * (rpc_seo_low_ctr_v4, rattrapage) prennent pour un jour complet. Aucune ligne
   * pour ce jour = no-op ; dry-run = aucune écriture ; échec → aucun grain écrit.
   */
  private async uncommitDay(
    date: string,
    ctx: { dryRun: boolean },
  ): Promise<void> {
    if (ctx.dryRun) return;
    const { error } = await this.supabase
      .from('__seo_gsc_daily_property_total')
      .update({ commit_version: null })
      .eq('date', date);
    if (error) {
      throw new IngestionDbError(
        '__seo_gsc_daily_property_total',
        error.code,
        error.message,
      );
    }
  }

  /**
   * Jours déjà commités (marqueur ≥ contrat courant) dans [from, to].
   * Première lecture DB du run : sert aussi de contrôle de schéma (colonne
   * `commit_version` absente = migration non appliquée → `schema_drift`, 0 écriture).
   */
  private async readCommittedDates(
    from: string,
    to: string,
  ): Promise<Set<string>> {
    const { data, error } = await this.supabase
      .from('__seo_gsc_daily_property_total')
      .select('date')
      .gte('date', from)
      .lte('date', to)
      .gte('commit_version', GSC_INGEST_COMMIT_VERSION);
    if (error) {
      throw new IngestionDbError(
        '__seo_gsc_daily_property_total',
        error.code,
        error.message,
      );
    }
    const rows = (data ?? []) as Array<{ date: string }>;
    if (rows.length >= SUPABASE_ROW_CAP) {
      throw new Error(
        `readCommittedDates: ${rows.length} lignes ≥ plafond supabase-js (${SUPABASE_ROW_CAP}) — fenêtre trop large`,
      );
    }
    return new Set(rows.map((r) => r.date));
  }

  /** Sonde de finalité : 1 appel `dataState: 'all'` groupé par date. */
  private async probeFinality(
    sc: searchconsole_v1.Searchconsole,
    siteUrl: string,
    planned: string[],
  ): Promise<GscFinalityProbe> {
    const startDate = planned.reduce((min, d) => (d < min ? d : min));
    // Veille UTC : toujours ≤ « aujourd'hui » Pacific → jour incomplet côté GSC,
    // condition pour que l'API renseigne `metadata.firstIncompleteDate`.
    const endDate = addDaysIso(new Date().toISOString().slice(0, 10), -1);
    const span =
      startDate <= endDate ? enumerateDatesIso(startDate, endDate).length : 1;
    const resp = await sc.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: startDate <= endDate ? startDate : endDate,
        endDate,
        type: SEARCH_TYPE_WEB,
        dimensions: ['date'],
        dataState: 'all',
        rowLimit: Math.min(25000, Math.max(1, span)),
      },
    });
    return parseFinalityProbe(resp.data, endDate);
  }

  /** Une requête GSC paginée pour un grain donné (dimensions). `type: 'web'`. */
  private async query(
    sc: searchconsole_v1.Searchconsole,
    siteUrl: string,
    date: string,
    dimensions: GscDimension[],
    rowLimit: number,
    extra: { aggregationType?: 'byPage' | 'byProperty' } = {},
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
          ...(extra.aggregationType
            ? { aggregationType: extra.aggregationType }
            : {}),
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

  /**
   * Upsert idempotent par grain, `fetched_at` rafraîchi (1 horodatage par run).
   * Retourne le nombre de lignes upsertées ; 0 et aucune écriture en dry-run.
   */
  private async upsert(
    table: string,
    rows: Array<Record<string, unknown>>,
    onConflict: string,
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
        .from(table)
        .upsert(batch, { onConflict, ignoreDuplicates: false });
      if (error) throw new IngestionDbError(table, error.code, error.message);
      inserted += batch.length;
    }
    return inserted;
  }

  /** Lignes du grain `queries` (page+query+device par défaut), paginées. */
  private async fetchQueryGrainRows(
    sc: searchconsole_v1.Searchconsole,
    siteUrl: string,
    date: string,
    rowLimit: number,
    dimensions: GscDimension[] = ['page', 'query', 'device'],
    prefixes: string[] = [''],
  ): Promise<{ rows: Array<Record<string, unknown>>; apiCalls: number }> {
    const out: Array<Record<string, unknown>> = [];
    let apiCalls = 0;
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
        apiCalls += 1;
        const resp = await sc.searchanalytics.query({
          siteUrl,
          requestBody: {
            startDate: date,
            endDate: date,
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
          out.push({
            date,
            page: dims[dimensions.indexOf('page')] ?? '',
            query: dims[dimensions.indexOf('query')] ?? '',
            device: (dims[dimensions.indexOf('device')] ?? 'all').toLowerCase(),
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
    return { rows: out, apiCalls };
  }

  /**
   * Grain `queries` (legacy, détail secondaire) — back-compat conservée
   * (déclenchement admin `POST run/gsc`). N'est PAS la source des totaux et ne
   * pose aucun marqueur de commit.
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
    const sc = google.searchconsole({ version: 'v1', auth });
    try {
      const q = await this.fetchQueryGrainRows(
        sc,
        siteUrl,
        options.date,
        options.rowLimit ?? 5000,
        options.dimensions ?? ['page', 'query', 'device'],
        options.pagePrefixes ?? [''],
      );
      result.apiCalls = q.apiCalls;
      result.rowsFetched = q.rows.length;
      result.rowsInserted = await this.upsert(
        '__seo_gsc_daily',
        q.rows,
        'date,page,query,device',
        {
          dryRun: options.dryRun === true,
          fetchedAt: new Date().toISOString(),
        },
      );
      result.durationSeconds = (Date.now() - startedAt) / 1000;
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.durationSeconds = (Date.now() - startedAt) / 1000;
      this.logger.error(`❌ GSC queries-grain ${options.date}: ${message}`);
      throw err;
    }
  }

  /** Paramètres de planification : config gouvernée + surcharges bornées. */
  private resolvePlanParams(options: GscMultiGrainOptions): IngestionConfig {
    const cfg = this.ingestion;
    const intOr = (v: number | undefined, fallback: number, min: number) => {
      if (v === undefined) return fallback;
      if (!Number.isInteger(v) || v < min || v > INGESTION_MAX_LOOKBACK_DAYS) {
        throw new Error(`GSC ingestion : surcharge invalide (${v})`);
      }
      return v;
    };
    const floorDate = options.floorDate ?? cfg.floorDate;
    if (!isIsoDate(options.date) || !isIsoDate(floorDate)) {
      throw new Error(
        `GSC ingestion : dates invalides (anchor=${options.date}, floor=${floorDate})`,
      );
    }
    if (floorDate < cfg.floorDate) {
      throw new Error(
        `GSC ingestion : plancher ${floorDate} antérieur au plancher gouverné ${cfg.floorDate}`,
      );
    }
    const rollingDays = intOr(options.rollingDays, cfg.rollingDays, 0);
    const lookbackDays = intOr(
      options.lookbackDays,
      Math.max(cfg.lookbackDays, rollingDays),
      1,
    );
    return {
      rollingDays,
      lookbackDays,
      maxBackfillPerRun: intOr(
        options.maxBackfillDays,
        cfg.maxBackfillPerRun,
        0,
      ),
      floorDate,
    };
  }

  /** Vue bornée du compte-rendu pour le journal (listes ≤ lookback). */
  private journalDates(report: GscIngestionDatesReport) {
    return {
      window: report.window,
      refresh: report.refresh,
      backfill: report.backfill,
      deferred_count: report.deferred.length,
      ingested: report.ingested,
      real_zero: report.realZero,
      not_final: report.notFinal,
      finality_unknown: report.finalityUnknown,
      failed: report.failed.map((f) => ({
        date: f.date,
        error_class: f.errorClass,
      })),
    };
  }

  private readRatio(
    configService: ConfigService,
    key: string,
    fallback: number,
  ): number {
    const raw = configService.get<string>(key);
    if (raw == null || String(raw).trim() === '') return fallback;
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0 && n <= 1) return n;
    this.logger.warn(
      `⚠️ ${key}=${raw} invalide (attendu ]0,1]) — défaut ${fallback} appliqué`,
    );
    return fallback;
  }
}
