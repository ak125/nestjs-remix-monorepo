/**
 * 🏷️ ADMIN GAMMES SEO - AGGREGATES CONTROLLER
 *
 * Badge aggregates refresh endpoints (Phase 1 Badges SEO V2)
 * - POST /api/admin/gammes-seo/refresh-aggregates      → Rafraîchir tous les agrégats
 * - POST /api/admin/gammes-seo/:pgId/refresh-aggregates → Rafraîchir agrégats d'une gamme
 */

import {
  Controller,
  Post,
  Param,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../../../auth/authenticated.guard';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
import { AdminGammesSeoService } from '../services/admin-gammes-seo.service';

@Controller('api/admin/gammes-seo')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class AdminGammesSeoAggregatesController {
  private readonly logger = new Logger(AdminGammesSeoAggregatesController.name);

  constructor(private readonly gammesSeoService: AdminGammesSeoService) {}

  /**
   * 🔄 POST /api/admin/gammes-seo/refresh-aggregates
   * Rafraîchit les agrégats pour toutes les gammes
   */
  @Post('refresh-aggregates')
  async refreshAllAggregates() {
    try {
      this.logger.log('🔄 POST /api/admin/gammes-seo/refresh-aggregates');

      const result = await this.gammesSeoService
        .getBadgesService()
        .refreshAggregates();

      return {
        success: true,
        data: {
          refreshed: result.refreshed,
          summary: {
            total: result.refreshed,
            withProducts: result.results.filter((r) => r.products_total > 0)
              .length,
            withVehicles: result.results.filter((r) => r.vehicles_total > 0)
              .length,
            withContent: result.results.filter((r) => r.content_words_total > 0)
              .length,
          },
        },
        message: `${result.refreshed} gammes rafraîchies`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error refreshing aggregates:', error);
      throw new HttpException(
        {
          success: false,
          message: 'Erreur lors du rafraîchissement des agrégats',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🔄 POST /api/admin/gammes-seo/:pgId/refresh-aggregates
   * Rafraîchit les agrégats pour une gamme spécifique
   */
  @Post(':pgId/refresh-aggregates')
  async refreshGammeAggregates(@Param('pgId', ParseIntPipe) pgId: number) {
    try {
      this.logger.log(
        `🔄 POST /api/admin/gammes-seo/${pgId}/refresh-aggregates`,
      );

      const result = await this.gammesSeoService
        .getBadgesService()
        .refreshAggregates(pgId);

      if (result.refreshed === 0) {
        throw new HttpException(
          {
            success: false,
            message: `Gamme ${pgId} non trouvée ou inactive`,
          },
          HttpStatus.NOT_FOUND,
        );
      }

      const gammeResult = result.results[0];

      return {
        success: true,
        data: {
          pg_id: pgId,
          products_total: gammeResult?.products_total || 0,
          vehicles_total: gammeResult?.vehicles_total || 0,
          content_words_total: gammeResult?.content_words_total || 0,
        },
        message: `Agrégats rafraîchis pour la gamme ${pgId}`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(
        `❌ Error refreshing aggregates for gamme ${pgId}:`,
        error,
      );
      throw new HttpException(
        {
          success: false,
          message: `Erreur lors du rafraîchissement des agrégats pour la gamme ${pgId}`,
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
