import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { PaymentService } from '../services/payment.service';
import { PaymentDataService } from '../repositories/payment-data.service';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { PaymentMethod } from '../entities/payment.entity';
import { logPaymentError } from './payment-controller.utils';

/**
 * Routes utilitaires : methodes disponibles, transactions, test
 */
@ApiTags('payments')
@Controller('api/payments')
export class PaymentMethodsController {
  private readonly logger = new Logger(PaymentMethodsController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly paymentDataService: PaymentDataService,
  ) {}

  /**
   * GET /api/payments/methods/available
   * Liste des methodes de paiement disponibles
   */
  @Get('methods/available')
  @ApiOperation({ summary: 'Liste des methodes de paiement disponibles' })
  @ApiResponse({ status: 200, description: 'Methodes disponibles' })
  async getAvailablePaymentMethods() {
    try {
      this.logger.log('Getting available payment methods');

      const methods = [
        {
          id: PaymentMethod.CYBERPLUS,
          name: 'Cyberplus (BNP Paribas)',
          enabled: true,
          description:
            'Paiement securise par carte bancaire via Cyberplus/BNP Paribas',
          logo: '/assets/cyberplus-logo.png',
        },
        {
          id: PaymentMethod.CREDIT_CARD,
          name: 'Carte de credit',
          enabled: true,
          description: 'Visa, Mastercard, American Express',
          logo: '/assets/credit-card-logo.png',
        },
        {
          id: PaymentMethod.DEBIT_CARD,
          name: 'Carte de debit',
          enabled: true,
          description: 'Carte bancaire avec debit immediat',
          logo: '/assets/debit-card-logo.png',
        },
        {
          id: PaymentMethod.PAYPAL,
          name: 'PayPal',
          enabled: false, // TODO: Activer quand integration prete
          description: 'Paiement via compte PayPal',
          logo: '/assets/paypal-logo.png',
        },
        {
          id: PaymentMethod.BANK_TRANSFER,
          name: 'Virement bancaire',
          enabled: false,
          description: 'Paiement par virement SEPA (delai 2-3 jours)',
          logo: '/assets/bank-transfer-logo.png',
        },
      ];

      return {
        success: true,
        data: methods.filter((m) => m.enabled),
        allMethods: methods,
      };
    } catch (error) {
      logPaymentError(this.logger, 'get payment methods', error);
      throw error;
    }
  }

  /**
   * POST /api/payments/test/create-with-consignes
   * Endpoint de test pour paiement avec consignes
   */
  @Post('test/create-with-consignes')
  @ApiOperation({ summary: '[TEST] Creer un paiement incluant des consignes' })
  @HttpCode(HttpStatus.OK)
  async testCreatePaymentWithConsignes(
    @Body() testData?: { orderId?: string },
  ) {
    try {
      this.logger.log('[TEST] Creating payment with consignes...');

      const mockPaymentDto: CreatePaymentDto = {
        amount: 487.17,
        currency: 'EUR',
        method: PaymentMethod.CYBERPLUS,
        userId: 'test-user-123',
        orderId: testData?.orderId || 'ORD-TEST-CONSIGNES',
        description: 'Test paiement avec consignes - Phase 6',
        consigne_total: 144,
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
        message: 'Phase 6: Paiement avec consignes cree avec succes',
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
        note: 'Les consignes sont stockees dans ___xtr_order.ord_deposit_ttc (Phase 5). Le paiement contient le montant total (produits + consignes + port).',
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

  /**
   * GET /api/payments/:id/transactions
   * Historique des transactions d'un paiement
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
      logPaymentError(this.logger, 'get transactions', error);
      throw error;
    }
  }
}
