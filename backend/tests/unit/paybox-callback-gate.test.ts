/**
 * PayboxCallbackGateService Unit Tests
 *
 * Tests the Callback Gate security layer for Paybox IPN callbacks.
 * 7 tests: 5 core + 2 bonus edge cases.
 *
 * @see backend/src/modules/payments/services/paybox-callback-gate.service.ts
 */
import * as crypto from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PayboxCallbackGateService } from '../../src/modules/payments/services/paybox-callback-gate.service';
import { PaymentDataService } from '../../src/modules/payments/repositories/payment-data.service';

describe('PayboxCallbackGateService', () => {
  let service: PayboxCallbackGateService;
  const MOCK_HMAC_KEY = '0123456789ABCDEF'.repeat(8); // 128 chars hex

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config: Record<string, string> = {
        PAYBOX_CALLBACK_MODE: 'strict',
        PAYBOX_HMAC_KEY: MOCK_HMAC_KEY,
        PAYBOX_SITE: '5259250',
        PAYBOX_RANG: '001',
        PAYBOX_IDENTIFIANT: '822188223',
      };
      return config[key] || defaultValue;
    }),
  };

  // Mock du PaymentDataService avec Supabase
  const mockPaymentDataService = {
    supabase: {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    },
  };

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayboxCallbackGateService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PaymentDataService, useValue: mockPaymentDataService },
      ],
    }).compile();

    service = module.get<PayboxCallbackGateService>(PayboxCallbackGateService);
  });

  /**
   * Helper: Generates a valid HMAC signature (UPPERCASE)
   */
  function generateValidSignature(params: Record<string, string>): string {
    const signString = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join('&');
    const keyBuffer = Buffer.from(MOCK_HMAC_KEY, 'hex');
    return crypto
      .createHmac('sha512', keyBuffer)
      .update(signString)
      .digest('hex')
      .toUpperCase();
  }

  /**
   * Helper: Mocks checkOrderExists to return an order
   */
  function mockOrderExists(order: {
    ord_id: string;
    ord_total_ttc: string;
    ord_is_pay: string;
  }) {
    mockPaymentDataService.supabase.single.mockResolvedValue({
      data: order,
      error: null,
    });
  }

  /**
   * Helper: Mocks checkOrderExists to return not found
   */
  function mockOrderNotFound() {
    mockPaymentDataService.supabase.single.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'Not found' },
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // TEST 1: Signature valide (au moins une strategie)
  // ═══════════════════════════════════════════════════════════════
  it('should pass when signature matches at least one strategy', async () => {
    const params = {
      Mt: '10050',
      Ref: 'ORD-123',
      Erreur: '00000',
      Auto: 'ABC123',
    };
    const signature = generateValidSignature(params);
    const query = { ...params, Signature: signature };
    const rawQuery = Object.entries(query)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');

    mockOrderExists({
      ord_id: '123',
      ord_total_ttc: '100.50',
      ord_is_pay: '0',
    });

    const result = await service.validateCallback(rawQuery, query, {
      amount: '10050',
      orderReference: 'ORD-123',
      errorCode: '00000',
      signature,
    });

    expect(result.result.checks.signature.ok).toBe(true);
    expect(result.result.checks.signature.present).toBe(true);
    expect(result.result.checks.signature.matchedStrategy).toBe('ALPHABETICAL');
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 2: Signature invalide (presente mais fausse)
  // ═══════════════════════════════════════════════════════════════
  it('should reject when signature is present but invalid', async () => {
    const query = {
      Mt: '10050',
      Ref: 'ORD-123',
      Erreur: '00000',
      Signature: 'INVALID_SIGNATURE_12345',
    };
    const rawQuery = Object.entries(query)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');

    mockOrderExists({
      ord_id: '123',
      ord_total_ttc: '100.50',
      ord_is_pay: '0',
    });

    const result = await service.validateCallback(rawQuery, query, {
      amount: '10050',
      orderReference: 'ORD-123',
      errorCode: '00000',
      signature: 'INVALID_SIGNATURE_12345',
    });

    expect(result.result.checks.signature.ok).toBe(false);
    expect(result.result.checks.signature.present).toBe(true);
    expect(result.result.checks.signature.reason).toBe('NO_STRATEGY_MATCHED');
    expect(result.reject).toBe(true); // Mode strict + signature presente invalide
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 3: Montant mismatch (strict=reject)
  // ═══════════════════════════════════════════════════════════════
  it('should reject on amount mismatch in strict mode', async () => {
    const params = { Mt: '5000', Ref: 'ORD-123', Erreur: '00000' };
    const signature = generateValidSignature(params);
    const query = { ...params, Signature: signature };
    const rawQuery = Object.entries(query)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');

    // Order expects 100.50 EUR = 10050 cents, callback says 5000 cents
    mockOrderExists({
      ord_id: '123',
      ord_total_ttc: '100.50',
      ord_is_pay: '0',
    });

    const result = await service.validateCallback(rawQuery, query, {
      amount: '5000',
      orderReference: 'ORD-123',
      errorCode: '00000',
      signature,
    });

    expect(result.result.checks.amountMatch.ok).toBe(false);
    expect(result.result.checks.amountMatch.expected).toBe(10050);
    expect(result.result.checks.amountMatch.received).toBe(5000);
    expect(result.reject).toBe(true);
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 4: Callback replay (idempotent)
  // ═══════════════════════════════════════════════════════════════
  it('should be idempotent when order already paid', async () => {
    const params = { Mt: '10050', Ref: 'ORD-123', Erreur: '00000' };
    const signature = generateValidSignature(params);
    const query = { ...params, Signature: signature };
    const rawQuery = Object.entries(query)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');

    // Order already paid (ord_is_pay = '1')
    mockOrderExists({
      ord_id: '123',
      ord_total_ttc: '100.50',
      ord_is_pay: '1',
    });

    const result = await service.validateCallback(rawQuery, query, {
      amount: '10050',
      orderReference: 'ORD-123',
      errorCode: '00000',
      signature,
    });

    expect(result.isIdempotent).toBe(true);
    expect(result.result.checks.idempotence.alreadyPaid).toBe(true);
    expect(result.reject).toBe(false); // Never reject idempotent callbacks
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 5: Erreur non-success => reject
  // ═══════════════════════════════════════════════════════════════
  it('should reject on non-success error code', async () => {
    const params = { Mt: '10050', Ref: 'ORD-123', Erreur: '00015' }; // 00015 = Card refused
    const signature = generateValidSignature(params);
    const query = { ...params, Signature: signature };
    const rawQuery = Object.entries(query)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');

    mockOrderExists({
      ord_id: '123',
      ord_total_ttc: '100.50',
      ord_is_pay: '0',
    });

    const result = await service.validateCallback(rawQuery, query, {
      amount: '10050',
      orderReference: 'ORD-123',
      errorCode: '00015',
      signature,
    });

    expect(result.result.checks.errorCode.ok).toBe(false);
    expect(result.result.checks.errorCode.value).toBe('00015');
    expect(result.reject).toBe(true);
  });

  // ═══════════════════════════════════════════════════════════════
  // BONUS TEST 6: Signature absente ne bloque PAS en strict
  // ═══════════════════════════════════════════════════════════════
  it('should NOT reject when signature is missing but other checks pass', async () => {
    // No signature in callback (PBX_RETOUR without ;Signature:K)
    const query = { Mt: '10050', Ref: 'ORD-123', Erreur: '00000' };
    const rawQuery = Object.entries(query)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');

    mockOrderExists({
      ord_id: '123',
      ord_total_ttc: '100.50',
      ord_is_pay: '0',
    });

    const result = await service.validateCallback(rawQuery, query, {
      amount: '10050',
      orderReference: 'ORD-123',
      errorCode: '00000',
      // No signature in parsedParams
    });

    expect(result.result.checks.signature.present).toBe(false);
    expect(result.result.checks.signature.ok).toBe(false);
    // Should NOT reject because signature is absent (not invalid)
    expect(result.reject).toBe(false);
  });

  // ═══════════════════════════════════════════════════════════════
  // BONUS TEST 7: Merchant ID mismatch (anti-test callback in prod)
  // ═══════════════════════════════════════════════════════════════
  it('should reject when merchant ID does not match (anti-test callback)', async () => {
    // PBX_SITE is from TEST environment, not production
    const params = {
      Mt: '10050',
      Ref: 'ORD-123',
      Erreur: '00000',
      PBX_SITE: '1999888', // Test site, not matching expected 5259250
    };
    const signature = generateValidSignature(params);
    const query = { ...params, Signature: signature };
    const rawQuery = Object.entries(query)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');

    mockOrderExists({
      ord_id: '123',
      ord_total_ttc: '100.50',
      ord_is_pay: '0',
    });

    const result = await service.validateCallback(rawQuery, query, {
      amount: '10050',
      orderReference: 'ORD-123',
      errorCode: '00000',
      signature,
    });

    expect(result.result.checks.merchantId.ok).toBe(false);
    expect(result.result.checks.merchantId.siteMatch).toBe(false);
    expect(result.reject).toBe(true); // Merchant ID mismatch = reject
  });
});
