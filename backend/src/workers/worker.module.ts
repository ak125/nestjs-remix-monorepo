/**
 * MODULE WORKER BULLMQ
 */

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Processors
// import { SitemapProcessor } from './processors/sitemap.processor'; // DESACTIVE temporairement
// import { CacheProcessor } from './processors/cache.processor'; // DESACTIVE - Besoin IORedis Module
import { EmailProcessor } from './processors/email.processor';
import { SeoMonitorProcessor } from './processors/seo-monitor.processor';
import { VideoExecutionProcessor } from './processors/video-execution.processor';

// Services Workers
import { SeoMonitorSchedulerService } from './services/seo-monitor-scheduler.service';

// Dependencies for VideoExecutionProcessor
import { VideoDataService } from '../modules/media-factory/services/video-data.service';
import { VideoGatesService } from '../modules/media-factory/services/video-gates.service';
import { RenderAdapterService } from '../modules/media-factory/render/render-adapter.service';

// Dependencies for AgenticProcessor
import { RagProxyModule } from '../modules/rag-proxy/rag-proxy.module';
import { AgenticProcessor } from './processors/agentic.processor';
import { PipelineChainProcessor } from './processors/pipeline-chain.processor';
import { AgenticDataService } from '../modules/agentic-engine/services/agentic-data.service';
import { EvidenceLedgerService } from '../modules/agentic-engine/services/evidence-ledger.service';
import { RunManagerService } from '../modules/agentic-engine/services/run-manager.service';
import { CriticService } from '../modules/agentic-engine/services/critic.service';
import { FeatureFlagsModule } from '../config/feature-flags.module';

// Job health tracking (used by all processors)
import { AdminJobHealthService } from '../modules/admin/services/admin-job-health.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Configuration BullMQ
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST', 'redis'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
          db: configService.get('REDIS_DB', 0),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: 50,
          removeOnFail: 50,
          timeout: 300_000, // P0: 5 minutes max per job — prevents zombie processing
        },
      }),
      inject: [ConfigService],
    }),

    // Queues BullMQ
    BullModule.registerQueue(
      // { name: 'sitemap' }, // DESACTIVE temporairement
      // { name: 'cache' }, // DESACTIVE temporairement
      { name: 'email' },
      { name: 'seo-monitor' },
      { name: 'video-render' },
      { name: 'agentic-engine' },
      { name: 'pipeline-chain' },
    ),

    // Modules for AgenticProcessor dependencies
    RagProxyModule,
    FeatureFlagsModule, // Used by RunManagerService (agentic budget guard + flags)
  ],

  providers: [
    // Processors
    // SitemapProcessor, // DESACTIVE
    // CacheProcessor, // DESACTIVE
    EmailProcessor,
    SeoMonitorProcessor,
    VideoExecutionProcessor,

    // Video execution dependencies
    // NOTE: Stateless services, safe duplicate (same pattern as enricher services above)
    VideoDataService,
    VideoGatesService,
    RenderAdapterService,

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

    // Services
    // SitemapStreamingService, // DESACTIVE
    // SitemapDeltaService, // DESACTIVE
    SeoMonitorSchedulerService,
  ],
  exports: [
    SeoMonitorSchedulerService,
    BullModule, // 🚀 Export BullModule so AdminModule can inject pipeline-chain queue
  ],
})
export class WorkerModule {}
