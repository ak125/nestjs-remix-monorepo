import { Controller, Get, Param, Query, Logger } from '@nestjs/common';
import {
  OperationFailedException,
  DomainException,
} from '../common/exceptions';
import { OrdersService } from '../database/services/orders.service';

@Controller('api/orders')
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(private readonly ordersService: OrdersService) {}

  /**
   * GET /api/orders
   * Récupère toutes les commandes avec pagination
   */
  @Get()
  async getAllOrders(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('status') status?: string,
    @Query('userId') userId?: string,
  ) {
    try {
      this.logger.log('Récupération des commandes...');

      const orders = await this.ordersService.getAllOrders({
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
        status,
        userId,
      });

      return {
        success: true,
        data: orders,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: orders.length,
        },
        filters: { status, userId },
      };
    } catch (error) {
      this.logger.error(`Erreur récupération commandes: ${error}`);
      throw new OperationFailedException({
        message: 'Erreur lors de la récupération des commandes',
      });
    }
  }

  /**
   * GET /api/orders/:id
   * Récupère une commande par son ID
   */
  @Get(':id')
  async getOrderById(@Param('id') orderId: string) {
    try {
      this.logger.log(`Récupération commande ID: ${orderId}`);

      const order = await this.ordersService.getOrderWithCustomer(orderId);

      return {
        success: true,
        data: order,
      };
    } catch (error) {
      this.logger.error(`Erreur récupération commande ${orderId}: ${error}`);
      if (error instanceof DomainException) throw error;

      throw new OperationFailedException({
        message: 'Erreur lors de la récupération de la commande',
      });
    }
  }

  /**
   * GET /api/orders/stats
   * Récupère les statistiques des commandes
   */
  @Get('stats')
  async getOrdersStats(@Query('userId') userId?: string) {
    try {
      this.logger.log('Calcul des statistiques des commandes...');

      const stats = await this.ordersService.getOrdersStats(userId);

      return {
        success: true,
        data: stats,
        userId: userId || 'all',
      };
    } catch (error) {
      this.logger.error(`Erreur calcul statistiques: ${error}`);
      throw new OperationFailedException({
        message: 'Erreur lors du calcul des statistiques',
      });
    }
  }
}
