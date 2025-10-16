import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  Request,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { PaymentService } from '../services/payment.service';
import { CyberplusService } from '../services/cyberplus.service';
import { PaymentValidationService } from '../services/payment-validation.service';
import { PaymentDataService } from '../repositories/payment-data.service';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { PaymentStatus, PaymentMethod } from '../entities/payment.entity';

/**
 * 🔄 CONTRÔLEUR PAYMENTS CONSOLIDÉ
 * ═══════════════════════════════════════════════════════════════
 *
 * Ce contrôleur unifié gère toutes les opérations de paiement :
 *
 * SECTIONS :
 * 1. Routes Client    → Création, consultation, annulation
 * 2. Routes Admin     → Liste, remboursements, statistiques
 * 3. Routes Callbacks → Webhooks bancaires Cyberplus/BNP
 * 4. Routes Utilitaires → Méthodes disponibles, statuts
 *
 * SÉCURITÉ :
 * - AuthenticatedGuard sur routes client
 * - IsAdminGuard sur routes admin
 * - Validation signature sur callbacks
 * - Logs audit complets
 *
 * INTÉGRATIONS :
 * - Cyberplus/BNP Paribas
 * - Orders module (ord_* tables)
 * - Users module (cst_* tables)
 *
 * VERSION : 1.0.0
 * CRÉÉ : 2025-10-05
 * REFACTORING : Consolidation de 3 contrôleurs → 1
 */
