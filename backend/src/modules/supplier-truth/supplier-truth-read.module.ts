import { Module } from '@nestjs/common';
import { SupplierTruthRepository } from './supplier-truth.repository';
import { SupplierTruthService } from './supplier-truth.service';
import { OrderAvailabilityService } from './order-availability.service';

/**
 * Read-only slice of the Supplier Availability Truth (CQRS read side).
 *
 * Provides ONLY the repository + read service — NO Bull queue, scheduler, or
 * connectors. Consumers that just need to read the canonical projection (the
 * funnel/catalogue, cart, orders) import THIS module, so they never pull in the
 * sync runtime (avoids loading the scheduler into hot paths / DI-coupling Bull).
 *
 * The write/sync side (connector → processor → runner → Bull scheduler) is wired in
 * `WorkerModule` (where Bull `forRoot` lives), which imports this read slice. So the
 * sync runs once at app root via WorkerModule; read consumers import this module only.
 */
@Module({
  providers: [
    SupplierTruthRepository,
    SupplierTruthService,
    OrderAvailabilityService,
  ],
  // Repository is exported so the write/sync side (SupplierTruthModule) reuses
  // the single data-access provider; funnel uses SupplierTruthService; the order
  // last-mile uses OrderAvailabilityService.
  exports: [
    SupplierTruthService,
    SupplierTruthRepository,
    OrderAvailabilityService,
  ],
})
export class SupplierTruthReadModule {}
