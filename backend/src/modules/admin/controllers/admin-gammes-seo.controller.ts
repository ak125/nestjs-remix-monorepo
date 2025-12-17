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
 */

import {
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Body,
  Param,
  Res,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger,
  ParseIntPipe,
} from '@nestjs/common';
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

      const result = await this.gammesSeoService.getGammesList(filters, pagination);

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
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send('\uFEFF' + csv); // BOM for Excel UTF-8 compatibility
    } catch (error) {
      this.logger.error('❌ Error in exportCsv:', error);
      throw new HttpException(
        {
          success: false,
          message: 'Erreur lors de l\'export CSV',
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
      this.logger.log(`🔧 PATCH /api/admin/gammes-seo/batch (${body.pgIds?.length} gammes)`);

      if (!body.pgIds || !Array.isArray(body.pgIds) || body.pgIds.length === 0) {
        throw new HttpException(
          { success: false, message: 'pgIds requis (tableau non vide)' },
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.gammesSeoService.batchUpdate(body.pgIds, body.updateData);

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
   * Appliquer une action prédéfinie
   */
  @Post('action')
  async applyPredefinedAction(
    @Body() body: { pgIds: number[]; actionId: string },
  ) {
    try {
      this.logger.log(`🚀 POST /api/admin/gammes-seo/action (${body.actionId})`);

      if (!body.pgIds || !Array.isArray(body.pgIds) || body.pgIds.length === 0) {
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

      const result = await this.gammesSeoService.applyPredefinedAction(body.pgIds, body.actionId);

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
          message: 'Erreur lors de l\'application de l\'action',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
