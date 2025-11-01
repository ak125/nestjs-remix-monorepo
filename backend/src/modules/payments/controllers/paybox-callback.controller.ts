import { Controller, Get, Post, Query, Body, Logger, Res } from '@nestjs/common';
import { Response } from 'express';
import { PayboxService } from '../services/paybox.service';
import { PaymentDataService } from '../repositories/payment-data.service';

/**
 * Contrôleur pour les callbacks Paybox (IPN - Instant Payment Notification)
 * Route: POST /api/paybox/callback
 */
@Controller('api/paybox')
export class PayboxCallbackController {
  private readonly logger = new Logger(PayboxCallbackController.name);

  constructor(
    private readonly payboxService: PayboxService,
    private readonly paymentDataService: PaymentDataService,
  ) {}

  /**
   * IPN - Instant Payment Notification
   * Appelé par Paybox pour notifier le résultat du paiement
   */
  @Post('callback')
  async handleCallback(
    @Query() query: Record<string, string>,
    @Body() body: string,
    @Res() res: Response,
  ) {
    try {
      this.logger.log('🔔 Callback IPN Paybox reçu');
      this.logger.log(`📦 Query params:`, query);
      
      // Parser la réponse Paybox
      const params = this.payboxService.parsePayboxResponse(
        Object.entries(query)
          .map(([k, v]) => `${k}=${v}`)
          .join('&')
      );

      this.logger.log(`💰 Montant: ${params.amount}`);
      this.logger.log(`📦 Référence: ${params.orderReference}`);
      this.logger.log(`🔐 Autorisation: ${params.authorization}`);
      this.logger.log(`⚠️  Erreur: ${params.errorCode}`);

      // Vérifier la signature
      const signature = params.signature || params.K || query.Signature || query.K;
      if (!signature) {
        this.logger.error('❌ Signature manquante dans le callback');
        return res.status(400).send('Signature manquante');
      }

      const isValid = this.payboxService.verifySignature(query, signature);

      if (!isValid) {
        this.logger.error('❌ Signature invalide !');
        return res.status(403).send('Signature invalide');
      }

      // Vérifier si le paiement est réussi
      const isSuccess = this.payboxService.isPaymentSuccessful(params.errorCode);

      if (isSuccess) {
        this.logger.log('✅ Paiement réussi !');

        // Mise à jour du paiement en base de données
        try {
          // Créer ou mettre à jour le paiement avec le bon enum
          const amountInEuros = parseFloat(params.amount) / 100;

          await this.paymentDataService.createPayment({
            orderId: params.orderReference,
            amount: amountInEuros,
            currency: 'EUR',
            status: 'completed' as any, // PaymentStatus.COMPLETED
            method: 'credit_card' as any, // PaymentMethod.CREDIT_CARD
            providerTransactionId: params.authorization || params.orderReference,
            providerReference: params.orderReference,
            description: `Paiement Paybox - Commande ${params.orderReference}`,
            metadata: {
              gateway: 'paybox',
              authorization: params.authorization,
              errorCode: params.errorCode,
              rawResponse: query,
            },
            processedAt: new Date(),
          });

          this.logger.log(
            `✅ Paiement enregistré - Commande #${params.orderReference} - ${amountInEuros}€`,
          );
        } catch (error: any) {
          this.logger.error(
            `❌ Erreur enregistrement paiement: ${error.message}`,
          );
          // On retourne quand même OK à Paybox pour éviter les re-tentatives
        }

        return res.status(200).send('OK');
      } else {
        this.logger.warn(
          `⚠️  Paiement échoué - Code erreur: ${params.errorCode}`,
        );

        // Enregistrer l'échec du paiement
        try {
          const amountInEuros = parseFloat(params.amount) / 100;

          await this.paymentDataService.createPayment({
            orderId: params.orderReference,
            amount: amountInEuros,
            currency: 'EUR',
            status: 'failed' as any, // PaymentStatus.FAILED
            method: 'credit_card' as any,
            providerTransactionId: params.authorization || params.orderReference,
            providerReference: params.orderReference,
            description: `Paiement Paybox échoué - Code ${params.errorCode}`,
            failureReason: `Code erreur Paybox: ${params.errorCode}`,
            metadata: {
              gateway: 'paybox',
              authorization: params.authorization,
              errorCode: params.errorCode,
              rawResponse: query,
            },
            processedAt: new Date(),
          });

          this.logger.log(
            `⚠️  Échec paiement enregistré pour commande #${params.orderReference}`,
          );
        } catch (error: any) {
          this.logger.error(
            `❌ Erreur enregistrement échec: ${error.message}`,
          );
        }

        return res.status(200).send('OK');
      }
    } catch (error) {
      this.logger.error('❌ Erreur traitement callback Paybox:', error);
      return res.status(500).send('Erreur serveur');
    }
  }

  /**
   * GET /api/paybox/callback - Pour les tests
   */
  @Get('callback')
  async handleCallbackGet(
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ) {
    this.logger.log('🔔 Callback Paybox GET (test)');
    return this.handleCallback(query, '', res);
  }
}
