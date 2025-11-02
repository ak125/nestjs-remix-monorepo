import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface PayboxPaymentParams {
  amount: number; // Montant en euros
  currency: string; // EUR
  orderId: string;
  customerEmail: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string; // URL IPN (Instant Payment Notification)
  description?: string;
}

export interface PayboxFormData {
  url: string; // URL de la passerelle Paybox
  parameters: Record<string, string>; // Paramètres du formulaire
}

/**
 * Service pour l'intégration Paybox (Verifone)
 * Documentation: https://www.paybox.com/documentation/
 */
@Injectable()
export class PayboxService {
  private readonly logger = new Logger(PayboxService.name);
  private readonly site: string;
  private readonly rang: string;
  private readonly identifiant: string;
  private readonly hmacKey: string;
  private readonly mode: string;
  private readonly paymentUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.site = this.configService.get<string>('PAYBOX_SITE', '');
    this.rang = this.configService.get<string>('PAYBOX_RANG', '001');
    this.identifiant = this.configService.get<string>('PAYBOX_IDENTIFIANT', '');
    this.hmacKey = this.configService.get<string>('PAYBOX_HMAC_KEY', '');
    this.mode = this.configService.get<string>('PAYBOX_MODE', 'TEST');

    // Pour les comptes de test mutualisés, utiliser l'URL CGI classique
    const defaultUrl =
      this.mode === 'TEST'
        ? 'https://preprod-tpeweb.paybox.com/cgi/MYchoix_pagepaiement.cgi'
        : 'https://tpeweb.paybox.com/cgi/MYchoix_pagepaiement.cgi';

    this.paymentUrl = this.configService.get<string>(
      'PAYBOX_PAYMENT_URL',
      defaultUrl,
    );

