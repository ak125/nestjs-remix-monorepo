/**
 * TrendSignalsProcessor — monthly BullMQ cron for `__trend_signals` ingestion.
 *
 * Cf. spec docs/superpowers/specs/2026-05-23-ai-additive-layer-phase-0-and-1-design.md §4.6
 * Task 1.11 — middle-ground processor, monthly cadence, no auto content gen.
 *
 * Job BullMQ : `@Process('ingest-monthly')` sur queue TREND_SIGNALS_QUEUE.
 * Scheduling = via cron registration externe (admin scheduler ou setup workflow).
 */
import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { TrendSignalsService } from '../trend-signals.service';

export const TREND_SIGNALS_QUEUE = 'trend-signals';

@Processor(TREND_SIGNALS_QUEUE)
export class TrendSignalsProcessor {
  private readonly logger = new Logger(TrendSignalsProcessor.name);

  constructor(private readonly service: TrendSignalsService) {}

  @Process('ingest-monthly')
  async ingestMonthly(_job: Job): Promise<{ inserted: number }> {
    const inserted = await this.service.ingestRappels();
    this.logger.log(`ingest-monthly done : ${inserted} rows`);
    return { inserted };
  }
}
