import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnQueueFailed, Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import {
  SUPPLIER_SYNC_QUEUE,
  SUPPLIER_SYNC_JOB,
} from './supplier-sync.scheduler';
import { SupplierSyncRunner, type RunSummary } from './supplier-sync.runner';
import { isSupplierSyncEnabled } from './supplier-sync.flag';

export type SupplierSyncSkipped = {
  skipped: 'SUPPLIER_TRUTH_SYNC_ENABLED!=true';
};

/**
 * Consumes the scheduled supplier-sync job → one full sync cycle.
 *
 * The flag is re-checked here, at execution: a job already in Redis (a delayed
 * repeat, a retry, a one-off) can outlive a `true → false` switch. Off ⇒ the
 * job completes as skipped (logged), the runner is never called.
 */
@Processor(SUPPLIER_SYNC_QUEUE)
export class SupplierSyncJobProcessor {
  private readonly logger = new Logger(SupplierSyncJobProcessor.name);

  constructor(
    private readonly runner: SupplierSyncRunner,
    private readonly config: ConfigService,
  ) {}

  @Process(SUPPLIER_SYNC_JOB)
  async handle(): Promise<RunSummary | SupplierSyncSkipped> {
    if (!isSupplierSyncEnabled(this.config)) {
      this.logger.warn(
        '⏸️ supplier-sync job skipped — SUPPLIER_TRUTH_SYNC_ENABLED!=true (no portal hit, no DB write)',
      );
      return { skipped: 'SUPPLIER_TRUTH_SYNC_ENABLED!=true' };
    }
    const summary = await this.runner.runSync();
    this.logger.log(
      `supplier-sync done: ${summary.suppliersRun} run / ${summary.suppliersFailed} failed / ${summary.suppliersSkipped} skipped, ${summary.refs} refs, ${summary.offersInserted} offers`,
    );
    return summary;
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error): void {
    this.logger.error(`supplier-sync job ${job.id} failed: ${err.message}`);
  }
}
