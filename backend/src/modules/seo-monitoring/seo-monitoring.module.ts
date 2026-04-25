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
import { AuditFindingsService } from './services/audit-findings.service';
import { RContentAuditorService } from './services/r-content-auditor.service';
import { SeoMonitoringController } from './controllers/seo-monitoring.controller';

@Module({
  imports: [ConfigModule],
  providers: [
    GoogleCredentialsService,
    SeoMonitoringRunsService,
    GscDailyFetcherService,
    Ga4DailyFetcherService,
    CwvFetcherService,
    GscLinksFetcherService,
    AuditFindingsService,
    RContentAuditorService,
  ],
  controllers: [SeoMonitoringController],
  exports: [
    GoogleCredentialsService,
    GscDailyFetcherService,
    Ga4DailyFetcherService,
    CwvFetcherService,
    GscLinksFetcherService,
    AuditFindingsService,
    RContentAuditorService,
  ],
})
export class SeoMonitoringModule {}
