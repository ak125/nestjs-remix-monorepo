/**
 * ADR-059 Phase B PR-6b — SeoProjectionModule.
 *
 * Wiring NestJS :
 *  - 2 BullMQ queues découplées : `seo-projection-write` et `seo-projection-refresh`
 *  - 2 processors associés (write : default concurrency, refresh : single-flight=1)
 *  - SeoProjectionConflictService partagé
 *
 * IMPORTANT : ce module ne déclare AUCUN controller, AUCUN endpoint HTTP.
 * Tout est piloté par BullMQ jobs enqueue côté caller (cron PR-5b ou ops).
 *
 * Hors scope PR-6b : RPC publique (PR-7), replay_projection.py (PR-6c).
 */
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';

import {
  SEO_PROJECTION_REFRESH_QUEUE,
  SEO_PROJECTION_WRITE_QUEUE,
} from './projection-contract.constants';
import { SeoProjectionConflictService } from './seo-projection-conflict.service';
import { SeoProjectionRefreshProcessor } from './seo-projection-refresh.processor';
import { SeoProjectionWriteProcessor } from './seo-projection-write.processor';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: SEO_PROJECTION_WRITE_QUEUE },
      { name: SEO_PROJECTION_REFRESH_QUEUE },
    ),
  ],
  providers: [
    SeoProjectionConflictService,
    SeoProjectionWriteProcessor,
    SeoProjectionRefreshProcessor,
  ],
  exports: [BullModule, SeoProjectionConflictService],
})
export class SeoProjectionModule {}
