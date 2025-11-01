import { Controller, Get, Query, Logger } from '@nestjs/common';
import { PaymentDataService } from '../repositories/payment-data.service';
import { PaymentStatus } from '../entities/payment.entity';

/**
 * Contrôleur pour le monitoring des paiements Paybox (Admin)
 * Route: GET /api/admin/paybox-monitoring
 */
@Controller('api/admin')
export class PayboxMonitoringController {
  private readonly logger = new Logger(PayboxMonitoringController.name);

  constructor(private readonly paymentDataService: PaymentDataService) {}

  /**
   * GET /api/admin/paybox-monitoring
   * Retourne les statistiques et transactions Paybox récentes
   */
  @Get('paybox-monitoring')
  async getPayboxMonitoring(
    @Query('limit') limit?: string,
    @Query('days') days?: string,
  ) {
    try {
      const limitNum = parseInt(limit || '50', 10);

      this.logger.log(
        `📊 Fetching Paybox monitoring data (limit: ${limitNum})`,
      );

      // Récupérer les paiements récents depuis ic_postback
      const recentPayments =
        await this.paymentDataService.getRecentPayments(limitNum);

      // Filtrer les paiements Paybox
      const payboxPayments = recentPayments.filter(
        (payment) =>
          payment.method?.toString().toLowerCase().includes('paybox') ||
          payment.metadata?.gateway === 'paybox',
      );

      // Calculer les statistiques
      const totalPaybox = payboxPayments.length;
      const totalAmount = payboxPayments.reduce(
        (sum, p) => sum + (p.amount || 0),
        0,
      );
      const successfulPayments = payboxPayments.filter(
        (p) => p.status === PaymentStatus.COMPLETED,
      ).length;
      const failedPayments = payboxPayments.filter(
        (p) => p.status === PaymentStatus.FAILED,
      ).length;
      const pendingPayments = payboxPayments.filter(
        (p) => p.status === PaymentStatus.PENDING,
      ).length;

      const successRate =
        totalPaybox > 0 ? (successfulPayments / totalPaybox) * 100 : 0;

      // Grouper par jour pour le graphique
      const paymentsByDay: Record<string, number> = {};
      const amountsByDay: Record<string, number> = {};

      payboxPayments.forEach((payment) => {
        const date = new Date(payment.createdAt).toISOString().split('T')[0];
        paymentsByDay[date] = (paymentsByDay[date] || 0) + 1;
        amountsByDay[date] = (amountsByDay[date] || 0) + (payment.amount || 0);
      });

      // Réponse structurée
      return {
        success: true,
        data: {
          summary: {
            totalTransactions: totalPaybox,
            totalAmount: Math.round(totalAmount * 100) / 100,
            successfulPayments,
            failedPayments,
            pendingPayments,
            successRate: Math.round(successRate * 10) / 10,
            averageAmount:
              totalPaybox > 0
                ? Math.round((totalAmount / totalPaybox) * 100) / 100
                : 0,
          },
          recentTransactions: payboxPayments.slice(0, 20).map((p) => ({
            id: p.id,
            orderId: p.orderId,
            amount: p.amount,
            currency: p.currency || 'EUR',
            status: p.status,
            method: p.method,
            transactionId: p.providerTransactionId || '',
            createdAt: p.createdAt,
            metadata: p.metadata || {},
          })),
          chartData: {
            dates: Object.keys(paymentsByDay).sort(),
            transactions: Object.keys(paymentsByDay)
              .sort()
              .map((date) => paymentsByDay[date]),
            amounts: Object.keys(amountsByDay)
              .sort()
              .map((date) => Math.round(amountsByDay[date] * 100) / 100),
          },
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.error('❌ Error fetching Paybox monitoring:', error);
      return {
        success: false,
        error: error.message,
        data: {
          summary: {
            totalTransactions: 0,
            totalAmount: 0,
            successfulPayments: 0,
            failedPayments: 0,
            pendingPayments: 0,
            successRate: 0,
            averageAmount: 0,
          },
          recentTransactions: [],
          chartData: {
            dates: [],
            transactions: [],
            amounts: [],
          },
        },
      };
    }
  }

  /**
   * GET /api/admin/paybox-health
   * Vérifie l'état de santé de l'intégration Paybox
   */
  @Get('paybox-health')
  async getPayboxHealth() {
    try {
      // Vérifier si la configuration Paybox est présente
      const config = {
        site: process.env.PAYBOX_SITE,
        rang: process.env.PAYBOX_RANG,
        identifiant: process.env.PAYBOX_IDENTIFIANT,
        hmacKey: process.env.PAYBOX_HMAC_KEY ? 'CONFIGURED' : 'MISSING',
        mode: process.env.PAYBOX_MODE || 'TEST',
        paymentUrl: process.env.PAYBOX_PAYMENT_URL,
      };

      const isHealthy =
        !!config.site &&
        !!config.rang &&
        !!config.identifiant &&
        config.hmacKey === 'CONFIGURED';

      return {
        success: true,
        data: {
          status: isHealthy ? 'healthy' : 'configuration_missing',
          config: {
            ...config,
            hmacKey: config.hmacKey, // Ne jamais exposer la vraie clé
          },
          lastCheck: new Date().toISOString(),
        },
      };
    } catch (error: any) {
      this.logger.error('❌ Error checking Paybox health:', error);
      return {
        success: false,
        error: error.message,
        data: {
          status: 'error',
          config: {},
          lastCheck: new Date().toISOString(),
        },
      };
    }
  }
}
