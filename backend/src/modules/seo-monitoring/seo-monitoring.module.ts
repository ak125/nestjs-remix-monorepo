/**
 * SEO Monitoring Module — Phase 1 Observability
 *
 * Ingestion daily des sources Google gratuites (GSC, GA4, CWV, GSC Links)
 * dans des tables Postgres time-series partitionnées mensuelles.
 *
 * Refs:
 * - ADR-025-seo-department-architecture (governance-vault)
 * - 20260425_seo_observability_timeseries.sql (4 tables)
 * - 20260425_seo_event_log.sql (audit trail unifié)
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GoogleCredentialsService } from './services/google-credentials.service';
import { SeoMonitoringRunsService } from './services/seo-monitoring-runs.service';
import { GscDailyFetcherService } from './services/gsc-daily-fetcher.service';
import { Ga4DailyFetcherService } from './services/ga4-daily-fetcher.service';
import { CwvFetcherService } from './services/cwv-fetcher.service';
import { GscLinksFetcherService } from './services/gsc-links-fetcher.service';
import { GscIndexHistoryCollectorService } from './services/gsc-index-history-collector.service';
import { CruxApiClient } from './services/crux-api-client.service';
import { CruxFieldFetcherService } from './services/crux-field-fetcher.service';
import { CruxAlerterService } from './services/crux-alerter.service';
import { AuditFindingsService } from './services/audit-findings.service';
import { RContentAuditorService } from './services/r-content-auditor.service';
import { QualityHistorySnapshotService } from './services/quality-history-snapshot.service';
import { RagMirrorFreshnessService } from './services/rag-mirror-freshness.service';
import { FunnelEventsService } from './services/funnel-events.service';
import { CwvBeaconService } from './services/cwv-beacon.service';
import { CwvAggregationService } from './services/cwv-aggregation.service';
import { RuntimeEventsService } from './services/runtime-events.service';
import { CwvDashboardService } from './services/cwv-dashboard.service';
import { SeoMonitoringController } from './controllers/seo-monitoring.controller';
import { QualityHistoryController } from './controllers/quality-history.controller';
import { FunnelEventsController } from './controllers/funnel-events.controller';
import { CwvBeaconController } from './controllers/cwv-beacon.controller';
import { RuntimeEventsController } from './controllers/runtime-events.controller';
import { CwvDashboardController } from './controllers/cwv-dashboard.controller';

@Module({
  imports: [ConfigModule],
  providers: [
    GoogleCredentialsService,
    SeoMonitoringRunsService,
    GscDailyFetcherService,
    Ga4DailyFetcherService,
    CwvFetcherService,
    GscLinksFetcherService,
    GscIndexHistoryCollectorService, // PR3 — index snapshot pilote (inert-by-default)
    CruxApiClient, // ADR-063 PR-3 — dormant, wired to processor in PR-5
    CruxFieldFetcherService, // ADR-063 PR-3 — dormant, wired to processor in PR-5
    CruxAlerterService, // ADR-063 PR-4 — dormant, wired to processor in PR-5
    AuditFindingsService,
    RContentAuditorService,
    QualityHistorySnapshotService, // ADR-050 Phase 0 baseline
    RagMirrorFreshnessService, // ADR-046 § L3 RAG MIRROR read-only — PR-E.2
    FunnelEventsService, // Commerce-Loop V1 étape 4-A — funnel outil diagnostic
    CwvBeaconService, // CWV Runtime Observability bloc 3 — landing beacons web-vitals
    CwvAggregationService, // CWV bloc 4 — RPCs aggregate_cwv_hourly/daily_rum
    RuntimeEventsService, // CWV bloc 5 — wrapper __seo_event_log pour 4 runtime events
    CwvDashboardService, // CWV bloc 6 — wraps STABLE RPCs get_cwv_dashboard/funnel_correlation + health
    // CwvAggregationSchedulerService + CwvAggregationProcessor : wired in workers/worker.module.ts
    // (queue 'seo-monitor' registered there ; pattern mirror SeoDailyFetchProcessor)
  ],
  controllers: [
    SeoMonitoringController,
    QualityHistoryController,
    FunnelEventsController, // POST /api/seo/funnel/event (public beacon)
    CwvBeaconController, // POST /api/seo/cwv/beacon (public beacon, bloc 3)
    RuntimeEventsController, // POST /api/seo/runtime-event (public beacon, bloc 5)
    CwvDashboardController, // GET /api/seo/cwv/{dashboard,funnel-correlation,health} (admin, bloc 6)
  ],
  exports: [
    GoogleCredentialsService,
    GscDailyFetcherService,
    Ga4DailyFetcherService,
    CwvFetcherService,
    GscLinksFetcherService,
    GscIndexHistoryCollectorService, // PR3 — index snapshot pilote (inert-by-default)
    CruxApiClient, // ADR-063 PR-3 — dormant, wired to processor in PR-5
    CruxFieldFetcherService, // ADR-063 PR-3 — dormant, wired to processor in PR-5
    CruxAlerterService, // ADR-063 PR-4 — dormant, wired to processor in PR-5
    AuditFindingsService,
    RContentAuditorService,
    QualityHistorySnapshotService, // exposé pour PR-T (re-enrich pre/post snapshot)
    RagMirrorFreshnessService, // exposé pour cron health endpoint
    CwvAggregationService, // exposé pour CwvAggregationProcessor (workers module)
  ],
})
export class SeoMonitoringModule {}
