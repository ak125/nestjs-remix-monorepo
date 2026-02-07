import { registerAs } from '@nestjs/config';
import { ConfigurationException, ErrorCodes } from '../common/exceptions';

export enum PaymentMode {
  TEST = 'TEST',
  PRODUCTION = 'PRODUCTION',
}

export interface PaymentConfig {
  systempay: {
    siteId: string;
    certificate: string;
    // Optional HMAC key (for HMAC signature method)
    hmacKey?: string;
    // Signature method: 'SHA1' (legacy) or 'HMAC'
    signatureMethod?: 'SHA1' | 'HMAC';
    certificateTest: string;
    mode: PaymentMode;
    apiUrl: string;
  };
  app: {
    url: string;
    callbackPath: string;
  };
}

/**
 * Configuration centralisée pour les paiements SystemPay
 *
 * ⚠️ SÉCURITÉ :
 * - Les valeurs sensibles (CERTIFICATE) ne doivent JAMAIS être loggées
 * - Utilisez des secrets managers en production (Vault, AWS Secrets Manager)
 * - Ne commitez JAMAIS le fichier .env
 */
export default registerAs('payment', (): PaymentConfig => {
  const mode = (
    process.env.SYSTEMPAY_MODE || 'TEST'
  ).toUpperCase() as PaymentMode;

  // Validation du mode
  if (!Object.values(PaymentMode).includes(mode)) {
    throw new ConfigurationException({
      code: ErrorCodes.PAYMENT.CONFIG_MISSING,
      message: `Invalid SYSTEMPAY_MODE: ${mode}. Must be TEST or PRODUCTION`,
    });
  }

  // Validation des variables requises
  const requiredVars = [
    'SYSTEMPAY_SITE_ID',
    'SYSTEMPAY_CERTIFICATE_PROD',
    'SYSTEMPAY_CERTIFICATE_TEST',
    'APP_URL',
  ];
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      throw new ConfigurationException({
        code: ErrorCodes.PAYMENT.CONFIG_MISSING,
        message: `Missing required environment variable: ${varName}`,
      });
    }
  }

  // Sélectionner le bon certificat selon le mode
  const certificate =
    mode === PaymentMode.PRODUCTION
      ? process.env.SYSTEMPAY_CERTIFICATE_PROD!
      : process.env.SYSTEMPAY_CERTIFICATE_TEST!;

  const signatureMethod = (process.env.SYSTEMPAY_SIGNATURE_METHOD || 'SHA1') as
    | 'SHA1'
    | 'HMAC';

  const hmacKey = process.env.SYSTEMPAY_HMAC_KEY || '';

  return {
    systempay: {
      siteId: process.env.SYSTEMPAY_SITE_ID!,
      certificate,
      hmacKey,
      signatureMethod,
      certificateTest: process.env.SYSTEMPAY_CERTIFICATE_TEST!,
      mode,
      apiUrl:
        process.env.SYSTEMPAY_API_URL ||
        'https://paiement.systempay.fr/vads-payment/',
    },
    app: {
      url: process.env.APP_URL!,
      callbackPath: '/api/payments/callback',
    },
  };
});
