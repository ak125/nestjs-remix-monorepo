/**
 * SupplierTruthModule — read-only observability surface for the sentinel.
 *
 * IMPORTANT (CQRS + no-duplication): the supplier-sync WRITE/SYNC side (queue +
 * scheduler + processor + runner + real event sink) is ALREADY wired in
 * `WorkerModule` (where Bull `forRoot` lives) and runs at app root. This module
 * does NOT re-provide any of that — re-registering the queue / scheduler /
 * @Processor here would create a parallel system + a second consumer on the same
 * BullMQ queue. It adds ONLY the admin read endpoint, reusing the shared read
 * slice (`SupplierTruthReadModule`) and reading the activation flag via
 * `ConfigService` (global) — no coupling to the Bull runtime.
 *
 * Inert-by-default is enforced where the job is armed — in the scheduler's
 * `onModuleInit` gate (`SUPPLIER_TRUTH_SYNC_ENABLED`), inside WorkerModule. This
 * endpoint only REPORTS that mode; it never arms, syncs, or mutates anything.
 */
import { Module } from '@nestjs/common';
import { SupplierTruthReadModule } from './supplier-truth-read.module';
import { SupplierTruthController } from './supplier-truth.controller';

@Module({
  imports: [SupplierTruthReadModule],
  controllers: [SupplierTruthController],
})
export class SupplierTruthModule {}
