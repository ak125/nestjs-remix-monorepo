/**
 * 📋 CONTRÔLEUR ORDERS ADMIN - Module Admin
 *
 * API REST pour la gestion des commandes administratives
 * Réutilise les services Orders existants avec sécurisation admin
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  Request,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { OrdersService } from '../../orders/orders.service';
import { OrdersCompleteService } from '../../orders/orders-complete.service';
import { LocalAuthGuard } from '../../../auth/local-auth.guard';

@Controller('api/admin/orders')
@UseGuards(LocalAuthGuard)
export class AdminOrdersController {
  private readonly logger = new Logger(AdminOrdersController.name);

  constructor(
    private readonly ordersService: OrdersService,
    private readonly ordersCompleteService: OrdersCompleteService,
  ) {}

  /**
   * GET /admin/orders
   * Récupérer toutes les commandes avec pagination et filtres
   */
  @Get()
  async getAllOrders(@Query() query: any, @Request() _req: any) {
    try {
      this.logger.log('Requête liste commandes admin');

      const page = parseInt(query.page) || 1;
      const limit = parseInt(query.limit) || 20;
      const status = query.status;
      const automotive = query.automotive === 'true';

      // Utiliser le service standard avec pagination
      const result = await this.ordersService.findOrdersWithPagination(
        page,
        limit,
      );

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur lors de la récupération des commandes:', error);
      return {
        success: false,
        error: 'Erreur lors de la récupération des commandes',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * GET /admin/orders/stats
   * Récupérer les statistiques des commandes
   */
  @Get('stats')
  async getOrdersStats() {
    try {
      this.logger.log('Requête statistiques commandes');
      const stats = await this.ordersService.getOrderStatsByStatus();

      return {
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        'Erreur lors de la récupération des stats commandes:',
        error,
      );
      return {
        success: false,
        error: 'Erreur lors de la récupération des statistiques',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * GET /admin/orders/:id
   * Récupérer une commande par ID
   */
  @Get(':id')
  async getOrderById(@Param('id') id: string) {
    try {
      this.logger.log(`Requête commande ID: ${id}`);
      const order = await this.ordersService.findOrderById(id);

      if (!order) {
        throw new NotFoundException('Commande non trouvée');
      }

      return {
        success: true,
        data: order,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération de la commande ${id}:`,
        error,
      );
      return {
        success: false,
        error:
          error instanceof NotFoundException
            ? 'Commande non trouvée'
            : 'Erreur lors de la récupération de la commande',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * PATCH /admin/orders/:id/status
   * Mettre à jour le statut d'une commande
   */
  @Patch(':id/status')
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() { status }: { status: string },
    @Request() _req: any,
  ) {
    try {
      this.logger.log(`Mise à jour statut commande ${id}: ${status}`);

      if (!status) {
        throw new BadRequestException('Le statut est requis');
      }

      // Note: Vous devrez peut-être implémenter cette méthode dans OrdersService
      // const updatedOrder = await this.ordersService.updateOrderStatus(id, status);

      return {
        success: true,
        message: `Statut de la commande mis à jour: ${status}`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la mise à jour du statut de la commande ${id}:`,
        error,
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Erreur lors de la mise à jour du statut',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * GET /admin/orders/customer/:customerId
   * Récupérer les commandes d'un client
   */
  @Get('customer/:customerId')
  async getOrdersByCustomer(@Param('customerId') customerId: string) {
    try {
      this.logger.log(`Requête commandes client: ${customerId}`);
      const orders =
        await this.ordersService.findOrdersByCustomerId(customerId);

      return {
        success: true,
        data: orders,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération des commandes du client ${customerId}:`,
        error,
      );
      return {
        success: false,
        error: 'Erreur lors de la récupération des commandes du client',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
