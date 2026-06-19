/**
 * SeoProjectionRefreshProcessor — consumer BullMQ de `projection-refresh-queue` (ADR-059 §Découplage).
 *
 * `REFRESH MATERIALIZED VIEW CONCURRENTLY` HORS de la transaction runner (lock-free). Concurrency=1 +
 * jobId singleton côté write-processor = single-flight. Fail-closed : erreur loguée, jamais de throw fatal.
 *
 * NB : la RPC `refresh_seo_projection_mvs` est livrée en PR-6c ; tant qu'absente, refreshViews fail-close
 * proprement (log + retour {refreshed:false}), sans casser la file ni le runtime.
 */
import { OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { SeoProjectionWriterService } from './seo-projection-writer.service';
import {
  PROJECTION_REFRESH_JOB,
  PROJECTION_REFRESH_QUEUE,
  type ProjectionRefreshJobData,
} from './seo-projection.types';

@Processor(PROJECTION_REFRESH_QUEUE)
export class SeoProjectionRefreshProcessor {
  private readonly logger = new Logger(SeoProjectionRefreshProcessor.name);

  constructor(private readonly writer: SeoProjectionWriterService) {}

  @Process(PROJECTION_REFRESH_JOB)
  async handle(
    job: Job<ProjectionRefreshJobData>,
  ): Promise<{ refreshed: boolean; error?: string }> {
    const res = await this.writer.refreshViews();
    this.logger.log(
      `projection refresh (run=${job?.data?.runId ?? 'n/a'}) → refreshed=${res.refreshed}` +
        (res.error ? ` (${res.error})` : ''),
    );
    return res;
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error): void {
    this.logger.error(
      `projection-refresh job ${job?.id} failed: ${err?.message}`,
    );
  }
}
