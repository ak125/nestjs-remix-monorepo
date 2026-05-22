/**
 * Admin endpoints for the price import lifecycle (IsAdminGuard).
 *   POST /api/admin/pricing/import/dry-run   → report + batchId (no writes)
 *   POST /api/admin/pricing/import/commit    → chunked atomic apply
 *   POST /api/admin/pricing/import/rollback  → LIFO restore
 */
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { PriceImportService, type ImportRequest } from '../services/price-import.service';

@Controller('api/admin/pricing/import')
@UseGuards(IsAdminGuard)
export class PricingImportController {
  constructor(private readonly importService: PriceImportService) {}

  @Post('dry-run')
  dryRun(@Body() body: ImportRequest) {
    return this.importService.dryRun(body);
  }

  @Post('commit')
  commit(@Body() body: ImportRequest & { batchId: string }) {
    return this.importService.commit(body.batchId, body);
  }

  @Post('rollback')
  rollback(@Body() body: { batchId: string; supplierId: string }) {
    return this.importService.rollback(body.batchId, body.supplierId);
  }
}