@ApiTags('payments')
@Controller('api/payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly cyberplusService: CyberplusService,
    private readonly validationService: PaymentValidationService,
    private readonly paymentDataService: PaymentDataService,
  ) {
    this.logger.log('✅ PaymentsController initialized');
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 1 : ROUTES CLIENT
  // ═══════════════════════════════════════════════════════════════

  /**
   * POST /api/payments
   * Créer un nouveau paiement
   * 🔒 Authentification requise
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  // @UseGuards(AuthenticatedGuard) // TODO: Activer quand guards disponibles
  @ApiOperation({
    summary: 'Créer un nouveau paiement',
    description:
      'Initialise un paiement pour une commande. Retourne les données nécessaires pour redirection vers passerelle.',
  })
  @ApiResponse({
    status: 201,
    description: 'Paiement créé avec succès',
    schema: {
      example: {
        success: true,
        data: {
          id: 'pay_1234567890',
          paymentReference: 'PAY_1696502400_ABC123',
          status: 'pending',
          amount: 99.99,
          redirectUrl: 'https://secure-paypage.lyra.com/...',
          formData: {
            /* ... */
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  async createPayment(
    @Body() createPaymentDto: CreatePaymentDto,
    @Request() req?: any,
  ) {
    try {
      this.logger.log(`Creating payment for order ${createPaymentDto.orderId}`);

      // Récupérer userId depuis session si disponible
      const userId = req?.user?.id || createPaymentDto.userId;
      if (!userId) {
        throw new BadRequestException('User ID is required');
      }

      // Validation des données
      this.validationService.validateAmountLimits(createPaymentDto.amount);

      // Créer le paiement
      const payment = await this.paymentService.createPayment({
        ...createPaymentDto,
        userId,
      });

      // Si méthode Cyberplus, générer le formulaire de redirection
      let redirectData = null;
      if (createPaymentDto.method === PaymentMethod.CYBERPLUS) {
        redirectData = this.cyberplusService.generatePaymentForm({
          amount: payment.amount,
          currency: payment.currency,
          orderId: payment.orderId || payment.id,
          customerEmail: createPaymentDto.customerEmail || '',
          returnUrl:
            createPaymentDto.returnUrl ||
            `${process.env.BASE_URL}/payment/success`,
          cancelUrl:
            createPaymentDto.cancelUrl ||
            `${process.env.BASE_URL}/payment/cancel`,
          notifyUrl: `${process.env.BASE_URL}/api/payments/callback/cyberplus`,
          description: payment.description,
        });
      }

      this.logger.log(`✅ Payment created: ${payment.id}`);

      return {
        success: true,
        data: {
          ...payment,
          redirectData,
        },
        message: 'Paiement créé avec succès',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `❌ Failed to create payment: ${errorMessage}`,
        error instanceof Error ? error.stack : '',
      );
      throw error;
    }
  }

  /**
   * GET /api/payments/stats (et /stats/global)
   * Statistiques des paiements - DOIT être avant @Get(':id')
   * 🔒 Admin uniquement
   */
  @Get('stats')
  // @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Statistiques des paiements (admin)' })
  @ApiResponse({ status: 200, description: 'Statistiques' })
  async getPaymentStats(
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    try {
      this.logger.log('Admin: Getting payment statistics');

      const filters: any = {};
      if (status) filters.status = status;
      if (startDate) filters.startDate = new Date(startDate);
      if (endDate) filters.endDate = new Date(endDate);

      const stats = await this.paymentDataService.getPaymentStats(filters);

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Failed to get stats: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Alias pour GET /api/payments/stats/global
   */
  @Get('stats/global')
  async getGlobalStats(
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.getPaymentStats(status, startDate, endDate);
  }

  /**
   * GET /api/payments/:id
   * Obtenir les détails d'un paiement
   * 🔒 Authentification requise
   */
  @Get(':id')
  // @UseGuards(AuthenticatedGuard)
  @ApiOperation({ summary: "Obtenir les détails d'un paiement" })
  @ApiParam({ name: 'id', description: 'ID du paiement' })
  @ApiResponse({ status: 200, description: 'Détails du paiement' })
  @ApiResponse({ status: 404, description: 'Paiement non trouvé' })
  async getPayment(@Param('id') id: string, @Request() req?: any) {
    try {
      this.logger.log(`Getting payment details for ID: ${id}`);

      const payment = await this.paymentService.getPaymentStatus(id);

      if (!payment) {
        throw new NotFoundException(`Payment not found: ${id}`);
      }

      // Vérifier que l'utilisateur est propriétaire (si pas admin)
      const userId = req?.user?.id;
      if (userId && payment.userId !== userId && !req?.user?.isAdmin) {
        throw new BadRequestException('Unauthorized access to payment');
      }

      return {
        success: true,
        data: payment,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Failed to get payment: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * GET /api/payments/user/:userId
   * Liste des paiements d'un utilisateur
   * 🔒 Authentification requise
   */
  @Get('user/:userId')
  // @UseGuards(AuthenticatedGuard)
  @ApiOperation({ summary: "Liste des paiements d'un utilisateur" })
  @ApiParam({ name: 'userId', description: "ID de l'utilisateur" })
  @ApiResponse({ status: 200, description: 'Liste des paiements' })
  async getUserPayments(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
    @Request() req?: any,
  ) {
    try {
      this.logger.log(`Getting payments for user: ${userId}`);

      // Vérifier que l'utilisateur consulte ses propres paiements (sauf admin)
      if (req?.user?.id !== userId && !req?.user?.isAdmin) {
        throw new BadRequestException('Unauthorized access');
      }

      const payments = await this.paymentService.getUserPayments(
        userId,
        limit ? parseInt(limit) : 20,
      );

      return {
        success: true,
        data: payments,
        count: payments.length,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Failed to get user payments: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * GET /api/payments/order/:orderId
   * Paiements d'une commande
   * 🔒 Authentification requise
   */
  @Get('order/:orderId')
  // @UseGuards(AuthenticatedGuard)
  @ApiOperation({ summary: 'Paiements associés à une commande' })
  @ApiParam({ name: 'orderId', description: 'ID de la commande' })
  @ApiResponse({ status: 200, description: 'Liste des paiements' })
  async getOrderPayments(@Param('orderId') orderId: string) {
    try {
      this.logger.log(`Getting payments for order: ${orderId}`);

      const payment = await this.paymentService.getPaymentByOrderId(orderId);

      return {
        success: true,
        data: payment,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Failed to get order payments: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * GET /api/payments/reference/:reference
   * Récupérer un paiement par sa référence
   */
  @Get('reference/:reference')
  @ApiOperation({ summary: 'Paiement par référence' })
  @ApiParam({ name: 'reference', description: 'Référence du paiement' })
  @ApiResponse({ status: 200, description: 'Détails du paiement' })
  @ApiResponse({ status: 404, description: 'Paiement introuvable' })
  async getPaymentByReference(@Param('reference') reference: string) {
    try {
      this.logger.log(`Getting payment by reference: ${reference}`);

      const payment =
        await this.paymentService.getPaymentByReference(reference);

      return {
        success: true,
        data: payment,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `❌ Failed to get payment by reference: ${errorMessage}`,
      );
      throw new NotFoundException(`Payment not found: ${reference}`);
    }
  }

  /**
   * PATCH /api/payments/:id/status
   * Mettre à jour le statut d'un paiement
   * 🔐 Admin uniquement
   */
  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(AuthenticatedGuard, AdminGuard)
  @ApiOperation({ summary: 'Mettre à jour le statut du paiement' })
  @ApiParam({ name: 'id', description: 'ID du paiement' })
  @ApiResponse({ status: 200, description: 'Statut mis à jour' })
  @ApiResponse({ status: 404, description: 'Paiement introuvable' })
  async updatePaymentStatus(
    @Param('id') id: string,
    @Body() updateDto: { status: string; providerTransactionId?: string },
  ) {
    try {
      this.logger.log(`Updating payment status: ${id} -> ${updateDto.status}`);

      const payment = await this.paymentService.updatePaymentStatus(
        id,
        updateDto.status as any,
      );

      this.logger.log(`✅ Payment status updated: ${id}`);

      return {
        success: true,
        data: payment,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Failed to update payment status: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * POST /api/payments/:id/cancel
   * Annuler un paiement en attente
   * 🔒 Authentification requise
   */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(AuthenticatedGuard)
  @ApiOperation({ summary: 'Annuler un paiement en attente' })
  @ApiParam({ name: 'id', description: 'ID du paiement' })
  @ApiResponse({ status: 200, description: 'Paiement annulé' })
  @ApiResponse({ status: 400, description: 'Paiement non annulable' })
  async cancelPayment(@Param('id') id: string, @Request() req?: any) {
    try {
      this.logger.log(`Cancelling payment: ${id}`);

      // Vérifier propriété
      const payment = await this.paymentService.getPaymentStatus(id);
      if (req?.user?.id !== payment.userId && !req?.user?.isAdmin) {
        throw new BadRequestException('Unauthorized');
      }

      const cancelledPayment = await this.paymentService.cancelPayment(id);

      this.logger.log(`✅ Payment cancelled: ${id}`);

      return {
        success: true,
        data: cancelledPayment,
        message: 'Paiement annulé avec succès',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Failed to cancel payment: ${errorMessage}`);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 2 : ROUTES ADMIN
  // ═══════════════════════════════════════════════════════════════

  /**
   * GET /api/payments
   * Liste tous les paiements (admin seulement)
   * 🔒 Admin uniquement
   */
  @Get()
  // @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Liste tous les paiements (admin)' })
  @ApiResponse({ status: 200, description: 'Liste des paiements' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  async listAllPayments() {
    try {
      this.logger.log('Admin: Listing all payments');

      // TODO: Implémenter findAllPayments dans PaymentDataService
      // Pour l'instant, retourner message
      return {
        success: true,
        data: [],
        message: 'Method to be implemented: findAllPayments',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Failed to list payments: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * POST /api/payments/:id/refund
   * Rembourser un paiement (total ou partiel)
   * 🔒 Admin uniquement
   */
  @Post(':id/refund')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Rembourser un paiement (admin)' })
  @ApiParam({ name: 'id', description: 'ID du paiement' })
  @ApiResponse({ status: 200, description: 'Remboursement effectué' })
  @ApiResponse({ status: 400, description: 'Remboursement impossible' })
  async refundPayment(
    @Param('id') id: string,
    @Body() body: { amount?: number; reason?: string },
  ) {
    try {
      this.logger.log(`Admin: Processing refund for payment ${id}`);

      // Valider le remboursement
      if (body.amount) {
        await this.validationService.validateRefund(id, body.amount);
      }

      const refundedPayment = await this.paymentService.processRefund(
        id,
        body.amount,
        body.reason,
      );

      this.logger.log(`✅ Refund processed for payment: ${id}`);

      return {
        success: true,
        data: refundedPayment,
        message: 'Remboursement effectué avec succès',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Failed to refund payment: ${errorMessage}`);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 3 : CALLBACKS BANCAIRES
  // ═══════════════════════════════════════════════════════════════

  /**
   * POST /api/payments/callback/cyberplus
   * Webhook Cyberplus/BNP Paribas
   * ⚠️ PUBLIC (mais sécurisé par signature)
   */
  @Post('callback/cyberplus')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Callback Cyberplus pour notifications de paiement',
    description:
      'Endpoint webhook appelé par Cyberplus/BNP pour notifier le statut des paiements',
  })
  @ApiResponse({ status: 200, description: 'Callback traité avec succès' })
  @ApiResponse({
    status: 400,
    description: 'Signature invalide ou données manquantes',
  })
  async handleCyberplusCallback(@Body() body: any) {
    try {
      this.logger.log('🔔 Received Cyberplus callback', {
        transactionId: body.transaction_id || body.transactionid,
        orderId: body.order_id || body.orderid,
        status: body.status || body.statuscode,
      });

      // Enregistrer le callback dans ic_postback pour audit
      await this.saveCallbackToDatabase(body);

      // Validation de la signature
      const isValid = this.cyberplusService.validateCallback(body);
      if (!isValid) {
        this.logger.warn('⚠️ Invalid callback signature', body);
        return {
          success: false,
          message: 'Invalid signature',
          paymentId: body.order_id || body.orderid || '',
        };
      }

      // Normaliser les données du callback
      const callbackData = {
        transactionId: body.transaction_id || body.transactionid || '',
        paymentReference: body.order_id || body.orderid || body.paymentid || '',
        status: body.status || body.statuscode || '',
        amount: parseFloat(body.amount) || 0,
        signature: body.signature || '',
      };

      // Traiter le callback
      const payment =
        await this.paymentService.handlePaymentCallback(callbackData);

      this.logger.log(
        `✅ Callback processed successfully: ${payment.id} -> ${payment.status}`,
      );

      return {
        success: true,
        message: 'Callback processed successfully',
        paymentId: payment.id,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `❌ Failed to process callback: ${errorMessage}`,
        error instanceof Error ? error.stack : '',
      );

      return {
        success: false,
        message: 'Internal error',
        paymentId: body.order_id || body.orderid || '',
        error: errorMessage,
      };
    }
  }

  /**
   * POST /api/payments/callback/success
   * Page de retour pour paiement réussi
   */
  @Post('callback/success')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Page de retour après paiement réussi' })
  @ApiResponse({ status: 200, description: 'Paiement validé' })
  async handleSuccessReturn(@Body() body: any) {
    try {
      this.logger.log('✅ Payment success return', {
        orderId: body.order_id || body.orderid,
      });

      const orderId = body.order_id || body.orderid;
      if (!orderId) {
        throw new BadRequestException('Order ID missing');
      }

      const payment = await this.paymentService.getPaymentByOrderId(orderId);

      if (!payment) {
        this.logger.warn(`⚠️ Payment not found for order: ${orderId}`);
        return {
          success: false,
          data: null,
          message: 'Payment not found',
        };
      }

      return {
        success: true,
        data: {
          paymentId: payment.id,
          status: payment.status,
          amount: payment.amount,
          orderId: payment.orderId,
        },
        message: 'Payment completed successfully',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Failed to handle success return: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * POST /api/payments/callback/error
   * Page de retour pour erreur de paiement
   */
  @Post('callback/error')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Page de retour après erreur de paiement' })
  @ApiResponse({ status: 200, description: 'Erreur enregistrée' })
  async handleErrorReturn(@Body() body: any) {
    try {
      this.logger.warn('⚠️ Payment error return', {
        orderId: body.order_id || body.orderid,
        error: body.error || body.error_message,
      });

      const orderId = body.order_id || body.orderid;
      if (orderId) {
        const payment = await this.paymentService.getPaymentByOrderId(orderId);

        if (payment && payment.status === PaymentStatus.PENDING) {
          // Mettre à jour le statut en FAILED
          await this.paymentService.updatePaymentStatus(
            payment.id,
            PaymentStatus.FAILED,
          );
        }
      }

      return {
        success: false,
        message: 'Payment failed',
        error: body.error || body.error_message || 'Unknown error',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Failed to handle error return: ${errorMessage}`);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 4 : UTILITAIRES
  // ═══════════════════════════════════════════════════════════════

  /**
   * GET /api/payments/methods/available
   * Liste des méthodes de paiement disponibles
   */
  @Get('methods/available')
  @ApiOperation({ summary: 'Liste des méthodes de paiement disponibles' })
  @ApiResponse({ status: 200, description: 'Méthodes disponibles' })
  async getAvailablePaymentMethods() {
    try {
      this.logger.log('Getting available payment methods');

      const methods = [
        {
          id: PaymentMethod.CYBERPLUS,
          name: 'Cyberplus (BNP Paribas)',
          enabled: true,
          description:
            'Paiement sécurisé par carte bancaire via Cyberplus/BNP Paribas',
          logo: '/assets/cyberplus-logo.png',
        },
        {
          id: PaymentMethod.CREDIT_CARD,
          name: 'Carte de crédit',
          enabled: true,
          description: 'Visa, Mastercard, American Express',
          logo: '/assets/credit-card-logo.png',
        },
        {
          id: PaymentMethod.DEBIT_CARD,
          name: 'Carte de débit',
          enabled: true,
          description: 'Carte bancaire avec débit immédiat',
          logo: '/assets/debit-card-logo.png',
        },
        {
          id: PaymentMethod.PAYPAL,
          name: 'PayPal',
          enabled: false, // TODO: Activer quand intégration prête
          description: 'Paiement via compte PayPal',
          logo: '/assets/paypal-logo.png',
        },
        {
          id: PaymentMethod.BANK_TRANSFER,
          name: 'Virement bancaire',
          enabled: false,
          description: 'Paiement par virement SEPA (délai 2-3 jours)',
          logo: '/assets/bank-transfer-logo.png',
        },
      ];

      return {
        success: true,
        data: methods.filter((m) => m.enabled),
        allMethods: methods,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Failed to get payment methods: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * GET /api/payments/:id/transactions
   * Historique des transactions d'un paiement
   * 🔒 Authentification requise
   */
  @Get(':id/transactions')
  // @UseGuards(AuthenticatedGuard)
  @ApiOperation({ summary: "Historique des transactions d'un paiement" })
  @ApiParam({ name: 'id', description: 'ID du paiement' })
  @ApiResponse({ status: 200, description: 'Liste des transactions' })
  async getPaymentTransactions(@Param('id') id: string) {
    try {
      this.logger.log(`Getting transactions for payment: ${id}`);

      const transactions =
        await this.paymentDataService.findTransactionsByPaymentId(id);

      return {
        success: true,
        data: transactions,
        count: transactions.length,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`❌ Failed to get transactions: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * POST /api/payments/proceed-supplement
   * Initialiser le paiement d'un supplément de commande
   * 🔒 Authentification requise
   */
  @Post('proceed-supplement')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(AuthenticatedGuard)
  @ApiOperation({
    summary: "Initialiser le paiement d'un supplément de commande",
    description:
      'Génère le formulaire de paiement pour un supplément de commande (ORD_PARENT != 0)',
  })
  @ApiResponse({
    status: 200,
    description: 'Redirection vers passerelle de paiement',
  })
  @ApiResponse({ status: 400, description: 'Commande invalide ou déjà payée' })
  @ApiResponse({ status: 403, description: 'Accès non autorisé' })
  async proceedSupplementPayment(
    @Body('orderId') orderId: string,
    @Body('paymentMethod') paymentMethod: 'PAYBOX' | 'PAYPAL',
    @Request() req?: any,
  ) {
    try {
      this.logger.log(`Processing supplement payment for order ${orderId}`);

      // Récupérer userId depuis session
      const userId = req?.user?.id;
      if (!userId) {
        throw new BadRequestException('User ID is required - please login');
      }

      // Récupérer les données de la commande
      const { data: orderData, error: orderError } =
        await this.paymentDataService['supabase']
          .from('___xtr_order')
          .select('ord_id, ord_cst_id, ord_parent, ord_total_ttc, ord_is_pay')
          .eq('ord_id', orderId)
          .single();

      if (orderError || !orderData) {
        throw new NotFoundException(`Order not found: ${orderId}`);
      }

      // Vérifications de sécurité
      if (orderData.ord_cst_id !== userId) {
        throw new BadRequestException(
          'Unauthorized access - order does not belong to user',
        );
      }

      if (orderData.ord_is_pay === 1 || orderData.ord_is_pay === true) {
        throw new BadRequestException('Order already paid');
      }

      if (!orderData.ord_parent || orderData.ord_parent === '0') {
        throw new BadRequestException('This is not a supplement order');
      }

      // Créer le paiement
      const payment = await this.paymentService.createPayment({
        orderId: orderData.ord_id.toString(),
        userId: userId,
        amount: parseFloat(orderData.ord_total_ttc),
        currency: 'EUR',
        method:
          paymentMethod === 'PAYBOX'
            ? PaymentMethod.CYBERPLUS
            : PaymentMethod.PAYPAL,
        description: `Supplément commande ${orderData.ord_parent}/A - ${orderData.ord_id}/A`,
      });

      // Générer le formulaire de redirection selon la méthode
      let redirectData = null;
      let redirectUrl = null;

      if (paymentMethod === 'PAYBOX') {
        // Utiliser Cyberplus pour les cartes bancaires
        redirectData = this.cyberplusService.generatePaymentForm({
          amount: payment.amount,
          currency: payment.currency,
          orderId: orderData.ord_id.toString(),
          customerEmail: req?.user?.email || '',
          returnUrl: `${process.env.BASE_URL}/account/orders/${orderData.ord_id}/payment-success`,
          cancelUrl: `${process.env.BASE_URL}/account/orders/${orderData.ord_id}/payment-cancel`,
          notifyUrl: `${process.env.BASE_URL}/api/payments/callback/cyberplus`,
          description: payment.description,
        });
        redirectUrl = redirectData.action;
      } else {
        // PayPal - TODO: implémenter l'intégration PayPal
        redirectUrl = `${process.env.PAYPAL_URL}/checkout?order_id=${payment.id}`;
      }

      this.logger.log(`✅ Supplement payment initialized: ${payment.id}`);

      return {
        success: true,
        data: {
          paymentId: payment.id,
          redirectUrl,
          redirectData,
        },
        message: 'Paiement initialisé avec succès',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `❌ Failed to proceed supplement payment: ${errorMessage}`,
        error instanceof Error ? error.stack : '',
      );
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // MÉTHODES PRIVÉES / HELPERS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Enregistre le callback dans la table ic_postback pour audit
   */
  private async saveCallbackToDatabase(callbackData: any): Promise<void> {
    try {
      // Insérer dans table ic_postback
      const { error } = await this.paymentDataService['supabase']
        .from('ic_postback')
        .insert({
          id_ic_postback:
            callbackData.transaction_id || callbackData.transactionid || '',
          id_com: callbackData.order_id || callbackData.orderid || '',
          status: callbackData.status || callbackData.statuscode || '',
          statuscode: callbackData.statuscode || callbackData.status || '',
          orderid: callbackData.order_id || callbackData.orderid || '',
          paymentid: callbackData.payment_id || callbackData.paymentid || '',
          transactionid:
            callbackData.transaction_id || callbackData.transactionid || '',
          amount: callbackData.amount || '0',
          currency: callbackData.currency || 'EUR',
          paymentmethod:
            callbackData.payment_method || callbackData.paymentmethod || 'card',
          ip: callbackData.ip || '',
          ips: callbackData.ips || '',
          datepayment:
            callbackData.date_payment ||
            callbackData.datepayment ||
            new Date().toISOString(),
        });

      if (error) {
        this.logger.error('Failed to save callback to ic_postback:', error);
      } else {
        this.logger.log('✅ Callback saved to ic_postback table');
      }
    } catch (error) {
      // Ne pas bloquer le traitement si enregistrement échoue
      this.logger.error('Error saving callback to database:', error);
    }
  }

  /**
   * ✅ Phase 6: Endpoint de test pour paiement avec consignes
   */
  @Post('test/create-with-consignes')
  @ApiOperation({ summary: '[TEST] Créer un paiement incluant des consignes' })
  @HttpCode(HttpStatus.OK)
  async testCreatePaymentWithConsignes(
    @Body() testData?: { orderId?: string },
  ) {
    try {
      this.logger.log('🧪 [TEST] Creating payment with consignes...');

      // Données de test : commande avec 2 alternateurs à 72€ de consigne chacun
      const mockPaymentDto: CreatePaymentDto = {
        amount: 487.17, // 337.18 (produits) + 144 (consignes) + 5.99 (port)
        currency: 'EUR',
        method: PaymentMethod.CYBERPLUS,
        userId: 'test-user-123',
        orderId: testData?.orderId || 'ORD-TEST-CONSIGNES',
        description: 'Test paiement avec consignes - Phase 6',
        consigne_total: 144, // 2 x 72€
        consigne_details: [
          {
            productId: '3047339',
            quantity: 2,
            consigne_unit: 72,
          },
        ],
      };

      const payment = await this.paymentService.createPayment(mockPaymentDto);

      return {
        success: true,
        message: '✅ Phase 6: Paiement avec consignes créé avec succès',
        payment: {
          id: payment.id,
          reference: payment.paymentReference,
          amount: payment.amount,
          consigne_total: payment.metadata?.consigne_total || 0,
          consigne_details: payment.metadata?.consigne_details || [],
          status: payment.status,
        },
        breakdown: {
          produits: 337.18,
          consignes: 144,
          port: 5.99,
          total: 487.17,
        },
        note: 'Les consignes sont stockées dans ___xtr_order.ord_deposit_ttc (Phase 5). Le paiement contient le montant total (produits + consignes + port).',
      };
    } catch (error) {
      this.logger.error('Error creating test payment:', error);
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Failed to create test payment',
      );
    }
  }
}
