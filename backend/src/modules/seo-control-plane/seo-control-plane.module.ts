/**
 * SeoControlPlaneModule — root module du SEO Production Control Plane.
 *
 * ADR-064 §Architecture 4-layer :
 *   - L4 Governance binding : CriticalityLoaderService (lit seo-criticality.yaml)
 *   - L1 Collectors :
 *       • SyntheticCrawlerService — fetch + HTML probe (PR-2A-1, Source B)
 *       • CfAnalyticsCollectorService — Cloudflare GraphQL Analytics (PR-2A-2, Source C edge-server)
 *       • CfRumCollectorService — Cloudflare GraphQL RUM Web Vitals (PR-2A-2.5, Source C' edge-RUM)
 *       • RuntimeLogsCollectorService — `__error_logs` query (PR-2A-3, Source A)
 *
 * Sous-PRs suivantes :
 *   - PR-2A-4 : GscCoverageCollectorService (Search Console API — Source D)
 *   - PR-2B : Evaluators (L2) — séparation stricte, lecture L1 only
 *   - PR-2C : Actions (L3) — déclenché par L2, jamais L1 direct
 *
 * Queue BullMQ partagée `seo-crawler-monitor` (NON mutualisée avec `seo-monitor`
 * pour éviter contention — cf. ADR-064 et feedback_schedulemodule_disabled_use_bullmq).
 * Mutualisation interne L1 OK : synthetic q15min + cf-analytics q5min + runtime-logs q5min + cf-rum q-daily = charge négligeable.
 */

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../database/database.module';
import { CriticalityLoaderService } from './services/criticality-loader.service';
import { SyntheticCrawlerService } from './collectors/synthetic-crawler/synthetic-crawler.service';
import { SyntheticCrawlerProcessor } from './collectors/synthetic-crawler/synthetic-crawler.processor';
import { SyntheticCrawlerSchedulerService } from './collectors/synthetic-crawler/synthetic-crawler.scheduler.service';
import { CfAnalyticsCollectorService } from './collectors/cf-analytics/cf-analytics.service';
import { CfAnalyticsProcessor } from './collectors/cf-analytics/cf-analytics.processor';
import { CfAnalyticsSchedulerService } from './collectors/cf-analytics/cf-analytics.scheduler.service';
import { CfRumCollectorService } from './collectors/cf-rum/cf-rum.service';
import { CfRumProcessor } from './collectors/cf-rum/cf-rum.processor';
import { CfRumSchedulerService } from './collectors/cf-rum/cf-rum.scheduler.service';
import { RuntimeLogsCollectorService } from './collectors/runtime-logs/runtime-logs.service';
import { RuntimeLogsProcessor } from './collectors/runtime-logs/runtime-logs.processor';
import { RuntimeLogsSchedulerService } from './collectors/runtime-logs/runtime-logs.scheduler.service';
import { SYNTHETIC_QUEUE_NAME } from './types';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    BullModule.registerQueue({ name: SYNTHETIC_QUEUE_NAME }),
  ],
  providers: [
    CriticalityLoaderService,
    // L1 — synthetic crawler (PR-2A-1, Source B)
    SyntheticCrawlerService,
    SyntheticCrawlerProcessor,
    SyntheticCrawlerSchedulerService,
    // L1 — cf-analytics (PR-2A-2, Source C edge-server)
    CfAnalyticsCollectorService,
    CfAnalyticsProcessor,
    CfAnalyticsSchedulerService,
    // L1 — cf-rum (PR-2A-2.5, Source C' edge-RUM Web Vitals)
    CfRumCollectorService,
    CfRumProcessor,
    CfRumSchedulerService,
    // L1 — runtime-logs (PR-2A-3, Source A)
    RuntimeLogsCollectorService,
    RuntimeLogsProcessor,
    RuntimeLogsSchedulerService,
  ],
  exports: [CriticalityLoaderService],
})
export class SeoControlPlaneModule {}
