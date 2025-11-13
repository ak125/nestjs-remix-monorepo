import { Controller, Get, Logger, UseGuards, UseInterceptors } from '@nestjs/common';
import {
  ModulePermissionGuard,
  RequireModule,
} from '../../auth/guards/module-permission.guard';
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

@Controller('api/dashboard')
@UseInterceptors(CacheInterceptor)
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @UseGuards(ModulePermissionGuard)
  @RequireModule('dashboard', 'read')
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
  async getStockAlerts() {
    this.logger.log('[DashboardController] GET /api/dashboard/stock/alerts');
    return this.dashboardService.getStockAlerts();
  }

  @Get('orders/recent')
  async getRecentOrders() {
    this.logger.log('[DashboardController] GET /api/dashboard/orders/recent');
    return {
      orders: await this.dashboardService.getRecentOrders(10),
      success: true,
    };
  }

  @Get('orders')
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
  @UseGuards(ModulePermissionGuard)
  @RequireModule('commercial', 'read')
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
  @UseGuards(ModulePermissionGuard)
  @RequireModule('expedition', 'read')
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
  @UseGuards(ModulePermissionGuard)
  @RequireModule('seo', 'read')
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
  @UseGuards(ModulePermissionGuard)
  @RequireModule('staff', 'read')
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
