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

// Services (depuis modules existants)
// import { SitemapStreamingService } from '../modules/seo/services/sitemap-streaming.service'; // DESACTIVE
// import { SitemapDeltaService } from '../modules/seo/services/sitemap-delta.service'; // DESACTIVE

// Services Workers
import { SeoMonitorSchedulerService } from './services/seo-monitor-scheduler.service';

// Dependencies for ContentRefreshProcessor
import { RagProxyModule } from '../modules/rag-proxy/rag-proxy.module';
import { BuyingGuideEnricherService } from '../modules/admin/services/buying-guide-enricher.service';
import { ConseilEnricherService } from '../modules/admin/services/conseil-enricher.service';

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
    ),

    // Modules for ContentRefreshProcessor dependencies
    RagProxyModule,
  ],

  providers: [
    // Processors
    // SitemapProcessor, // DESACTIVE
    // CacheProcessor, // DESACTIVE
    // EmailProcessor, // DESACTIVE
    SeoMonitorProcessor,
    ContentRefreshProcessor,

    // Enricher services (used by ContentRefreshProcessor)
    BuyingGuideEnricherService,
    ConseilEnricherService,

    // Services
    // SitemapStreamingService, // DESACTIVE
    // SitemapDeltaService, // DESACTIVE
    SeoMonitorSchedulerService,
  ],
  exports: [SeoMonitorSchedulerService],
})
export class WorkerModule {}
