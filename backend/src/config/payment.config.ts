import { registerAs } from '@nestjs/config';

export enum PaymentMode {
  TEST = 'TEST',
  PRODUCTION = 'PRODUCTION',
}

export interface PaymentConfig {
  cyberplus: {
    siteId: string;
    certificat: string;
    mode: PaymentMode;
    paymentUrl: string;
  };
  app: {
    url: string;
    callbackPath: string;
  };
}

/**
 * Configuration centralisée pour les paiements
 *
 * ⚠️ SÉCURITÉ :
 * - Les valeurs sensibles (CERTIFICAT) ne doivent JAMAIS être loggées
 * - Utilisez des secrets managers en production (Vault, AWS Secrets Manager)
 * - Ne commitez JAMAIS le fichier .env
 */
export default registerAs('payment', (): PaymentConfig => {
  const mode = (
    process.env.CYBERPLUS_MODE || 'TEST'
  ).toUpperCase() as PaymentMode;

  // Validation du mode
  if (!Object.values(PaymentMode).includes(mode)) {
    throw new Error(
      `Invalid CYBERPLUS_MODE: ${mode}. Must be TEST or PRODUCTION`,
    );
  }

  // Validation des variables requises
  const requiredVars = ['CYBERPLUS_SITE_ID', 'CYBERPLUS_CERTIFICAT', 'APP_URL'];
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      throw new Error(`Missing required environment variable: ${varName}`);
    }
  }

  return {
    cyberplus: {
      siteId: process.env.CYBERPLUS_SITE_ID!,
      certificat: process.env.CYBERPLUS_CERTIFICAT!,
      mode,
      paymentUrl:
        process.env.CYBERPLUS_PAYMENT_URL ||
        'https://secure.systempay.fr/vads-payment/',
    },
    app: {
      url: process.env.APP_URL!,
      callbackPath: '/api/payments/callback',
    },
  };
});
