/**
 * 🎯 ADMIN GAMMES SEO CONTROLLER
 *
 * API pour la gestion des gammes SEO (G-Level classification)
 * Endpoints:
 * - GET  /api/admin/gammes-seo          → Liste paginée avec filtres
 * - GET  /api/admin/gammes-seo/stats    → KPIs et statistiques
 * - GET  /api/admin/gammes-seo/families → Liste des familles (dropdown)
 * - GET  /api/admin/gammes-seo/actions  → Actions disponibles
 * - GET  /api/admin/gammes-seo/export   → Export CSV
 * - PATCH /api/admin/gammes-seo/:id     → Mise à jour d'une gamme
 * - PATCH /api/admin/gammes-seo/batch   → Mise à jour en masse
 * - POST /api/admin/gammes-seo/action   → Appliquer action prédéfinie
 * - GET  /api/admin/gammes-seo/thresholds       → Seuils actuels
 * - PUT  /api/admin/gammes-seo/thresholds       → Modifier seuils
 * - POST /api/admin/gammes-seo/thresholds/reset → Réinitialiser seuils
 * - GET  /api/admin/gammes-seo/audit            → Historique des actions
 * - GET  /api/admin/gammes-seo/audit/stats      → Stats audit
 * - PUT  /api/admin/gammes-seo/:pgId/seo        → Sauvegarder SEO depuis formulaire
 * - POST /api/admin/gammes-seo/:pgId/generate-seo → Générer SEO automatiquement
 */

