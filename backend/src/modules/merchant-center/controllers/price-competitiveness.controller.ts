/**
 * PriceCompetitivenessController — admin (IsAdminGuard).
 *
 *   POST /api/admin/merchant-center/price-competitiveness/sync   → pull GMC benchmark
 *   GET  /api/admin/merchant-center/price-competitiveness/gap    → over/under-market list
 *
 * OBSERVE-only: surfaces where we sit vs the market average. It never reprices.
 */
import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { IsAdminGuard } from '@auth/is-admin.guard';
import {
  PriceCompetitivenessService,
  type PriceCompetitivenessSyncResult,
} from '../services/price-competitiveness.service';

@Controller('api/admin/merchant-center/price-competitiveness')
@UseGuards(IsAdminGuard)
export class PriceCompetitivenessController {
  constructor(private readonly service: PriceCompetitivenessService) {}

  /** Trigger a benchmark pull (idempotent per day). */
  @Post('sync')
  sync(
    @Query('country') country = 'FR',
  ): Promise<PriceCompetitivenessSyncResult> {
    return this.service.sync(country);
  }

  /** List offers vs market: positive gap = above the market (candidate to lower). */
  @Get('gap')
  gap(
    @Query('country') country = 'FR',
    @Query('minGap') minGap?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<unknown[]> {
    const min = minGap != null && minGap !== '' ? Number(minGap) : null;
    return this.service.gapReport(
      country,
      Number.isFinite(min as number) ? (min as number) : null,
      limit ? Number(limit) : 200,
      offset ? Number(offset) : 0,
    );
  }
}
