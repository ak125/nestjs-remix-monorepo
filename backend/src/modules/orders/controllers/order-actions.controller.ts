/* eslint-disable prettier/prettier */
import {
  Controller,
  Post,
  Patch,
  Get,
  Param,
  Body,
  ParseIntPipe,
  Logger,
  BadRequestException,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { PermissionsGuard } from '@auth/guards/permissions.guard';
import { RequirePermission } from '@auth/decorators/require-permission.decorator';
import { OrderActionsService } from '../services/order-actions.service';
import {
  OrdersService,
  type CreateSupplementOrderInput,
} from '../services/orders.service';
import { MailService } from '../../../services/mail.service';
import { z } from 'zod';
import { OrderLineSupplierService } from '../services/order-line-supplier.service';
import { SupplierOrderPreparationService } from '../services/supplier-order-preparation.service';

/** `orl_id` / `ord_id` sont du texte en base : numérique, « <ord>-L001 », « ORD-… ». */
const IDENTIFIANT_TEXTE = /^[A-Za-z0-9_-]{1,64}$/;
const ConfirmSupplierSchema = z
  .object({
    splId: z.string().regex(/^[0-9]{1,9}$/),
    prixAchatUnitHt: z.number().positive(),
  })
  .strict();
const MarkRuptureSchema = z
  .object({ comment: z.string().max(500).optional() })
  .strict();
/**
 * Mandat BK : aucun champ quantité, fournisseur ni prix — ils viennent de la
 * ligne et de la relecture live, jamais du client (contrôle 5).
 */
const PrepareSupplierOrderSchema = z
  .object({
    compatibiliteVerifiee: z.boolean(),
    confirmationPlafond: z.boolean().optional(),
  })
  .strict();

function identifiant(valeur: string, nom: string): string {
  if (!IDENTIFIANT_TEXTE.test(valeur)) {
    throw new BadRequestException(`${nom} invalide`);
  }
  return valeur;
}

function valider<T>(schema: z.ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body ?? {});
  if (!r.success) {
    throw new BadRequestException(r.error.issues);
  }
  return r.data;
}

/**
 * 🎮 Controller Actions Commandes
 *
 * Endpoints pour toutes les actions backoffice. Permissions per-action via
 * @RequirePermission(canX) consultant la matrice canonique PermissionsService.
 * Cf docs/specs/2026-04-30-permissions-canonical-backend-design.md
 */
@Controller('api/admin/orders')
@UseGuards(AuthenticatedGuard, PermissionsGuard)
export class OrderActionsController {
  private readonly logger = new Logger(OrderActionsController.name);

  constructor(
    private readonly orderActionsService: OrderActionsService,
    private readonly mailService: MailService,
    private readonly ordersService: OrdersService,
    private readonly lineSupplierService: OrderLineSupplierService,
    private readonly supplierOrderPreparation: SupplierOrderPreparationService,
  ) {}

  /**
   * GET /api/admin/orders/:orderId/lines/:lineId/supplier-proposal
   * Décision 50 : fournisseur proposé (pièce vendable au meilleur prix d'achat),
   * ou RUPTURE, ou A_COMPLETER avec les motifs. Lecture seule.
   */
  @Get(':orderId/lines/:lineId/supplier-proposal')
  @RequirePermission('canValidate')
  async getSupplierProposal(
    @Param('orderId') orderId: string,
    @Param('lineId') lineId: string,
  ) {
    return this.lineSupplierService.getProposal(
      identifiant(orderId, 'orderId'),
      identifiant(lineId, 'lineId'),
    );
  }

  /**
   * POST /api/admin/orders/:orderId/lines/:lineId/confirm-supplier
   * Décision 50 : confirmation en un geste. Le corps reprend le fournisseur et le
   * prix affichés ; s'ils ne correspondent plus à la proposition recalculée → 409.
   */
  @Post(':orderId/lines/:lineId/confirm-supplier')
  @RequirePermission('canValidate')
  async confirmSupplier(
    @Param('orderId') orderId: string,
    @Param('lineId') lineId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const attendu = valider(ConfirmSupplierSchema, body);
    const userId = (req.user as { id?: unknown } | undefined)?.id;
    return this.orderActionsService.confirmLineSupplier(
      identifiant(orderId, 'orderId'),
      identifiant(lineId, 'lineId'),
      attendu,
      userId != null ? String(userId) : undefined,
    );
  }

