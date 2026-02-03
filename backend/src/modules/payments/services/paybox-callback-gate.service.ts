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
import {
  parseQueryStringPreservingOrder,
  buildSignatureStringFromOrdered,
} from '../utils/querystring-order-preserving';
import { PaymentDataService } from '../repositories/payment-data.service';
import { normalizeOrderId } from '../utils/normalize-order-id';

export type CallbackMode = 'shadow' | 'strict';

export interface SignatureCheckResult {
  ok: boolean;
  present: boolean; // Distinguer "absente" vs "invalide"
  matchedStrategy?: 'ORDER_RECEIVED' | 'ALPHABETICAL' | 'ORDERED_KEYS';
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

// FROZEN - Ordre des clés pour signature (NE PAS MODIFIER)
const ORDERED_KEYS_FOR_SIGNATURE = [
  'PBX_SITE',
  'PBX_RANG',
  'PBX_IDENTIFIANT',
  'PBX_TOTAL',
  'PBX_DEVISE',
  'PBX_CMD',
  'PBX_PORTEUR',
  'PBX_RETOUR',
  'PBX_HASH',
  'PBX_TIME',
];

const SIGNATURE_KEYS = ['Signature', 'K', 'PBX_HMAC'];

@Injectable()
export class PayboxCallbackGateService {
  private readonly logger = new Logger(PayboxCallbackGateService.name);
  private readonly mode: CallbackMode;
  private readonly hmacKey: string;
  // Stocker les identifiants marchands pour vérification
  private readonly expectedSite: string;
  private readonly expectedRang: string;
  private readonly expectedIdentifiant: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly paymentDataService: PaymentDataService,
  ) {
    this.mode = this.configService.get<CallbackMode>(
      'PAYBOX_CALLBACK_MODE',
      'shadow',
    );
    this.hmacKey = this.configService.get<string>('PAYBOX_HMAC_KEY', '');

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

    // 1. Vérification signature multi-stratégie
    if (signature) {
      result.checks.signature = this.verifySignatureMultiStrategy(
        rawQueryString,
        query,
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

    // Calcul du statut global (signature OK si présente et valide, OU absente)
    const signatureOkOrAbsent =
      result.checks.signature.ok || !result.checks.signature.present;

    result.allCriticalChecksOk =
      signatureOkOrAbsent &&
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
      // En strict, rejeter si:
      // - Signature PRÉSENTE mais INVALIDE
      // - OU orderExists=false OU amountMismatch OU errorCode!=00000 OU merchantId mismatch
      const signatureInvalid =
        result.checks.signature.present && !result.checks.signature.ok;
      const criticalCheckFailed =
        !result.checks.orderExists.ok ||
        !result.checks.amountMatch.ok ||
        !result.checks.errorCode.ok ||
        !result.checks.merchantId.ok;

      reject = signatureInvalid || criticalCheckFailed;
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
   * Vérifie la signature avec 3 stratégies différentes
   * SAFE CHANGE: Ne modifie pas l'algo HMAC existant
   * Utilise timingSafeEqual pour comparaison sécurisée
   */
  private verifySignatureMultiStrategy(
    rawQueryString: string,
    query: Record<string, string>,
    receivedSignature: string,
  ): SignatureCheckResult {
    const strategies: Array<{ name: string; match: boolean }> = [];

    // Stratégie 1: Ordre de réception
    try {
      const orderedPairs = parseQueryStringPreservingOrder(rawQueryString);
      const signString = buildSignatureStringFromOrdered(
        orderedPairs,
        SIGNATURE_KEYS,
      );
      const sig1 = this.computeHMAC(signString);
      strategies.push({
        name: 'ORDER_RECEIVED',
        match: this.timingSafeCompare(sig1, receivedSignature),
      });
    } catch {
      strategies.push({ name: 'ORDER_RECEIVED', match: false });
    }

    // Stratégie 2: Ordre alphabétique
    try {
      const paramsWithoutSig = { ...query };
      SIGNATURE_KEYS.forEach((k) => delete paramsWithoutSig[k]);

      const signString = Object.keys(paramsWithoutSig)
        .sort()
        .map((k) => `${k}=${paramsWithoutSig[k]}`)
        .join('&');
      const sig2 = this.computeHMAC(signString);
      strategies.push({
        name: 'ALPHABETICAL',
        match: this.timingSafeCompare(sig2, receivedSignature),
      });
    } catch {
      strategies.push({ name: 'ALPHABETICAL', match: false });
    }

    // Stratégie 3: orderedKeys[] (si applicable)
    try {
      const paramsWithoutSig = { ...query };
      SIGNATURE_KEYS.forEach((k) => delete paramsWithoutSig[k]);

      const applicableKeys = ORDERED_KEYS_FOR_SIGNATURE.filter(
        (k) => paramsWithoutSig[k] !== undefined,
      );

      if (applicableKeys.length > 0) {
        const signString = applicableKeys
          .map((k) => `${k}=${paramsWithoutSig[k]}`)
          .join('&');
        const sig3 = this.computeHMAC(signString);
        strategies.push({
          name: 'ORDERED_KEYS',
          match: this.timingSafeCompare(sig3, receivedSignature),
        });
      }
    } catch {
      // orderedKeys non applicable
    }

    const matchedStrategy = strategies.find((s) => s.match);

    return {
      ok: matchedStrategy !== undefined,
      present: true,
      matchedStrategy:
        matchedStrategy?.name as SignatureCheckResult['matchedStrategy'],
      triedStrategies: strategies.map((s) => s.name),
      reason: matchedStrategy ? undefined : 'NO_STRATEGY_MATCHED',
    };
  }

  /**
   * Calcul HMAC-SHA512
   * Retourne UPPERCASE (aligné avec le gelé de PayboxService)
   */
  private computeHMAC(signatureString: string): string {
    const keyBuffer = Buffer.from(this.hmacKey, 'hex');
    const hmac = crypto.createHmac('sha512', keyBuffer);
    hmac.update(signatureString, 'utf8');
    return hmac.digest('hex').toUpperCase(); // UPPERCASE comme gelé
  }

  /**
   * Comparaison timing-safe des signatures
   * Évite les timing attacks
   */
  private timingSafeCompare(calculated: string, received: string): boolean {
    try {
      // Normaliser en uppercase pour comparaison
      const calcNorm = calculated.toUpperCase();
      const recvNorm = received.toUpperCase();

      // Vérifier même longueur avant timingSafeEqual
      if (calcNorm.length !== recvNorm.length) {
        return false;
      }

      const calcBuf = Buffer.from(calcNorm, 'utf8');
      const recvBuf = Buffer.from(recvNorm, 'utf8');

      return crypto.timingSafeEqual(calcBuf, recvBuf);
    } catch {
      return false;
    }
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
    }
  }
}
