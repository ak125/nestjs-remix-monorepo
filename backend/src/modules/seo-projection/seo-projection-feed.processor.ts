/**
 * SeoProjectionFeedProcessor — consumer BullMQ de `projection-feed-queue` (ADR-059 PR-6c).
 *
 * Adaptateur fin : délègue la découverte + l'enqueue des write-jobs au SeoProjectionFeederService.
 * Le READ_ONLY gate + la robustesse "dossier absent" vivent dans le service (testable sans BullMQ).
 * Fail-closed : erreur loguée, jamais de throw fatal qui casserait la file.
 */
import { OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { SeoProjectionFeederService } from './seo-projection-feeder.service';
import {
  PROJECTION_FEED_JOB,
  PROJECTION_FEED_QUEUE,
  type ProjectionFeedJobData,
  type ProjectionFeedResult,
} from './seo-projection.types';

@Processor(PROJECTION_FEED_QUEUE)
export class SeoProjectionFeedProcessor {
  private readonly logger = new Logger(SeoProjectionFeedProcessor.name);

  constructor(private readonly feeder: SeoProjectionFeederService) {}

  @Process(PROJECTION_FEED_JOB)
  async handle(job: Job<ProjectionFeedJobData>): Promise<ProjectionFeedResult> {
    const triggeredBy = job?.data?.triggeredBy ?? 'scheduler';
    const res = await this.feeder.discoverAndEnqueue(triggeredBy);
    this.logger.log(
      `r1-feed (${triggeredBy}) → discovered=${res.discovered} enqueued=${res.enqueued}` +
        (res.reason ? ` reason=${res.reason}` : '') +
        ` dir=${res.exportsDir}`,
    );
    return res;
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error): void {
    this.logger.error(`projection-feed job ${job?.id} failed: ${err?.message}`);
  }
}
