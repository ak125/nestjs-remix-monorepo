import {
  Controller,
  Get,
  Param,
  Query,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { LegacyOrderService } from '../database/services/legacy-order.service';

@Controller('api/legacy-orders')
export class OrdersController {
  constructor(private readonly legacyOrderService: LegacyOrderService) {}

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
      console.log('📦 Récupération des commandes...');

      const orders = await this.legacyOrderService.getAllOrders({
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
        status,
        userId,
      });

      // Récupérer le total de commandes
      const totalCount = await this.legacyOrderService.getTotalOrdersCount();

      return {
        success: true,
        data: orders,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
        },
        filters: { status, userId },
      };
    } catch (error) {
      console.error('❌ Erreur récupération commandes:', error);
      throw new HttpException(
        'Erreur lors de la récupération des commandes',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/legacy-orders/stats
   * Récupère les statistiques des commandes
   */
  @Get('stats')
  async getOrdersStats(@Query('userId') userId?: string) {
    try {
      console.log('📊 Calcul des statistiques des commandes...');

      const stats = await this.legacyOrderService.getOrdersStats(userId);

      return {
        success: true,
        data: stats,
        userId: userId || 'all',
      };
    } catch (error) {
      console.error('❌ Erreur calcul statistiques:', error);
      throw new HttpException(
        'Erreur lors du calcul des statistiques',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/legacy-orders/:id
   * Récupère une commande par son ID
   */
  @Get(':id')
  async getOrderById(@Param('id') orderId: string) {
    try {
      console.log(`🔍 Récupération commande ID: ${orderId}`);

      const order = await this.legacyOrderService.getOrderWithCustomer(orderId);

      return {
        success: true,
        data: order,
      };
    } catch (error) {
      console.error(`❌ Erreur récupération commande ${orderId}:`, error);
      if (error instanceof HttpException) throw error;

      throw new HttpException(
        'Erreur lors de la récupération de la commande',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
