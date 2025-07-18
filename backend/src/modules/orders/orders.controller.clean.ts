/**
 * Contrôleur Orders - Version simplifiée
 * Utilise les services propres et les méthodes disponibles
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersCompleteService } from './orders-complete.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('orders')
@UseGuards(AuthGuard('session'))
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly ordersCompleteService: OrdersCompleteService
  ) {}

  /**
   * Récupérer les commandes avec pagination
   */
  @Get()
  async getOrders(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string
  ) {
    return this.ordersService.findOrdersWithPagination(
      page,
      limit,
      { status, customerId, dateFrom, dateTo }
    );
  }

  /**
   * Récupérer une commande par ID
   */
  @Get(':id')
  async getOrderById(@Param('id') id: string) {
    return this.ordersService.findOrderById(id);
  }

  /**
   * Récupérer les commandes d'un client
   */
  @Get('customer/:customerId')
  async getOrdersByCustomer(@Param('customerId') customerId: string) {
    return this.ordersService.findOrdersByCustomerId(customerId);
  }

  /**
   * Récupérer les statistiques par statut
   */
  @Get('stats/by-status')
  async getOrderStatsByStatus() {
    return this.ordersService.getOrderStatsByStatus();
  }

  /**
   * Récupérer tous les statuts de commande
   */
  @Get('statuses/orders')
  async getOrderStatuses() {
    return this.ordersService.getAllOrderStatuses();
  }

  /**
   * Récupérer tous les statuts de ligne
   */
  @Get('statuses/lines')
  async getOrderLineStatuses() {
    return this.ordersService.getAllOrderLineStatuses();
  }

  /**
   * Récupérer les statistiques générales
   */
  @Get('stats/general')
  async getGeneralStats() {
    return this.ordersService.getOrderStats();
  }

  /**
   * Créer une nouvelle commande
   */
  @Post()
  async createOrder(@Body() orderData: any) {
    return this.ordersService.createOrder(orderData);
  }

  /**
   * Mettre à jour une commande
   */
  @Put(':id')
  async updateOrder(@Param('id') id: string, @Body() updates: any) {
    return this.ordersService.updateOrder(id, updates);
  }

  /**
   * Mettre à jour le statut de paiement
   */
  @Put(':id/payment-status')
  async updatePaymentStatus(
    @Param('id') id: string,
    @Body() body: { isPaid: boolean }
  ) {
    return this.ordersService.updatePaymentStatus(id, body.isPaid);
  }

  /**
   * Mettre à jour le statut de commande
   */
  @Put(':id/status')
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() body: { statusId: string }
  ) {
    return this.ordersService.updateOrderStatus(id, body.statusId);
  }

  /**
   * Supprimer une commande
   */
  @Delete(':id')
  async deleteOrder(@Param('id') id: string) {
    return this.ordersService.deleteOrder(id);
  }

  /**
   * ADMIN: Récupérer toutes les commandes avec relations complètes
   */
  @Get('admin/all-relations')
  async getOrdersWithAllRelations(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string
  ) {
    return this.ordersCompleteService.getOrdersWithAllRelations(
      page,
      limit,
      { status, customerId, dateFrom, dateTo }
    );
  }

  /**
   * ADMIN: Récupérer une commande avec tous les détails
   */
  @Get('admin/:id/complete')
  async getCompleteOrderById(@Param('id') id: string) {
    return this.ordersCompleteService.getCompleteOrderById(id);
  }
}
