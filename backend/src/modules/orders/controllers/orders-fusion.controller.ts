import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpStatus,
  HttpCode,
  Logger,
} from '@nestjs/common';
import {
  OrdersService,
  CreateOrderData,
  OrderFilters,
} from '../services/orders-fusion.service';

/**
 * Contrôleur Orders Fusion - Version Complète
 * ✅ Teste le service fusion sans impacter l'existant
 * ✅ Endpoints riches avec validation
 * ✅ Documentation et logging complets
 */
@Controller('orders-fusion')
export class OrdersFusionController {
  private readonly logger = new Logger(OrdersFusionController.name);

  constructor(private readonly ordersService: OrdersService) {}

  /**
   * 📋 Lister les commandes avec pagination et filtres
   * GET /orders-fusion?page=1&limit=10&customerId=123&status=1
   */
  @Get()
  async listOrders(@Query() query: any) {
    try {
      this.logger.log('Listing orders with filters:', query);

      const filters: OrderFilters = {
        customerId: query.customerId ? parseInt(query.customerId) : undefined,
        status: query.status !== undefined ? parseInt(query.status) : undefined,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
        page: query.page ? parseInt(query.page) : 1,
        limit: query.limit ? parseInt(query.limit) : 20,
      };

      return await this.ordersService.listOrders(filters);
    } catch (error) {
      this.logger.error('Error listing orders:', error);
      throw error;
    }
  }

  /**
   * 🆕 Créer une nouvelle commande
   * POST /orders-fusion
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createOrder(@Body() orderData: CreateOrderData) {
    try {
      this.logger.log('Creating new order for customer:', orderData.customerId);
      return await this.ordersService.createOrder(orderData);
    } catch (error) {
      this.logger.error('Error creating order:', error);
      throw error;
    }
  }

  /**
   * 📖 Récupérer une commande par ID
   * GET /orders-fusion/:id
   */
  @Get(':id')
  async getOrderById(@Param('id', ParseIntPipe) orderId: number) {
    try {
      this.logger.log(`Getting order ${orderId}`);
      return await this.ordersService.getOrderById(orderId);
    } catch (error) {
      this.logger.error(`Error getting order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * 🔄 Mettre à jour le statut d'une commande
   * PATCH /orders-fusion/:id/status
   */
  @Patch(':id/status')
  async updateOrderStatus(
    @Param('id', ParseIntPipe) orderId: number,
    @Body() updateData: { status: number; comment?: string; userId?: number },
  ) {
    try {
      this.logger.log(
        `Updating order ${orderId} status to ${updateData.status}`,
      );
      return await this.ordersService.updateOrderStatus(
        orderId,
        updateData.status,
        updateData.comment,
        updateData.userId,
      );
    } catch (error) {
      this.logger.error(`Error updating order ${orderId} status:`, error);
      throw error;
    }
  }

  /**
   * 🗑️ Supprimer une commande (soft delete)
   * DELETE /orders-fusion/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOrder(
    @Param('id', ParseIntPipe) orderId: number,
    @Body() deleteData: { userId: number; reason?: string },
  ) {
    try {
      this.logger.log(`Deleting order ${orderId} by user ${deleteData.userId}`);
      await this.ordersService.deleteOrder(
        orderId,
        deleteData.userId,
        deleteData.reason,
      );
    } catch (error) {
      this.logger.error(`Error deleting order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * 📊 Tester la création d'une commande complète (endpoint de test)
   * POST /orders-fusion/test
   */
  @Post('test')
  async testCreateOrder() {
    try {
      this.logger.log('Testing order creation with mock data');

      const mockOrderData: CreateOrderData = {
        customerId: 1,
        orderLines: [
          {
            productId: 'TEST001',
            productName: 'Produit Test',
            productReference: 'REF-TEST-001',
            quantity: 2,
            unitPrice: 29.99,
            vatRate: 20,
            discount: 0,
          },
          {
            productId: 'TEST002',
            productName: 'Produit Test 2',
            productReference: 'REF-TEST-002',
            quantity: 1,
            unitPrice: 15.5,
            vatRate: 20,
            discount: 10,
          },
        ],
        billingAddress: {
          firstName: 'Jean',
          lastName: 'Dupont',
          address: '123 rue de la Paix',
          zipCode: '75001',
          city: 'Paris',
          country: 'France',
        },
        shippingAddress: {
          firstName: 'Jean',
          lastName: 'Dupont',
          address: '123 rue de la Paix',
          zipCode: '75001',
          city: 'Paris',
          country: 'France',
        },
        customerNote: 'Commande de test générée automatiquement',
        shippingMethod: 'standard',
      };

      const result = await this.ordersService.createOrder(mockOrderData);

      return {
        message: 'Commande de test créée avec succès',
        order: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error testing order creation:', error);
      throw error;
    }
  }

  /**
   * 📈 Statistiques rapides (endpoint utilitaire)
   * GET /orders-fusion/stats
   */
  @Get('stats/summary')
  async getOrdersStats() {
    try {
      this.logger.log('Getting orders statistics');

      // Statistiques basiques
      const allOrders = await this.ordersService.listOrders({ limit: 1000 });
      const recentOrders = await this.ordersService.listOrders({
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 derniers jours
        limit: 1000,
      });

      return {
        total: allOrders.pagination.total,
        recentCount: recentOrders.data.length,
        lastWeek: recentOrders.pagination.total,
        pagination: allOrders.pagination,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error getting orders stats:', error);
      throw error;
    }
  }
}
