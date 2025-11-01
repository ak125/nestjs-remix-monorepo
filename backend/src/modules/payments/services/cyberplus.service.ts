import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fetch } from 'undici';
import { createHmac, createHash } from 'crypto';
import { PaymentConfig } from '../../../config/payment.config';

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
  private readonly paymentConfig: PaymentConfig;

  constructor(private configService: ConfigService) {
    // ✅ Utilisation de la configuration type-safe
    this.paymentConfig = this.configService.get<PaymentConfig>('payment')!;

    // ⚠️ Sécurité : Ne jamais logger le certificat
    this.logger.log(
      `SystemPay initialized in ${this.paymentConfig.systempay.mode} mode`,
    );
    this.logger.log(`Site ID: ${this.paymentConfig.systempay.siteId}`);
  }

  async createPayment(
    amount: number,
    orderId: string,
    customerEmail: string,
  ): Promise<any> {
    try {
      const paymentData = {
        merchantId: this.paymentConfig.systempay.siteId,
        amount,
        orderId,
        customerEmail,
        currency: 'EUR',
        timestamp: Date.now(),
      };

      const signature = this.generateSignature(paymentData);

      const response = await fetch(
        `${this.paymentConfig.systempay.apiUrl}/payments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${signature}`,
          },
          body: JSON.stringify(paymentData),
        },
      );

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
        `${this.paymentConfig.systempay.apiUrl}/payments/${transactionId}/status`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.paymentConfig.systempay.certificate}`,
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
    // Implémentation HMAC-SHA256 pour API SystemPay
    const payload =
      JSON.stringify(data) + this.paymentConfig.systempay.certificate;
    return createHmac('sha256', this.paymentConfig.systempay.certificate)
      .update(payload)
      .digest('hex');
  }

  /**
   * Génère un formulaire HTML pour redirection vers SystemPay (protocole Lyra)
   * Documentation: https://paiement.systempay.fr/doc/
   */
  generatePaymentForm(paymentData: PaymentData): CyberplusFormData {
    // Montant en centimes (ex: 475.16 EUR → 47516)
    const amountInCents = Math.round(paymentData.amount * 100);

    // Date/heure au format YYYYMMDDHHmmss UTC
    const now = new Date();
    const vads_trans_date = now
      .toISOString()
      .replace(/[-:T]/g, '')
      .substring(0, 14);

    // Transaction ID: 6 chiffres uniques (utiliser timestamp modulo)
    const vads_trans_id = String(Date.now() % 1000000).padStart(6, '0');

    // Paramètres SystemPay (ordre alphabétique requis pour signature)
    const parameters: Record<string, string> = {
      vads_action_mode: 'INTERACTIVE',
      vads_amount: amountInCents.toString(),
      vads_capture_delay: '0',
      vads_ctx_mode: this.paymentConfig.systempay.mode,
      vads_currency: '978', // EUR
      vads_cust_country: 'FR',
      vads_cust_email: paymentData.customerEmail,
      vads_order_id: paymentData.orderId,
      vads_page_action: 'PAYMENT',
      vads_payment_config: 'SINGLE',
      vads_return_mode: 'POST', // ✅ Mode de retour POST (important pour signature)
      vads_site_id: this.paymentConfig.systempay.siteId,
      vads_trans_date: vads_trans_date,
      vads_trans_id: vads_trans_id,
      vads_url_cancel: paymentData.cancelUrl,
      vads_url_error: paymentData.returnUrl, // Même URL que success pour simplifier
      vads_url_refused: paymentData.cancelUrl,
      vads_url_success: paymentData.returnUrl,
      vads_version: 'V2',
    };

    // Générer la signature SHA-1 selon le protocole SystemPay
    const signature = this.generateSystemPaySignature(parameters);
    parameters.signature = signature;

    this.logger.log(`✅ SystemPay form generated`);
    this.logger.log(`📋 Order: ${paymentData.orderId}`);
    this.logger.log(
      `💰 Amount: ${amountInCents} centimes (${paymentData.amount} EUR)`,
    );
    this.logger.log(`🔐 Signature: ${signature.substring(0, 20)}...`);

    // Génération du formulaire HTML
    const formFields = Object.entries(parameters)
      .map(
        ([key, value]) =>
          `    <input type="hidden" name="${key}" value="${value}" />`,
      )
      .join('\n');

    const html = `
<form id="systempay-form" method="POST" action="${this.paymentConfig.systempay.apiUrl}">
${formFields}
    <button type="submit">Procéder au paiement</button>
</form>
<script>
    document.getElementById('systempay-form').submit();
</script>`;

    return {
      html,
      url: this.paymentConfig.systempay.apiUrl,
      parameters,
    };
  }

  /**
   * Génère la signature SystemPay selon le protocole officiel
   * Méthode HMAC-SHA-256 (recommandée par Paybox/SystemPay depuis DSP2)
   * 
   * Format: HMAC-SHA-256(valeur1+valeur2+...+valeurN, certificat)
   * 
   * Alternative SHA-1 : Si HMAC ne fonctionne pas, utilisez :
   * SHA-1(valeur1+valeur2+...+valeurN+certificat)
   */
  private generateSystemPaySignature(
    parameters: Record<string, string>,
  ): string {
    // Trier les clés par ordre alphabétique et extraire les valeurs
    const sortedKeys = Object.keys(parameters)
      .filter((key) => key.startsWith('vads_'))
      .sort();

    const values = sortedKeys.map((key) => parameters[key]);
    const dataString = values.join('+');

    // 🔐 MÉTHODE 1 : HMAC-SHA-256 (recommandée depuis DSP2)
    // Utiliser la clé HMAC si fournie, sinon retomber sur le certificat
    const hmacKey =
      (this.paymentConfig.systempay as any).hmacKey ||
      this.paymentConfig.systempay.certificate;
    const signatureHmac = createHmac('sha256', hmacKey)
      .update(dataString)
      .digest('hex');

    // 🔐 MÉTHODE 2 : SHA-1 simple (ancienne méthode CGI)
    const signatureSha1 = createHash('sha1')
      .update(dataString + '+' + this.paymentConfig.systempay.certificate)
      .digest('hex');

    // Log complet pour debug (masquer certificat)
    const debugString = dataString + '+[CERTIFICAT_MASQUE]';
    this.logger.log(`🔐 Signature params (${sortedKeys.length} fields):`);
    this.logger.log(`   Keys: ${sortedKeys.join(', ')}`);
    this.logger.log(`   Data: ${debugString}`);
    this.logger.log(`   HMAC-SHA256: ${signatureHmac}`);
    this.logger.log(`   SHA1 (legacy): ${signatureSha1}`);

    // Choisir la méthode configurée (SHA1 legacy ou HMAC)
    const method =
      (this.paymentConfig.systempay as any).signatureMethod || 'SHA1';
    if (method === 'HMAC') {
      this.logger.log('Using HMAC-SHA256 signature method');
      return signatureHmac;
    }

    this.logger.log('Using legacy SHA1 signature method');
    return signatureSha1;
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
        merchant_id: this.paymentConfig.systempay.siteId,
      };

      const signature = this.generateSignature(body);
      body.signature = signature;

      const response = await fetch(
        `${this.paymentConfig.systempay.apiUrl}/refund`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.paymentConfig.systempay.certificate}`,
          },
          body: JSON.stringify(body),
        },
      );

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
