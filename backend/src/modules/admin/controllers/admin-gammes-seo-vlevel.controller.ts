/**
 * ADMIN GAMMES SEO - V-LEVEL CONTROLLER v5.0
 *
 * V-Level management endpoints
 * - POST /api/admin/gammes-seo/:pgId/recalculate-vlevel
 * - GET  /api/admin/gammes-seo/v-level/global-stats
 */

import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Logger,
  ParseIntPipe,
} from '@nestjs/common';
import { OperationFailedException } from '../../../common/exceptions';
import { AuthenticatedGuard } from '../../../auth/authenticated.guard';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
import { AdminGammesSeoService } from '../services/admin-gammes-seo.service';

@Controller('api/admin/gammes-seo')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class AdminGammesSeoVlevelController {
  private readonly logger = new Logger(AdminGammesSeoVlevelController.name);

  constructor(private readonly gammesSeoService: AdminGammesSeoService) {}

  /**
   * POST /api/admin/gammes-seo/:pgId/recalculate-vlevel
   * Recalculate V-Level v5.0 for a specific gamme
   */
  @Post(':pgId/recalculate-vlevel')
  async recalculateVLevel(@Param('pgId', ParseIntPipe) pgId: number) {
    try {
      this.logger.log(`POST /api/admin/gammes-seo/${pgId}/recalculate-vlevel`);

      const result = await this.gammesSeoService.recalculateVLevel(pgId);

      return {
        success: true,
        message: result.message,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Error recalculating V-Level for gamme ${pgId}:`,
        error,
      );
      throw new OperationFailedException({
        message: 'Erreur lors du recalcul V-Level',
      });
    }
  }

  /**
   * GET /api/admin/gammes-seo/v-level/global-stats
   * Global V-Level distribution stats for dashboard
   */
  @Get('v-level/global-stats')
  async getVLevelGlobalStats() {
    try {
      this.logger.log('GET /api/admin/gammes-seo/v-level/global-stats');

      const stats = await this.gammesSeoService
        .getBadgesService()
        .getVLevelGlobalStats();

      return {
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error fetching V-Level global stats:', error);
      throw new OperationFailedException({
        message: 'Erreur lors de la recuperation des stats V-Level',
      });
    }
  }
}