  /**
   * POST /api/admin/orders/:orderId/lines/:lineId/mark-rupture
   * Décision 50 : statut de ligne 4 « Pièce non disponible ». La suite suit le
   * skill order-rupture-equivalence (rien n'est envoyé ni annulé ici).
   */
  @Post(':orderId/lines/:lineId/mark-rupture')
  @RequirePermission('canValidate')
  async markRupture(
    @Param('orderId') orderId: string,
    @Param('lineId') lineId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const { comment } = valider(MarkRuptureSchema, body);
    const userId = (req.user as { id?: unknown } | undefined)?.id;
    return this.orderActionsService.markLineRupture(
      identifiant(orderId, 'orderId'),
      identifiant(lineId, 'lineId'),
      userId != null ? String(userId) : undefined,
      comment,
    );
  }

  /**
   * POST /api/admin/orders/:orderId/lines/:lineId/prepare-supplier-order
   * Mandat BK, mode essai : relecture live du portail, 8 contrôles, trace sur la
   * ligne. La commande fournisseur est PRÉPARÉE, jamais envoyée.
   */
  @Post(':orderId/lines/:lineId/prepare-supplier-order')
  @RequirePermission('canValidate')
  async prepareSupplierOrder(
    @Param('orderId') orderId: string,
    @Param('lineId') lineId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const demande = valider(PrepareSupplierOrderSchema, body);
    const userId = (req.user as { id?: unknown } | undefined)?.id;
    return this.supplierOrderPreparation.prepare(
      identifiant(orderId, 'orderId'),
      identifiant(lineId, 'lineId'),
      demande,
      userId != null ? String(userId) : null,
    );
  }

  /**
   * GET /api/admin/orders/:orderId/lines/:lineId/prepared-supplier-order
   * Mandat BK : commande fournisseur préparée, dernier refus et comparaison avec
   * la commande passée à la main. Lecture seule.
   */
  @Get(':orderId/lines/:lineId/prepared-supplier-order')
  @RequirePermission('canValidate')
  async getPreparedSupplierOrder(
    @Param('orderId') orderId: string,
    @Param('lineId') lineId: string,
  ) {
    return this.supplierOrderPreparation.getPrepared(
      identifiant(orderId, 'orderId'),
      identifiant(lineId, 'lineId'),
    );
  }

  /**
   * PATCH /api/admin/orders/:orderId/lines/:lineId/status/:newStatus
   * Changer statut ligne (1-6, 91-94)
   */
  @Patch(':orderId/lines/:lineId/status/:newStatus')
  @RequirePermission('canValidate')
  async updateLineStatus(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Param('lineId', ParseIntPipe) lineId: number,
    @Param('newStatus', ParseIntPipe) newStatus: number,
    @Body() body: { comment?: string; resetEquiv?: boolean },
    @Req() req: Request,
  ) {
    return this.orderActionsService.updateLineStatus(
      orderId,
      lineId,
      newStatus,
      {
        comment: body.comment,
        userId: (req.user as any)?.id,
        resetEquiv: body.resetEquiv,
      },
    );
  }

