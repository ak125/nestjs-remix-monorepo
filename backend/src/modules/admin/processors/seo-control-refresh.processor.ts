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
import {
  SEO_CONTROL_REFRESH_JOB,
  SEO_CONTROL_REFRESH_QUEUE,
} from '../constants/seo-control.constants';
import { type SeoControlRefreshJobData } from '../services/seo-control-refresher.service';
import { SeoControlService } from '../services/seo-control.service';
import { getAppConfig } from '../../../config/app.config';

@Processor(SEO_CONTROL_REFRESH_QUEUE)
export class SeoControlRefreshProcessor {
  private readonly logger = new Logger(SeoControlRefreshProcessor.name);
  private readonly readOnly: boolean;

  // NB: SeoControlRefresherService is a singleton provider in AdminModule, so
  // Nest eagerly instantiates it and runs its onModuleInit scheduling on its
  // own — the processor does not need to inject it. See its *.test.ts.
  constructor(private readonly seoControlService: SeoControlService) {
    this.readOnly = getAppConfig().supabase.readOnly;
  }

  @Process(SEO_CONTROL_REFRESH_JOB)
  async handleRefresh(job: Job<SeoControlRefreshJobData>): Promise<void> {
    const { block, range } = job.data;
    // READ_ONLY (PREPROD, anon key — ADR-028 Option D): refreshBlock() calls
    // rpc_seo_alerts_v1 which reads RLS-protected tables (e.g. __seo_audit_findings)
    // the anon role cannot access → the job fails, retries storm, and the rejection
    // crashes the process (exit 1 → restart-loop ~5 min, breaking E2E Smoke). Skip
    // like the sibling collectors (cf-analytics / cf-rum / runtime-logs /
    // synthetic-crawler) already do — there is nothing to refresh in PREPROD.
    if (this.readOnly) {
      this.logger.log(
        `[READ_ONLY] Skipping seo-control refresh ${block}/${range}`,
      );
      return;
    }
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
