/**
 * SeoProjectionModule — forward-writer ADR-059 (exports/seo → DB versionnée).
 *
 * PR-6b : 2 queues découplées (write courte / refresh) + gate + writer. PR-6c : ajoute le feeder R1
 * (3ᵉ queue `projection-feed-queue`, repeatable flag-gated OFF) + l'endpoint admin de trigger one-off,
 * et branche `refreshViews()` sur la RPC `refresh_seo_projection_mvs`.
 *
 * Réutilise DatabaseModule (SupabaseBaseService, service_role) + @nestjs/bull (root config dans
 * WorkerModule). AUCUNE nouvelle infra hors les tables/MV/RPC de migrations PR-6/PR-6c.
 * Read-path (RPC get_active_seo_projection + GRANT anon) = PR-7 ; flag seo_projection_read_v1 OFF.
 */
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { SeoProjectionGateService } from './seo-projection-gate.service';
import { SeoProjectionWriterService } from './seo-projection-writer.service';
import { SeoProjectionWriteProcessor } from './seo-projection-write.processor';
import { SeoProjectionRefreshProcessor } from './seo-projection-refresh.processor';
import { SeoProjectionFeederService } from './seo-projection-feeder.service';
import { SeoProjectionFeedProcessor } from './seo-projection-feed.processor';
import { SeoProjectionAdminController } from './seo-projection-admin.controller';
import {
  PROJECTION_FEED_QUEUE,
  PROJECTION_REFRESH_QUEUE,
  PROJECTION_WRITE_QUEUE,
} from './seo-projection.types';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    BullModule.registerQueue(
      { name: PROJECTION_WRITE_QUEUE },
      { name: PROJECTION_REFRESH_QUEUE },
      { name: PROJECTION_FEED_QUEUE },
    ),
  ],
  controllers: [SeoProjectionAdminController],
  providers: [
    SeoProjectionGateService,
    SeoProjectionWriterService,
    SeoProjectionWriteProcessor,
    SeoProjectionRefreshProcessor,
    SeoProjectionFeederService,
    SeoProjectionFeedProcessor,
  ],
  exports: [SeoProjectionWriterService, SeoProjectionGateService],
})
export class SeoProjectionModule {}
