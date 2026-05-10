/**
 * 🔧 ADMIN GAMMES SEO - THRESHOLDS CONTROLLER
 *
 * Configuration endpoints: Smart Action threshold management
 * - GET  /api/admin/gammes-seo/thresholds       → Seuils actuels
 * - PUT  /api/admin/gammes-seo/thresholds       → Modifier seuils
 * - POST /api/admin/gammes-seo/thresholds/reset → Réinitialiser seuils
 */

import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Req,
  UseGuards,
  Logger,
} from '@nestjs/common';
import {
  OperationFailedException,
  DomainValidationException,
} from '@common/exceptions';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { AdminGammesSeoService } from '../services/admin-gammes-seo.service';

@Controller('api/admin/gammes-seo')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class AdminGammesSeoThresholdsController {
  private readonly logger = new Logger(AdminGammesSeoThresholdsController.name);

  constructor(private readonly gammesSeoService: AdminGammesSeoService) {}

  /**
   * 🔧 GET /api/admin/gammes-seo/thresholds
   * Récupère les seuils actuels et la matrice de décision
   */
  @Get('thresholds')
  async getThresholds() {
    try {
      this.logger.log('🔧 GET /api/admin/gammes-seo/thresholds');

      const thresholdsService = this.gammesSeoService.getThresholdsService();
      const result = await thresholdsService.getDecisionMatrix();

      return {
        success: true,
        data: result,
        message: 'Seuils récupérés',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error getting thresholds:', error);
      throw new OperationFailedException({
        message: 'Erreur lors de la récupération des seuils',
      });
    }
  }

  /**
   * 🔧 PUT /api/admin/gammes-seo/thresholds
   * Met à jour les seuils (avec audit)
   */
  @Put('thresholds')
  async updateThresholds(
    @Req() req: any,
    @Body()
    body: {
      trends_high?: number;
      trends_medium?: number;
      seo_excellent?: number;
      seo_good?: number;
    },
  ) {
    try {
      this.logger.log('🔧 PUT /api/admin/gammes-seo/thresholds');

      const thresholdsService = this.gammesSeoService.getThresholdsService();
      const auditService = this.gammesSeoService.getAuditService();

      const result = await thresholdsService.updateThresholds(body);

      // Log to audit
      const user = req.user;
      await auditService.logAction({
        adminId: user?.cst_id || user?.id || 0,
        adminEmail: user?.cst_email || user?.email || 'unknown',
        actionType: 'THRESHOLD_UPDATE',
        entityType: 'threshold',
        entityIds: null,
        oldValues: result.oldThresholds,
        newValues: result.newThresholds,
        impactSummary: 'Seuils Smart Action modifiés',
      });

      return {
        success: result.success,
        message: result.message,
        data: {
          oldThresholds: result.oldThresholds,
          newThresholds: result.newThresholds,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error updating thresholds:', error);
      throw new DomainValidationException({
        message:
          error instanceof Error
            ? error.message
            : 'Erreur lors de la mise à jour des seuils',
      });
    }
  }

  /**
   * 🔄 POST /api/admin/gammes-seo/thresholds/reset
   * Réinitialise les seuils aux valeurs par défaut (avec audit)
   */
  @Post('thresholds/reset')
  async resetThresholds(@Req() req: any) {
    try {
      this.logger.log('🔄 POST /api/admin/gammes-seo/thresholds/reset');

      const thresholdsService = this.gammesSeoService.getThresholdsService();
      const auditService = this.gammesSeoService.getAuditService();

      const result = await thresholdsService.resetToDefaults();

      // Log to audit
      const user = req.user;
      await auditService.logAction({
        adminId: user?.cst_id || user?.id || 0,
        adminEmail: user?.cst_email || user?.email || 'unknown',
        actionType: 'THRESHOLD_RESET',
        entityType: 'threshold',
        entityIds: null,
        oldValues: result.oldThresholds,
        newValues: result.newThresholds,
        impactSummary: 'Seuils réinitialisés aux valeurs par défaut',
      });

      return {
        success: result.success,
        message: result.message,
        data: {
          oldThresholds: result.oldThresholds,
          newThresholds: result.newThresholds,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error resetting thresholds:', error);
      throw new OperationFailedException({
        message: 'Erreur lors de la réinitialisation des seuils',
      });
    }
  }
}
