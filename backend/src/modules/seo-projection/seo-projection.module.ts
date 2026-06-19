/**
 * SeoProjectionModule — forward-writer ADR-059 PR-6b (exports/seo → DB versionnée).
 *
 * 2 queues découplées (write courte / refresh hors-tx). Réutilise DatabaseModule (SupabaseBaseService,
 * service_role) + @nestjs/bull. AUCUNE nouvelle infra : tables/MV créées par la migration PR-6.
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
import { PROJECTION_REFRESH_QUEUE, PROJECTION_WRITE_QUEUE } from './seo-projection.types';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    BullModule.registerQueue({ name: PROJECTION_WRITE_QUEUE }, { name: PROJECTION_REFRESH_QUEUE }),
  ],
  providers: [
    SeoProjectionGateService,
    SeoProjectionWriterService,
    SeoProjectionWriteProcessor,
    SeoProjectionRefreshProcessor,
  ],
  exports: [SeoProjectionWriterService, SeoProjectionGateService],
})
export class SeoProjectionModule {}