  /**
   * POST /api/admin/orders/:orderId/lines/:lineId/order-from-supplier
   * Commander chez fournisseur (statut 6)
   */
  @Post(':orderId/lines/:lineId/order-from-supplier')
  @RequirePermission('canValidate')
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
    @Req() req: Request,
  ) {
    return this.orderActionsService.updateLineStatus(orderId, lineId, 6, {
      userId: (req.user as any)?.id,
      supplierData: {
        splId: body.supplierId,
        splName: body.supplierName,
        priceHT: body.priceHT,
        qty: body.quantity,
      },
    });
  }

  /**
   * PATCH /api/admin/orders/:orderId/lines/:lineId/accept-equivalent
   * Accepter équivalence (statut 92)
   */
  @Patch(':orderId/lines/:lineId/accept-equivalent')
  @RequirePermission('canValidate')
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
  @RequirePermission('canValidate')
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
  @RequirePermission('canValidate')
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
      await this.mailService.sendOrderConfirmation(order, customer);

      this.logger.log(`✅ Commande ${orderId} validée avec succès`);

      return {
        success: true,
        message: 'Commande validée et client notifié',
        order: { ...order, ord_ords_id: '3' },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Échec validation ${orderId}:`, message);
      throw error;
    }
  }

  /**
   * POST /api/admin/orders/:orderId/ship
   * Expédier commande (statut 3 → 4)
   */
  @Post(':orderId/ship')
  @RequirePermission('canShip')
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
      await this.mailService.sendShippingNotification(
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Échec expédition ${orderId}:`, message);
      throw error;
    }
  }

  /**
   * POST /api/admin/orders/:orderId/deliver
   * Marquer comme livrée (statut 4 → 5)
   */
  @Post(':orderId/deliver')
  @RequirePermission('canDeliver')
  async markAsDelivered(@Param('orderId') orderId: string) {
    try {
      this.logger.log(`🚚 Livraison commande ${orderId}`);

      await this.orderActionsService.markAsDelivered(orderId);

      this.logger.log(`✅ Commande ${orderId} marquée comme livrée`);

      return {
        success: true,
        message: 'Commande marquée comme livrée',
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Échec livraison ${orderId}:`, message);
      throw error;
    }
  }

  /**
   * POST /api/admin/orders/:orderId/cancel
   * Annuler commande
   */
  @Post(':orderId/cancel')
  @RequirePermission('canCancel')
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

      // Le mail d'annulation part de l'écouteur de ORDER_EVENTS.CANCELLED
      // (OrderEmailListener), émis par le service : un seul mail.
      await this.orderActionsService.cancelOrder(orderId, body.reason);

      this.logger.log(`✅ Commande ${orderId} annulée avec succès`);

      return {
        success: true,
        message: 'Commande annulée et client notifié',
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Échec annulation ${orderId}:`, message);
      throw error;
    }
  }

  /**
   * POST /api/admin/orders/:orderId/supplements
   * Supplément après une rupture fournisseur : l'équivalent disponible coûte
   * plus cher, le client paie la différence par une commande enfant. Les règles
   * sont dans OrdersService.createSupplementOrder. Aucun mail n'est envoyé : le
   * texte proposé au client, avec `paymentUrl`, est validé par l'owner.
   */
  @Post(':orderId/supplements')
  @RequirePermission('canCreateOrders')
  async createSupplementOrder(
    @Param('orderId') orderId: string,
    @Body() body: CreateSupplementOrderInput,
    @Req() req: Request,
  ) {
    const supplement = await this.ordersService.createSupplementOrder(
      orderId,
      body,
      { userId: req.user?.id },
    );
    return {
      success: true,
      message: `Supplément ${supplement.orderId} créé : ${supplement.totalTtc.toFixed(2)} € TTC à payer par le client.`,
      ...supplement,
    };
  }

  /**
   * POST /api/admin/orders/:orderId/confirm-payment
   * Confirmer paiement manuellement (admin)
   */
  @Post(':orderId/confirm-payment')
  @RequirePermission('canMarkPaid')
  async confirmPayment(@Param('orderId') orderId: string) {
    try {
      this.logger.log(`💰 Confirmation paiement manuel commande ${orderId}`);

      await this.orderActionsService.confirmPaymentManual(orderId);

      this.logger.log(`✅ Paiement commande ${orderId} confirme manuellement`);

      return {
        success: true,
        message: 'Paiement confirme manuellement',
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Echec confirmation paiement ${orderId}:`, message);
      throw error;
    }
  }

  /**
   * POST /api/admin/orders/:orderId/payment-reminder
   * Envoyer rappel de paiement
   */
  @Post(':orderId/payment-reminder')
  @RequirePermission('canSendEmails')
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
      await this.mailService.sendPaymentReminder(order, customer);

      this.logger.log(`✅ Email rappel envoyé à ${customer.cst_mail}`);

      return {
        success: true,
        message: `Email de rappel envoyé à ${customer.cst_mail}`,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Échec envoi rappel ${orderId}:`, message);
      throw error;
    }
  }
}
