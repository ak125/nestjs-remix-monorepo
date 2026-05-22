/**
 * Admin endpoints for the price import lifecycle (IsAdminGuard).
 *   POST /api/admin/pricing/import/dry-run   → report + batchId (no writes)
 *   POST /api/admin/pricing/import/commit    → chunked atomic apply
 *   POST /api/admin/pricing/import/rollback  → LIFO restore
 */
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { PriceImportService, type ImportRequest } from '../services/price-import.service';
import { PricingSimulationService } from '../services/pricing-simulation.service';
import type { CustomerType, PricingRule } from '../services/pricing-strategy.service';

@Controller('api/admin/pricing')
@UseGuards(IsAdminGuard)
export class PricingImportController {
  constructor(
    private readonly importService: PriceImportService,
    private readonly simulationService: PricingSimulationService,
  ) {}

  /** Read-only grid simulation (no write). */
  @Post('simulate')
  simulate(@Body() body: { customerType?: CustomerType; candidateRules?: PricingRule[] }) {
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
}
