/**
 * SeoControlPlaneModule — root module du SEO Production Control Plane.
 *
 * ADR-064 §Architecture 4-layer :
 *   - L4 Governance binding : CriticalityLoaderService (lit seo-criticality.yaml)
 *   - L1 Collectors :
 *       • SyntheticCrawlerService — fetch + HTML probe (PR-2A-1)
 *       • CfAnalyticsCollectorService — Cloudflare GraphQL Analytics (PR-2A-2)
 *
 * Sous-PRs suivantes :
 *   - PR-2A-3 : RuntimeLogsCollectorService (`__error_logs` query)
 *   - PR-2A-4 : GscCoverageCollectorService (Search Console API)
 *   - PR-2B : Evaluators (L2) — séparation stricte, lecture L1 only
 *   - PR-2C : Actions (L3) — déclenché par L2, jamais L1 direct
 *
 * Queue BullMQ dédiée `seo-crawler-monitor` (NON mutualisée avec `seo-monitor`
 * pour éviter contention — cf. ADR-064 et feedback_schedulemodule_disabled_use_bullmq).
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
import { SYNTHETIC_QUEUE_NAME } from './types';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    BullModule.registerQueue({ name: SYNTHETIC_QUEUE_NAME }),
  ],
  providers: [
    CriticalityLoaderService,
    // L1 — synthetic crawler (PR-2A-1)
    SyntheticCrawlerService,
    SyntheticCrawlerProcessor,
    SyntheticCrawlerSchedulerService,
    // L1 — cf-analytics (PR-2A-2)
    CfAnalyticsCollectorService,
    CfAnalyticsProcessor,
    CfAnalyticsSchedulerService,
  ],
  exports: [CriticalityLoaderService],
})
export class SeoControlPlaneModule {}
