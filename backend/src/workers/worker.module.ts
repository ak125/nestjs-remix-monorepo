/**
 * 🔄 MODULE WORKER BULLMQ
 */

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Processors
import { SitemapProcessor } from './processors/sitemap.processor';
import { CacheProcessor } from './processors/cache.processor';
import { EmailProcessor } from './processors/email.processor';

// Services (depuis modules existants)
import { SitemapStreamingService } from '../modules/seo/services/sitemap-streaming.service';
import { SitemapDeltaService } from '../modules/seo/services/sitemap-delta.service';

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
      { name: 'sitemap' }, // Queue sitemaps
      { name: 'cache' }, // Queue cache cleanup
      { name: 'email' }, // Queue emails
    ),
  ],

  providers: [
    // Processors
    SitemapProcessor,
    CacheProcessor,
    EmailProcessor,

    // Services
    SitemapStreamingService,
    SitemapDeltaService,
  ],
})
export class WorkerModule {}
