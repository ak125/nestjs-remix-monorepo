import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Query,
  Logger,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { LegacyOrderService } from '../../../database/services/legacy-order.service';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

@ApiTags('Legacy Orders')
@Controller('api/legacy-orders-enhanced')
export class LegacyOrdersController {
  private readonly logger = new Logger(LegacyOrdersController.name);

  constructor(private readonly legacyOrderService: LegacyOrderService) {}

  /**
   * Test endpoint pour vérifier que le service enrichi fonctionne
   */
  @Get('test')
  @ApiOperation({ summary: 'Test du service legacy orders enrichi' })
  async testEnhancedService(): Promise<any> {
    try {
      this.logger.log('🧪 Testing enhanced LegacyOrderService...');

      // Test des fonctions existantes
      const totalOrders = await this.legacyOrderService.getTotalOrdersCount();
      const stats = await this.legacyOrderService.getOrdersStats();
      
      // Test de pagination
      const recentOrders = await this.legacyOrderService.getAllOrders({
        limit: 5,
        offset: 0,
      });

      return {
        success: true,
        message: 'Enhanced LegacyOrderService is working!',
        data: {
          totalOrders,
          stats,
          recentOrdersCount: recentOrders.length,
          features: {
            existing: [
              'getAllOrders',
              'getOrderById', 
              'getUserOrders',
              'getOrdersStats',
              'getOrderWithCustomer',
              'getTotalOrdersCount'
            ],
            new: [
              'createLegacyOrder',
              'getOrderLines',
              'updateOrderStatus',
              'getOrderStatusHistory',
              'getOrderWithDetails'
            ]
          }
        },
      };
    } catch (error: any) {
      this.logger.error('❌ Enhanced service test failed:', error);
      throw new HttpException(
        `Test failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Récupère toutes les commandes avec pagination et filtres
   */
  @Get()
  @ApiOperation({ summary: 'Récupérer toutes les commandes' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'userId', required: false, type: String })
  async getAllOrders(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
  ): Promise<any> {
    try {
      const orders = await this.legacyOrderService.getAllOrders({
        limit: limit ? parseInt(limit.toString()) : 20,
        offset: offset ? parseInt(offset.toString()) : 0,
        status,
        userId,
      });

      return {
        success: true,
        data: orders,
        pagination: {
          limit: limit || 20,
          offset: offset || 0,
          total: orders.length,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get all orders:', error);
      throw new HttpException(
        'Failed to retrieve orders',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Récupère une commande par son ID avec détails complets
   */
  @Get(':id')
  @ApiOperation({ summary: 'Récupérer une commande par ID' })
  async getOrderById(@Param('id') id: string): Promise<any> {
    try {
      const order = await this.legacyOrderService.getOrderById(id);
      return {
        success: true,
        data: order,
      };
    } catch (error) {
      this.logger.error(`Failed to get order ${id}:`, error);
      throw new HttpException(
        'Order not found',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  /**
   * Récupère une commande avec ses détails complets
   */
  @Get(':id/details')
  @ApiOperation({ summary: 'Récupérer une commande avec tous ses détails' })
  async getOrderWithDetails(@Param('id') id: string): Promise<any> {
    try {
      const orderDetails = await this.legacyOrderService.getOrderWithDetails(id);
      return {
        success: true,
        data: orderDetails,
      };
    } catch (error) {
      this.logger.error(`Failed to get order details for ${id}:`, error);
      throw new HttpException(
        'Order not found',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  /**
   * Récupère les lignes d'une commande
   */
  @Get(':id/lines')
  @ApiOperation({ summary: 'Récupérer les lignes d\'une commande' })
  async getOrderLines(@Param('id') id: string): Promise<any> {
    try {
      const lines = await this.legacyOrderService.getOrderLines(id);
      return {
        success: true,
        data: lines,
      };
    } catch (error) {
      this.logger.error(`Failed to get order lines for ${id}:`, error);
      throw new HttpException(
        'Failed to retrieve order lines',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Récupère l'historique des statuts d'une commande
   */
  @Get(':id/status-history')
  @ApiOperation({ summary: 'Récupérer l\'historique des statuts d\'une commande' })
  async getOrderStatusHistory(@Param('id') id: string): Promise<any> {
    try {
      const history = await this.legacyOrderService.getOrderStatusHistory(id);
      return {
        success: true,
        data: history,
      };
    } catch (error) {
      this.logger.error(`Failed to get status history for ${id}:`, error);
      throw new HttpException(
        'Failed to retrieve status history',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Crée une nouvelle commande
   */
  @Post()
  @ApiOperation({ summary: 'Créer une nouvelle commande' })
  @ApiResponse({ status: 201, description: 'Commande créée avec succès' })
  async createOrder(@Body() orderData: any): Promise<any> {
    try {
      this.logger.log(`Creating order for customer ${orderData.customerId}`);
      
      const newOrder = await this.legacyOrderService.createLegacyOrder(orderData);
      
      return {
        success: true,
        message: 'Order created successfully',
        data: newOrder,
      };
    } catch (error: any) {
      this.logger.error('Failed to create order:', error);
      throw new HttpException(
        `Failed to create order: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Met à jour le statut d'une commande
   */
  @Patch(':id/status')
  @ApiOperation({ summary: 'Mettre à jour le statut d\'une commande' })
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() updateData: { status: string; comment?: string },
  ): Promise<any> {
    try {
      await this.legacyOrderService.updateOrderStatus(
        id,
        updateData.status,
        updateData.comment,
      );

      return {
        success: true,
        message: `Order ${id} status updated to ${updateData.status}`,
      };
    } catch (error) {
      this.logger.error(`Failed to update order ${id} status:`, error);
      throw new HttpException(
        'Failed to update order status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Récupère les statistiques des commandes
   */
  @Get('stats/overview')
  @ApiOperation({ summary: 'Récupérer les statistiques des commandes' })
  async getOrdersStats(@Query('userId') userId?: string): Promise<any> {
    try {
      const stats = await this.legacyOrderService.getOrdersStats(userId);
      const totalCount = await this.legacyOrderService.getTotalOrdersCount();

      return {
        success: true,
        data: {
          ...stats,
          totalOrdersInDB: totalCount,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get orders stats:', error);
      throw new HttpException(
        'Failed to retrieve statistics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Test de création d'une commande simple
   */
  @Post('test/create')
  @ApiOperation({ summary: 'Test de création d\'une commande simple' })
  async testCreateOrder(): Promise<any> {
    try {
      this.logger.log('🧪 Testing order creation...');

      // Données de test pour une commande simple
      const testOrderData = {
        customerId: '1', // ID du client de test
        orderLines: [
          {
            productId: 'TEST001',
            productName: 'Produit de test',
            productReference: 'REF-TEST-001',
            quantity: 2,
            unitPrice: 25.50,
            vatRate: 20,
            discount: 0,
          },
          {
            productId: 'TEST002',
            productName: 'Autre produit test',
            productReference: 'REF-TEST-002',
            quantity: 1,
            unitPrice: 15.00,
            vatRate: 20,
            discount: 10, // 10% de remise
          },
        ],
        customerNote: 'Commande de test créée automatiquement',
        shippingMethod: 'standard',
      };

      const newOrder = await this.legacyOrderService.createLegacyOrder(testOrderData);

      return {
        success: true,
        message: '✅ Test order created successfully!',
        data: {
          order: newOrder,
          testData: testOrderData,
          calculations: {
            expectedTotalHt: (2 * 25.5) + (1 * 15 * 0.9), // 51 + 13.5 = 64.5
            expectedTva: (64.5 * 0.2), // 12.9
            expectedShipping: 0, // Gratuit car > 50€
            expectedTotalTtc: 64.5 + 12.9, // 77.4
          },
        },
      };
    } catch (error: any) {
      this.logger.error('❌ Test order creation failed:', error);
      
      return {
        success: false,
        error: error.message,
        details: {
          message: 'Test order creation failed - this is expected if customer ID 1 does not exist',
          suggestion: 'Try creating a customer first, or check existing customer IDs',
        },
      };
    }
  }
}
