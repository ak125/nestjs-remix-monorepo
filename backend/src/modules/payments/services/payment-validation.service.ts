import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import {
  DomainValidationException,
  ErrorCodes,
} from '../../../common/exceptions';

@Injectable()
export class PaymentValidationService {
  private readonly logger = new Logger(PaymentValidationService.name);

  constructor(private readonly configService: ConfigService) {}

  async validatePaymentData(paymentData: CreatePaymentDto): Promise<boolean> {
    try {
      // Validation du montant
      if (!paymentData.amount || paymentData.amount <= 0) {
        throw new DomainValidationException({
          code: ErrorCodes.PAYMENT.INVALID_AMOUNT,
          message: 'Amount must be greater than 0',
          field: 'amount',
        });
      }

      // Validation de l'email
      if (
        !paymentData.customerEmail ||
        !this.isValidEmail(paymentData.customerEmail)
      ) {
        throw new DomainValidationException({
          code: ErrorCodes.VALIDATION.INVALID_EMAIL,
          message: 'Valid customer email is required',
          field: 'customerEmail',
        });
      }

      // Validation de l'ordre
      if (!paymentData.orderId || paymentData.orderId.trim().length === 0) {
        throw new DomainValidationException({
          code: ErrorCodes.VALIDATION.REQUIRED_FIELD,
          message: 'Order ID is required',
          field: 'orderId',
        });
      }

      // Validation des montants maximum (sécurité)
      if (paymentData.amount > 10000) {
        this.logger.warn(
          `High amount payment requested: ${paymentData.amount} for order ${paymentData.orderId}`,
        );
      }

      this.logger.log(
        `Payment validation successful for order ${paymentData.orderId}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Payment validation failed: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  async validateCallbackSignature(
    callbackData: any,
    expectedSignature: string,
  ): Promise<boolean> {
    try {
      if (!callbackData || !expectedSignature) {
        return false;
      }

      // Validation de la structure des données
      const requiredFields = ['transactionId', 'status', 'amount', 'orderId'];
      for (const field of requiredFields) {
        if (!callbackData[field]) {
          this.logger.error(`Missing required field in callback: ${field}`);
          return false;
        }
      }

      return true;
    } catch (error) {
      this.logger.error(
        `Callback validation failed: ${(error as Error).message}`,
      );
      return false;
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async validateRefund(
    paymentId: string,
    refundAmount: number,
  ): Promise<boolean> {
    try {
      if (!paymentId || refundAmount <= 0) {
        throw new DomainValidationException({
          code: ErrorCodes.PAYMENT.REFUND_INVALID,
          message: 'Invalid refund parameters',
        });
      }

      // Ici, on pourrait ajouter des validations supplémentaires
      // comme vérifier que le montant du remboursement ne dépasse pas le paiement original

      return true;
    } catch (error) {
      this.logger.error(
        `Refund validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Valide la signature d'un callback Cyberplus
   */
  validateCyberplusSignature(
    data: Record<string, any>,
    receivedSignature: string,
  ): boolean {
    try {
      const secretKey = this.configService.get<string>('CYBERPLUS_SECRET_KEY');
      if (!secretKey) {
        this.logger.error('CYBERPLUS_SECRET_KEY not configured');
        return false;
      }

      const expectedSignature = this.generateCyberplusSignature(
        data,
        secretKey,
      );
      const a = Buffer.from(expectedSignature);
      const b = Buffer.from(receivedSignature);
      const isValid = a.length === b.length && timingSafeEqual(a, b);

      if (!isValid) {
        this.logger.warn('Invalid Cyberplus signature', {
          received: receivedSignature,
          expected: expectedSignature,
        });
      }

      return isValid;
    } catch (error) {
      this.logger.error('Error validating signature', error);
      return false;
    }
  }

  /**
   * Génère une signature Cyberplus
   */
  private generateCyberplusSignature(
    data: Record<string, any>,
    secretKey: string,
  ): string {
    // Trier les clés et créer la chaîne de signature
    const sortedKeys = Object.keys(data).sort();
    const signatureString = sortedKeys
      .map((key) => `${key}=${data[key]}`)
      .join('&');

    return createHmac('sha256', secretKey)
      .update(signatureString)
      .digest('hex');
  }

  /**
   * Valide le format d'un ID de transaction
   */
  validateTransactionId(transactionId: string): boolean {
    // Format UUID ou format personnalisé
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const customFormatRegex = /^TXN_[A-Z0-9]{8,}$/;

    return (
      uuidRegex.test(transactionId) || customFormatRegex.test(transactionId)
    );
  }

  /**
   * Valide le montant par rapport aux limites configurées
   */
  validateAmountLimits(amount: number): void {
    const minAmount = this.configService.get<number>('PAYMENT_MIN_AMOUNT', 1);
    const maxAmount = this.configService.get<number>(
      'PAYMENT_MAX_AMOUNT',
      10000,
    );

    if (amount < minAmount) {
      throw new DomainValidationException({
        code: ErrorCodes.PAYMENT.INVALID_AMOUNT,
        message: `Amount must be at least ${minAmount}`,
        field: 'amount',
      });
    }

    if (amount > maxAmount) {
      throw new DomainValidationException({
        code: ErrorCodes.PAYMENT.INVALID_AMOUNT,
        message: `Amount cannot exceed ${maxAmount}`,
        field: 'amount',
      });
    }
  }
}
