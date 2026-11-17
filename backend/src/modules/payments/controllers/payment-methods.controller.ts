import { Controller, Get, Param, Logger, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { PaymentService } from '../services/payment.service';
import { PaymentDataService } from '../repositories/payment-data.service';
import { CyberplusService } from '../services/cyberplus.service';
import { PaymentMethod } from '../entities/payment.entity';
import { logPaymentError } from './payment-controller.utils';

/**
 * Routes utilitaires : methodes disponibles, transactions
 *
 * Frontiere d'acces : `methods/available` est publique (la page de commande la
 * lit sans cookie de session) ; `:id/transactions` est reservee aux
 * administrateurs.
 *
 * Classification exhaustive : backend/tests/unit/payment-core-routes-authz.test.ts
 */
@ApiTags('payments')
@Controller('api/payments')
export class PaymentMethodsController {
  private readonly logger = new Logger(PaymentMethodsController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly paymentDataService: PaymentDataService,
    private readonly cyberplusService: CyberplusService,
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
          // Mandat AY : propose au client seulement si SystemPay est rouvert
          // (SYSTEMPAY_CALLBACK_ENABLED=true). Le passage en caisse envoie
          // de toute facon vers /api/paybox/redirect.
          enabled: this.cyberplusService.isCallbackEnabled(),
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
   * GET /api/payments/:id/transactions
   * Historique des transactions d'un paiement
   */
  @Get(':id/transactions')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
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
