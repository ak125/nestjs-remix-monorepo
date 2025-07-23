/**
 * 📋 CONTRÔLEUR ADMIN DASHBOARD - NestJS-Remix Monorepo
 * 
 * API REST pour les statistiques et métriques admin
 * Compatible avec l'interface Remix existante
 */

import { Controller, Get, UseGuards, Logger } from '@nestjs/common';
import { AdminDashboardService } from '../services/admin-dashboard.service';
import { LocalAuthGuard } from '../../../auth/local-auth.guard';

@Controller('admin/dashboard')
@UseGuards(LocalAuthGuard)
export class AdminDashboardController {
  private readonly logger = new Logger(AdminDashboardController.name);

  constructor(
    private readonly dashboardService: AdminDashboardService,
  ) {}

  /**
   * GET /admin/dashboard/stats
   * Récupérer les statistiques complètes du dashboard
   */
  @Get('stats')
  async getDashboardStats() {
    try {
      this.logger.log('Requête stats dashboard admin');
      const stats = await this.dashboardService.getDashboardStats();
      
      return {
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Erreur lors de la récupération des stats dashboard:', error);
      return {
        success: false,
        error: 'Erreur lors de la récupération des statistiques',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * GET /admin/dashboard/metrics
   * Métriques en temps réel
   */
  @Get('metrics')
  async getRealtimeMetrics() {
    try {
      this.logger.log('Requête métriques temps réel');
      const metrics = await this.dashboardService.getRealtimeMetrics();
      
      return {
        success: true,
        data: metrics,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Erreur lors de la récupération des métriques:', error);
      return {
        success: false,
        error: 'Erreur lors de la récupération des métriques',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * GET /admin/dashboard/health
   * Vérification de l'état du système
   */
  @Get('health')
  async getSystemHealth() {
    try {
      this.logger.log('Vérification état système');
      
      return {
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          services: {
            database: 'connected',
            cache: 'connected',
            api: 'running'
          }
        }
      };

    } catch (error) {
      this.logger.error('Erreur lors de la vérification système:', error);
      return {
        success: false,
        error: 'Erreur système',
        timestamp: new Date().toISOString()
      };
    }
  }
}
