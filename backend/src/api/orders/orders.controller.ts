import { Controller, Get, Query } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';

@ApiTags('orders')
@Controller('api/orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'Récupérer les commandes avec pagination' })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Numéro de page',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: "Nombre d'éléments par page",
    example: 50,
  })
  async getOrders(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
  ) {
    try {
      const pageNum = parseInt(page.toString(), 10) || 1;
      const limitNum = parseInt(limit.toString(), 10) || 50;

      const result = await this.ordersService.findAll({
        page: pageNum,
        limit: limitNum,
      });

      return {
        success: true,
        orders: result.orders || [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: result.total || 0,
          totalPages: Math.ceil((result.total || 0) / limitNum),
        },
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des commandes:', error);

      // Fallback avec données de test
      return {
        success: false,
        orders: [
          {
            ord_id: '1',
            ord_total_ttc: '299.99',
            ord_is_pay: '1',
            ord_date: new Date().toISOString(),
            ord_info: JSON.stringify({
              payment_gateway: 'stripe',
              transaction_id: 'txn_test_001',
            }),
            customer: {
              cst_fname: 'Client',
              cst_name: 'Test',
            },
          },
          {
            ord_id: '2',
            ord_total_ttc: '159.50',
            ord_is_pay: '0',
            ord_date: new Date().toISOString(),
            ord_info: JSON.stringify({
              payment_gateway: 'paypal',
              transaction_id: 'txn_test_002',
            }),
            customer: {
              cst_fname: 'Client',
              cst_name: 'Test 2',
            },
          },
        ],
        pagination: {
          page: 1,
          limit: 50,
          total: 2,
          totalPages: 1,
        },
        message: 'Données de test - service en cours de configuration',
      };
    }
  }

  @Get('stats')
  @ApiOperation({ summary: 'Statistiques des commandes' })
  async getOrderStats() {
    try {
      const stats = await this.ordersService.getStats();
      return {
        success: true,
        stats,
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des stats:', error);
      return {
        success: false,
        stats: {
          totalOrders: 0,
          completedOrders: 0,
          pendingOrders: 0,
          totalRevenue: 0,
        },
        message: 'Stats par défaut - service en cours de configuration',
      };
    }
  }
}
