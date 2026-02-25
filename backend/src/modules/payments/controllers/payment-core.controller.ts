import {
  Controller,
  Post,
  Get,
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
import { PayboxService } from '../services/paybox.service';
import { PaymentValidationService } from '../services/payment-validation.service';
import { PaymentDataService } from '../repositories/payment-data.service';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { PaymentMethod } from '../entities/payment.entity';
import { logPaymentError } from './payment-controller.utils';

interface AuthenticatedRequest {
  user?: { id: string; email?: string; isAdmin?: boolean };
}

/**
 * Routes client : creation, consultation, annulation, supplement
 */
@ApiTags('payments')
@Controller('api/payments')
export class PaymentCoreController {
  private readonly logger = new Logger(PaymentCoreController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly cyberplusService: CyberplusService,
    private readonly payboxService: PayboxService,
    private readonly validationService: PaymentValidationService,
    private readonly paymentDataService: PaymentDataService,
  ) {}

  /**
   * POST /api/payments
   * Creer un nouveau paiement
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  // @UseGuards(AuthenticatedGuard)
  @ApiOperation({
    summary: 'Creer un nouveau paiement',
    description:
      'Initialise un paiement pour une commande. Retourne les donnees necessaires pour redirection vers passerelle.',
  })
  @ApiResponse({
    status: 201,
    description: 'Paiement cree avec succes',
    schema: {
      example: {
        success: true,
        data: {
          id: 'pay_1234567890',
          paymentReference: 'PAY_1696502400_ABC123',
          status: 'pending',
          amount: 99.99,
          redirectUrl: 'https://secure-paypage.lyra.com/...',
          formData: {},
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Donnees invalides' })
  @ApiResponse({ status: 401, description: 'Non authentifie' })
  async createPayment(
    @Body() createPaymentDto: CreatePaymentDto,
    @Request() req?: AuthenticatedRequest,
  ) {
    try {
      this.logger.log(`Creating payment for order ${createPaymentDto.orderId}`);

      const userId = req?.user?.id || createPaymentDto.userId;
      if (!userId) {
        throw new BadRequestException('User ID is required');
      }

      this.validationService.validateAmountLimits(createPaymentDto.amount);

      const payment = await this.paymentService.createPayment({
        ...createPaymentDto,
        userId,
      });

      let redirectData = null;
      const methodLower = createPaymentDto.method?.toString().toLowerCase();

      if (
        methodLower === 'cyberplus' ||
        createPaymentDto.method === PaymentMethod.CYBERPLUS
      ) {
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
          notifyUrl:
            createPaymentDto.notifyUrl ||
            `${process.env.BASE_URL}/api/payments/callback/cyberplus`,
          description: payment.description,
        });
      } else if (
        methodLower === 'paybox' ||
        createPaymentDto.method === PaymentMethod.PAYBOX
      ) {
        redirectData = this.payboxService.generatePaymentForm({
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
          notifyUrl:
            createPaymentDto.notifyUrl ||
            `${process.env.BASE_URL}/api/payments/callback/paybox`,
        });
      }

      this.logger.log(`Payment created: ${payment.id}`);

      return {
        success: true,
        data: {
          ...payment,
          redirectData,
        },
        message: 'Paiement cree avec succes',
      };
    } catch (error) {
      logPaymentError(this.logger, 'create payment', error);
      throw error;
    }
  }

  /**
   * GET /api/payments/user/:userId
   * Liste des paiements d'un utilisateur
   */
  @Get('user/:userId')
  // @UseGuards(AuthenticatedGuard)
  @ApiOperation({ summary: "Liste des paiements d'un utilisateur" })
  @ApiParam({ name: 'userId', description: "ID de l'utilisateur" })
  @ApiResponse({ status: 200, description: 'Liste des paiements' })
  async getUserPayments(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
    @Request() req?: AuthenticatedRequest,
  ) {
    try {
      this.logger.log(`Getting payments for user: ${userId}`);

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
      logPaymentError(this.logger, 'get user payments', error);
      throw error;
    }
  }

  /**
   * GET /api/payments/order/:orderId
   * Paiements d'une commande
   */
  @Get('order/:orderId')
  // @UseGuards(AuthenticatedGuard)
  @ApiOperation({ summary: 'Paiements associes a une commande' })
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
      logPaymentError(this.logger, 'get order payments', error);
      throw error;
    }
  }

  /**
   * GET /api/payments/reference/:reference
   * Recuperer un paiement par sa reference
   */
  @Get('reference/:reference')
  @ApiOperation({ summary: 'Paiement par reference' })
  @ApiParam({ name: 'reference', description: 'Reference du paiement' })
  @ApiResponse({ status: 200, description: 'Details du paiement' })
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
      logPaymentError(this.logger, 'get payment by reference', error);
      throw new NotFoundException(`Payment not found: ${reference}`);
    }
  }

  /**
   * POST /api/payments/proceed-supplement
   * Initialiser le paiement d'un supplement de commande
   */
  @Post('proceed-supplement')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(AuthenticatedGuard)
  @ApiOperation({
    summary: "Initialiser le paiement d'un supplement de commande",
    description:
      'Genere le formulaire de paiement pour un supplement de commande (ORD_PARENT != 0)',
  })
  @ApiResponse({
    status: 200,
    description: 'Redirection vers passerelle de paiement',
  })
  @ApiResponse({ status: 400, description: 'Commande invalide ou deja payee' })
  @ApiResponse({ status: 403, description: 'Acces non autorise' })
  async proceedSupplementPayment(
    @Body('orderId') orderId: string,
    @Body('paymentMethod') paymentMethod: 'PAYBOX' | 'PAYPAL',
    @Request() req?: AuthenticatedRequest,
  ) {
    try {
      this.logger.log(`Processing supplement payment for order ${orderId}`);

      const userId = req?.user?.id;
      if (!userId) {
        throw new BadRequestException('User ID is required - please login');
      }

      const { data: orderData, error: orderError } =
        await this.paymentDataService['supabase']
          .from('___xtr_order')
          .select('ord_id, ord_cst_id, ord_parent, ord_total_ttc, ord_is_pay')
          .eq('ord_id', orderId)
          .single();

      if (orderError || !orderData) {
        throw new NotFoundException(`Order not found: ${orderId}`);
      }

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

      const payment = await this.paymentService.createPayment({
        orderId: orderData.ord_id.toString(),
        userId: userId,
        amount: parseFloat(orderData.ord_total_ttc),
        currency: 'EUR',
        method:
          paymentMethod === 'PAYBOX'
            ? PaymentMethod.CYBERPLUS
            : PaymentMethod.PAYPAL,
        description: `Supplement commande ${orderData.ord_parent}/A - ${orderData.ord_id}/A`,
      });

      let redirectData = null;
      let redirectUrl = null;

      if (paymentMethod === 'PAYBOX') {
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
        redirectUrl = `${process.env.PAYPAL_URL}/checkout?order_id=${payment.id}`;
      }

      this.logger.log(`Supplement payment initialized: ${payment.id}`);

      return {
        success: true,
        data: {
          paymentId: payment.id,
          redirectUrl,
          redirectData,
        },
        message: 'Paiement initialise avec succes',
      };
    } catch (error) {
      logPaymentError(this.logger, 'proceed supplement payment', error);
      throw error;
    }
  }

  /**
   * GET /api/payments/:id
   * Obtenir les details d'un paiement
   */
  @Get(':id')
  // @UseGuards(AuthenticatedGuard)
  @ApiOperation({ summary: "Obtenir les details d'un paiement" })
  @ApiParam({ name: 'id', description: 'ID du paiement' })
  @ApiResponse({ status: 200, description: 'Details du paiement' })
  @ApiResponse({ status: 404, description: 'Paiement non trouve' })
  async getPayment(
    @Param('id') id: string,
    @Request() req?: AuthenticatedRequest,
  ) {
    try {
      this.logger.log(`Getting payment details for ID: ${id}`);

      const payment = await this.paymentService.getPaymentStatus(id);

      if (!payment) {
        throw new NotFoundException(`Payment not found: ${id}`);
      }

      const userId = req?.user?.id;
      if (userId && payment.userId !== userId && !req?.user?.isAdmin) {
        throw new BadRequestException('Unauthorized access to payment');
      }

      return {
        success: true,
        data: payment,
      };
    } catch (error) {
      logPaymentError(this.logger, 'get payment', error);
      throw error;
    }
  }

  /**
   * POST /api/payments/:id/cancel
   * Annuler un paiement en attente
   */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(AuthenticatedGuard)
  @ApiOperation({ summary: 'Annuler un paiement en attente' })
  @ApiParam({ name: 'id', description: 'ID du paiement' })
  @ApiResponse({ status: 200, description: 'Paiement annule' })
  @ApiResponse({ status: 400, description: 'Paiement non annulable' })
  async cancelPayment(
    @Param('id') id: string,
    @Request() req?: AuthenticatedRequest,
  ) {
    try {
      this.logger.log(`Cancelling payment: ${id}`);

      const payment = await this.paymentService.getPaymentStatus(id);
      if (req?.user?.id !== payment.userId && !req?.user?.isAdmin) {
        throw new BadRequestException('Unauthorized');
      }

      const cancelledPayment = await this.paymentService.cancelPayment(id);

      this.logger.log(`Payment cancelled: ${id}`);

      return {
        success: true,
        data: cancelledPayment,
        message: 'Paiement annule avec succes',
      };
    } catch (error) {
      logPaymentError(this.logger, 'cancel payment', error);
      throw error;
    }
  }
}
