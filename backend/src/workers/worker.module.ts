/**
 * 🔄 MODULE WORKER BULLMQ
 */

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule } from '@nestjs-modules/ioredis';

// Processors
// import { SitemapProcessor } from './processors/sitemap.processor'; // ❌ DÉSACTIVÉ temporairement
import { CacheProcessor } from './processors/cache.processor'; // ✅ ACTIVÉ
import { EmailProcessor } from './processors/email.processor'; // ✅ ACTIVÉ
import { SeoMonitorProcessor } from './processors/seo-monitor.processor';
import { VLevelCollectorProcessor } from './processors/vlevel-collector.processor'; // ✅ V-Level Pipeline

// Modules externes (pour DI)
import { SeoModule } from '../modules/seo/seo.module'; // ✅ V-Level: VLevelAnalyzerService

// Services (depuis modules existants)
// import { SitemapStreamingService } from '../modules/seo/services/sitemap-streaming.service'; // ❌ DÉSACTIVÉ
// import { SitemapDeltaService } from '../modules/seo/services/sitemap-delta.service'; // ❌ DÉSACTIVÉ

// Services Workers
import { SeoMonitorSchedulerService } from './services/seo-monitor-scheduler.service';

// Services partagés
import { EmailService } from '../services/email.service';

// Controllers
import { JobsController } from './controllers/jobs.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Module SEO (pour VLevelAnalyzerService)
    SeoModule,

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
      { name: 'cache' }, // ✅ Queue nettoyage cache Redis
      { name: 'email' }, // ✅ Queue envoi emails asynchrone
      { name: 'seo-monitor' }, // ✅ Queue monitoring SEO anti-désindexation
      { name: 'gmail-sync' }, // ✅ Queue sync Gmail inbox admin
      { name: 'vlevel-collector' }, // ✅ Queue V-Level pipeline (WebSearch + Anthropic)
    ),

    // Redis Module pour CacheProcessor (@InjectRedis)
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'single',
        url: `redis://${configService.get('REDIS_HOST', 'redis')}:${configService.get('REDIS_PORT', 6379)}`,
        options: {
          password: configService.get('REDIS_PASSWORD'),
          db: configService.get('REDIS_DB', 0),
        },
      }),
      inject: [ConfigService],
    }),
  ],

  controllers: [
    JobsController, // 🎯 API endpoints pour déclencher les jobs
  ],

  providers: [
    // Processors
    // SitemapProcessor, // ❌ DÉSACTIVÉ
    CacheProcessor, // ✅ ACTIVÉ
    EmailProcessor, // ✅ ACTIVÉ
    SeoMonitorProcessor, // ✅ ACTIF
    VLevelCollectorProcessor, // ✅ V-Level Pipeline (WebSearch + Anthropic + MinIO)

    // Services
    // SitemapStreamingService, // ❌ DÉSACTIVÉ
    // SitemapDeltaService, // ❌ DÉSACTIVÉ
    SeoMonitorSchedulerService, // ✅ ACTIF
    EmailService, // 📧 Service email Resend (pour EmailProcessor)
  ],
  exports: [SeoMonitorSchedulerService],
})
export class WorkerModule {}
