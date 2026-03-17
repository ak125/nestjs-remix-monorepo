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
import { AgenticDataService } from '../modules/agentic-engine/services/agentic-data.service';
import { EvidenceLedgerService } from '../modules/agentic-engine/services/evidence-ledger.service';
import { RunManagerService } from '../modules/agentic-engine/services/run-manager.service';
import { PlannerService } from '../modules/agentic-engine/services/planner.service';
import { SolverService } from '../modules/agentic-engine/services/solver.service';
import { CriticService } from '../modules/agentic-engine/services/critic.service';
import { ClaudeCliService } from '../modules/agentic-engine/services/claude-cli.service';
import { FeatureFlagsModule } from '../config/feature-flags.module';
import { MailService } from '../services/mail.service';

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

    // Agentic engine processor + dependencies (Phase 2: Claude CLI plan/solve/critique)
    // NOTE: Stateless services, safe duplicate (same pattern as enricher services above)
    AgenticProcessor,
    ClaudeCliService,
    AgenticDataService,
    EvidenceLedgerService,
    RunManagerService,
    PlannerService,
    SolverService,
    CriticService,

    // Job health tracking (shared by all processors)
    AdminJobHealthService,
    MailService, // Email service for EmailProcessor

    // Services
    // SitemapStreamingService, // DESACTIVE
    // SitemapDeltaService, // DESACTIVE
    SeoMonitorSchedulerService,
  ],
  exports: [SeoMonitorSchedulerService],
})
export class WorkerModule {}
