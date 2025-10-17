import { Controller, Get, Post, Param, Query, Logger } from '@nestjs/common';
import { OrderArchiveService } from '../services/order-archive.service';

/**
 * Contrôleur pour l'archivage complet des commandes
 * Mis à jour pour utiliser OrderArchiveService consolidé (Phase 2)
 */
@Controller('order-archive')
export class OrderArchiveController {
  private readonly logger = new Logger(OrderArchiveController.name);

  constructor(private readonly orderArchiveService: OrderArchiveService) {}

  /**
   * GET /order-archive/:orderId
   * Récupérer une commande archivée
   */
  @Get(':orderId')
  async getArchivedOrder(@Param('orderId') orderId: string) {
    try {
      const orderIdNum = parseInt(orderId);

      const order = await this.orderArchiveService.getArchivedOrder(orderIdNum);

      if (!order) {
        return {
          success: false,
          error: 'Commande archivée non trouvée',
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        data: order,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * GET /order-archive/customer/:customerId/list
   * Lister les commandes archivées d'un client
   */
  @Get('customer/:customerId/list')
  async listArchivedOrders(
    @Param('customerId') customerId: string,
    @Query() filters: any,
  ) {
    try {
      const customerIdNum = parseInt(customerId);

      const result = await this.orderArchiveService.listArchivedOrders({
        customerId: customerIdNum,
        page: filters.page ? parseInt(filters.page) : undefined,
        limit: filters.limit ? parseInt(filters.limit) : undefined,
      });

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * GET /order-archive/:orderId/export
   * Exporter une commande pour PDF
   */
  @Get(':orderId/export')
  async exportOrderForPdf(@Param('orderId') orderId: string) {
    try {
      const orderIdNum = parseInt(orderId);

      const exportData =
        await this.orderArchiveService.exportOrderForPdf(orderIdNum);

      return {
        success: true,
        data: exportData,
        message: 'Données préparées pour export PDF',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * GET /order-archive/customer/:customerId/stats
   * Statistiques d'archivage d'un client
   */
  @Get('customer/:customerId/stats')
  async getArchiveStats(@Param('customerId') customerId: string) {
    try {
      const customerIdNum = parseInt(customerId);

      const stats =
        await this.orderArchiveService.getArchiveStats(customerIdNum);

      return {
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * POST /order-archive/:orderId/archive
   * Marquer une commande comme archivée
   */
  @Post(':orderId/archive')
  async archiveOrder(@Param('orderId') orderId: string) {
    try {
      const orderIdNum = parseInt(orderId);

      const success = await this.orderArchiveService.archiveOrder(orderIdNum);

      return {
        success,
        message: success
          ? 'Commande archivée avec succès'
          : "Erreur lors de l'archivage",
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * POST /order-archive/:orderId/restore
   * Restaurer une commande archivée
   */
  @Post(':orderId/restore')
  async restoreOrder(@Param('orderId') orderId: string) {
    try {
      const orderIdNum = parseInt(orderId);

      const success = await this.orderArchiveService.restoreOrder(orderIdNum);

      return {
        success,
        message: success
          ? 'Commande restaurée avec succès'
          : 'Erreur lors de la restauration',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * GET /order-archive/test
   * Test du service d'archivage
   */
  @Get('test/service')
  async testArchiveService() {
    try {
      // Test avec les IDs des vraies commandes
      const testOrderId = 1; // Premier ordre dans la DB
      const testCustomerId = 1;

      const results = {
        testOrderId,
        testCustomerId,
        tests: [] as any[],
      };

      // Test 1: Récupérer une commande archivée
      try {
        const order =
          await this.orderArchiveService.getArchivedOrder(testOrderId);
        results.tests.push({
          name: 'getArchivedOrder',
          success: true,
          data: order ? 'Commande trouvée' : 'Aucune commande',
          hasLines: order?.order_lines?.length || 0,
          hasTickets: order?.tickets?.length || 0,
        });
      } catch (error) {
        results.tests.push({
          name: 'getArchivedOrder',
          success: false,
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        });
      }

      // Test 2: Lister les commandes archivées
      try {
        const list = await this.orderArchiveService.listArchivedOrders({
          customerId: testCustomerId,
        });
        results.tests.push({
          name: 'listArchivedOrders',
          success: true,
          totalOrders: list.data?.length || 0,
          pagination: list.pagination,
        });
      } catch (error) {
        results.tests.push({
          name: 'listArchivedOrders',
          success: false,
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        });
      }

      // Test 3: Statistiques
      try {
        const stats =
          await this.orderArchiveService.getArchiveStats(testCustomerId);
        results.tests.push({
          name: 'getArchiveStats',
          success: true,
          data: stats,
        });
      } catch (error) {
        results.tests.push({
          name: 'getArchiveStats',
          success: false,
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        });
      }

      return {
        success: true,
        message: "Tests du service d'archivage",
        data: results,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
