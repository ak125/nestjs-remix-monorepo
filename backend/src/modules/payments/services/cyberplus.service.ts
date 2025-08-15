import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fetch } from 'undici';
import { createHmac } from 'crypto';

export interface PaymentData {
  amount: number;
  currency: string;
  orderId: string;
  customerEmail: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
  description?: string;
}

export interface CyberplusFormData {
  html: string;
  url: string;
  parameters: Record<string, string>;
}

@Injectable()
export class CyberplusService {
  private readonly logger = new Logger(CyberplusService.name);
  private readonly apiUrl: string;
  private readonly merchantId: string;
  private readonly secretKey: string;
  private readonly isProduction: boolean;

  constructor(private configService: ConfigService) {
    this.apiUrl =
      this.configService.get<string>('CYBERPLUS_API_URL') ||
      'https://secure-paypage.lyra.com';
    this.merchantId =
      this.configService.get<string>('CYBERPLUS_MERCHANT_ID') || '';
    this.secretKey =
      this.configService.get<string>('CYBERPLUS_SECRET_KEY') || '';
    this.isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
  }

  async createPayment(
    amount: number,
    orderId: string,
    customerEmail: string,
  ): Promise<any> {
    try {
      const paymentData = {
        merchantId: this.merchantId,
        amount,
        orderId,
        customerEmail,
        currency: 'EUR',
        timestamp: Date.now(),
      };

      const signature = this.generateSignature(paymentData);

      const response = await fetch(`${this.apiUrl}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${signature}`,
        },
        body: JSON.stringify(paymentData),
      });

      if (!response.ok) {
        throw new BadRequestException(
          `Cyberplus API error: ${response.statusText}`,
        );
      }

      const result = await response.json();
      this.logger.log(`Payment created for order ${orderId}`);

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to create payment: ${errorMessage}`);
      throw error;
    }
  }

  async verifyCallback(callbackData: any): Promise<boolean> {
    try {
      const expectedSignature = this.generateSignature(callbackData);
      const receivedSignature = callbackData.signature;

      return expectedSignature === receivedSignature;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to verify callback: ${errorMessage}`);
      return false;
    }
  }

  async getPaymentStatus(transactionId: string): Promise<any> {
    try {
      const response = await fetch(
        `${this.apiUrl}/payments/${transactionId}/status`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
        },
      );

      if (!response.ok) {
        throw new BadRequestException(
          `Failed to get payment status: ${response.statusText}`,
        );
      }

      return await response.json();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get payment status: ${errorMessage}`);
      throw error;
    }
  }

  private generateSignature(data: any): string {
    // Implémentation HMAC-SHA256 conforme aux standards Cyberplus
    const payload = JSON.stringify(data) + this.secretKey;
    return createHmac('sha256', this.secretKey).update(payload).digest('hex');
  }

  /**
   * Génère un formulaire HTML pour redirection vers Cyberplus
   */
  generatePaymentForm(paymentData: PaymentData): CyberplusFormData {
    const parameters: Record<string, string> = {
      merchant_id: this.merchantId,
      amount: (paymentData.amount * 100).toString(), // Montant en centimes
      currency: paymentData.currency,
      order_id: paymentData.orderId,
      customer_email: paymentData.customerEmail,
      return_url: paymentData.returnUrl,
      cancel_url: paymentData.cancelUrl,
      notify_url: paymentData.notifyUrl,
      description: paymentData.description || `Order ${paymentData.orderId}`,
      mode: this.isProduction ? 'PRODUCTION' : 'TEST',
    };

    // Ajout de la signature
    const signature = this.generateSignature(parameters);
    parameters.signature = signature;

    // Génération du formulaire HTML
    const formFields = Object.entries(parameters)
      .map(
        ([key, value]) =>
          `<input type="hidden" name="${key}" value="${value}" />`,
      )
      .join('\n    ');

    const html = `
<form id="cyberplus-form" method="POST" action="${this.apiUrl}/payment">
    ${formFields}
    <button type="submit">Procéder au paiement</button>
</form>
<script>
    document.getElementById('cyberplus-form').submit();
</script>`;

    return {
      html,
      url: `${this.apiUrl}/payment`,
      parameters,
    };
  }

  /**
   * Traite un remboursement
   */
  async processRefund(
    transactionId: string,
    amount?: number,
    reason?: string,
  ): Promise<any> {
    try {
      const body: Record<string, string> = {
        transaction_id: transactionId,
        amount: amount ? (amount * 100).toString() : '', // Montant en centimes
        reason: reason || 'Remboursement demandé',
        merchant_id: this.merchantId,
      };

      const signature = this.generateSignature(body);
      body.signature = signature;

      const response = await fetch(`${this.apiUrl}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.secretKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new BadRequestException(
          `Failed to process refund: ${response.statusText}`,
        );
      }

      const result = await response.json();
      this.logger.log(`Refund processed for transaction ${transactionId}`);

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to process refund: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Validation renforcée des callbacks Cyberplus
   */
  validateCallback(callbackData: any): boolean {
    try {
      // Vérification des champs obligatoires
      const requiredFields = [
        'transaction_id',
        'status',
        'amount',
        'order_id',
        'signature',
      ];
      
      for (const field of requiredFields) {
        if (!callbackData[field]) {
          this.logger.warn(`Missing required field: ${field}`);
          return false;
        }
      }

      // Vérification de la signature
      const { signature, ...dataWithoutSignature } = callbackData;
      const expectedSignature = this.generateSignature(dataWithoutSignature);

      const isValid = expectedSignature === signature;
      
      if (!isValid) {
        this.logger.warn('Invalid signature in callback');
      }

      return isValid;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Callback validation error: ${errorMessage}`);
      return false;
    }
  }
}
