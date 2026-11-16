import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { OperationFailedException } from '@common/exceptions';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PaymentService } from '../services/payment.service';
import { CyberplusService } from '../services/cyberplus.service';
import { PaymentDataService } from '../repositories/payment-data.service';
import { PaymentStatus } from '../entities/payment.entity';
import { logPaymentError } from './payment-controller.utils';
import {
  SYSTEMPAY_CLOSED_BODY,
  SYSTEMPAY_CLOSED_STATUS,
  logSystemPayRouteClosed,
} from '../utils/systempay-closure';
import {
  CyberplusCallbackSchema,
  type CyberplusCallbackDto,
  PaymentSuccessReturnSchema,
  PaymentErrorReturnSchema,
} from '../dto/cyberplus-callback.dto';

/**
 * Callbacks bancaires Cyberplus/BNP + pages de retour success/error
 *
 * Mandat AY : `callback/cyberplus` et `callback/error` modifient un paiement
 * (et, via handlePaymentCallback, la commande) ; ils répondent 410 tant que
 * SYSTEMPAY_CALLBACK_ENABLED ne vaut pas `true`. `callback/success` ne fait
 * qu'une lecture et reste inchangé. Voir utils/systempay-closure.ts.
 */
@ApiTags('payments')
@Controller('api/payments')
export class PaymentCallbackController {
  private readonly logger = new Logger(PaymentCallbackController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly cyberplusService: CyberplusService,
    private readonly paymentDataService: PaymentDataService,
  ) {}

