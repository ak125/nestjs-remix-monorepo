/**
 * 🎯 Contrôleur Admin Principal - Version Minimale
 * Compatible avec l'architecture existante
 */

import { Controller, Get, UseGuards, Logger } from '@nestjs/common';
import { AuthenticatedGuard } from '../../../auth/authenticated.guard';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
import { StockManagementService } from '../services/stock-management.service';

@Controller('api/admin')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(private readonly stockService: StockManagementService) {}

  /**
   * GET /api/admin/dashboard
   * Dashboard principal admin avec statistiques
   */
  @Get('dashboard')
  async getDashboard() {
    try {
      this.logger.log('📊 Récupération dashboard admin');

      // Récupération simple pour test
      const stockDashboard = {
        success: true,
        data: {
          stats: {
            totalProducts: 50,
            totalValue: 15000,
            alerts: 3,
          },
          items: [],
          totalItems: 50,
        },
        message: 'Dashboard de test',
      };

      const dashboard = {
        timestamp: new Date().toISOString(),
        stock: stockDashboard.data,
        summary: {
          totalProducts: stockDashboard.data.stats.totalProducts,
          totalValue: stockDashboard.data.stats.totalValue,
          alertCount: stockDashboard.data.stats.alerts,
          status: 'active',
        },
      };

      this.logger.log(
        `✅ Dashboard admin récupéré avec ${dashboard.summary.totalProducts} produits`,
      );
      return dashboard;

    } catch (error) {
      this.logger.error('❌ Erreur récupération dashboard admin:', error);
      return {
        timestamp: new Date().toISOString(),
        error: 'Erreur lors de la récupération du dashboard',
        stock: {
          totalProducts: 0,
          totalValue: 0,
          alertCount: 0,
          lowStock: [],
          outOfStock: [],
        },
        summary: {
          totalProducts: 0,
          totalValue: 0,
          alertCount: 0,
          status: 'error'
        }
      };
    }
  }

  /**
   * GET /api/admin/health
   * Health check pour le module admin
   */
  @Get('health')
  async getHealth() {
    try {
      // Test de connexion aux services
      const stockHealth = await this.stockService.healthCheck();
      
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          stock: stockHealth,
        },
        version: '1.0.0'
      };
    } catch (error) {
      this.logger.error('❌ Health check admin failed:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        version: '1.0.0'
      };
    }
  }
}
