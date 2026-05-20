/**
 * PR-SBD-1 Task 4 — SeoControlRefreshProcessor
 *
 * BullMQ processor for `seo-control-refresh` queue.
 * Receives job from SeoControlRefresherService (scheduled per-block) and
 * delegates to SeoControlService.refreshBlock() (RPC call + cache set).
 *
 * Pattern aligned with seo-daily-fetch.processor.ts (Bull v3, @nestjs/bull).
 */
import { Logger } from '@nestjs/common';
import { OnQueueError, OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { SEO_CONTROL_REFRESH_QUEUE } from '../constants/seo-control.constants';
import {
  type SeoControlRefreshJobData,
  SeoControlRefresherService,
} from '../services/seo-control-refresher.service';
import { SeoControlService } from '../services/seo-control.service';

@Processor(SEO_CONTROL_REFRESH_QUEUE)
export class SeoControlRefreshProcessor {
  private readonly logger = new Logger(SeoControlRefreshProcessor.name);

  constructor(
    private readonly seoControlService: SeoControlService,
    // Inject refresher to ensure DI graph includes scheduling on init
    private readonly _refresher: SeoControlRefresherService,
  ) {}

  @Process()
  async handleRefresh(job: Job<SeoControlRefreshJobData>): Promise<void> {
    const { block, range } = job.data;
    const start = Date.now();
    try {
      await this.seoControlService.refreshBlock(block, range);
      const ms = Date.now() - start;
      this.logger.debug(
        `SWR refresh ${block}/${range} OK in ${ms}ms (job ${job.id})`,
      );
    } catch (err) {
      this.logger.error(
        `SWR refresh ${block}/${range} FAILED (job ${job.id})`,
        err as Error,
      );
      throw err;
    }
  }

  @OnQueueError()
  onError(err: Error): void {
    this.logger.error(
      `Queue ${SEO_CONTROL_REFRESH_QUEUE} error: ${err.message}`,
    );
  }

  @OnQueueFailed()
  onFailed(job: Job<SeoControlRefreshJobData>, err: Error): void {
    this.logger.warn(
      `Job ${job.id} (${job.data.block}/${job.data.range}) failed: ${err.message}`,
    );
  }
}
