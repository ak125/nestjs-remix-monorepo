/**
 * 📊 ADMIN GAMMES SEO - V-LEVEL CONTROLLER
 *
 * V-Level management + Section K compliance endpoints
 * - POST /api/admin/gammes-seo/:pgId/recalculate-vlevel → Recalcul V-Level
 * - GET  /api/admin/gammes-seo/v-level/validate         → Validation règles V1
 * - GET  /api/admin/gammes-seo/v-level/global-stats     → Stats globales V-Level
 * - GET  /api/admin/gammes-seo/section-k/metrics        → Métriques Section K
 * - GET  /api/admin/gammes-seo/section-k/:pgId/missing  → Type_ids manquants
 * - GET  /api/admin/gammes-seo/section-k/:pgId/extras   → Type_ids en surplus
 */

import {
  Controller,
  Get,
  Post,
  Query,
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

  // ============== V-LEVEL ENDPOINTS ==============

  /**
   * 🔄 POST /api/admin/gammes-seo/:pgId/recalculate-vlevel
   * Recalcule les V-Level pour une gamme spécifique
   */
  @Post(':pgId/recalculate-vlevel')
  async recalculateVLevel(@Param('pgId', ParseIntPipe) pgId: number) {
    try {
      this.logger.log(
        `🔄 POST /api/admin/gammes-seo/${pgId}/recalculate-vlevel`,
      );

      const result = await this.gammesSeoService.recalculateVLevel(pgId);

      return {
        success: true,
        message: result.message,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `❌ Error recalculating V-Level for gamme ${pgId}:`,
        error,
      );
      throw new OperationFailedException({
        message: 'Erreur lors du recalcul V-Level',
      });
    }
  }

  /**
   * 🔍 GET /api/admin/gammes-seo/v-level/validate
   * Valide les règles V-Level (V1 >= 30% G1)
   */
  @Get('v-level/validate')
  async validateVLevelRules() {
    try {
      this.logger.log('🔍 GET /api/admin/gammes-seo/v-level/validate');

      const result = await this.gammesSeoService.validateV1Rules();

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error validating V-Level rules:', error);
      throw new OperationFailedException({
        message: 'Erreur lors de la validation V-Level',
      });
    }
  }

  /**
   * 📊 GET /api/admin/gammes-seo/v-level/global-stats
   * Statistiques globales V-Level pour le dashboard
   */
  @Get('v-level/global-stats')
  async getVLevelGlobalStats() {
    try {
      this.logger.log('📊 GET /api/admin/gammes-seo/v-level/global-stats');

      const stats = await this.gammesSeoService
        .getBadgesService()
        .getVLevelGlobalStats();

      return {
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error fetching V-Level global stats:', error);
      throw new OperationFailedException({
        message: 'Erreur lors de la récupération des stats V-Level',
      });
    }
  }

  // ============== SECTION K - V-LEVEL CONFORMITÉ ==============

  /**
   * 📊 GET /api/admin/gammes-seo/section-k/metrics
   * Métriques Section K pour dashboard conformité V-Level
   */
  @Get('section-k/metrics')
  async getSectionKMetrics(@Query('pg_id') pgId?: string) {
    try {
      this.logger.log(
        `📊 GET /api/admin/gammes-seo/section-k/metrics (pg_id=${pgId || 'all'})`,
      );

      const pgIdNum = pgId ? parseInt(pgId, 10) : undefined;
      const result = await this.gammesSeoService
        .getBadgesService()
        .getSectionKMetrics(pgIdNum);

      return {
        success: true,
        ...result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error fetching Section K metrics:', error);
      throw new OperationFailedException({
        message: 'Erreur lors de la récupération des métriques Section K',
      });
    }
  }

  /**
   * 🔍 GET /api/admin/gammes-seo/section-k/:pgId/missing
   * Détail des type_ids manquants pour une gamme
   */
  @Get('section-k/:pgId/missing')
  async getSectionKMissing(@Param('pgId') pgId: string) {
    try {
      const pgIdNum = parseInt(pgId, 10);
      this.logger.log(
        `🔍 GET /api/admin/gammes-seo/section-k/${pgIdNum}/missing`,
      );

      const data = await this.gammesSeoService
        .getSectionKService()
        .getSectionKMissingDetails(pgIdNum);

      return {
        success: true,
        data,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error fetching Section K missing:', error);
      throw new OperationFailedException({
        message: 'Erreur lors de la récupération des manquants Section K',
      });
    }
  }

  /**
   * 🔍 GET /api/admin/gammes-seo/section-k/:pgId/extras
   * Détail des type_ids en surplus pour une gamme
   */
  @Get('section-k/:pgId/extras')
  async getSectionKExtras(@Param('pgId') pgId: string) {
    try {
      const pgIdNum = parseInt(pgId, 10);
      this.logger.log(
        `🔍 GET /api/admin/gammes-seo/section-k/${pgIdNum}/extras`,
      );

      const data = await this.gammesSeoService
        .getSectionKService()
        .getSectionKExtrasDetails(pgIdNum);

      return {
        success: true,
        data,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error fetching Section K extras:', error);
      throw new OperationFailedException({
        message: 'Erreur lors de la récupération des extras Section K',
      });
    }
  }
}
