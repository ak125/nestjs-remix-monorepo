/**
 * SEO Monitoring Controller — endpoints admin
 *
 * Expose :
 *  GET  /api/admin/seo-monitoring/credentials/health  — check SA credentials
 *  GET  /api/admin/seo-monitoring/timeseries/gsc      — GSC clicks/impressions/ctr/position
 *  GET  /api/admin/seo-monitoring/timeseries/ga4      — GA4 sessions/conversions/bounce
 *  GET  /api/admin/seo-monitoring/timeseries/cwv      — CWV LCP/CLS/INP par page
 *  GET  /api/admin/seo-monitoring/runs                — historique runs (event log)
 *  POST /api/admin/seo-monitoring/run/gsc             — trigger manuel GSC fetch (debug)
 *  POST /api/admin/seo-monitoring/run/ga4             — trigger manuel GA4 fetch (debug)
 *
 * Auth : AuthenticatedGuard + IsAdminGuard au niveau classe (même motif que
 * QualityHistoryController). Avant 2026-09-11 le contrôleur n'avait AUCUN guard :
 * GET credentials/health répondait 200 sans session en PROD (vérifié) et les
 * POST run/* / audit/r-content/run étaient exposés de la même façon.
 */
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { getEffectiveSupabaseKey } from '@common/utils';
import { computeDayCoverage, isIsoDate } from '@repo/seo-types';
import { GoogleCredentialsService } from '../services/google-credentials.service';
import { GscDailyFetcherService } from '../services/gsc-daily-fetcher.service';
import { Ga4DailyFetcherService } from '../services/ga4-daily-fetcher.service';
import {
  AuditFindingsService,
  type AuditType,
} from '../services/audit-findings.service';
import { RContentAuditorService } from '../services/r-content-auditor.service';
import { SeoMonitoringRunsService } from '../services/seo-monitoring-runs.service';
import { RagMirrorFreshnessService } from '../services/rag-mirror-freshness.service';

