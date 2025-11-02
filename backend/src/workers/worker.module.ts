/**
 * 🔄 MODULE WORKER BULLMQ
 */

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Processors
// import { SitemapProcessor } from './processors/sitemap.processor'; // ❌ DÉSACTIVÉ temporairement
// import { CacheProcessor } from './processors/cache.processor'; // ❌ DÉSACTIVÉ - Besoin IORedis Module
// import { EmailProcessor } from './processors/email.processor'; // ❌ DÉSACTIVÉ temporairement
import { SeoMonitorProcessor } from './processors/seo-monitor.processor';

// Services (depuis modules existants)
// import { SitemapStreamingService } from '../modules/seo/services/sitemap-streaming.service'; // ❌ DÉSACTIVÉ
// import { SitemapDeltaService } from '../modules/seo/services/sitemap-delta.service'; // ❌ DÉSACTIVÉ

// Services Workers
import { SeoMonitorSchedulerService } from './services/seo-monitor-scheduler.service';

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
          removeOnComplete: 100, // Garder 100 derniers jobs réussis
          removeOnFail: 500, // Garder 500 derniers jobs échoués
        },
      }),
      inject: [ConfigService],
    }),

    // Queues BullMQ
    BullModule.registerQueue(
      // { name: 'sitemap' }, // ❌ DÉSACTIVÉ temporairement
      // { name: 'cache' }, // ❌ DÉSACTIVÉ temporairement
      // { name: 'email' }, // ❌ DÉSACTIVÉ temporairement
      { name: 'seo-monitor' }, // ✅ Queue monitoring SEO anti-désindexation
    ),
  ],

  providers: [
    // Processors
    // SitemapProcessor, // ❌ DÉSACTIVÉ
    // CacheProcessor, // ❌ DÉSACTIVÉ
    // EmailProcessor, // ❌ DÉSACTIVÉ
    SeoMonitorProcessor, // ✅ ACTIF

    // Services
    // SitemapStreamingService, // ❌ DÉSACTIVÉ
    // SitemapDeltaService, // ❌ DÉSACTIVÉ
    SeoMonitorSchedulerService, // ✅ ACTIF
  ],
  exports: [SeoMonitorSchedulerService],
})
export class WorkerModule {}
