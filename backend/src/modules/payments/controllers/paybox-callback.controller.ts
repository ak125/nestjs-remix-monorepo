import {
  Controller,
  Get,
  HttpStatus,
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
import { EmailService } from '../../../services/email.service';
import { PaymentStatus, PaymentMethod } from '../entities/payment.entity';
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
    private readonly emailService: EmailService,
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
        return res.status(HttpStatus.OK).send('OK');
      }

      // SAFE CHANGE: En mode strict, rejeter si invalide
      if (gateDecision.reject) {
        this.logger.error(`GATE REJECT: ${gateDecision.result.correlationId}`);
        return res.status(HttpStatus.FORBIDDEN).send('Validation failed');
      }

      this.logger.log(`Montant: ${params.amount}`);
      this.logger.log(`📦 Référence: ${params.orderReference}`);
      this.logger.log(`🔐 Autorisation: ${params.authorization}`);
      this.logger.log(`⚠️  Erreur: ${params.errorCode}`);

      // Verifier la signature
      const signature =
        params.signature || params.K || query.Signature || query.K;
      if (!signature) {
        this.logger.error('Signature manquante dans le callback Paybox');
        return res.status(HttpStatus.BAD_REQUEST).send('Signature manquante');
      }

      const isValid = this.payboxService.verifySignature(query, signature);

      if (!isValid) {
        // Mode CGI Paybox: la signature est RSA (pas HMAC).
        // En mode strict, on rejette. Sinon on log et on continue.
        const strictVerify = process.env.PAYBOX_STRICT_VERIFY === 'true';
        if (strictVerify) {
          this.logger.error(
            `REJECT: Signature Paybox invalide pour ${params.orderReference} (strict mode)`,
          );
          return res.status(HttpStatus.FORBIDDEN).send('Signature invalide');
        }
        this.logger.warn(
          `Signature Paybox non verifiee pour ${params.orderReference} ` +
            `(mode lenient — implementer RSA pour mode strict)`,
        );
      }

      // Vérifier si le paiement est réussi
      const isSuccess = this.payboxService.isPaymentSuccessful(
        params.errorCode,
      );

      if (isSuccess) {
        this.logger.log('Paiement reussi !');

        // Normaliser l'ID commande (preservé tel quel pour matcher la BDD)
        const orderId = normalizeOrderId(params.orderReference);
        this.logger.log(
          `ID commande: ${orderId} (depuis ${params.orderReference})`,
        );

        const amountInEuros = parseFloat(params.amount) / 100;

        // Enregistrer le paiement — si échec, retourner 500 pour que Paybox retry
        try {
          await this.paymentDataService.createPayment({
            orderId,
            amount: amountInEuros,
            currency: 'EUR',
            status: PaymentStatus.COMPLETED,
            method: PaymentMethod.CREDIT_CARD,
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
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : String(error);
          this.logger.error(
            `CRITICAL: Echec enregistrement paiement reussi pour ${params.orderReference}: ${message}`,
          );
          // Retourner 500 pour que Paybox re-essaie le callback
          return res
            .status(HttpStatus.INTERNAL_SERVER_ERROR)
            .send('Payment recording failed');
        }

        this.logger.log(
          `Paiement enregistre - Commande #${params.orderReference} - ${amountInEuros}EUR`,
        );

        // Email confirmation (non bloquant — ne pas bloquer le 200 OK)
        try {
          const order =
            await this.paymentDataService.getOrderForPayment(orderId);
          const customer =
            await this.paymentDataService.getCustomerForOrder(orderId);

          if (order && customer?.cst_mail) {
            const orderData = {
              ...order,
              ord_date: order.ord_date || new Date().toISOString(),
            };
            await this.emailService.sendOrderConfirmation(orderData, customer);
            this.logger.log(
              `Email confirmation envoye pour commande #${orderId}`,
            );
          } else {
            this.logger.warn(
              `Impossible d'envoyer email confirmation: order=${!!order}, customer=${!!customer}`,
            );
          }
        } catch (emailError: unknown) {
          const emailMsg =
            emailError instanceof Error
              ? emailError.message
              : String(emailError);
          this.logger.error(
            `Erreur envoi email confirmation (non bloquant): ${emailMsg}`,
          );
        }

        return res.status(HttpStatus.OK).send('OK');
      } else {
        this.logger.warn(`Paiement echoue - Code erreur: ${params.errorCode}`);

        // Enregistrer l'échec du paiement (non bloquant, best-effort)
        const orderId = normalizeOrderId(params.orderReference);
        const amountInEuros = parseFloat(params.amount) / 100;

        try {
          await this.paymentDataService.createPayment({
            orderId,
            amount: amountInEuros,
            currency: 'EUR',
            status: PaymentStatus.FAILED,
            method: PaymentMethod.CREDIT_CARD,
            providerTransactionId:
              params.authorization || params.orderReference,
            providerReference: params.orderReference,
            description: `Paiement Paybox echoue - Code ${params.errorCode}`,
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
            `Echec paiement enregistre pour commande #${params.orderReference}`,
          );
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : String(error);
          this.logger.error(`Erreur enregistrement echec paiement: ${message}`);
        }

        // OK pour les échecs — Paybox n'a pas besoin de re-essayer
        return res.status(HttpStatus.OK).send('OK');
      }
    } catch (error) {
      this.logger.error('❌ Erreur traitement callback Paybox:', error);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .send('Erreur serveur');
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
