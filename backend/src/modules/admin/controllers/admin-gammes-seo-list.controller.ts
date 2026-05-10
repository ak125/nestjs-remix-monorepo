/**
 * 📋 ADMIN GAMMES SEO - LIST CONTROLLER
 *
 * Read-only endpoints: listing, stats, families, actions, export, detail, audit
 * - GET  /api/admin/gammes-seo          → Liste paginée avec filtres
 * - GET  /api/admin/gammes-seo/stats    → KPIs et statistiques
 * - GET  /api/admin/gammes-seo/families → Liste des familles (dropdown)
 * - GET  /api/admin/gammes-seo/actions  → Actions disponibles
 * - GET  /api/admin/gammes-seo/export   → Export CSV
 * - GET  /api/admin/gammes-seo/:id/detail → Détail complet
 * - GET  /api/admin/gammes-seo/audit    → Historique des actions
 * - GET  /api/admin/gammes-seo/audit/stats → Stats audit
 */

import {
  Controller,
  Get,
  Query,
  Param,
  Res,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { OperationFailedException } from '@common/exceptions';
import { Response } from 'express';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import {
  AdminGammesSeoService,
  GammeSeoFilters,
  GammeSeoPagination,
} from '../services/admin-gammes-seo.service';
import { GammeSeoActionType } from '../services/gamme-seo-audit.service';

@Controller('api/admin/gammes-seo')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class AdminGammesSeoListController {
  private readonly logger = new Logger(AdminGammesSeoListController.name);

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
      throw new OperationFailedException({
        message: 'Erreur lors de la récupération des gammes',
      });
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
      throw new OperationFailedException({
        message: 'Erreur lors de la récupération des statistiques',
      });
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
      throw new OperationFailedException({
        message: 'Erreur lors de la récupération des familles',
      });
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
      throw new OperationFailedException({
        message: 'Erreur lors de la récupération des actions',
      });
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
      throw new OperationFailedException({
        message: "Erreur lors de l'export CSV",
      });
    }
  }

  /**
   * 📋 GET /api/admin/gammes-seo/:id/detail
   * Détail complet d'une gamme avec SEO, switches, articles, véhicules
   */
  @Get(':id/detail')
  async getGammeDetail(@Param('id') idOrSlug: string) {
    try {
      const id = await this.gammesSeoService.resolveIdOrSlug(idOrSlug);
      this.logger.log(`📋 GET /api/admin/gammes-seo/${id}/detail`);

      const detail = await this.gammesSeoService.getGammeDetail(id);

      return {
        success: true,
        data: detail,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ Error getting gamme detail ${idOrSlug}:`, error);
      throw new OperationFailedException({
        message: 'Erreur lors de la récupération du détail gamme',
      });
    }
  }

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
        actionType: actionType as GammeSeoActionType | undefined,
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
      throw new OperationFailedException({
        message: "Erreur lors de la récupération de l'historique",
      });
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
      throw new OperationFailedException({
        message: 'Erreur lors de la récupération des statistiques',
      });
    }
  }
}
