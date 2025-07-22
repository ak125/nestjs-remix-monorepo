/**
 * Contrôleur API Orders - Version complète et corrigée
 * Toutes les fonctionnalités pour les tests curl
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpException,
  UseInterceptors,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersCompleteService } from './orders-complete.service';
import { MethodNotAllowedInterceptor } from '../../common/interceptors/method-not-allowed.interceptor';

@Controller('api/orders')
@UseInterceptors(MethodNotAllowedInterceptor)
export class OrdersApiController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly ordersCompleteService: OrdersCompleteService,
  ) {}

  /**
   * Récupérer les commandes avec pagination - API
   */
  @Get()
  async getOrders(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    console.log(`📡 API Orders: GET /api/orders?page=${page}&limit=${limit}`);

    try {
      const result = await this.ordersService.findOrdersWithPagination(
        Number(page),
        Number(limit),
        { status, customerId, dateFrom, dateTo },
      );

      console.log(
        `✅ API Orders: ${result.orders.length} commandes retournées`,
      );
      return result;
    } catch (error: any) {
      console.error(`❌ API Orders Error: ${error.message || error}`);
      throw new HttpException(
        'Erreur serveur',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Récupérer une commande par ID - API
   */
  @Get(':id')
  async getOrderById(@Param('id') id: string) {
    console.log(`📡 API Orders: GET /api/orders/${id}`);

    try {
      const order = await this.ordersService.findOrderById(id);
      if (!order) {
        console.log(`❌ API Orders: Commande ${id} non trouvée`);
        throw new HttpException('Commande non trouvée', HttpStatus.NOT_FOUND);
      }
      console.log(`✅ API Orders: Commande ${id} trouvée`);
      return order;
    } catch (error: any) {
      if (error.status === HttpStatus.NOT_FOUND) {
        throw error;
      }
      console.error(`❌ API Orders Error: ${error.message || error}`);
      throw new HttpException(
        'Erreur serveur',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Récupérer les commandes d'un client - API
   */
  @Get('customer/:customerId')
  async getOrdersByCustomer(@Param('customerId') customerId: string) {
    console.log(`📡 API Orders: GET /api/orders/customer/${customerId}`);

    try {
      const orders =
        await this.ordersService.findOrdersByCustomerId(customerId);
      console.log(
        `✅ API Orders: ${orders.length} commandes pour le client ${customerId}`,
      );
      return orders;
    } catch (error: any) {
      console.error(`❌ API Orders Error: ${error.message || error}`);
      throw new HttpException(
        'Erreur serveur',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Récupérer les statistiques par statut - API
   */
  @Get('stats/by-status')
  async getOrderStatsByStatus() {
    console.log(`📡 API Orders: GET /api/orders/stats/by-status`);

    try {
      const stats = await this.ordersService.getOrderStatsByStatus();
      console.log(`✅ API Orders: Statistiques par statut récupérées`);
      return stats;
    } catch (error: any) {
      console.error(`❌ API Orders Error: ${error.message || error}`);
      throw new HttpException(
        'Erreur serveur',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Récupérer les statistiques générales - API
   */
  @Get('stats/general')
  async getOrderStats() {
    console.log(`📡 API Orders: GET /api/orders/stats/general`);

    try {
      const stats = await this.ordersService.getOrderStats();
      console.log(`✅ API Orders: Statistiques générales récupérées`);
      return stats;
    } catch (error: any) {
      console.error(`❌ API Orders Error: ${error.message || error}`);
      throw new HttpException(
        'Erreur serveur',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Récupérer tous les statuts de commande - API
   */
  @Get('statuses/orders')
  async getOrderStatuses() {
    console.log(`📡 API Orders: GET /api/orders/statuses/orders`);

    try {
      const statuses = await this.ordersService.getAllOrderStatuses();
      console.log(`✅ API Orders: Statuts de commande récupérés`);
      return statuses;
    } catch (error: any) {
      console.error(`❌ API Orders Error: ${error.message || error}`);
      throw new HttpException(
        'Erreur serveur',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Récupérer tous les statuts de ligne - API
   */
  @Get('statuses/lines')
  async getOrderLineStatuses() {
    console.log(`📡 API Orders: GET /api/orders/statuses/lines`);

    try {
      const statuses = await this.ordersService.getAllOrderLineStatuses();
      console.log(`✅ API Orders: Statuts de ligne récupérés`);
      return statuses;
    } catch (error: any) {
      console.error(`❌ API Orders Error: ${error.message || error}`);
      throw new HttpException(
        'Erreur serveur',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * ADMIN: Récupérer toutes les commandes avec relations complètes - API
   */
  @Get('admin/all-relations')
  async getOrdersWithAllRelations(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    console.log(`📡 API Orders: GET /api/orders/admin/all-relations`);

    try {
      const result = await this.ordersCompleteService.getOrdersWithAllRelations(
        Number(page),
        Number(limit),
        { status, customerId, dateFrom, dateTo },
      );
      console.log(
        `✅ API Orders: ${result.orders.length} commandes avec relations complètes`,
      );
      return result;
    } catch (error: any) {
      console.error(`❌ API Orders Error: ${error.message || error}`);
      throw new HttpException(
        'Erreur serveur',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * ADMIN: Récupérer une commande avec tous les détails - API
   */
  @Get('admin/:id/complete')
  async getCompleteOrderById(@Param('id') id: string) {
    console.log(`📡 API Orders: GET /api/orders/admin/${id}/complete`);

    try {
      const order = await this.ordersCompleteService.getCompleteOrderById(id);
      if (!order) {
        throw new HttpException('Commande non trouvée', HttpStatus.NOT_FOUND);
      }
      console.log(`✅ API Orders: Détails complets commande ${id}`);
      return order;
    } catch (error: any) {
      if (error.status === HttpStatus.NOT_FOUND) {
        throw error;
      }
      console.error(`❌ API Orders Error: ${error.message || error}`);
      throw new HttpException(
        'Erreur serveur',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Créer une nouvelle commande - API
   */
  @Post()
  async createOrder(@Body() orderData: any) {
    console.log(`📡 API Orders: POST /api/orders`);

    // Validation basique des données
    if (!orderData.customerId) {
      console.error('❌ API Orders: customerId manquant');
      throw new HttpException('customerId est requis', HttpStatus.BAD_REQUEST);
    }

    try {
      const newOrder = await this.ordersService.createOrder(orderData);
      console.log(`✅ API Orders: Commande créée ${newOrder?.ord_id}`);
      return newOrder;
    } catch (error: any) {
      console.error(`❌ API Orders Error: ${error.message || error}`);
      throw new HttpException(
        'Erreur lors de la création',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Mettre à jour une commande - API
   */
  @Put(':id')
  async updateOrder(@Param('id') id: string, @Body() updates: any) {
    console.log(`📡 API Orders: PUT /api/orders/${id}`);

    try {
      const updatedOrder = await this.ordersService.updateOrder(id, updates);
      if (!updatedOrder) {
        throw new HttpException('Commande non trouvée', HttpStatus.NOT_FOUND);
      }
      console.log(`✅ API Orders: Commande ${id} mise à jour`);
      return updatedOrder;
    } catch (error: any) {
      if (error.status === HttpStatus.NOT_FOUND) {
        throw error;
      }
      console.error(`❌ API Orders Error: ${error.message || error}`);
      throw new HttpException(
        'Erreur lors de la mise à jour',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Mettre à jour le statut d'une commande - API
   */
  @Put(':id/status')
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() body: { statusId: string },
  ) {
    console.log(`📡 API Orders: PUT /api/orders/${id}/status`);

    try {
      const success = await this.ordersService.updateOrderStatus(
        id,
        body.statusId,
      );
      console.log(`✅ API Orders: Statut commande ${id} mis à jour`);
      return { success };
    } catch (error: any) {
      console.error(`❌ API Orders Error: ${error.message || error}`);
      throw new HttpException(
        'Erreur lors de la mise à jour du statut',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Mettre à jour le statut de paiement - API
   */
  @Put(':id/payment')
  async updatePaymentStatus(
    @Param('id') id: string,
    @Body() body: { isPaid: boolean },
  ) {
    console.log(`📡 API Orders: PUT /api/orders/${id}/payment`);

    try {
      const success = await this.ordersService.updatePaymentStatus(
        id,
        body.isPaid,
      );
      console.log(`✅ API Orders: Statut paiement ${id} mis à jour`);
      return { success };
    } catch (error: any) {
      console.error(`❌ API Orders Error: ${error.message || error}`);
      throw new HttpException(
        'Erreur lors de la mise à jour du paiement',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Supprimer une commande - API
   */
  @Delete(':id')
  async deleteOrder(@Param('id') id: string) {
    console.log(`📡 API Orders: DELETE /api/orders/${id}`);

    try {
      const success = await this.ordersService.deleteOrder(id);
      console.log(`✅ API Orders: Commande ${id} supprimée`);
      return { success };
    } catch (error: any) {
      console.error(`❌ API Orders Error: ${error.message || error}`);
      throw new HttpException(
        'Erreur lors de la suppression',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