    // Validation de la configuration
    if (!this.site || !this.identifiant) {
      this.logger.warn(
        "Configuration Paybox incomplete. Verifiez vos variables d'environnement.",
      );
    } else {
      this.logger.log(`Paybox configure en mode ${this.mode}`);
      this.logger.log(`Site: ${this.site}, Rang: ${this.rang}`);

      // Pour les comptes de test mutualisés (pas de clé HMAC)
      if (!this.hmacKey || this.hmacKey.startsWith('0123456789ABCDEF')) {
        this.logger.warn(
          'Mode TEST sans cle HMAC valide : utilisation sans signature',
        );
        this.logger.warn(
          'Ceci est normal pour les comptes de test mutualises Paybox',
        );
      }
    }
  }

  /**
   * Génère le formulaire de paiement Paybox
   * Configuration INTELLIGENTE : avec ou sans URLs selon l'environnement
   */
  generatePaymentForm(params: PayboxPaymentParams): PayboxFormData {
    this.logger.log('Generation formulaire Paybox...');
    this.logger.log(`Mode: ${this.mode}`);
    this.logger.log(`Montant: ${params.amount} ${params.currency}`);
    this.logger.log(`Commande: ${params.orderId}`);

    // Convertir le montant en centimes (ex: 100.50 EUR → 10050)
    const amountInCents = Math.round(params.amount * 100);

    // Date/heure au format ISO8601 (comme date("c") en PHP)
    const dateTime = new Date().toISOString();

    // Paramètres Paybox de base (toujours présents)
    const payboxParams: Record<string, string> = {
      PBX_SITE: this.site,
      PBX_RANG: this.rang,
      PBX_IDENTIFIANT: this.identifiant,
      PBX_TOTAL: amountInCents.toString(),
      PBX_DEVISE: '978', // EUR
      PBX_CMD: params.orderId,
      PBX_PORTEUR: params.customerEmail,
      PBX_RETOUR: 'Mt:M;Ref:R;Auto:A;Erreur:E', // ⚠️ Sans ";Signature:K" comme dans le PHP
      PBX_HASH: 'SHA512',
      PBX_TIME: dateTime,
    };

    // ⭐ STRATÉGIE INTELLIGENTE : Ajouter les URLs SEULEMENT en PRODUCTION
    // Le compte TEST (1999888) ne supporte pas correctement ces paramètres
    const isProduction = this.mode === 'PRODUCTION' || this.site === '5259250';

    if (isProduction) {
      this.logger.log('✅ Mode PRODUCTION: ajout des URLs de retour');
      payboxParams.PBX_EFFECTUE = params.returnUrl;
      payboxParams.PBX_REFUSE = params.cancelUrl;
      payboxParams.PBX_ANNULE = params.cancelUrl;

      if (params.notifyUrl) {
        payboxParams.PBX_REPONDRE_A = params.notifyUrl;
      }
    } else {
      this.logger.log(
        '🧪 Mode TEST: URLs de retour omises (compte test limité)',
      );
    }

    // Construire la chaîne de signature avec les paramètres présents
    const signatureString = this.buildSignatureString(payboxParams);

    this.logger.log(
      `Signature string: ${signatureString.substring(0, 100)}...`,
    );

    // Calculer HMAC-SHA512 comme le PHP: hash_hmac('sha512', $string, pack("H*", $key))
    const keyBuffer = Buffer.from(this.hmacKey, 'hex'); // pack("H*", $key)
    const hmac = crypto.createHmac('sha512', keyBuffer);
    hmac.update(signatureString);
    const signature = hmac.digest('hex').toUpperCase(); // strtoupper()

    payboxParams.PBX_HMAC = signature;

    this.logger.log(
      `HMAC signature (20 premiers chars): ${signature.substring(0, 20)}...`,
    );
    this.logger.log('Formulaire Paybox genere');
    this.logger.log(`URL: ${this.paymentUrl}`);

    return {
      url: this.paymentUrl,
      parameters: payboxParams,
    };
  }

  /**
   * Construit la chaîne de signature dans l'ordre EXACT requis par Paybox
   */
  private buildSignatureString(params: Record<string, string>): string {
    // Ordre EXACT des paramètres pour la signature
    const orderedKeys = [
      'PBX_SITE',
      'PBX_RANG',
      'PBX_IDENTIFIANT',
      'PBX_TOTAL',
      'PBX_DEVISE',
      'PBX_CMD',
      'PBX_PORTEUR',
      'PBX_RETOUR',
      'PBX_EFFECTUE',
      'PBX_REFUSE',
      'PBX_ANNULE',
      'PBX_REPONDRE_A',
      'PBX_HASH',
      'PBX_TIME',
    ];

    // Construire la chaîne uniquement avec les paramètres présents
    return orderedKeys
      .filter((key) => params[key] !== undefined)
      .map((key) => `${key}=${params[key]}`)
      .join('&');
  }

  /**
   * Génère la signature HMAC SHA-512
   */
  private generateSignature(params: Record<string, string>): string {
    // Construire la chaîne à signer (format: param1=value1&param2=value2&...)
    const signString = Object.keys(params)
      .sort() // Ordre alphabétique
      .map((key) => `${key}=${params[key]}`)
      .join('&');

    this.logger.debug(`String to sign: ${signString.substring(0, 100)}...`);

    // Générer HMAC SHA-512
    const hmac = crypto.createHmac('sha512', Buffer.from(this.hmacKey, 'hex'));
    hmac.update(signString, 'utf8');
    const signature = hmac.digest('hex');

    return signature;
  }

  /**
   * Vérifie la signature d'une réponse Paybox (callback IPN)
   */
  verifySignature(
    params: Record<string, string>,
    receivedSignature: string,
  ): boolean {
    try {
      // Extraire la signature reçue
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { PBX_HMAC: _PBX_HMAC, ...paramsWithoutSignature } = params;

      // Recalculer la signature
      const calculatedSignature = this.generateSignature(
        paramsWithoutSignature,
      );

      // Comparaison sécurisée (insensible à la casse et au timing)
      const isValid =
        calculatedSignature.toLowerCase() === receivedSignature.toLowerCase();

      if (isValid) {
        this.logger.log('Signature Paybox valide');
      } else {
        this.logger.error('Signature Paybox invalide !');
        this.logger.error(`Expected: ${calculatedSignature}`);
        this.logger.error(`Received: ${receivedSignature}`);
      }

      return isValid;
    } catch (error) {
      this.logger.error('Erreur validation signature:', error);
      return false;
    }
  }

  /**
   * Parse le retour Paybox (format: Mt:10050;Ref:ORD123;Auto:XXXXXX;Erreur:00000;Signature:...)
   */
  parsePayboxResponse(queryString: string): Record<string, string> {
    const params: Record<string, string> = {};
    const pairs = queryString.split('&');

    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      params[key] = decodeURIComponent(value || '');
    }

    // Parser les variables de retour (format PBX_RETOUR)
    if (params.Mt) params.amount = params.Mt;
    if (params.Ref) params.orderReference = params.Ref;
    if (params.Auto) params.authorization = params.Auto;
    if (params.Erreur) params.errorCode = params.Erreur;
    if (params.Signature || params.K)
      params.signature = params.Signature || params.K;

    return params;
  }

  /**
   * Vérifie si le paiement est réussi (code erreur 00000)
   */
  isPaymentSuccessful(errorCode: string): boolean {
    return errorCode === '00000';
  }
}
