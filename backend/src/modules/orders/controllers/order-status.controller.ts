import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  BadRequestException,
} from '@nestjs/common';
import {
  OrderStatusService,
  OrderLineStatusCode,
} from '../services/order-status.service';

/**
 * Contrôleur pour tester et gérer les statuts de commandes
 */
@Controller('order-status')
export class OrderStatusController {
  constructor(private readonly orderStatusService: OrderStatusService) {}

  /**
   * GET /order-status/info/:status
   * Obtenir les informations d'un statut
   */
  @Get('info/:status')
  async getStatusInfo(@Param('status') status: string) {
    try {
      const statusNum = parseInt(status);
      const info = this.orderStatusService.getStatusInfo(statusNum);

      return {
        success: true,
        status: statusNum,
        ...info,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * GET /order-status/all
   * Obtenir tous les statuts disponibles
   */
  @Get('all')
  async getAllStatuses() {
    try {
      const statuses = this.orderStatusService.getAllStatuses();
      const statusDetails = statuses.map((status) => ({
        code: status,
        ...this.orderStatusService.getStatusInfo(status),
      }));

      return {
        success: true,
        statuses: statusDetails,
        total: statuses.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * PATCH /order-status/line/:lineId
   * Mettre à jour le statut d'une ligne de commande
   */
  @Patch('line/:lineId')
  async updateLineStatus(
    @Param('lineId') lineId: string,
    @Body() body: { status: number; comment?: string; userId?: number },
  ) {
    try {
      const lineIdNum = parseInt(lineId);

      if (isNaN(lineIdNum)) {
        throw new BadRequestException('ID de ligne invalide');
      }

      if (!body.status) {
        throw new BadRequestException('Statut requis');
      }

      const result = await this.orderStatusService.updateLineStatus(
        lineIdNum,
        body.status,
        body.comment,
        body.userId,
      );

      return {
        success: true,
        message: `Statut mis à jour vers ${body.status}`,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * GET /order-status/order/:orderId/history
   * Obtenir l'historique des statuts d'une commande
   */
  @Get('order/:orderId/history')
  async getOrderStatusHistory(@Param('orderId') orderId: string) {
    try {
      const orderIdNum = parseInt(orderId);

      if (isNaN(orderIdNum)) {
        throw new BadRequestException('ID de commande invalide');
      }

      const history =
        await this.orderStatusService.getOrderStatusHistory(orderIdNum);

      return {
        success: true,
        orderId: orderIdNum,
        history: history,
        total: history.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * GET /order-status/test
   * Test des transitions de statuts
   */
  @Get('test')
  async testStatusTransitions() {
    try {
      const transitions = [
        {
          from: OrderLineStatusCode.PENDING,
          to: OrderLineStatusCode.CONFIRMED,
        },
        {
          from: OrderLineStatusCode.CONFIRMED,
          to: OrderLineStatusCode.PREPARING,
        },
        { from: OrderLineStatusCode.PREPARING, to: OrderLineStatusCode.READY },
        { from: OrderLineStatusCode.READY, to: OrderLineStatusCode.SHIPPED },
        {
          from: OrderLineStatusCode.SHIPPED,
          to: OrderLineStatusCode.DELIVERED,
        },
        {
          from: OrderLineStatusCode.DELIVERED,
          to: OrderLineStatusCode.RETURNED,
        },
        {
          from: OrderLineStatusCode.RETURNED,
          to: OrderLineStatusCode.REFUNDED,
        },
      ];

      const results = transitions.map(({ from, to }) => {
        const canTransition = this.orderStatusService['canTransition'](
          from,
          to,
        );
        return {
          from: {
            code: from,
            label: this.orderStatusService['getStatusLabel'](from),
          },
          to: {
            code: to,
            label: this.orderStatusService['getStatusLabel'](to),
          },
          allowed: canTransition,
        };
      });

      return {
        success: true,
        message: 'Test des transitions de statuts',
        transitions: results,
        validTransitions: results.filter((r) => r.allowed).length,
        totalTransitions: results.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
