/**
 * MODULE WORKER BULLMQ
 */

import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { getAppConfig } from '../config/app.config';

// Processors
// import { SitemapProcessor } from './processors/sitemap.processor'; // DESACTIVE temporairement
// import { CacheProcessor } from './processors/cache.processor'; // DESACTIVE - Besoin IORedis Module
import { EmailProcessor } from './processors/email.processor';
import { SeoMonitorProcessor } from './processors/seo-monitor.processor';
// VideoExecutionProcessor — SUPPRIMÉ 2026-04-10 (MediaFactory supprimé)

// SEO daily-fetch processor (orchestre GSC/GA4/CWV/Links daily) — V0.A
import { SeoDailyFetchProcessor } from '../modules/seo-monitoring/processors/seo-daily-fetch.processor';
import { SeoMonitoringModule } from '../modules/seo-monitoring/seo-monitoring.module';

// Services Workers
import { SeoMonitorSchedulerService } from './services/seo-monitor-scheduler.service';

// Dependencies for AgenticProcessor
import { RagProxyModule } from '../modules/rag-proxy/rag-proxy.module';
import { AgenticProcessor } from './processors/agentic.processor';
import { PipelineChainProcessor } from './processors/pipeline-chain.processor';
import { RagChangeWatcherService } from './services/rag-change-watcher.service';
import { ContentMergerService } from './services/content-merger.service';
import { AgenticDataService } from '../modules/agentic-engine/services/agentic-data.service';
import { EvidenceLedgerService } from '../modules/agentic-engine/services/evidence-ledger.service';
import { RunManagerService } from '../modules/agentic-engine/services/run-manager.service';
import { CriticService } from '../modules/agentic-engine/services/critic.service';
import { FeatureFlagsModule } from '../config/feature-flags.module';
import { CartModule } from '../modules/cart/cart.module';

// Job health tracking (used by all processors)
import { AdminJobHealthService } from '../modules/admin/services/admin-job-health.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Configuration BullMQ
    //
    // Priorité config Redis : REDIS_URL > getAppConfig() (host/port avec
    // fallback 'localhost'). Aligné sur cache.service.ts et main.ts. Le
    // fallback host est 'localhost' (jamais le hostname Docker 'redis'),
    // sinon le runner CI — qui expose le service redis sur localhost et
    // ne résout pas 'redis' en DNS — bloque ioredis en retry forever, qui
    // bloque les `await emailQueue.add(...)` dans onModuleInit, qui bloque
    // app.listen() (NestJS v10 fire les onModuleInit dans app.init() appelé
    // par listen — cf. node_modules/@nestjs/core/nest-application.js:90-103),
    // qui produit exit 124 sur perf-gates.yml.
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const url = configService.get<string>('REDIS_URL');
        const defaultJobOptions = {
          attempts: 3,
          backoff: {
            type: 'exponential' as const,
            delay: 5000,
          },
          removeOnComplete: 50,
          removeOnFail: 50,
          timeout: 300_000, // P0: 5 minutes max per job — prevents zombie processing
        };
        if (url) {
          return { redis: url, defaultJobOptions };
        }
        const appConfig = getAppConfig();
        return {
          redis: {
            host: appConfig.redis.host ?? 'localhost',
            port: appConfig.redis.port ?? 6379,
            password: configService.get<string>('REDIS_PASSWORD'),
            db: configService.get<number>('REDIS_DB', 0),
          },
          defaultJobOptions,
        };
      },
      inject: [ConfigService],
    }),

    // Queues BullMQ
    BullModule.registerQueue(
      // { name: 'sitemap' }, // DESACTIVE temporairement
      // { name: 'cache' }, // DESACTIVE temporairement
      { name: 'email' },
      { name: 'seo-monitor' },
      // { name: 'video-render' }, // SUPPRIMÉ 2026-04-10
      { name: 'agentic-engine' },
      { name: 'pipeline-chain' },
    ),

    // Cart module for AbandonedCartService (used by EmailProcessor)
    forwardRef(() => CartModule),

    // Modules for AgenticProcessor dependencies
    RagProxyModule,
    FeatureFlagsModule, // Used by RunManagerService (agentic budget guard + flags)

    // V0.A — SEO daily-fetch processor needs GSC/GA4/CWV/Links fetcher services
    SeoMonitoringModule,
  ],

  providers: [
    // Processors
    // SitemapProcessor, // DESACTIVE
    // CacheProcessor, // DESACTIVE
    EmailProcessor,
    SeoMonitorProcessor,
    SeoDailyFetchProcessor, // V0.A — daily GSC/GA4/CWV/Links ingestion (cron 04:00 UTC)
    // VideoExecutionProcessor — SUPPRIMÉ 2026-04-10

    // Agentic engine processor + dependencies (Agent-Native — state management only)
    // NOTE: Stateless services, safe duplicate (same pattern as enricher services above)
    AgenticProcessor,
    PipelineChainProcessor, // 🚀 Pipeline chain consumer (dispatches to ExecutionRouterService)
    AgenticDataService,
    EvidenceLedgerService,
    RunManagerService,
    CriticService,

    // Job health tracking (shared by all processors)
    AdminJobHealthService,

    // RAG Change → Content Improvement Pipeline (append-only, never replace)
    RagChangeWatcherService,
    ContentMergerService,

    // Services
    // SitemapStreamingService, // DESACTIVE
    // SitemapDeltaService, // DESACTIVE
    SeoMonitorSchedulerService,
  ],
  exports: [
    SeoMonitorSchedulerService,
    ContentMergerService,
    RagChangeWatcherService,
    BullModule, // 🚀 Export BullModule so AdminModule can inject pipeline-chain queue
  ],
})
export class WorkerModule {}
