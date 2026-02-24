/**
 * MODULE WORKER BULLMQ
 */

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Processors
// import { SitemapProcessor } from './processors/sitemap.processor'; // DESACTIVE temporairement
// import { CacheProcessor } from './processors/cache.processor'; // DESACTIVE - Besoin IORedis Module
// import { EmailProcessor } from './processors/email.processor'; // DESACTIVE temporairement
import { SeoMonitorProcessor } from './processors/seo-monitor.processor';
import { ContentRefreshProcessor } from './processors/content-refresh.processor';
import { VideoExecutionProcessor } from './processors/video-execution.processor';

// Services (depuis modules existants)
// import { SitemapStreamingService } from '../modules/seo/services/sitemap-streaming.service'; // DESACTIVE
// import { SitemapDeltaService } from '../modules/seo/services/sitemap-delta.service'; // DESACTIVE

// Services Workers
import { SeoMonitorSchedulerService } from './services/seo-monitor-scheduler.service';

// Dependencies for ContentRefreshProcessor
import { RagProxyModule } from '../modules/rag-proxy/rag-proxy.module';
import { AiContentModule } from '../modules/ai-content/ai-content.module';
import { BuyingGuideEnricherService } from '../modules/admin/services/buying-guide-enricher.service';
import { ConseilEnricherService } from '../modules/admin/services/conseil-enricher.service';
import { ReferenceService } from '../modules/seo/services/reference.service';
import { DiagnosticService } from '../modules/seo/services/diagnostic.service';
import { BriefGatesService } from '../modules/admin/services/brief-gates.service';
import { HardGatesService } from '../modules/admin/services/hard-gates.service';
import { ImageGatesService } from '../modules/admin/services/image-gates.service';
import { SectionCompilerService } from '../modules/admin/services/section-compiler.service';
import { PageBriefService } from '../modules/admin/services/page-brief.service';
import { KeywordDensityGateService } from '../modules/admin/services/keyword-density-gate.service';

// Job health tracking (used by all processors)
import { AdminJobHealthService } from '../modules/admin/services/admin-job-health.service';

// Dependencies for VideoExecutionProcessor
import { VideoDataService } from '../modules/media-factory/services/video-data.service';
import { VideoGatesService } from '../modules/media-factory/services/video-gates.service';
import { RenderAdapterService } from '../modules/media-factory/render/render-adapter.service';

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
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      }),
      inject: [ConfigService],
    }),

    // Queues BullMQ
    BullModule.registerQueue(
      // { name: 'sitemap' }, // DESACTIVE temporairement
      // { name: 'cache' }, // DESACTIVE temporairement
      // { name: 'email' }, // DESACTIVE temporairement
      { name: 'seo-monitor' },
      { name: 'content-refresh' },
      { name: 'video-render' },
    ),

    // Modules for ContentRefreshProcessor dependencies
    RagProxyModule,
    ...(process.env.LLM_POLISH_ENABLED === 'true' ? [AiContentModule] : []),
  ],

  providers: [
    // Processors
    // SitemapProcessor, // DESACTIVE
    // CacheProcessor, // DESACTIVE
    // EmailProcessor, // DESACTIVE
    SeoMonitorProcessor,
    ContentRefreshProcessor,
    VideoExecutionProcessor,

    // Enricher services (used by ContentRefreshProcessor)
    // NOTE: These 4 services are also declared in AdminModule/SeoContentModule.
    // WorkerModule does NOT import those modules, so NestJS creates separate instances.
    // Verified stateless (no in-memory cache/state) — safe duplicate. See audit 2026-02-19.
    BuyingGuideEnricherService,
    ConseilEnricherService,
    ReferenceService,
    DiagnosticService,
    PageBriefService, // Used by BriefGatesService + enrichers (brief-aware templates)
    KeywordDensityGateService, // Gate F: keyword density (injected into BriefGatesService)
    BriefGatesService, // Pre-publish gates anti-cannibalisation
    HardGatesService, // Hard gates (attribution, no_guess, scope, contradiction, seo)
    ImageGatesService, // P3: image gates (OG, hero policy, alt text)
    SectionCompilerService, // Section policy enforcement (raw → compiled)

    // Video execution dependencies
    // NOTE: Stateless services, safe duplicate (same pattern as enricher services above)
    VideoDataService,
    VideoGatesService,
    RenderAdapterService,

    // Job health tracking (shared by all processors)
    AdminJobHealthService,

    // Services
    // SitemapStreamingService, // DESACTIVE
    // SitemapDeltaService, // DESACTIVE
    SeoMonitorSchedulerService,
  ],
  exports: [SeoMonitorSchedulerService],
})
export class WorkerModule {}
