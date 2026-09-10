import { Module } from '@nestjs/common';
import { SupplierTruthRepository } from './supplier-truth.repository';
import { SupplierTruthService } from './supplier-truth.service';
import { OrderAvailabilityService } from './order-availability.service';

/**
 * Read-only slice of the Supplier Availability Truth (CQRS read side).
 *
 * Provides ONLY the repository + read services — NO Bull queue, scheduler, or
 * connectors, so an importer never pulls the sync runtime into its DI graph.
 *
 * Its only importer is `WorkerModule` (where Bull `forRoot` lives), which wires the
 * write/sync side (connector → processor → runner → Bull scheduler) on top of it.
 * NOT WIRED to any funnel, cart or order code: `SupplierTruthService` and
 * `OrderAvailabilityService` read the deferred H3 consensus tables, which no
 * migration declares (see `supplier-truth.repository.ts`).
 */
@Module({
  providers: [
    SupplierTruthRepository,
    SupplierTruthService,
    OrderAvailabilityService,
  ],
  // Repository is exported for the sync processor/runner that WorkerModule builds
  // (`insertOffer`). The two read services are exported for the deferred H3
  // consumers; none injects them today.
  exports: [
    SupplierTruthService,
    SupplierTruthRepository,
    OrderAvailabilityService,
  ],
})
export class SupplierTruthReadModule {}
