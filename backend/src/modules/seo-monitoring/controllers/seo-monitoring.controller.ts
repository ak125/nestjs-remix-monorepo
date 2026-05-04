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
 * Auth : protégé par IsAdminGuard (ajouté à brancher dans AppModule).
 */
import { Body, Controller, Get, Logger, Post, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { getEffectiveSupabaseKey } from '@common/utils';
import { GoogleCredentialsService } from '../services/google-credentials.service';
import { GscDailyFetcherService } from '../services/gsc-daily-fetcher.service';
import { Ga4DailyFetcherService } from '../services/ga4-daily-fetcher.service';
import {
  AuditFindingsService,
  type AuditType,
} from '../services/audit-findings.service';
import { RContentAuditorService } from '../services/r-content-auditor.service';

@Controller('api/admin/seo-monitoring')
export class SeoMonitoringController {
  private readonly logger = new Logger(SeoMonitoringController.name);
  private readonly supabase: SupabaseClient;

  constructor(
    private readonly credentials: GoogleCredentialsService,
    private readonly gscFetcher: GscDailyFetcherService,
    private readonly ga4Fetcher: Ga4DailyFetcherService,
    private readonly auditFindings: AuditFindingsService,
    private readonly rContentAuditor: RContentAuditorService,
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
   * GET /timeseries/gsc?from=YYYY-MM-DD&to=YYYY-MM-DD&page=&group_by=&top=
   *
   * Aggrège côté DB (pas côté Node) pour gérer 30M rows/mois.
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
    const limit = Math.min(parseInt(top ?? '500', 10), 5000);

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

    // Aggrégation simple côté Node (pour 50k pages, l'agrégation lourde
    // sera déléguée à Postgres via vue matérialisée Phase 1b).
    const rows = data ?? [];
    const totals = rows.reduce(
      (acc, r) => {
        acc.clicks += r.clicks ?? 0;
        acc.impressions += r.impressions ?? 0;
        acc.position_sum += (r.position ?? 0) * (r.impressions ?? 0);
        return acc;
      },
      { clicks: 0, impressions: 0, position_sum: 0 },
    );

    return {
      from: dateFrom,
      to: dateTo,
      group_by: groupBy,
      rows,
      totals: {
        clicks: totals.clicks,
        impressions: totals.impressions,
        ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
        avg_position:
          totals.impressions > 0 ? totals.position_sum / totals.impressions : 0,
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
