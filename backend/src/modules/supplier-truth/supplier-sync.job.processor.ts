import { Logger } from '@nestjs/common';
import { OnQueueFailed, Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import {
  SUPPLIER_SYNC_QUEUE,
  SUPPLIER_SYNC_JOB,
} from './supplier-sync.scheduler';
import { SupplierSyncRunner, type RunSummary } from './supplier-sync.runner';

/** Consumes the scheduled supplier-sync job → one full sync cycle. */
@Processor(SUPPLIER_SYNC_QUEUE)
export class SupplierSyncJobProcessor {
  private readonly logger = new Logger(SupplierSyncJobProcessor.name);

  constructor(private readonly runner: SupplierSyncRunner) {}

  @Process(SUPPLIER_SYNC_JOB)
  async handle(): Promise<RunSummary> {
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
