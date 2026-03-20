/**
 * PayboxCallbackGateService
 * SAFE CHANGE: Nouveau service, aucune modification de l'existant
 *
 * Sécurise les callbacks Paybox avec feature flag shadow/strict
 * - shadow: log uniquement, ne bloque jamais
 * - strict: rejette les callbacks invalides
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PaymentDataService } from '../repositories/payment-data.service';
import { normalizeOrderId } from '../utils/normalize-order-id';
import { PAYBOX_PUBLIC_KEYS } from '../../../config/paybox-public-keys';

export type CallbackMode = 'shadow' | 'strict';

export interface SignatureCheckResult {
  ok: boolean;
  present: boolean; // Distinguer "absente" vs "invalide"
  matchedStrategy?: 'RSA_2048' | 'RSA_1024';
  triedStrategies: string[];
  reason?: string;
}

export interface CheckResult {
  ok: boolean;
  reason?: string;
  expected?: number | string;
  received?: number | string;
  value?: string;
  alreadyPaid?: boolean;
}

export interface MerchantCheckResult {
  ok: boolean;
  siteMatch?: boolean;
  rangMatch?: boolean;
  identifiantMatch?: boolean;
  reason?: string;
}

export interface CallbackValidationResult {
  correlationId: string;
  orderId: string;
  amountCents: string;
  mode: CallbackMode;
  timestamp: string;
  checks: {
    signature: SignatureCheckResult;
    orderExists: CheckResult;
    amountMatch: CheckResult;
    errorCode: CheckResult;
    idempotence: CheckResult;
    merchantId: MerchantCheckResult;
  };
  allCriticalChecksOk: boolean;
}

export interface GateDecision {
  valid: boolean;
  result: CallbackValidationResult;
  reject: boolean;
  isIdempotent: boolean;
}

@Injectable()
export class PayboxCallbackGateService {
  private readonly logger = new Logger(PayboxCallbackGateService.name);
  private readonly mode: CallbackMode;
  private readonly expectedSite: string;
  private readonly expectedRang: string;
  private readonly expectedIdentifiant: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly paymentDataService: PaymentDataService,
  ) {
    // Secure by default: strict unless explicitly set to shadow
    this.mode = this.configService.get<CallbackMode>(
      'PAYBOX_CALLBACK_MODE',
      'strict',
    );

    // Charger identifiants marchands pour vérification callback
    this.expectedSite = this.configService.get<string>('PAYBOX_SITE', '');
    this.expectedRang = this.configService.get<string>('PAYBOX_RANG', '001');
    this.expectedIdentifiant = this.configService.get<string>(
      'PAYBOX_IDENTIFIANT',
      '',
    );

    this.logger.log(
      `PayboxCallbackGate initialized in ${this.mode.toUpperCase()} mode`,
    );

    // Startup guard: warn loudly if shadow mode in production
    const nodeEnv = this.configService.get<string>('NODE_ENV', '');
    if (this.mode === 'shadow' && nodeEnv === 'production') {
      this.logger.error(
        'SECURITY WARNING: PayboxCallbackGate running in SHADOW mode in PRODUCTION — ' +
          'invalid callbacks will be logged but NOT rejected. ' +
          'Set PAYBOX_CALLBACK_MODE=strict to enforce validation.',
      );
    }
  }

  /**
   * Point d'entrée principal du Callback Gate
   * SAFE CHANGE: Appelé AVANT le traitement existant
   */
  async validateCallback(
    rawQueryString: string,
    query: Record<string, string>,
    parsedParams: Record<string, string>,
  ): Promise<GateDecision> {
    const correlationId = crypto.randomUUID();
    const signature =
      parsedParams.signature ||
      parsedParams.K ||
      query.Signature ||
      query.K ||
      '';

    const result: CallbackValidationResult = {
      correlationId,
      orderId: parsedParams.orderReference || parsedParams.Ref || '',
      amountCents: parsedParams.amount || parsedParams.Mt || '0',
      mode: this.mode,
      timestamp: new Date().toISOString(),
      checks: {
        signature: { ok: false, present: false, triedStrategies: [] },
        orderExists: { ok: false },
        amountMatch: { ok: false },
        errorCode: { ok: false },
        idempotence: { ok: false },
        merchantId: { ok: true }, // OK par défaut si non présent
      },
      allCriticalChecksOk: false,
    };

    // 1. Verification signature RSA (Paybox CGI signe avec RSA + SHA-1)
    if (signature) {
      result.checks.signature = this.verifySignatureRSA(
        rawQueryString,
        signature,
      );
      result.checks.signature.present = true;
    } else {
      // Signature absente != signature invalide
      result.checks.signature = {
        ok: false, // Pas de signature = pas de validation possible
        present: false, // MAIS on note qu'elle est absente (pas invalide)
        reason: 'MISSING',
        triedStrategies: [],
      };
    }

    // 2. Vérification identifiants marchands (anti-callback test en prod)
    result.checks.merchantId = this.verifyMerchantId(query);

    // 3. Vérification commande existe + récupération montant attendu
    let expectedAmountCents = 0;
    let orderAlreadyPaid = false;

    if (result.orderId) {
      const orderCheck = await this.checkOrderExists(result.orderId);
      result.checks.orderExists = orderCheck.result;

      if (orderCheck.order) {
        expectedAmountCents = Math.round(
          parseFloat(orderCheck.order.ord_total_ttc || '0') * 100,
        );
        orderAlreadyPaid = orderCheck.order.ord_is_pay === '1';
      }
    } else {
      result.checks.orderExists = { ok: false, reason: 'NO_ORDER_REF' };
    }

    // 4. Vérification montant
    const receivedCents = parseInt(result.amountCents, 10) || 0;
    result.checks.amountMatch = {
      ok: expectedAmountCents === receivedCents && expectedAmountCents > 0,
      expected: expectedAmountCents,
      received: receivedCents,
    };
    if (expectedAmountCents === 0) {
      result.checks.amountMatch.reason = 'EXPECTED_ZERO';
    } else if (expectedAmountCents !== receivedCents) {
      result.checks.amountMatch.reason = 'MISMATCH';
    }

    // 5. Vérification code erreur
    const errorCode = parsedParams.errorCode || parsedParams.Erreur || '';
    result.checks.errorCode = {
      ok: errorCode === '00000',
      value: errorCode,
    };
    if (errorCode !== '00000') {
      result.checks.errorCode.reason = `ERROR_CODE_${errorCode}`;
    }

    // 6. Idempotence
    result.checks.idempotence = {
      ok: true, // L'idempotence n'est pas un échec, c'est une information
      alreadyPaid: orderAlreadyPaid,
    };

    result.allCriticalChecksOk =
      result.checks.signature.ok &&
      result.checks.orderExists.ok &&
      result.checks.amountMatch.ok &&
      result.checks.errorCode.ok &&
      result.checks.merchantId.ok;

    // Logging structuré (sans données sensibles)
    this.logStructured(result);

    // Décision selon le mode
    const isIdempotent = result.checks.idempotence.alreadyPaid === true;
    let reject = false;

    if (this.mode === 'strict' && !isIdempotent) {
      // En strict, rejeter si un check critique echoue
      // (signature absente OU invalide, commande inexistante, montant incorrect, etc.)
      reject = !result.allCriticalChecksOk;
    }

    return {
      valid: result.allCriticalChecksOk,
      result,
      reject,
      isIdempotent,
    };
  }

  /**
   * Vérifie les identifiants marchands si présents dans le callback
   * Protection contre callbacks de test envoyés en prod
   */
  private verifyMerchantId(query: Record<string, string>): MerchantCheckResult {
    const result: MerchantCheckResult = { ok: true };

    // Vérifier PBX_SITE si présent
    if (query.PBX_SITE && this.expectedSite) {
      result.siteMatch = query.PBX_SITE === this.expectedSite;
      if (!result.siteMatch) {
        result.ok = false;
        result.reason = `SITE_MISMATCH: expected=${this.expectedSite}, received=${query.PBX_SITE}`;
      }
    }

    // Vérifier PBX_RANG si présent
    if (query.PBX_RANG && this.expectedRang) {
      result.rangMatch = query.PBX_RANG === this.expectedRang;
      if (!result.rangMatch && result.ok) {
        result.ok = false;
        result.reason = `RANG_MISMATCH: expected=${this.expectedRang}, received=${query.PBX_RANG}`;
      }
    }

    // Vérifier PBX_IDENTIFIANT si présent
    if (query.PBX_IDENTIFIANT && this.expectedIdentifiant) {
      result.identifiantMatch =
        query.PBX_IDENTIFIANT === this.expectedIdentifiant;
      if (!result.identifiantMatch && result.ok) {
        result.ok = false;
        result.reason = `IDENTIFIANT_MISMATCH`;
      }
    }

    return result;
  }

  /**
   * Verification RSA + SHA-1 de la signature Paybox IPN
   * Paybox signe les donnees AVANT &K= dans la querystring brute
   * Essaie les cles 2048 puis 1024 (Paybox peut changer de cle)
   */
  private verifySignatureRSA(
    rawQueryString: string,
    receivedSignature: string,
  ): SignatureCheckResult {
    // 1. Extraire les donnees signees = tout AVANT "&K=" dans la querystring brute
    const kIndex = rawQueryString.indexOf('&K=');
    if (kIndex === -1) {
      return {
        ok: false,
        present: true,
        triedStrategies: ['RSA'],
        reason: 'NO_K_SEPARATOR',
      };
    }
    const signedData = rawQueryString.substring(0, kIndex);

    // 2. Decoder la signature : URL decode → Base64
    let decodedSignature: string;
    try {
      decodedSignature = decodeURIComponent(receivedSignature);
    } catch {
      return {
        ok: false,
        present: true,
        triedStrategies: ['RSA'],
        reason: 'SIGNATURE_DECODE_ERROR',
      };
    }

    // 3. Essayer chaque cle publique (2048 puis 1024)
    for (let i = 0; i < PAYBOX_PUBLIC_KEYS.length; i++) {
      try {
        const verify = crypto.createVerify('SHA1');
        verify.update(signedData);
        const isValid = verify.verify(
          PAYBOX_PUBLIC_KEYS[i],
          decodedSignature,
          'base64',
        );
        if (isValid) {
          const keyLabel = i === 0 ? 'RSA_2048' : 'RSA_1024';
          this.logger.log(`Signature RSA valide avec cle ${keyLabel}`);
          return {
            ok: true,
            present: true,
            matchedStrategy:
              keyLabel as SignatureCheckResult['matchedStrategy'],
            triedStrategies: ['RSA'],
          };
        }
      } catch {
        // Cle invalide ou erreur crypto → essayer la suivante
      }
    }

    return {
      ok: false,
      present: true,
      triedStrategies: ['RSA'],
      reason: 'RSA_VERIFY_FAILED',
    };
  }

  /**
   * Vérifie si la commande existe et récupère ses données
   * Utilise PaymentDataService au lieu d'instancier Supabase
   */
  private async checkOrderExists(
    orderRef: string,
  ): Promise<{ result: CheckResult; order?: any }> {
    try {
      // Utiliser le helper centralisé pour normaliser l'ID
      const orderId = normalizeOrderId(orderRef);

      // Utiliser le client Supabase du service existant
      const { data: order, error } = await this.paymentDataService['supabase']
        .from('___xtr_order')
        .select('ord_id, ord_total_ttc, ord_is_pay, ord_date_pay')
        .eq('ord_id', orderId)
        .single();

      if (error || !order) {
        return {
          result: { ok: false, reason: 'NOT_FOUND' },
        };
      }

      return {
        result: { ok: true },
        order,
      };
    } catch {
      return {
        result: { ok: false, reason: 'DB_ERROR' },
      };
    }
  }

  /**
   * Logging structuré sans données sensibles
   */
  private logStructured(result: CallbackValidationResult): void {
    const logEntry = {
      type: 'PAYBOX_CALLBACK_GATE',
      correlationId: result.correlationId,
      orderId: result.orderId,
      amountCents: result.amountCents,
      mode: result.mode,
      timestamp: result.timestamp,
      signaturePresent: result.checks.signature.present,
      signatureOk: result.checks.signature.ok,
      signatureStrategy: result.checks.signature.matchedStrategy || 'NONE',
      merchantIdOk: result.checks.merchantId.ok,
      orderExists: result.checks.orderExists.ok,
      amountMatch: result.checks.amountMatch.ok,
      errorCodeOk: result.checks.errorCode.ok,
      errorCodeValue: result.checks.errorCode.value,
      isIdempotent: result.checks.idempotence.alreadyPaid,
      allCriticalChecksOk: result.allCriticalChecksOk,
    };

    if (result.allCriticalChecksOk) {
      this.logger.log(`GATE PASS: ${JSON.stringify(logEntry)}`);
    } else {
      this.logger.warn(`GATE FAIL: ${JSON.stringify(logEntry)}`);

      // Persist GATE FAIL to DB for monitoring (non-blocking)
      this.persistGateFail(result).catch((err) => {
        this.logger.error(
          `Failed to persist gate log: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    }
  }

  /**
   * Persist GATE FAIL decisions to __paybox_gate_log for monitoring.
   * Non-blocking: errors are logged but never block the callback response.
   */
  private async persistGateFail(
    result: CallbackValidationResult,
  ): Promise<void> {
    await this.paymentDataService['supabase'].from('__paybox_gate_log').insert({
      correlation_id: result.correlationId,
      order_id: result.orderId,
      amount_cents: result.amountCents,
      mode: result.mode,
      all_checks_ok: result.allCriticalChecksOk,
      rejected: this.mode === 'strict',
      checks: {
        signature: result.checks.signature.ok,
        signaturePresent: result.checks.signature.present,
        signatureReason: result.checks.signature.reason,
        orderExists: result.checks.orderExists.ok,
        amountMatch: result.checks.amountMatch.ok,
        errorCode: result.checks.errorCode.ok,
        errorCodeValue: result.checks.errorCode.value,
        merchantId: result.checks.merchantId.ok,
        idempotent: result.checks.idempotence.alreadyPaid,
      },
    });
  }
}