@Controller('api/admin/seo-monitoring')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class SeoMonitoringController {
  private readonly logger = new Logger(SeoMonitoringController.name);
  private readonly supabase: SupabaseClient;
  /** Premier jour GSC attendu (même paramètre gouverné que le planificateur d'ingestion). */
  private readonly gscExpectedFrom: string;

  constructor(
    private readonly credentials: GoogleCredentialsService,
    private readonly gscFetcher: GscDailyFetcherService,
    private readonly ga4Fetcher: Ga4DailyFetcherService,
    private readonly auditFindings: AuditFindingsService,
    private readonly rContentAuditor: RContentAuditorService,
    private readonly runsService: SeoMonitoringRunsService,
    private readonly ragMirrorFreshness: RagMirrorFreshnessService,
    configService: ConfigService,
  ) {
    const url = configService.get<string>('SUPABASE_URL') || '';
    // ADR-028 Option D — fallback to ANON_KEY in read-only mode (RLS protects writes)
    const key = getEffectiveSupabaseKey();
    if (!url || !key) {
      this.logger.warn(
        'SeoMonitoringController: Supabase env missing — service will fail on first call',
      );
    }
    this.supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    // Source unique du plancher résolu (env validé + défaut) : le planificateur.
    this.gscExpectedFrom = this.gscFetcher.ingestionConfig.floorDate;
  }

  @Get('credentials/health')
  health() {
    return {
      monitoring_enabled: this.credentials.isMonitoringEnabled(),
      readiness: this.credentials.checkReadiness(),
      gsc_site_url: this.credentials.getGSCSiteUrl(),
      ga4_property: this.credentials.getGA4PropertyName(),
    };
  }

  /**
   * V0.A — GET /cron/health
   *
   * Last successful + last failed run par source d'ingestion + état du
   * mirror RAG (PR-E.2 — ADR-046 § Layer L3 RAG MIRROR read-only).
   * Source : `__seo_event_log` (event_type ENUM + payload JSONB) + manifest
   * `rag/knowledge/.last-sync.json` (cron sync-wiki-exports-to-rag.py).
   * Utilisé pour monitoring externe (Slack alerting / dashboard / readiness probe).
   */
  @Get('cron/health')
  async cronHealth() {
    const runs = await this.runsService.getRunsHealth(this.supabase);
    const now = Date.now();
    const staleThresholdHours = 36; // J-3 par défaut + tolérance 12h

    const sources = runs.map((r) => {
      const lastSuccessAgeHours = r.lastSuccessAt
        ? Math.round((now - new Date(r.lastSuccessAt).getTime()) / 3_600_000)
        : null;
      const isStale =
        lastSuccessAgeHours === null ||
        lastSuccessAgeHours > staleThresholdHours;
      return {
        ...r,
        lastSuccessAgeHours,
        status: isStale ? 'stale' : 'healthy',
      };
    });

    // PR-E.2 — fraîcheur du mirror L3 RAG (ADR-046)
    const ragMirror = await this.ragMirrorFreshness.checkFreshness();

    const sourcesHealthy = sources.every((s) => s.status === 'healthy');
    const ragMirrorHealthy = ragMirror.status === 'healthy';
    const overall = sourcesHealthy && ragMirrorHealthy ? 'healthy' : 'stale';

    return {
      overall,
      monitoring_enabled: this.credentials.isMonitoringEnabled(),
      checked_at: new Date().toISOString(),
      stale_threshold_hours: staleThresholdHours,
      sources,
      rag_mirror: ragMirror,
    };
  }

  /**
   * GET /timeseries/gsc?from=YYYY-MM-DD&to=YYYY-MM-DD&page=&group_by=&top=
   *
   * - `totals` + `daily` : `__seo_gsc_daily_property_total` (1 ligne/jour, total
   *   propriété sans dimension). Un jour absent reste ABSENT (listé dans
   *   `coverage.missing_dates`), jamais compté comme zéro. Chaque point porte
   *   `confirmed` (marqueur de commit posé) : un zéro confirmé est un vrai zéro ;
   *   une ligne sans marqueur (ancien ingesteur, qui l'écrivait en premier et à
   *   zéro si GSC ne renvoyait rien, ou réécriture interrompue) est listée dans
   *   `coverage.unconfirmed_dates` et interdit `complete`.
   * - `coverage` : jours attendus = [max(from, plancher d'ingestion) ..
   *   min(to, dernier jour présent)] ; le retard de finalisation GSC en queue de
   *   fenêtre est porté par `last_data_date`, pas compté manquant.
   * - Erreur de lecture (dont schéma sans `commit_version`) → `{ error }`, aucune
   *   couverture affirmée.
   * - `rows` : échantillon du grain requêtes (`__seo_gsc_daily`), ordre non
   *   garanti, borné par `top` — NON EXHAUSTIF (`rows_scope`).
   *
   * Défaut corrigé 2026-09-11 : les totaux et la courbe sommaient ≤ `top` lignes
   * arbitraires du grain requêtes (lui-même ~7 % des clics) → KPI faux.
   * `page` filtre uniquement l'échantillon `rows` (le total propriété n'a pas de page).
   */
  @Get('timeseries/gsc')
  async timeseriesGsc(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('group_by') groupBy: 'date' | 'page' | 'query' | 'device' = 'date',
    @Query('top') top?: string,
  ) {
    const dateTo = to ?? new Date().toISOString().slice(0, 10);
    const dateFrom =
      from ?? new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
    if (!isIsoDate(dateFrom) || !isIsoDate(dateTo) || dateFrom > dateTo) {
      throw new BadRequestException(
        `from/to : dates ISO YYYY-MM-DD attendues avec from <= to (reçu ${dateFrom} → ${dateTo})`,
      );
    }
    const parsedTop = Number.parseInt(top ?? '500', 10);
    const limit = Number.isFinite(parsedTop)
      ? Math.min(Math.max(parsedTop, 1), 5000)
      : 500;

    const totalsRes = await this.supabase
      .from('__seo_gsc_daily_property_total')
      .select('date, clicks, impressions, ctr, position, commit_version')
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .order('date', { ascending: true })
      // 1 ligne/jour : 1000 = ~2,7 ans, au-delà de la rétention GSC (16 mois).
      .limit(1000);
    if (totalsRes.error) {
      return { error: totalsRes.error.message, rows: [] };
    }

    let query = this.supabase
      .from('__seo_gsc_daily')
      .select('date, page, query, device, clicks, impressions, ctr, position')
      .gte('date', dateFrom)
      .lte('date', dateTo);

    if (page) query = query.ilike('page', `%${page}%`);

    const { data, error } = await query.limit(limit);
    if (error) {
      return { error: error.message, rows: [] };
    }
    const rows = data ?? [];

    const daily = (totalsRes.data ?? []).map((d) => ({
      date: String(d.date),
      clicks: Number(d.clicks) || 0,
      impressions: Number(d.impressions) || 0,
      ctr: Number(d.ctr) || 0,
      position: Number(d.position) || 0,
      confirmed: d.commit_version !== null && d.commit_version !== undefined,
    }));
    const totals = daily.reduce(
      (acc, d) => {
        acc.clicks += d.clicks;
        acc.impressions += d.impressions;
        acc.position_sum += d.position * d.impressions;
        return acc;
      },
      { clicks: 0, impressions: 0, position_sum: 0 },
    );
    const lastDataDate = daily.length ? daily[daily.length - 1].date : null;
    const expectedFrom =
      dateFrom > this.gscExpectedFrom ? dateFrom : this.gscExpectedFrom;
    const expectedTo =
      lastDataDate && lastDataDate < dateTo ? lastDataDate : dateTo;
    const days =
      lastDataDate && expectedFrom <= expectedTo
        ? computeDayCoverage({
            from: expectedFrom,
            to: expectedTo,
            presentDates: daily.map((d) => d.date),
            confirmedDates: daily.filter((d) => d.confirmed).map((d) => d.date),
          })
        : null;

    return {
      from: dateFrom,
      to: dateTo,
      group_by: groupBy,
      rows,
      rows_scope: {
        grain: 'query' as const,
        exhaustive: false,
        limit,
        returned: rows.length,
        truncated: rows.length >= limit,
      },
      daily,
      totals: {
        clicks: totals.clicks,
        impressions: totals.impressions,
        ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
        avg_position:
          totals.impressions > 0 ? totals.position_sum / totals.impressions : 0,
      },
      coverage: {
        grain: 'property_total' as const,
        last_data_date: lastDataDate,
        expected_from: days?.from ?? null,
        expected_to: days?.to ?? null,
        days_expected: days?.daysExpected ?? 0,
        days_present: days?.daysPresent ?? 0,
        days_confirmed: days?.daysConfirmed ?? 0,
        missing_dates: days?.missingDates ?? [],
        unconfirmed_dates: days?.unconfirmedDates ?? [],
        // aucune donnée → pas « complet » (rien n'est affirmé)
        complete: days?.complete ?? false,
      },
    };
  }

  @Get('timeseries/ga4')
  async timeseriesGa4(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
  ) {
    const dateTo = to ?? new Date().toISOString().slice(0, 10);
    const dateFrom =
      from ?? new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);

    let query = this.supabase
      .from('__seo_ga4_daily')
      .select(
        'date, page, channel, sessions, conversions, bounce_rate, avg_session_duration',
      )
      .gte('date', dateFrom)
      .lte('date', dateTo);

    if (page) query = query.ilike('page', `%${page}%`);

    const { data, error } = await query.limit(5000);
    if (error) return { error: error.message, rows: [] };

    const rows = data ?? [];
    const totals = rows.reduce(
      (acc, r) => {
        acc.sessions += r.sessions ?? 0;
        acc.conversions += r.conversions ?? 0;
        return acc;
      },
      { sessions: 0, conversions: 0 },
    );

    return { from: dateFrom, to: dateTo, rows, totals };
  }

  @Get('timeseries/cwv')
  async timeseriesCwv(
    @Query('page') page?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const dateTo = to ?? new Date().toISOString().slice(0, 10);
    const dateFrom =
      from ?? new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);

    let query = this.supabase
      .from('__seo_cwv_daily')
      .select('date, page, lcp, cls, inp, ttfb')
      .gte('date', dateFrom)
      .lte('date', dateTo);

    if (page) query = query.eq('page', page);

    const { data, error } = await query.limit(2000);
    if (error) return { error: error.message, rows: [] };

    return { from: dateFrom, to: dateTo, rows: data ?? [] };
  }

  /**
   * Read CrUX field history (ADR-063).
   * Returns weekly p75 LCP/INP/CLS/TTFB/FCP rows from `__seo_crux_field_history`.
   *
   * Query params (mutually exclusive origin XOR url) :
   *  - days       : lookback window in days (default 180)
   *  - origin     : origin URL (default https://www.automecanik.com)
   *  - url        : URL-level lookup (origin-level if omitted)
   *  - formFactor : PHONE (default) | DESKTOP | TABLET | ALL_FORM_FACTORS
   */
  @Get('timeseries/crux')
  async timeseriesCrux(
    @Query('days') days?: string,
    @Query('origin') origin?: string,
    @Query('url') url?: string,
    @Query('formFactor') formFactor?: string,
  ) {
    const dayCount = Math.min(parseInt(days ?? '180', 10) || 180, 365);
    const dateTo = new Date().toISOString().slice(0, 10);
    const dateFrom = new Date(Date.now() - dayCount * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const ff = (formFactor ?? 'PHONE').toUpperCase();
    const originResolved = origin ?? 'https://www.automecanik.com';

    let query = this.supabase
      .from('__seo_crux_field_history')
      .select(
        'origin, url, form_factor, collection_period_start_date, collection_period_end_date, p75_lcp_ms, p75_inp_ms, p75_cls, p75_ttfb_ms, p75_fcp_ms, fetched_at, source_api',
      )
      .gte('collection_period_end_date', dateFrom)
      .lte('collection_period_end_date', dateTo)
      .eq('form_factor', ff)
      .eq('origin', originResolved);

    if (url) {
      query = query.eq('url', url);
    } else {
      query = query.is('url', null);
    }

    const { data, error } = await query
      .order('collection_period_end_date', { ascending: false })
      .limit(500);
    if (error) return { error: error.message, rows: [] };

    return {
      from: dateFrom,
      to: dateTo,
      origin: originResolved,
      url: url ?? null,
      form_factor: ff,
      rows: data ?? [],
    };
  }

  @Get('runs')
  async runs(@Query('limit') limit?: string) {
    const max = Math.min(parseInt(limit ?? '50', 10), 500);
    const { data, error } = await this.supabase
      .from('__seo_event_log')
      .select(
        'id, event_type, severity, payload, created_at, ack_at, resolved_at',
      )
      .in('event_type', [
        'ingestion_run_started',
        'ingestion_run_completed',
        'ingestion_run_failed',
      ])
      .order('created_at', { ascending: false })
      .limit(max);

    if (error) return { error: error.message, rows: [] };
    return { rows: data ?? [] };
  }

  @Post('run/gsc')
  async runGsc(@Body() body: { date?: string; dryRun?: boolean }) {
    const date =
      body.date ?? new Date(Date.now() - 86_400_000).toISOString().slice(0, 10); // J-1 par défaut
    return this.gscFetcher.fetchAndPersist({ date, dryRun: body.dryRun });
  }

  @Post('run/ga4')
  async runGa4(@Body() body: { date?: string; dryRun?: boolean }) {
    const date =
      body.date ?? new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    return this.ga4Fetcher.fetchAndPersist({ date, dryRun: body.dryRun });
  }

  // ─── Phase 2 — On-page audit findings ────────────────────────────────

  /**
   * GET /audit/findings?type=canonical_conflict&limit=
   * Liste les findings open d'un audit_type.
   */
  @Get('audit/findings')
  async listFindings(
    @Query('type') type: AuditType = 'canonical_conflict',
    @Query('limit') limit?: string,
  ) {
    const max = Math.min(parseInt(limit ?? '100', 10), 1000);
    const rows = await this.auditFindings.listOpen(type, max);
    return { audit_type: type, count: rows.length, rows };
  }

  /**
   * GET /audit/findings/summary?type=
   * Aggrégat par severity (KPI cards dashboard).
   */
  @Get('audit/findings/summary')
  async findingsSummary(@Query('type') type: AuditType = 'r_content_gap') {
    const bySeverity = await this.auditFindings.countOpenBySeverity(type);
    const total = Object.values(bySeverity).reduce((a, b) => a + b, 0);
    return { audit_type: type, total, by_severity: bySeverity };
  }

  /**
   * POST /audit/r-content/run
   * Trigger manuel R-content audit (Phase 2a').
   * Audite les tables persistées __seo_gamme_conseil, _purchase_guide,
   * _reference, _brand_editorial. Retourne récap by_source + by_gap_type.
   */
  @Post('audit/r-content/run')
  async runRContentAudit(
    @Body()
    body: {
      sources?: Array<
        'conseil' | 'purchase_guide' | 'reference' | 'brand_editorial'
      >;
      thinContentThreshold?: number;
      dryRun?: boolean;
    },
  ) {
    return this.rContentAuditor.audit({
      sources: body.sources,
      thinContentThreshold: body.thinContentThreshold,
      dryRun: body.dryRun,
    });
  }
}
