/**
 * 📊 REPORTING CONTROLLER - Module Admin
 *
 * Contrôleur pour les rapports et analytics administratifs
 * Compatible avec l'architecture existante
 */

import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { OperationFailedException } from '@common/exceptions';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { ReportingService, ReportFilters } from '../services/reporting.service';

@Controller('api/admin/reports')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class ReportingController {
  private readonly logger = new Logger(ReportingController.name);

  constructor(private readonly reportingService: ReportingService) {}

  /**
   * 📊 Rapport analytics global pour le dashboard admin
   */
  @Get('/analytics')
  async getAnalyticsReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('category') category?: string,
  ) {
    try {
      this.logger.log('📊 Génération rapport analytics...');

      const filters: ReportFilters = {};

      if (startDate) {
        filters.startDate = startDate;
      }

      if (endDate) {
        filters.endDate = endDate;
      }

      if (category) {
        filters.category = category;
      }

      const report = await this.reportingService.generateAnalyticsReport();

      this.logger.log('✅ Rapport analytics généré');

      return {
        success: true,
        data: report,
        message: 'Rapport analytics généré avec succès',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Erreur génération rapport analytics:', error);

      throw new OperationFailedException({
        message: 'Erreur lors de la génération du rapport analytics',
      });
    }
  }

  /**
   * 📈 Rapport spécialisé (utilisateurs, commandes, etc.)
   */
  @Post('/generate')
  async generateSpecificReport(
    @Body()
    body: {
      type: string;
      filters?: ReportFilters;
    },
  ) {
    try {
      this.logger.log(`📈 Génération rapport spécialisé: ${body.type}`);

      const report = await this.reportingService.generateSpecificReport(
        body.type,
        body.filters || {},
      );

      this.logger.log(`✅ Rapport ${body.type} généré`);

      return {
        success: true,
        data: report,
        message: `Rapport ${body.type} généré avec succès`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ Erreur génération rapport ${body.type}:`, error);

      throw new OperationFailedException({
        message: `Erreur lors de la génération du rapport ${body.type}`,
      });
    }
  }

  /**
   * 📋 Liste des rapports générés disponibles
   */
  @Get('/generated')
  async getGeneratedReports() {
    try {
      this.logger.log('📋 Récupération liste rapports générés...');

      const reports = await this.reportingService.getGeneratedReports();

      this.logger.log(`✅ ${reports.length} rapports récupérés`);

      return {
        success: true,
        data: reports,
        message: 'Liste des rapports récupérée avec succès',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Erreur récupération rapports:', error);

      throw new OperationFailedException({
        message: 'Erreur lors de la récupération des rapports',
      });
    }
  }

  /**
   * 🔍 Health check du système de reporting
   */
  @Get('/health')
  async healthCheck() {
    try {
      this.logger.log('🔍 Health check reporting...');

      const health = await this.reportingService.healthCheck();

      return {
        success: true,
        data: health,
        message: 'Health check reporting terminé',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Erreur health check reporting:', error);

      throw new OperationFailedException({
        message: 'Erreur lors du health check reporting',
      });
    }
  }
}
