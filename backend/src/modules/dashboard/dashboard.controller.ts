import { Controller, Get, Logger } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('api/dashboard')
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  async getStats() {
    this.logger.log('[DashboardController] GET /api/dashboard/stats');

    try {
      const [ordersStats, usersStats, suppliersStats] = await Promise.all([
        this.dashboardService.getOrdersStats(),
        this.dashboardService.getUsersStats(),
        this.dashboardService.getSuppliersStats(),
      ]);

      const response = {
        ...ordersStats,
        ...usersStats,
        ...suppliersStats,
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
        count: shipments.length
      };
    } catch (error) {
      this.logger.error('Error fetching shipments:', error);
      return {
        success: false,
        data: [],
        count: 0,
        error: 'Failed to fetch shipments'
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
      success: true
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
}
