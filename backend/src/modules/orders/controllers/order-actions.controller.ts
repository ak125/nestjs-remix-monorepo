/* eslint-disable prettier/prettier */
import {
  Controller,
  Post,
  Patch,
  Param,
  Body,
  ParseIntPipe,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { OrderActionsService } from '../services/order-actions.service';
import { EmailService } from '../../../services/email.service';

/**
 * 🎮 Controller Actions Commandes
 * 
 * Endpoints pour toutes les actions backoffice
 */
@Controller('api/admin/orders')
// @UseGuards(JwtAuthGuard, AdminLevelGuard) // TODO: Activer après tests
// @RequireAdminLevel(7)
export class OrderActionsController {
  private readonly logger = new Logger(OrderActionsController.name);

  constructor(
    private readonly orderActionsService: OrderActionsService,
    private readonly emailService: EmailService,
  ) {}

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

  // ============================================================
  // ACTIONS GLOBALES SUR COMMANDES (Nouveau)
  // ============================================================

  /**
   * POST /api/admin/orders/:orderId/validate
   * Valider commande (statut 2 → 3)
   */
  @Post(':orderId/validate')
  async validateOrder(@Param('orderId') orderId: string) {
    try {
      this.logger.log(`🔍 Validation commande ${orderId} démarrée`);

      // 1. Valider commande
      await this.orderActionsService.validateOrder(orderId);

      // 2. Récupérer données pour email
      const order = await this.orderActionsService.getOrder(orderId);
      const customer = await this.orderActionsService.getCustomer(
        order.ord_cst_id,
      );

      // 3. Envoyer email confirmation
      await this.emailService.sendOrderConfirmation(order, customer);

      this.logger.log(`✅ Commande ${orderId} validée avec succès`);

      return {
        success: true,
        message: 'Commande validée et client notifié',
        order: { ...order, ord_ords_id: '3' },
      };
    } catch (error: any) {
      this.logger.error(`❌ Échec validation ${orderId}:`, error.message);
      throw error;
    }
  }

  /**
   * POST /api/admin/orders/:orderId/ship
   * Expédier commande (statut 3 → 4)
   */
  @Post(':orderId/ship')
  async shipOrder(
    @Param('orderId') orderId: string,
    @Body() body: { trackingNumber: string },
  ) {
    try {
      if (!body.trackingNumber) {
        throw new BadRequestException('Numéro de suivi requis');
      }

      this.logger.log(
        `📦 Expédition commande ${orderId} - Suivi: ${body.trackingNumber}`,
      );

      // 1. Expédier commande
      await this.orderActionsService.shipOrder(orderId, body.trackingNumber);

      // 2. Récupérer données pour email
      const order = await this.orderActionsService.getOrder(orderId);
      const customer = await this.orderActionsService.getCustomer(
        order.ord_cst_id,
      );

      // 3. Envoyer email avec suivi
      await this.emailService.sendShippingNotification(
        order,
        customer,
        body.trackingNumber,
      );

      this.logger.log(`✅ Commande ${orderId} expédiée avec succès`);

      return {
        success: true,
        message: 'Commande expédiée et client notifié',
        trackingNumber: body.trackingNumber,
      };
    } catch (error: any) {
      this.logger.error(`❌ Échec expédition ${orderId}:`, error.message);
      throw error;
    }
  }

  /**
   * POST /api/admin/orders/:orderId/deliver
   * Marquer comme livrée (statut 4 → 5)
   */
  @Post(':orderId/deliver')
  async markAsDelivered(@Param('orderId') orderId: string) {
    try {
      this.logger.log(`🚚 Livraison commande ${orderId}`);

      await this.orderActionsService.markAsDelivered(orderId);

      this.logger.log(`✅ Commande ${orderId} marquée comme livrée`);

      return {
        success: true,
        message: 'Commande marquée comme livrée',
      };
    } catch (error: any) {
      this.logger.error(`❌ Échec livraison ${orderId}:`, error.message);
      throw error;
    }
  }

  /**
   * POST /api/admin/orders/:orderId/cancel
   * Annuler commande
   */
  @Post(':orderId/cancel')
  async cancelOrder(
    @Param('orderId') orderId: string,
    @Body() body: { reason: string },
  ) {
    try {
      if (!body.reason) {
        throw new BadRequestException("Raison d'annulation requise");
      }

      this.logger.log(
        `❌ Annulation commande ${orderId} - Raison: ${body.reason}`,
      );

      // 1. Annuler commande
      await this.orderActionsService.cancelOrder(orderId, body.reason);

      // 2. Récupérer données pour email
      const order = await this.orderActionsService.getOrder(orderId);
      const customer = await this.orderActionsService.getCustomer(
        order.ord_cst_id,
      );

      // 3. Envoyer email annulation
      await this.emailService.sendCancellationEmail(
        order,
        customer,
        body.reason,
      );

      this.logger.log(`✅ Commande ${orderId} annulée avec succès`);

      return {
        success: true,
        message: 'Commande annulée et client notifié',
      };
    } catch (error: any) {
      this.logger.error(`❌ Échec annulation ${orderId}:`, error.message);
      throw error;
    }
  }

  /**
   * POST /api/admin/orders/:orderId/payment-reminder
   * Envoyer rappel de paiement
   */
  @Post(':orderId/payment-reminder')
  async sendPaymentReminder(@Param('orderId') orderId: string) {
    try {
      this.logger.log(`📧 Envoi rappel paiement pour commande ${orderId}`);

      // 1. Récupérer commande
      const order = await this.orderActionsService.getOrder(orderId);

      // 2. Vérifier que pas déjà payée
      if (order.ord_is_pay === '1') {
        throw new BadRequestException('Commande déjà payée');
      }

      // 3. Récupérer client
      const customer = await this.orderActionsService.getCustomer(
        order.ord_cst_id,
      );

      // 4. Envoyer email rappel
      await this.emailService.sendPaymentReminder(order, customer);

      this.logger.log(`✅ Email rappel envoyé à ${customer.cst_mail}`);

      return {
        success: true,
        message: `Email de rappel envoyé à ${customer.cst_mail}`,
      };
    } catch (error: any) {
      this.logger.error(`❌ Échec envoi rappel ${orderId}:`, error.message);
      throw error;
    }
  }

  // ============================================================
  // ACTIONS SUR LIGNES (Existantes)
  // ============================================================

  /**
   * PATCH /api/admin/orders/:orderId/lines/:lineId/status/:newStatus
   * Changer statut ligne (1-6, 91-94)
   */
  @Patch(':orderId/lines/:lineId/status/:newStatus')
  async validateEquivalent(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Param('lineId', ParseIntPipe) lineId: number,
  ) {
    return this.orderActionsService.validateEquivalent(orderId, lineId);
  }
}
