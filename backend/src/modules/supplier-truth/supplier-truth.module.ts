/**
 * SupplierTruthModule — runtime wiring of the supplier availability sentinel.
 *
 * INERT MODE by default (owner-gated). This module instantiates the sentinel's
 * components (connectors registry + runner + processor + BullMQ scheduler/job +
 * the REAL event sink) and exposes a read-only observability endpoint — but it
 * runs NO sync: the scheduler arms its repeatable job ONLY when
 * `SUPPLIER_TRUTH_SYNC_ENABLED=true`. Off (default) → no job armed → the
 * @Processor never receives work → no connector login / portal hit / DB write.
 *
 * Status: PARTIAL_READY → OBSERVABLE_DORMANT. The components are live-verified
 * (DCA #826/#827, CAL #828); this PR makes them instantiated + observable, not
 * active. Activation (flag ON) stays a separate, owner-gated decision.
 */
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { DatabaseModule } from '../../database/database.module';
import { SupplierTruthRepository } from './supplier-truth.repository';
import { SupplierTruthService } from './supplier-truth.service';
import { SupplierTruthEventSink } from './supplier-truth-event-sink';
import { SupplierSyncProcessor } from './supplier-sync.processor';
import {
  SupplierSyncRunner,
  defaultConnectorFactory,
  envCredResolver,
} from './supplier-sync.runner';
import { SupplierSyncJobProcessor } from './supplier-sync.job.processor';
import {
  SupplierSyncScheduler,
  SUPPLIER_SYNC_QUEUE,
} from './supplier-sync.scheduler';
import { SupplierTruthController } from './supplier-truth.controller';

@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({ name: SUPPLIER_SYNC_QUEUE }),
  ],
  controllers: [SupplierTruthController],
  providers: [
    SupplierTruthRepository,
    SupplierTruthService,
    SupplierTruthEventSink,
    // Processor + runner get the REAL event sink (not noopSink) via factory, so
    // degradation/observability events are actually emitted once active.
    {
      provide: SupplierSyncProcessor,
      useFactory: (
        repo: SupplierTruthRepository,
        sink: SupplierTruthEventSink,
      ) => new SupplierSyncProcessor(repo, sink.emit),
      inject: [SupplierTruthRepository, SupplierTruthEventSink],
    },
    {
      provide: SupplierSyncRunner,
      useFactory: (
        repo: SupplierTruthRepository,
        processor: SupplierSyncProcessor,
        sink: SupplierTruthEventSink,
      ) =>
        new SupplierSyncRunner(
          repo,
          processor,
          defaultConnectorFactory,
          envCredResolver,
          sink.emit,
        ),
      inject: [
        SupplierTruthRepository,
        SupplierSyncProcessor,
        SupplierTruthEventSink,
      ],
    },
    SupplierSyncJobProcessor,
    SupplierSyncScheduler,
  ],
  exports: [SupplierTruthService],
})
export class SupplierTruthModule {}
