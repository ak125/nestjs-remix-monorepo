import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  ParseIntPipe,
  Logger,
} from '@nestjs/common';
import { CommercialArchivesService } from './archives.service';

/**
 * Contrôleur des archives commerciales
 * ✅ Remplace archive.index.php
 * ✅ API moderne avec validation
 * ✅ Pagination et filtrage avancé
 * ✅ Intégré au système d'authentification
 */
@Controller('commercial/archives')
export class CommercialArchivesController {
  private readonly logger = new Logger(CommercialArchivesController.name);

  constructor(private readonly archivesService: CommercialArchivesService) {}

  /**
   * GET /commercial/archives
   * Récupérer les archives avec filtres et pagination
   */
  @Get()
  async getArchives(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('type') type?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    try {
      this.logger.log(
        `GET /commercial/archives - page:${page}, limit:${limit}, type:${type}`,
      );

      const filters = {
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
        type,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
      };

      const result = await this.archivesService.getArchives(filters);

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur récupération archives:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * GET /commercial/archives/stats
   * Statistiques des archives
   */
  @Get('stats')
  async getArchiveStats() {
    try {
      this.logger.log('GET /commercial/archives/stats');

      const stats = await this.archivesService.getArchiveStats();

      return {
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur récupération stats archives:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * POST /commercial/archives/manual-archive/:orderId
   * Archiver manuellement une commande
   */
  @Post('manual-archive/:orderId')
  async manualArchiveOrder(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() body: { reason?: string },
  ) {
    try {
      this.logger.log(`POST /commercial/archives/manual-archive/${orderId}`);

      const result = await this.archivesService.manualArchiveOrder(
        orderId,
        body.reason,
      );

      return {
        success: result.success,
        message: result.message,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Erreur archivage manuel commande ${orderId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * POST /commercial/archives/restore/:orderId
   * Restaurer une commande archivée (utilise l'ID de commande)
   */
  @Post('restore/:orderId')
  async restoreArchivedOrder(@Param('orderId', ParseIntPipe) orderId: number) {
    try {
      this.logger.log(`POST /commercial/archives/restore/${orderId}`);

      const result = await this.archivesService.restoreArchivedOrder(orderId);

      return {
        success: result.success,
        message: result.message,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Erreur restauration commande ${orderId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * POST /commercial/archives/auto-archive
   * Déclencher manuellement l'archivage automatique (pour tests)
   */
  @Post('auto-archive')
  async triggerAutoArchive() {
    try {
      this.logger.log(
        'POST /commercial/archives/auto-archive - Déclenchement manuel',
      );

      const result = await this.archivesService.autoArchiveOrders();

      return {
        success: result.success,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur déclenchement archivage auto:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * GET /commercial/archives/test
   * Test de fonctionnement du service
   */
  @Get('test')
  async testService() {
    try {
      this.logger.log('GET /commercial/archives/test');

      // Test des stats
      const stats = await this.archivesService.getArchiveStats();

      // Test de récupération avec filtres simples
      const archives = await this.archivesService.getArchives({
        page: 1,
        limit: 10,
      });

      return {
        success: true,
        message: "Service d'archives opérationnel",
        data: {
          stats,
          sampleArchives: archives,
          serviceInfo: {
            name: 'CommercialArchivesService',
            version: '2.0 - Table Existante',
            database: 'Utilise ___xtr_order (table existante)',
            features: [
              'Archivage dans la table ___xtr_order existante',
              'Colonnes is_archived et archived_at utilisées',
              'Aucune nouvelle table créée',
              'Archivage automatique CRON (à réactiver)',
              'Archivage manuel avec raison personnalisée',
              'Restauration des commandes archivées',
              'Statistiques détaillées',
              'Filtrage et pagination avancés',
            ],
            cronSchedule: 'EVERY_DAY_AT_2AM (désactivé temporairement)',
            archiveThreshold: '3 mois',
            finalStatuses: [6, 91, 92, 93, 94],
            implementation: 'Utilise les colonnes existantes de ___xtr_order',
          },
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur test service archives:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
