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
 * Importers:
 *  - `WorkerModule` (where Bull `forRoot` lives), which wires the write/sync side
 *    (connector → processor → runner → Bull scheduler) on top of it;
 *  - `OrdersModule` (decision 50, 2026-11-16), for ONE read only:
 *    `SupplierTruthRepository.getSupplierDirectory()` (`___xtr_supplier`), used by
 *    the admin order-line supplier proposal. No funnel or cart code imports it.
 * `SupplierTruthService` and `OrderAvailabilityService` read the deferred H3
 * consensus tables, which no migration declares (see `supplier-truth.repository.ts`):
 * still not wired to any funnel, cart or order code.
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
