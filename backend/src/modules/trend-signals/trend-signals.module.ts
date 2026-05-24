/**
 * TrendSignalsModule — middle-ground trend signals ingestion.
 *
 * Cf. spec docs/superpowers/specs/2026-05-23-ai-additive-layer-phase-0-and-1-design.md §4.6
 * Tasks 1.10 + 1.11 — service + BullMQ processor (monthly cadence).
 *
 * Wire-up :
 *   - DatabaseModule fournit SupabaseBaseService transitivement (parent class).
 *   - BullModule.registerQueue('trend-signals') déclare la queue BullMQ.
 *   - TrendSignalsProcessor traite les jobs `ingest-monthly`.
 */
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { DatabaseModule } from '../../database/database.module';
import { TrendSignalsService } from './trend-signals.service';
import {
  TrendSignalsProcessor,
  TREND_SIGNALS_QUEUE,
} from './processors/trend-signals.processor';

@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({ name: TREND_SIGNALS_QUEUE }),
  ],
  providers: [TrendSignalsService, TrendSignalsProcessor],
  exports: [TrendSignalsService],
})
export class TrendSignalsModule {}
