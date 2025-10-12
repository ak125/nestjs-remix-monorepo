import {
  Controller,
  Post,
  Patch,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { OrderActionsService } from '../services/order-actions.service';

/**
 * 🎮 Controller Actions Commandes
 * 
 * Endpoints pour toutes les actions backoffice
 */
@Controller('api/admin/orders')
// @UseGuards(JwtAuthGuard, AdminLevelGuard) // TODO: Activer après tests
// @RequireAdminLevel(7)
export class OrderActionsController {
  constructor(private readonly orderActionsService: OrderActionsService) {}

  /**
   * PATCH /api/admin/orders/:orderId/lines/:lineId/status/:newStatus
   * Changer statut ligne (1-6, 91-94)
   */
  @Patch(':orderId/lines/:lineId/status/:newStatus')
  async updateLineStatus(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Param('lineId', ParseIntPipe) lineId: number,
    @Param('newStatus', ParseIntPipe) newStatus: number,
    @Body() body: { comment?: string; resetEquiv?: boolean },
  ) {
    return this.orderActionsService.updateLineStatus(
      orderId,
      lineId,
      newStatus,
      {
        comment: body.comment,
        userId: 1, // TODO: Get from JWT
        resetEquiv: body.resetEquiv,
      },
    );
  }

  /**
   * POST /api/admin/orders/:orderId/lines/:lineId/order-from-supplier
   * Commander chez fournisseur (statut 6)
   */
  @Post(':orderId/lines/:lineId/order-from-supplier')
  async orderFromSupplier(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Param('lineId', ParseIntPipe) lineId: number,
    @Body()
    body: {
      supplierId: number;
      supplierName: string;
      priceHT: number;
      quantity: number;
    },
  ) {
    return this.orderActionsService.updateLineStatus(orderId, lineId, 6, {
      userId: 1, // TODO: Get from JWT
      supplierData: {
        splId: body.supplierId,
        splName: body.supplierName,
        priceHT: body.priceHT,
        qty: body.quantity,
      },
    });
  }

  /**
   * POST /api/admin/orders/:orderId/lines/:lineId/propose-equivalent
   * Proposer équivalence (statut 91)
   */
  @Post(':orderId/lines/:lineId/propose-equivalent')
  async proposeEquivalent(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Param('lineId', ParseIntPipe) lineId: number,
    @Body() body: { productId: number; quantity: number },
  ) {
    return this.orderActionsService.proposeEquivalent(
      orderId,
      lineId,
      body.productId,
      body.quantity,
      1, // TODO: Get from JWT
    );
  }

  /**
   * PATCH /api/admin/orders/:orderId/lines/:lineId/accept-equivalent
   * Accepter équivalence (statut 92)
   */
  @Patch(':orderId/lines/:lineId/accept-equivalent')
  async acceptEquivalent(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Param('lineId', ParseIntPipe) lineId: number,
  ) {
    return this.orderActionsService.acceptEquivalent(orderId, lineId);
  }

  /**
   * PATCH /api/admin/orders/:orderId/lines/:lineId/reject-equivalent
   * Refuser équivalence (statut 93)
   */
  @Patch(':orderId/lines/:lineId/reject-equivalent')
  async rejectEquivalent(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Param('lineId', ParseIntPipe) lineId: number,
  ) {
    return this.orderActionsService.rejectEquivalent(orderId, lineId);
  }

  /**
   * PATCH /api/admin/orders/:orderId/lines/:lineId/validate-equivalent
   * Valider équivalence (statut 94) + Ticket
   */
  @Patch(':orderId/lines/:lineId/validate-equivalent')
  async validateEquivalent(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Param('lineId', ParseIntPipe) lineId: number,
  ) {
    return this.orderActionsService.validateEquivalent(orderId, lineId);
  }
}
