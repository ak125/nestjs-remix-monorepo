import {
  Controller,
  Get,
  Logger,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../../auth/authenticated.guard';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { DashboardService } from './dashboard.service';
import { CacheInterceptor } from '@nestjs/cache-manager';

/**
 * 📊 DASHBOARD CONTROLLER
 * Fournit les statistiques et métriques du dashboard
 */

// Interfaces pour les réponses typées
interface DashboardStats {
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  totalUsers?: number;
  activeUsers?: number;
  totalSuppliers?: number;
  seoStats?: {
    totalPages: number;
    pagesWithSeo: number;
    sitemapEntries: number;
    completionRate: number;
  };
  success: boolean;
  error?: string;
}

interface ModuleStats {
  ordersCount: number;
  totalRevenue: number;
  status: string;
}

/**
 * Réservé à l'équipe : session obligatoire, puis une permission de la matrice
 * canonique (`user-permissions.dto.ts`) par route. `PermissionsGuard` laisse
 * passer une route sans `@RequirePermission` : chaque route doit en déclarer
 * une (vérifié par `tests/unit/dashboard-routes-authz.test.ts`).
 */
@Controller('api/dashboard')
@UseGuards(AuthenticatedGuard, PermissionsGuard)
@UseInterceptors(CacheInterceptor)
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @RequirePermission('canSeeFullStats')
  async getStats(): Promise<DashboardStats> {
    this.logger.log('[DashboardController] GET /api/dashboard/stats avec SEO');

    try {
      // Utiliser la nouvelle méthode getAllStats qui inclut les statistiques SEO
      const allStats = await this.dashboardService.getAllStats();

      const response = {
        ...allStats,
        success: true,
      };

      this.logger.log('Dashboard stats response:', response);
      return response;
    } catch (error) {
      this.logger.error('Error fetching dashboard stats:', error);
      return {
        totalOrders: 0,
        completedOrders: 0,
        pendingOrders: 0,
        totalRevenue: 0,
        totalUsers: 0,
        activeUsers: 0,
        totalSuppliers: 0,
        success: false,
        error: 'Failed to fetch dashboard statistics',
      };
    }
  }

  @Get('shipments')
  @RequirePermission('canSeeCustomerDetails')
  async getShipments() {
    this.logger.log('[DashboardController] GET /api/dashboard/shipments');
    try {
      const shipments = await this.dashboardService.getShipmentsWithTracking();
      return {
        success: true,
        data: shipments,
        count: shipments.length,
      };
    } catch (error) {
      this.logger.error('Error fetching shipments:', error);
      return {
        success: false,
        data: [],
        count: 0,
        error: 'Failed to fetch shipments',
      };
    }
  }

  @Get('stock/alerts')
  @RequirePermission('canSeeFullStats')
  async getStockAlerts() {
    this.logger.log('[DashboardController] GET /api/dashboard/stock/alerts');
    return this.dashboardService.getStockAlerts();
  }

  @Get('orders/recent')
  @RequirePermission('canSeeCustomerDetails')
  async getRecentOrders() {
    this.logger.log('[DashboardController] GET /api/dashboard/orders/recent');
    return {
      orders: await this.dashboardService.getRecentOrders(10),
      success: true,
    };
  }

  @Get('orders')
  @RequirePermission('canSeeFinancials')
  async getOrdersForDashboard() {
    this.logger.log('[DashboardController] GET /api/dashboard/orders');

    const stats = await this.dashboardService.getOrdersStats();

    return {
      orders: [], // Empty array for compatibility
      pagination: {
        total: stats.totalOrders,
        page: 1,
        limit: 50,
        pages: Math.ceil(stats.totalOrders / 50),
      },
      stats,
    };
  }

  // ===== NOUVEAUX ENDPOINTS PAR MODULE =====

  @Get('commercial')
  @RequirePermission('canSeeFinancials')
  async getCommercialStats(): Promise<ModuleStats> {
    this.logger.log('[DashboardController] GET /api/dashboard/commercial');
    try {
      const stats = await this.dashboardService.getOrdersStats();
      return {
        ordersCount: stats.totalOrders,
        totalRevenue: stats.totalRevenue,
        status: 'active',
      };
    } catch (error) {
      this.logger.error('Error fetching commercial stats:', error);
      return {
        ordersCount: 0,
        totalRevenue: 0,
        status: 'error',
      };
    }
  }

  @Get('expedition')
  @RequirePermission('canSeeFullStats')
  async getExpeditionStats(): Promise<ModuleStats> {
    this.logger.log('[DashboardController] GET /api/dashboard/expedition');
    try {
      const shipments = await this.dashboardService.getShipmentsWithTracking();
      return {
        ordersCount: shipments.length,
        totalRevenue: 0, // Pas de revenus directs pour expédition
        status: 'active',
      };
    } catch (error) {
      this.logger.error('Error fetching expedition stats:', error);
      return {
        ordersCount: 0,
        totalRevenue: 0,
        status: 'error',
      };
    }
  }

  @Get('seo')
  @RequirePermission('canSeeFullStats')
  async getSeoStats(): Promise<ModuleStats> {
    this.logger.log('[DashboardController] GET /api/dashboard/seo');
    // Pour le moment, stats basiques - à étendre selon les besoins SEO
    return {
      ordersCount: 0,
      totalRevenue: 0,
      status: 'active',
    };
  }

  @Get('staff')
  @RequirePermission('canSeeFullStats')
  async getStaffStats(): Promise<ModuleStats> {
    this.logger.log('[DashboardController] GET /api/dashboard/staff');
    try {
      const usersStats = await this.dashboardService.getUsersStats();
      return {
        ordersCount: usersStats.totalUsers || 0,
        totalRevenue: 0, // Pas de revenus directs pour staff
        status: 'active',
      };
    } catch (error) {
      this.logger.error('Error fetching staff stats:', error);
      return {
        ordersCount: 0,
        totalRevenue: 0,
        status: 'error',
      };
    }
  }
}
