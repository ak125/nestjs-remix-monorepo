/**
 * ADR-072 PR 2D-3 — BullMQ processor for the admin R8 seed-run queue.
 *
 * Worker side of the admin-job state machine :
 *   1. Transition pending → running (RPC __seo_admin_job_transition).
 *   2. Invoke R8SnapshotSeedService.run(input) (no-op if dryRun=true).
 *   3. Transition running → completed | failed.
 *
 * READ_ONLY gate (canon `feedback_readonly_gate_at_processor_not_scheduler`)
 * runs the dry-run path to keep the wiring observable in mirror envs.
 */

import { OnQueueError, OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bull';
import { getAppConfig } from '../../../../config/app.config';
import { R2R8SeedJobOrchestratorService } from '../services/r2-r8-seed-job-orchestrator.service';
import { R2R8GateStatusService } from '../services/r2-r8-gate-status.service';
import { R8SnapshotSeedService } from '../services/r8-snapshot-seed.service';
import {
  R8_SEED_RUN_JOB_NAME,
  R8_SEED_RUN_QUEUE_NAME,
  R8SeedRunJobData,
} from './r8-seed-run.constants';

@Processor(R8_SEED_RUN_QUEUE_NAME)
@Injectable()
export class R8SeedRunProcessor {
  private readonly logger = new Logger(R8SeedRunProcessor.name);
  private readonly readOnly: boolean;

  constructor(
    private readonly orchestrator: R2R8SeedJobOrchestratorService,
    private readonly seedService: R8SnapshotSeedService,
    private readonly gateStatus: R2R8GateStatusService,
  ) {
    this.readOnly = getAppConfig().supabase.readOnly;
  }

  @Process({ name: R8_SEED_RUN_JOB_NAME, concurrency: 1 })
  async handleSeedRun(job: Job<R8SeedRunJobData>): Promise<{
    jobId: string;
    status: 'completed' | 'failed' | 'skipped_read_only';
  }> {
    const { jobId, dryRun, batchSize, sinceTypeId, maxBatches } = job.data;

    if (this.readOnly) {
      // Even in READ_ONLY we transition the row so dashboards aren't
      // permanently stuck in 'pending'. Result records the skip reason.
      await this.orchestrator.transition(jobId, 'completed', {
        result: { skipped: 'read_only', dryRun },
      });
      return { jobId, status: 'skipped_read_only' };
    }

    try {
      await this.orchestrator.transition(jobId, 'running');
    } catch (e) {
      // Transition failure is fatal — abort the job so BullMQ marks it failed.
      this.logger.error(
        `transition pending→running failed for ${jobId}: ${(e as Error).message}`,
      );
      throw e;
    }

    try {
      const report = await this.seedService.run({
        dryRun,
        batchSize: batchSize ?? undefined,
        sinceTypeId: sinceTypeId ?? undefined,
        maxBatches: maxBatches ?? undefined,
      });
      await this.orchestrator.transition(jobId, 'completed', {
        result: report as unknown as Record<string, unknown>,
      });
      // Invalidate the gate-status cache so the next CI / admin poll sees the
      // post-run truth without waiting for the 30 s TTL.
      this.gateStatus.invalidate();
      return { jobId, status: 'completed' };
    } catch (e) {
      const message = (e as Error).message;
      this.logger.error(`seed run ${jobId} failed: ${message}`);
      await this.orchestrator.transition(jobId, 'failed', {
        error: message.slice(0, 2000),
      });
      return { jobId, status: 'failed' };
    }
  }

  @OnQueueError()
  onError(err: Error): void {
    this.logger.error(`r8-seed-run queue error: ${err.message}`);
  }

  @OnQueueFailed()
  onFailed(job: Job<R8SeedRunJobData>, err: Error): void {
    this.logger.error(
      `r8-seed-run job ${job.id} (jobId=${job.data?.jobId}) failed: ${err.message}`,
    );
  }
}