  /**
   * POST /api/payments/callback/cyberplus
   * Webhook Cyberplus/BNP Paribas
   *
   * Rate limit: 30/min/IP via named throttler `payment_callback` (ADR-043
   * Sprint 1 ticket #6, STRIDE 01-paiement critique #2). Gateway retries
   * idempotently on 429 (HMAC signature dedups).
   */
  @Throttle({ payment_callback: { limit: 30, ttl: 60000 } })
  @Post('callback/cyberplus')
  @ApiOperation({
    summary: 'Callback Cyberplus pour notifications de paiement',
    description:
      'Endpoint webhook appele par Cyberplus/BNP pour notifier le statut des paiements',
  })
  @ApiResponse({ status: 200, description: 'Callback traite avec succes' })
  @ApiResponse({
    status: 400,
    description: 'Signature invalide ou donnees manquantes',
  })
  @ApiResponse({
    status: 410,
    description: 'SystemPay ferme (SYSTEMPAY_CALLBACK_ENABLED absent)',
  })
  async handleCyberplusCallback(
    @Body() body: Record<string, string | undefined>,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Mandat AY : refus avant validation, ecriture ic_postback et signature.
    if (!this.cyberplusService.isCallbackEnabled()) {
      logSystemPayRouteClosed(
        this.logger,
        'POST /api/payments/callback/cyberplus',
      );
      res.status(SYSTEMPAY_CLOSED_STATUS);
      return SYSTEMPAY_CLOSED_BODY;
    }

    // Validation Zod — rejeter les callbacks malformes avant tout traitement
    const parsed = CyberplusCallbackSchema.safeParse(body);
    if (!parsed.success) {
      this.logger.error('REJECT: Cyberplus callback Zod validation failed', {
        errors: parsed.error.issues.map((i) => i.message),
        receivedKeys: Object.keys(body),
      });
      throw new BadRequestException(
        `Invalid callback payload: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
      );
    }

    const validBody: CyberplusCallbackDto = parsed.data;
    const orderId =
      validBody.vads_order_id || validBody.order_id || validBody.orderid || '';
    const transactionId =
      validBody.vads_trans_id ||
      validBody.transaction_id ||
      validBody.transactionid ||
      '';
    const status =
      validBody.vads_trans_status ||
      validBody.status ||
      validBody.statuscode ||
      '';
    const amount =
      parseFloat(validBody.vads_amount || validBody.amount || '0') || 0;

    try {
      this.logger.log('Received Cyberplus/SystemPay callback', {
        transactionId,
        orderId,
        status,
      });

      await this.saveCallbackToDatabase(validBody);

      const isValid = this.cyberplusService.validateCallback(validBody);
      if (!isValid) {
        this.logger.error(
          `REJECT: Invalid SystemPay callback signature for order ${orderId}`,
        );
        throw new BadRequestException('Invalid signature');
      }

      const callbackData = {
        transactionId,
        paymentReference: orderId,
        status,
        amount,
        signature: validBody.signature || '',
      };

      const payment =
        await this.paymentService.handlePaymentCallback(callbackData);

      this.logger.log(
        `Callback processed successfully: ${payment.id} -> ${payment.status}`,
      );

      return {
        success: true,
        message: 'Callback processed successfully',
        paymentId: payment.id,
      };
    } catch (error) {
      logPaymentError(
        this.logger,
        `process SystemPay callback for order ${orderId}`,
        error,
      );
      throw new OperationFailedException({
        message: 'Payment callback processing failed',
      });
    }
  }

  /**
   * POST /api/payments/callback/success
   * Page de retour pour paiement reussi
   */
  @Post('callback/success')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Page de retour apres paiement reussi' })
  @ApiResponse({ status: 200, description: 'Paiement valide' })
  async handleSuccessReturn(@Body() body: Record<string, string | undefined>) {
    const parsed = PaymentSuccessReturnSchema.safeParse(body);
    if (!parsed.success) {
      this.logger.warn('Payment success return - Zod validation failed', {
        errors: parsed.error.issues.map((i) => i.message),
      });
      throw new BadRequestException('Order ID missing');
    }

    const validBody = parsed.data;
    try {
      this.logger.log('Payment success return', {
        orderId: validBody.order_id || validBody.orderid,
      });

      const orderId = validBody.order_id || validBody.orderid;
      if (!orderId) {
        throw new BadRequestException('Order ID missing');
      }

      const payment = await this.paymentService.getPaymentByOrderId(orderId);

      if (!payment) {
        this.logger.warn(`Payment not found for order: ${orderId}`);
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
      logPaymentError(this.logger, 'handle success return', error);
      throw error;
    }
  }

  /**
   * POST /api/payments/callback/error
   * Page de retour pour erreur de paiement
   */
  @Post('callback/error')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Page de retour apres erreur de paiement' })
  @ApiResponse({ status: 200, description: 'Erreur enregistree' })
  @ApiResponse({
    status: 410,
    description: 'SystemPay ferme (SYSTEMPAY_CALLBACK_ENABLED absent)',
  })
  async handleErrorReturn(
    @Body() body: Record<string, string | undefined>,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Mandat AY : sans signature, cette route passait un paiement PENDING en
    // FAILED pour n'importe quel numero de commande.
    if (!this.cyberplusService.isCallbackEnabled()) {
      logSystemPayRouteClosed(this.logger, 'POST /api/payments/callback/error');
      res.status(SYSTEMPAY_CLOSED_STATUS);
      return SYSTEMPAY_CLOSED_BODY;
    }

    const parsed = PaymentErrorReturnSchema.safeParse(body);
    // Error return is best-effort — log but don't reject on validation failure
    const validBody = parsed.success
      ? parsed.data
      : (body as Record<string, string | undefined>);

    try {
      this.logger.warn('Payment error return', {
        orderId: validBody.order_id || validBody.orderid,
        error: validBody.error || validBody.error_message,
      });

      const orderId = validBody.order_id || validBody.orderid;
      if (orderId) {
        const payment = await this.paymentService.getPaymentByOrderId(orderId);

        if (payment && payment.status === PaymentStatus.PENDING) {
          await this.paymentService.updatePaymentStatus(
            payment.id,
            PaymentStatus.FAILED,
          );
        }
      }

      return {
        success: false,
        message: 'Payment failed',
        error: validBody.error || validBody.error_message || 'Unknown error',
      };
    } catch (error) {
      logPaymentError(this.logger, 'handle error return', error);
      throw error;
    }
  }

  /**
   * Enregistre le callback dans la table ic_postback pour audit
   */
  private async saveCallbackToDatabase(
    callbackData: CyberplusCallbackDto,
  ): Promise<void> {
    try {
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
        this.logger.log('Callback saved to ic_postback table');
      }
    } catch (error) {
      this.logger.error('Error saving callback to database:', error);
    }
  }
}
