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
import { CruxApiClient } from './services/crux-api-client.service';
import { CruxFieldFetcherService } from './services/crux-field-fetcher.service';
import { CruxAlerterService } from './services/crux-alerter.service';
import { AuditFindingsService } from './services/audit-findings.service';
import { RContentAuditorService } from './services/r-content-auditor.service';
import { QualityHistorySnapshotService } from './services/quality-history-snapshot.service';
import { RagMirrorFreshnessService } from './services/rag-mirror-freshness.service';
import { SeoMonitoringController } from './controllers/seo-monitoring.controller';
import { QualityHistoryController } from './controllers/quality-history.controller';

@Module({
  imports: [ConfigModule],
  providers: [
    GoogleCredentialsService,
    SeoMonitoringRunsService,
    GscDailyFetcherService,
    Ga4DailyFetcherService,
    CwvFetcherService,
    GscLinksFetcherService,
    CruxApiClient, // ADR-063 PR-3 — dormant, wired to processor in PR-5
    CruxFieldFetcherService, // ADR-063 PR-3 — dormant, wired to processor in PR-5
    CruxAlerterService, // ADR-063 PR-4 — dormant, wired to processor in PR-5
    AuditFindingsService,
    RContentAuditorService,
    QualityHistorySnapshotService, // ADR-050 Phase 0 baseline
    RagMirrorFreshnessService, // ADR-046 § L3 RAG MIRROR read-only — PR-E.2
  ],
  controllers: [SeoMonitoringController, QualityHistoryController],
  exports: [
    GoogleCredentialsService,
    GscDailyFetcherService,
    Ga4DailyFetcherService,
    CwvFetcherService,
    GscLinksFetcherService,
    CruxApiClient, // ADR-063 PR-3 — dormant, wired to processor in PR-5
    CruxFieldFetcherService, // ADR-063 PR-3 — dormant, wired to processor in PR-5
    CruxAlerterService, // ADR-063 PR-4 — dormant, wired to processor in PR-5
    AuditFindingsService,
    RContentAuditorService,
    QualityHistorySnapshotService, // exposé pour PR-T (re-enrich pre/post snapshot)
    RagMirrorFreshnessService, // exposé pour cron health endpoint
  ],
})
export class SeoMonitoringModule {}