import {
  Controller,
  Get,
  Put,
  Patch,
  Post,
  Delete,
  Query,
  Body,
  Param,
  Res,
  Req,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger,
  ParseIntPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { Response } from 'express';
import { AuthenticatedGuard } from '../../../auth/authenticated.guard';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
import {
  AdminGammesSeoService,
  GammeSeoFilters,
  GammeSeoPagination,
  GammeSeoUpdateData,
} from '../services/admin-gammes-seo.service';

@Controller('api/admin/gammes-seo')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class AdminGammesSeoController {
  private readonly logger = new Logger(AdminGammesSeoController.name);

  constructor(private readonly gammesSeoService: AdminGammesSeoService) {}

  /**
   * 📋 GET /api/admin/gammes-seo
   * Liste des gammes avec filtres et pagination
   */
  @Get()
  async getGammesList(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('search') search?: string,
    @Query('familyId') familyId?: string,
    @Query('gLevel') gLevel?: 'G1' | 'G2' | 'G3',
    @Query('status') status?: 'INDEX' | 'NOINDEX',
    @Query('actionRecommended') actionRecommended?: string,
    @Query('minTrends') minTrends?: string,
    @Query('maxTrends') maxTrends?: string,
  ) {
    try {
      this.logger.log('📋 GET /api/admin/gammes-seo');

      const filters: GammeSeoFilters = {};
      if (search) filters.search = search;
      if (familyId) filters.familyId = parseInt(familyId, 10);
      if (gLevel) filters.gLevel = gLevel;
      if (status) filters.status = status;
      if (actionRecommended) filters.actionRecommended = actionRecommended;
      if (minTrends) filters.minTrends = parseInt(minTrends, 10);
      if (maxTrends) filters.maxTrends = parseInt(maxTrends, 10);

      const pagination: GammeSeoPagination = {
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 50,
        sortBy: sortBy || 'trends_index',
        sortOrder: sortOrder || 'desc',
      };

      const result = await this.gammesSeoService.getGammesList(
        filters,
        pagination,
      );

      return {
        success: true,
        ...result,
        message: `${result.data.length} gammes récupérées`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error in getGammesList:', error);
      throw new HttpException(
        {
          success: false,
          message: 'Erreur lors de la récupération des gammes',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 📊 GET /api/admin/gammes-seo/stats
   * KPIs et statistiques globales
   */
  @Get('stats')
  async getStats() {
    try {
      this.logger.log('📊 GET /api/admin/gammes-seo/stats');

      const stats = await this.gammesSeoService.getStats();

      return {
        success: true,
        data: stats,
        message: 'Statistiques récupérées',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error in getStats:', error);
      throw new HttpException(
        {
          success: false,
          message: 'Erreur lors de la récupération des statistiques',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 📋 GET /api/admin/gammes-seo/families
   * Liste des familles pour le dropdown de filtre
   */
  @Get('families')
  async getFamilies() {
    try {
      this.logger.log('📋 GET /api/admin/gammes-seo/families');

      const families = await this.gammesSeoService.getFamilies();

      return {
        success: true,
        data: families,
        message: `${families.length} familles récupérées`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error in getFamilies:', error);
      throw new HttpException(
        {
          success: false,
          message: 'Erreur lors de la récupération des familles',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🎯 GET /api/admin/gammes-seo/actions
   * Liste des actions prédéfinies disponibles
   */
  @Get('actions')
  async getAvailableActions() {
    try {
      this.logger.log('🎯 GET /api/admin/gammes-seo/actions');

      const actions = this.gammesSeoService.getAvailableActions();

      return {
        success: true,
        data: actions,
        message: 'Actions disponibles récupérées',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error in getAvailableActions:', error);
      throw new HttpException(
        {
          success: false,
          message: 'Erreur lors de la récupération des actions',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 📤 GET /api/admin/gammes-seo/export
   * Export CSV des gammes
   */
  @Get('export')
  async exportCsv(@Res() res: Response) {
    try {
      this.logger.log('📤 GET /api/admin/gammes-seo/export');

      const csv = await this.gammesSeoService.exportCsv();

      const filename = `gammes-seo-${new Date().toISOString().split('T')[0]}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );
      res.send('\uFEFF' + csv); // BOM for Excel UTF-8 compatibility
    } catch (error) {
      this.logger.error('❌ Error in exportCsv:', error);
      throw new HttpException(
        {
          success: false,
          message: "Erreur lors de l'export CSV",
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 📋 GET /api/admin/gammes-seo/:id/detail
   * Détail complet d'une gamme avec SEO, switches, articles, véhicules
   */
  @Get(':id/detail')
  async getGammeDetail(@Param('id', ParseIntPipe) id: number) {
    try {
      this.logger.log(`📋 GET /api/admin/gammes-seo/${id}/detail`);

      const detail = await this.gammesSeoService.getGammeDetail(id);

      return {
        success: true,
        data: detail,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ Error getting gamme detail ${id}:`, error);
      throw new HttpException(
        {
          success: false,
          message: 'Erreur lors de la récupération du détail gamme',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🔧 PATCH /api/admin/gammes-seo/:id
   * Mise à jour d'une gamme
   */
  @Patch(':id')
  async updateGamme(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateData: GammeSeoUpdateData,
  ) {
    try {
      this.logger.log(`🔧 PATCH /api/admin/gammes-seo/${id}`);

      const result = await this.gammesSeoService.updateGamme(id, updateData);

      return {
        success: result.success,
        message: result.message,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ Error updating gamme ${id}:`, error);
      throw new HttpException(
        {
          success: false,
          message: `Erreur lors de la mise à jour de la gamme ${id}`,
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🔧 PATCH /api/admin/gammes-seo/batch
   * Mise à jour en masse
   */
  @Patch('batch')
  async batchUpdate(
    @Body() body: { pgIds: number[]; updateData: GammeSeoUpdateData },
  ) {
    try {
      this.logger.log(
        `🔧 PATCH /api/admin/gammes-seo/batch (${body.pgIds?.length} gammes)`,
      );

      if (
        !body.pgIds ||
        !Array.isArray(body.pgIds) ||
        body.pgIds.length === 0
      ) {
        throw new HttpException(
          { success: false, message: 'pgIds requis (tableau non vide)' },
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.gammesSeoService.batchUpdate(
        body.pgIds,
        body.updateData,
      );

      return {
        success: result.success,
        message: result.message,
        updated: result.updated,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error in batch update:', error);
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        {
          success: false,
          message: 'Erreur lors de la mise à jour en masse',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🚀 POST /api/admin/gammes-seo/action
   * Appliquer une action prédéfinie (avec audit)
   */
  @Post('action')
  async applyPredefinedAction(
    @Req() req: Request,
    @Body() body: { pgIds: number[]; actionId: string },
  ) {
    try {
      this.logger.log(
        `🚀 POST /api/admin/gammes-seo/action (${body.actionId})`,
      );

      if (
        !body.pgIds ||
        !Array.isArray(body.pgIds) ||
        body.pgIds.length === 0
      ) {
        throw new HttpException(
          { success: false, message: 'pgIds requis (tableau non vide)' },
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!body.actionId) {
        throw new HttpException(
          { success: false, message: 'actionId requis' },
          HttpStatus.BAD_REQUEST,
        );
      }

      // Extract admin info from session for audit logging
      const user = (req as any).user;
      const adminInfo = user
        ? { id: user.cst_id || user.id, email: user.cst_email || user.email }
        : undefined;

      const result = await this.gammesSeoService.applyPredefinedAction(
        body.pgIds,
        body.actionId,
        adminInfo,
      );

      return {
        success: result.success,
        message: result.message,
        updated: result.updated,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error applying predefined action:', error);
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        {
          success: false,
          message: "Erreur lors de l'application de l'action",
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ============== THRESHOLDS ENDPOINTS ==============

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
      throw new HttpException(
        {
          success: false,
          message: 'Erreur lors de la récupération des seuils',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🔧 PUT /api/admin/gammes-seo/thresholds
   * Met à jour les seuils (avec audit)
   */
  @Put('thresholds')
  async updateThresholds(
    @Req() req: Request,
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
      const user = (req as any).user;
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
      throw new HttpException(
        {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'Erreur lors de la mise à jour des seuils',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * 🔄 POST /api/admin/gammes-seo/thresholds/reset
   * Réinitialise les seuils aux valeurs par défaut (avec audit)
   */
  @Post('thresholds/reset')
  async resetThresholds(@Req() req: Request) {
    try {
      this.logger.log('🔄 POST /api/admin/gammes-seo/thresholds/reset');

      const thresholdsService = this.gammesSeoService.getThresholdsService();
      const auditService = this.gammesSeoService.getAuditService();

      const result = await thresholdsService.resetToDefaults();

      // Log to audit
      const user = (req as any).user;
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
      throw new HttpException(
        {
          success: false,
          message: 'Erreur lors de la réinitialisation des seuils',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ============== AUDIT ENDPOINTS ==============

  /**
   * 📜 GET /api/admin/gammes-seo/audit
   * Récupère l'historique des actions
   */
  @Get('audit')
  async getAuditHistory(
    @Query('actionType') actionType?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    try {
      this.logger.log('📜 GET /api/admin/gammes-seo/audit');

      const auditService = this.gammesSeoService.getAuditService();
      const result = await auditService.getAuditHistory({
        actionType: actionType as any,
        dateFrom,
        dateTo,
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
      });

      return {
        success: true,
        data: result.data,
        total: result.total,
        message: `${result.data.length} entrées récupérées`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error getting audit history:', error);
      throw new HttpException(
        {
          success: false,
          message: "Erreur lors de la récupération de l'historique",
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 📊 GET /api/admin/gammes-seo/audit/stats
   * Statistiques d'audit
   */
  @Get('audit/stats')
  async getAuditStats() {
    try {
      this.logger.log('📊 GET /api/admin/gammes-seo/audit/stats');

      const auditService = this.gammesSeoService.getAuditService();
      const stats = await auditService.getAuditStats();

      return {
        success: true,
        data: stats,
        message: 'Statistiques audit récupérées',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error getting audit stats:', error);
      throw new HttpException(
        {
          success: false,
          message: 'Erreur lors de la récupération des statistiques',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

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
      throw new HttpException(
        {
          success: false,
          message: 'Erreur lors du recalcul V-Level',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
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
      throw new HttpException(
        {
          success: false,
          message: 'Erreur lors de la validation V-Level',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
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

      const stats = await this.gammesSeoService.getVLevelGlobalStats();

      return {
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error fetching V-Level global stats:', error);
      throw new HttpException(
        {
          success: false,
          message: 'Erreur lors de la récupération des stats V-Level',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ============== SEO MANAGEMENT ENDPOINTS ==============

  /**
   * 💾 PUT /api/admin/gammes-seo/:pgId/seo
   * Met à jour les données SEO d'une gamme (depuis le formulaire admin)
   */
  @Put(':pgId/seo')
  async updateGammeSeo(
    @Param('pgId', ParseIntPipe) pgId: number,
    @Body()
    seoData: {
      sg_title: string;
      sg_descrip: string;
      sg_keywords: string;
      sg_h1: string;
      sg_content: string;
    },
  ) {
    try {
      this.logger.log(`💾 PUT /api/admin/gammes-seo/${pgId}/seo`);

      const result = await this.gammesSeoService.updateGammeSeo(pgId, seoData);

      return {
        success: true,
        message: result.message,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ Error updating SEO for gamme ${pgId}:`, error);
      throw new HttpException(
        {
          success: false,
          message: 'Erreur lors de la mise à jour SEO',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ============== PURCHASE GUIDE ENDPOINTS ==============

  /**
   * 📖 GET /api/admin/gammes-seo/:pgId/purchase-guide
   * Récupère le guide d'achat d'une gamme
   */
  @Get(':pgId/purchase-guide')
  async getPurchaseGuide(@Param('pgId', ParseIntPipe) pgId: number) {
    try {
      this.logger.log(`📖 GET /api/admin/gammes-seo/${pgId}/purchase-guide`);

      const guide = await this.gammesSeoService.getPurchaseGuide(pgId);

      return {
        success: true,
        data: guide,
        message: guide ? 'Guide récupéré' : 'Aucun guide pour cette gamme',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `❌ Error fetching purchase guide for gamme ${pgId}:`,
        error,
      );
      throw new HttpException(
        {
          success: false,
          message: 'Erreur lors de la récupération du guide',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 💾 PUT /api/admin/gammes-seo/:pgId/purchase-guide
   * Met à jour ou crée le guide d'achat d'une gamme
   */
  @Put(':pgId/purchase-guide')
  async updatePurchaseGuide(
    @Param('pgId', ParseIntPipe) pgId: number,
    @Body()
    guideData: {
      step1: {
        title: string;
        content: string;
        highlight: string;
        bullets?: string[];
      };
      step2: {
        economique: {
          subtitle: string;
          description: string;
          specs: string[];
          priceRange: string;
        };
        qualitePlus: {
          subtitle: string;
          description: string;
          specs: string[];
          priceRange: string;
          badge?: string;
        };
        premium: {
          subtitle: string;
          description: string;
          specs: string[];
          priceRange: string;
        };
      };
      step3: {
        title: string;
        content: string;
        alerts: Array<{ type: 'danger' | 'warning' | 'info'; text: string }>;
        relatedGammes?: Array<{
          pgId: number;
          pgName: string;
          pgAlias: string;
        }>;
      };
    },
  ) {
    try {
      this.logger.log(`💾 PUT /api/admin/gammes-seo/${pgId}/purchase-guide`);

      const result = await this.gammesSeoService.updatePurchaseGuide(
        pgId,
        guideData,
      );

      return {
        success: result.success,
        message: result.message,
        data: result.guide,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `❌ Error updating purchase guide for gamme ${pgId}:`,
        error,
      );
      throw new HttpException(
        {
          success: false,
          message: "Erreur lors de la mise à jour du guide d'achat",
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🗑️ DELETE /api/admin/gammes-seo/:pgId/purchase-guide
   * Supprime le guide d'achat d'une gamme
   */
  @Delete(':pgId/purchase-guide')
  async deletePurchaseGuide(@Param('pgId', ParseIntPipe) pgId: number) {
    try {
      this.logger.log(`🗑️ DELETE /api/admin/gammes-seo/${pgId}/purchase-guide`);

      const result = await this.gammesSeoService.deletePurchaseGuide(pgId);

      return {
        success: result.success,
        message: result.message,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `❌ Error deleting purchase guide for gamme ${pgId}:`,
        error,
      );
      throw new HttpException(
        {
          success: false,
          message: "Erreur lors de la suppression du guide d'achat",
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ============== SEO GENERATION ENDPOINTS ==============

  /**
   * 🎯 POST /api/admin/gammes-seo/:pgId/generate-seo
   * Génère le contenu SEO pour une gamme spécifique
   */
  @Post(':pgId/generate-seo')
  async generateGammeSeo(@Param('pgId', ParseIntPipe) pgId: number) {
    try {
      this.logger.log(`🎯 POST /api/admin/gammes-seo/${pgId}/generate-seo`);

      const result = await this.gammesSeoService.generateGammeSeo(pgId);

      return {
        success: true,
        message: result.message,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ Error generating SEO for gamme ${pgId}:`, error);
      throw new HttpException(
        {
          success: false,
          message: 'Erreur lors de la génération SEO',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🚀 POST /api/admin/gammes-seo/generate-all
   * Génère le SEO pour toutes les gammes (batch)
   */
  @Post('generate-all')
  async generateAllGammesSeo(
    @Body()
    body: {
      onlyEmpty?: boolean;
      gLevels?: string[];
      limit?: number;
    },
  ) {
    try {
      this.logger.log('🚀 POST /api/admin/gammes-seo/generate-all');

      const result = await this.gammesSeoService.generateAllGammesSeo({
        onlyEmpty: body.onlyEmpty ?? true,
        gLevels: body.gLevels,
        limit: body.limit,
      });

      return {
        success: result.success,
        message: result.message,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error in batch SEO generation:', error);
      throw new HttpException(
        {
          success: false,
          message: 'Erreur lors de la génération SEO batch',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 📊 GET /api/admin/gammes-seo/seo-stats
   * Statistiques de couverture SEO
   */
  @Get('seo-stats')
  async getSeoGenerationStats() {
    try {
      this.logger.log('📊 GET /api/admin/gammes-seo/seo-stats');

      const stats = await this.gammesSeoService.getSeoGenerationStats();

      return {
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error getting SEO stats:', error);
      throw new HttpException(
        {
          success: false,
          message: 'Erreur lors de la récupération des stats SEO',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // =========================================================================
  // CRUD Family Switches
  // =========================================================================

  /**
   * ➕ POST /api/admin/gammes-seo/:pgId/switches
   * Créer un Family Switch
   */
  @Post(':pgId/switches')
  async createFamilySwitch(
    @Param('pgId') pgId: string,
    @Body() body: { alias: number; content: string },
  ) {
    try {
      this.logger.log(`➕ POST /api/admin/gammes-seo/${pgId}/switches`);

      const result = await this.gammesSeoService.createFamilySwitch(
        parseInt(pgId, 10),
        body.alias,
        body.content,
      );

      if (!result.success) {
        throw new HttpException(
          { success: false, message: result.error },
          HttpStatus.BAD_REQUEST,
        );
      }

      return {
        success: true,
        id: result.id,
        message: `Switch alias ${body.alias} créé`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('❌ Error creating family switch:', error);
      throw new HttpException(
        {
          success: false,
          message: 'Erreur lors de la création du switch',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * ✏️ PUT /api/admin/gammes-seo/:pgId/switches/:id
   * Modifier un Family Switch
   */
  @Put(':pgId/switches/:id')
  async updateFamilySwitch(
    @Param('pgId') pgId: string,
    @Param('id') id: string,
    @Body() body: { content: string },
  ) {
    try {
      this.logger.log(`✏️ PUT /api/admin/gammes-seo/${pgId}/switches/${id}`);

      const result = await this.gammesSeoService.updateFamilySwitch(
        parseInt(id, 10),
        body.content,
      );

      if (!result.success) {
        throw new HttpException(
          { success: false, message: result.error },
          HttpStatus.BAD_REQUEST,
        );
      }

      return {
        success: true,
        message: 'Switch mis à jour',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('❌ Error updating family switch:', error);
      throw new HttpException(
        {
          success: false,
          message: 'Erreur lors de la mise à jour du switch',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🗑️ DELETE /api/admin/gammes-seo/:pgId/switches/:id
   * Supprimer un Family Switch
   */
  @Delete(':pgId/switches/:id')
  async deleteFamilySwitch(
    @Param('pgId') pgId: string,
    @Param('id') id: string,
  ) {
    try {
      this.logger.log(`🗑️ DELETE /api/admin/gammes-seo/${pgId}/switches/${id}`);

      const result = await this.gammesSeoService.deleteFamilySwitch(
        parseInt(id, 10),
      );

      if (!result.success) {
        throw new HttpException(
          { success: false, message: result.error },
          HttpStatus.BAD_REQUEST,
        );
      }

      return {
        success: true,
        message: 'Switch supprimé',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('❌ Error deleting family switch:', error);
      throw new HttpException(
        {
          success: false,
          message: 'Erreur lors de la suppression du switch',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ============== INFORMATIONS TECHNIQUES ENDPOINTS ==============

  /**
   * 📚 GET /api/admin/gammes-seo/:pgId/informations
   * Récupère toutes les informations techniques d'une gamme
   */
  @Get(':pgId/informations')
  async getInformations(@Param('pgId', ParseIntPipe) pgId: number) {
    try {
      this.logger.log(`📚 GET /api/admin/gammes-seo/${pgId}/informations`);
      const data = await this.gammesSeoService.getInformations(pgId);
      return {
        success: true,
        data,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error getting informations:', error);
      throw new HttpException(
        {
          success: false,
          message: 'Erreur lors de la récupération des informations',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * ➕ POST /api/admin/gammes-seo/:pgId/informations
   * Ajoute une nouvelle information technique
   */
  @Post(':pgId/informations')
  async addInformation(
    @Param('pgId', ParseIntPipe) pgId: number,
    @Body('content') content: string,
  ) {
    try {
      this.logger.log(`➕ POST /api/admin/gammes-seo/${pgId}/informations`);

      if (!content || content.trim().length === 0) {
        throw new HttpException(
          { success: false, message: 'Le contenu est requis' },
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.gammesSeoService.addInformation(pgId, content);

      if (!result.success) {
        throw new HttpException(
          { success: false, message: result.message },
          HttpStatus.BAD_REQUEST,
        );
      }

      return {
        success: true,
        data: result.item,
        message: 'Information ajoutée',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('❌ Error adding information:', error);
      throw new HttpException(
        {
          success: false,
          message: "Erreur lors de l'ajout de l'information",
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * ✏️ PUT /api/admin/gammes-seo/informations/:sgiId
   * Met à jour une information technique
   */
  @Put('informations/:sgiId')
  async updateInformation(
    @Param('sgiId', ParseIntPipe) sgiId: number,
    @Body('content') content: string,
  ) {
    try {
      this.logger.log(`✏️ PUT /api/admin/gammes-seo/informations/${sgiId}`);

      if (!content || content.trim().length === 0) {
        throw new HttpException(
          { success: false, message: 'Le contenu est requis' },
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.gammesSeoService.updateInformation(sgiId, content);

      if (!result.success) {
        throw new HttpException(
          { success: false, message: result.message },
          HttpStatus.BAD_REQUEST,
        );
      }

      return {
        success: true,
        message: 'Information mise à jour',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('❌ Error updating information:', error);
      throw new HttpException(
        {
          success: false,
          message: "Erreur lors de la mise à jour de l'information",
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🗑️ DELETE /api/admin/gammes-seo/informations/:sgiId
   * Supprime une information technique
   */
  @Delete('informations/:sgiId')
  async deleteInformation(@Param('sgiId', ParseIntPipe) sgiId: number) {
    try {
      this.logger.log(`🗑️ DELETE /api/admin/gammes-seo/informations/${sgiId}`);

      const result = await this.gammesSeoService.deleteInformation(sgiId);

      if (!result.success) {
        throw new HttpException(
          { success: false, message: result.message },
          HttpStatus.BAD_REQUEST,
        );
      }

      return {
        success: true,
        message: 'Information supprimée',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('❌ Error deleting information:', error);
      throw new HttpException(
        {
          success: false,
          message: "Erreur lors de la suppression de l'information",
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ============== ÉQUIPEMENTIERS ENDPOINTS ==============

  /**
   * 🏭 GET /api/admin/gammes-seo/:pgId/equipementiers
   * Récupère tous les équipementiers d'une gamme
   */
  @Get(':pgId/equipementiers')
  async getEquipementiers(@Param('pgId', ParseIntPipe) pgId: number) {
    try {
      this.logger.log(`🏭 GET /api/admin/gammes-seo/${pgId}/equipementiers`);
      const data = await this.gammesSeoService.getEquipementiers(pgId);
      return {
        success: true,
        data,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error getting equipementiers:', error);
      throw new HttpException(
        {
          success: false,
          message: 'Erreur lors de la récupération des équipementiers',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 📋 GET /api/admin/gammes-seo/marques/available
   * Liste des marques disponibles pour le dropdown
   */
  @Get('marques/available')
  async getAvailableMarques() {
    try {
      this.logger.log('📋 GET /api/admin/gammes-seo/marques/available');
      const data = await this.gammesSeoService.getAvailableMarques();
      return {
        success: true,
        data,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Error getting available marques:', error);
      throw new HttpException(
        {
          success: false,
          message: 'Erreur lors de la récupération des marques',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * ➕ POST /api/admin/gammes-seo/:pgId/equipementiers
   * Ajoute un équipementier à une gamme
   */
  @Post(':pgId/equipementiers')
  async addEquipementier(
    @Param('pgId', ParseIntPipe) pgId: number,
    @Body() body: { pmId: number; content: string },
  ) {
    try {
      this.logger.log(`➕ POST /api/admin/gammes-seo/${pgId}/equipementiers`);

      if (!body.pmId) {
        throw new HttpException(
          { success: false, message: 'La marque est requise' },
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.gammesSeoService.addEquipementier(
        pgId,
        body.pmId,
        body.content || '',
      );

      if (!result.success) {
        throw new HttpException(
          { success: false, message: result.message },
          HttpStatus.BAD_REQUEST,
        );
      }

      return {
        success: true,
        data: result.item,
        message: 'Équipementier ajouté',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('❌ Error adding equipementier:', error);
      throw new HttpException(
        {
          success: false,
          message: "Erreur lors de l'ajout de l'équipementier",
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * ✏️ PUT /api/admin/gammes-seo/equipementiers/:segId
   * Met à jour la description d'un équipementier
   */
  @Put('equipementiers/:segId')
  async updateEquipementier(
    @Param('segId', ParseIntPipe) segId: number,
    @Body('content') content: string,
  ) {
    try {
      this.logger.log(`✏️ PUT /api/admin/gammes-seo/equipementiers/${segId}`);

      const result = await this.gammesSeoService.updateEquipementier(segId, content || '');

      if (!result.success) {
        throw new HttpException(
          { success: false, message: result.message },
          HttpStatus.BAD_REQUEST,
        );
      }

      return {
        success: true,
        message: 'Équipementier mis à jour',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('❌ Error updating equipementier:', error);
      throw new HttpException(
        {
          success: false,
          message: "Erreur lors de la mise à jour de l'équipementier",
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🗑️ DELETE /api/admin/gammes-seo/equipementiers/:segId
   * Supprime un équipementier d'une gamme
   */
  @Delete('equipementiers/:segId')
  async deleteEquipementier(@Param('segId', ParseIntPipe) segId: number) {
    try {
      this.logger.log(`🗑️ DELETE /api/admin/gammes-seo/equipementiers/${segId}`);

      const result = await this.gammesSeoService.deleteEquipementier(segId);

      if (!result.success) {
        throw new HttpException(
          { success: false, message: result.message },
          HttpStatus.BAD_REQUEST,
        );
      }

      return {
        success: true,
        message: 'Équipementier supprimé',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('❌ Error deleting equipementier:', error);
      throw new HttpException(
        {
          success: false,
          message: "Erreur lors de la suppression de l'équipementier",
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
