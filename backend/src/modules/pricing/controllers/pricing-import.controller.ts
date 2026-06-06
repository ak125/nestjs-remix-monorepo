/**
 * Admin endpoints for the price import + activation lifecycle (IsAdminGuard).
 *   POST /api/admin/pricing/import/dry-run     → report + batchId (no writes)
 *   POST /api/admin/pricing/import/commit      → chunked atomic apply
 *   POST /api/admin/pricing/import/rollback    → LIFO restore
 *   POST /api/admin/pricing/activate/dry-run   → dispo-only projection (no writes)
 *   POST /api/admin/pricing/activate/commit    → flip pri_dispo 1/2 (confirm:true)
 *   POST /api/admin/pricing/activate/rollback  → LIFO restore of an activation batch
 */
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsAdminGuard } from '@auth/is-admin.guard';
import {
  PriceImportService,
  type ImportRequest,
} from '../services/price-import.service';
import {
  PriceActivationService,
  type ActivationRequest,
} from '../services/price-activation.service';
import { PricingSimulationService } from '../services/pricing-simulation.service';
import type {
  CustomerType,
  PricingRule,
} from '../services/pricing-strategy.service';

@Controller('api/admin/pricing')
@UseGuards(IsAdminGuard)
export class PricingImportController {
  constructor(
    private readonly importService: PriceImportService,
    private readonly activationService: PriceActivationService,
    private readonly simulationService: PricingSimulationService,
  ) {}

  /** Read-only grid simulation (no write). */
  @Post('simulate')
  simulate(
    @Body()
    body: {
      customerType?: CustomerType;
      candidateRules?: PricingRule[];
    },
  ) {
    return this.simulationService.simulate(body);
  }

  @Post('import/dry-run')
  dryRun(@Body() body: ImportRequest) {
    return this.importService.dryRun(body);
  }

  @Post('import/commit')
  commit(@Body() body: ImportRequest & { batchId: string }) {
    return this.importService.commit(body.batchId, body);
  }

  @Post('import/rollback')
  rollback(@Body() body: { batchId: string; supplierId: string }) {
    return this.importService.rollback(body.batchId, body.supplierId);
  }

  /** Read-only activation projection (no writes). */
  @Post('activate/dry-run')
  activateDryRun(@Body() body: ActivationRequest) {
    return this.activationService.dryRun(body);
  }

  /** Apply the dispo-only activation — requires `confirm: true` (owner-gated). */
  @Post('activate/commit')
  activateCommit(@Body() body: ActivationRequest & { confirm?: boolean }) {
    return this.activationService.commit(body);
  }

  @Post('activate/rollback')
  activateRollback(@Body() body: { batchId: string; supplierId: string }) {
    return this.activationService.rollback(body.batchId, body.supplierId);
  }
}
