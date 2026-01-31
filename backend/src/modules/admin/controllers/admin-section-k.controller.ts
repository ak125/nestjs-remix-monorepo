import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { SectionKService } from '../services/section-k.service';
import { IsAdminGuard } from '../../../auth/is-admin.guard';

/**
 * Admin Section K Controller - V-Level Conformity API
 *
 * Endpoints:
 * - GET /api/admin/section-k/metrics - Toutes les gammes avec KPIs
 * - GET /api/admin/section-k/metrics?pg_id=7 - Une gamme spécifique
 * - GET /api/admin/section-k/:pgId/missing - Drill-down type_ids manquants
 * - GET /api/admin/section-k/:pgId/extras - Drill-down type_ids extras
 */
@Controller('api/admin/section-k')
@UseGuards(IsAdminGuard)
export class AdminSectionKController {
  constructor(private readonly sectionKService: SectionKService) {}

  /**
   * GET /api/admin/section-k/metrics
   * Récupère les métriques Section K avec KPIs
   */
  @Get('metrics')
  async getMetrics(@Query('pg_id') pgId?: string) {
    const pgIdNum = pgId ? parseInt(pgId, 10) : undefined;
    return this.sectionKService.getSectionKWithKpis(pgIdNum);
  }

  /**
   * GET /api/admin/section-k/:pgId/missing
   * Drill-down: type_ids manquants (T-E)
   */
  @Get(':pgId/missing')
  async getMissing(@Param('pgId') pgId: string) {
    return this.sectionKService.getMissingTypeIds(parseInt(pgId, 10));
  }

  /**
   * GET /api/admin/section-k/:pgId/extras
   * Drill-down: type_ids extras (T-F)
   */
  @Get(':pgId/extras')
  async getExtras(@Param('pgId') pgId: string) {
    return this.sectionKService.getExtrasTypeIds(parseInt(pgId, 10));
  }
}
