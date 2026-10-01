/**
 * DiagnosticProjectionModule — projection `exports/diagnostic/` du WIKI vers
 * `__diag_link_provenance` (spec §4.5). Réutilise DatabaseModule, le référentiel
 * de DiagnosticEngineModule et la config Bull racine (WorkerModule).
 */
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../../database/database.module';
import { DiagnosticEngineModule } from '../diagnostic-engine.module';
import { DiagnosticProjectionAdminController } from './diagnostic-projection-admin.controller';
import { DiagnosticProjectionProcessor } from './diagnostic-projection.processor';
import { DiagnosticProjectionSchedulerService } from './diagnostic-projection-scheduler.service';
import { DiagnosticProjectionWriterService } from './diagnostic-projection-writer.service';
import { DIAGNOSTIC_PROJECTION_QUEUE } from './diagnostic-projection.types';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    DiagnosticEngineModule,
    BullModule.registerQueue({ name: DIAGNOSTIC_PROJECTION_QUEUE }),
  ],
  controllers: [DiagnosticProjectionAdminController],
  providers: [
    DiagnosticProjectionWriterService,
    DiagnosticProjectionSchedulerService,
    DiagnosticProjectionProcessor,
  ],
})
export class DiagnosticProjectionModule {}
