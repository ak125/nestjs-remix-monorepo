import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Logger,
  Res,
  Req,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { PayboxService } from '../services/paybox.service';
import { PaymentDataService } from '../repositories/payment-data.service';
import { PayboxCallbackGateService } from '../services/paybox-callback-gate.service';
import { normalizeOrderId } from '../utils/normalize-order-id';

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
    private readonly callbackGate: PayboxCallbackGateService,
  ) {}

  /**
   * IPN - Instant Payment Notification
   * Appelé par Paybox pour notifier le résultat du paiement
   */
  @Post('callback')
  async handleCallback(
    @Query() query: Record<string, string>,
    @Body() _body: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      this.logger.log('Callback IPN Paybox recu');
      this.logger.log(`Query params:`, query);

      // Récupérer la querystring brute pour calcul signature ordre réception
      const rawQueryString = req.originalUrl.includes('?')
        ? req.originalUrl.split('?')[1]
        : '';

      // Parser la réponse Paybox
      const params = this.payboxService.parsePayboxResponse(
        Object.entries(query)
          .map(([k, v]) => `${k}=${v}`)
          .join('&'),
      );

      // SAFE CHANGE: Appel au Callback Gate AVANT traitement
      const gateDecision = await this.callbackGate.validateCallback(
        rawQueryString,
        query,
        params,
      );

      // SAFE CHANGE: Idempotence - si déjà payé, retourner OK immédiatement
      if (gateDecision.isIdempotent) {
        this.logger.log(
          `Callback idempotent - Commande deja payee: ${params.orderReference}`,
        );
        return res.status(200).send('OK');
      }

      // SAFE CHANGE: En mode strict, rejeter si invalide
      if (gateDecision.reject) {
        this.logger.error(`GATE REJECT: ${gateDecision.result.correlationId}`);
        return res.status(403).send('Validation failed');
      }

      this.logger.log(`Montant: ${params.amount}`);
      this.logger.log(`📦 Référence: ${params.orderReference}`);
      this.logger.log(`🔐 Autorisation: ${params.authorization}`);
      this.logger.log(`⚠️  Erreur: ${params.errorCode}`);

      // Vérifier la signature
      const signature =
        params.signature || params.K || query.Signature || query.K;
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
      const isSuccess = this.payboxService.isPaymentSuccessful(
        params.errorCode,
      );

      if (isSuccess) {
        this.logger.log('✅ Paiement réussi !');

        // Mise à jour du paiement en base de données
        try {
          // Normaliser l'ID commande (ORD-1762010061177-879 → 1762010061177)
          const numericOrderId = normalizeOrderId(params.orderReference);
          this.logger.log(
            `📋 ID commande normalisé: ${numericOrderId} (depuis ${params.orderReference})`,
          );

          // Créer ou mettre à jour le paiement avec le bon enum
          const amountInEuros = parseFloat(params.amount) / 100;

          await this.paymentDataService.createPayment({
            orderId: numericOrderId,
            amount: amountInEuros,
            currency: 'EUR',
            status: 'completed' as any, // PaymentStatus.COMPLETED
            method: 'credit_card' as any, // PaymentMethod.CREDIT_CARD
            providerTransactionId:
              params.authorization || params.orderReference,
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
          // Normaliser l'ID commande (même logique que pour succès)
          const numericOrderId = normalizeOrderId(params.orderReference);

          const amountInEuros = parseFloat(params.amount) / 100;

          await this.paymentDataService.createPayment({
            orderId: numericOrderId,
            amount: amountInEuros,
            currency: 'EUR',
            status: 'failed' as any, // PaymentStatus.FAILED
            method: 'credit_card' as any,
            providerTransactionId:
              params.authorization || params.orderReference,
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
          this.logger.error(`❌ Erreur enregistrement échec: ${error.message}`);
        }

        return res.status(200).send('OK');
      }
    } catch (error) {
      this.logger.error('❌ Erreur traitement callback Paybox:', error);
      return res.status(500).send('Erreur serveur');
    }
  }

  /**
   * GET /api/paybox/callback - Alias GET pour le callback POST
   * Note: Paybox utilise principalement POST, mais GET peut être utile pour tests
   */
  @Get('callback')
  async handleCallbackGet(
    @Query() query: Record<string, string>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    this.logger.log('Callback Paybox GET');
    return this.handleCallback(query, '', req, res);
  }

  // NOTE: L'endpoint /callback-test a été supprimé pour raisons de sécurité.
  // Il permettait de créer des paiements sans vérification de signature HMAC.
  // Pour tester, utiliser l'environnement sandbox Paybox avec des signatures valides.
}
