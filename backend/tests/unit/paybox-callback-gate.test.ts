/**
 * PayboxCallbackGateService Unit Tests
 *
 * Tests the Callback Gate security layer for Paybox IPN callbacks.
 * Now uses RSA+SHA1 verification (not HMAC).
 * 7 tests: 5 core + 2 bonus edge cases.
 *
 * @see backend/src/modules/payments/services/paybox-callback-gate.service.ts
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PayboxCallbackGateService } from '../../src/modules/payments/services/paybox-callback-gate.service';
import { PaymentDataService } from '../../src/modules/payments/repositories/payment-data.service';

describe('PayboxCallbackGateService', () => {
  let service: PayboxCallbackGateService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config: Record<string, string> = {
        PAYBOX_CALLBACK_MODE: 'strict',
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
  // TEST 1: Signature RSA invalide (fausse sig) → reject
  // ═══════════════════════════════════════════════════════════════
  it('should reject when RSA signature is invalid', async () => {
    const query = {
      Mt: '10050',
      Ref: 'ORD-123',
      Erreur: '00000',
      Auto: 'ABC123',
      K: 'FAKE_SIGNATURE',
    };
    // K must be last in rawQuery for RSA verification to find &K=
    const rawQuery = 'Mt=10050&Ref=ORD-123&Erreur=00000&Auto=ABC123&K=FAKE_SIGNATURE';

    mockOrderExists({
      ord_id: '123',
      ord_total_ttc: '100.50',
      ord_is_pay: '0',
    });

    const result = await service.validateCallback(rawQuery, query, {
      amount: '10050',
      orderReference: 'ORD-123',
      errorCode: '00000',
      signature: 'FAKE_SIGNATURE',
    });

    expect(result.result.checks.signature.ok).toBe(false);
    expect(result.result.checks.signature.present).toBe(true);
    expect(result.result.checks.signature.reason).toBe('RSA_VERIFY_FAILED');
    expect(result.reject).toBe(true);
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 2: Signature presente mais invalide → reject en strict
  // ═══════════════════════════════════════════════════════════════
  it('should reject when signature is present but invalid', async () => {
    const query = {
      Mt: '10050',
      Ref: 'ORD-123',
      Erreur: '00000',
      K: 'INVALID_SIGNATURE_12345',
    };
    const rawQuery = 'Mt=10050&Ref=ORD-123&Erreur=00000&K=INVALID_SIGNATURE_12345';

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
    expect(result.result.checks.signature.reason).toBe('RSA_VERIFY_FAILED');
    expect(result.reject).toBe(true);
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 3: Montant mismatch (strict=reject)
  // ═══════════════════════════════════════════════════════════════
  it('should reject on amount mismatch in strict mode', async () => {
    const query = { Mt: '5000', Ref: 'ORD-123', Erreur: '00000', K: 'fakesig' };
    const rawQuery = 'Mt=5000&Ref=ORD-123&Erreur=00000&K=fakesig';

    mockOrderExists({
      ord_id: '123',
      ord_total_ttc: '100.50',
      ord_is_pay: '0',
    });

    const result = await service.validateCallback(rawQuery, query, {
      amount: '5000',
      orderReference: 'ORD-123',
      errorCode: '00000',
      signature: 'fakesig',
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
    const query = { Mt: '10050', Ref: 'ORD-123', Erreur: '00000', K: 'fakesig' };
    const rawQuery = 'Mt=10050&Ref=ORD-123&Erreur=00000&K=fakesig';

    mockOrderExists({
      ord_id: '123',
      ord_total_ttc: '100.50',
      ord_is_pay: '1',
    });

    const result = await service.validateCallback(rawQuery, query, {
      amount: '10050',
      orderReference: 'ORD-123',
      errorCode: '00000',
      signature: 'fakesig',
    });

    expect(result.isIdempotent).toBe(true);
    expect(result.result.checks.idempotence.alreadyPaid).toBe(true);
    expect(result.reject).toBe(false); // Never reject idempotent callbacks
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 5: Erreur non-success => reject
  // ═══════════════════════════════════════════════════════════════
  it('should reject on non-success error code', async () => {
    const query = { Mt: '10050', Ref: 'ORD-123', Erreur: '00015', K: 'fakesig' };
    const rawQuery = 'Mt=10050&Ref=ORD-123&Erreur=00015&K=fakesig';

    mockOrderExists({
      ord_id: '123',
      ord_total_ttc: '100.50',
      ord_is_pay: '0',
    });

    const result = await service.validateCallback(rawQuery, query, {
      amount: '10050',
      orderReference: 'ORD-123',
      errorCode: '00015',
      signature: 'fakesig',
    });

    expect(result.result.checks.errorCode.ok).toBe(false);
    expect(result.result.checks.errorCode.value).toBe('00015');
    expect(result.reject).toBe(true);
  });

  // ═══════════════════════════════════════════════════════════════
  // BONUS TEST 6: Signature absente → reject en strict
  // (signature fait partie des checks critiques)
  // ═══════════════════════════════════════════════════════════════
  it('should reject when signature is missing in strict mode', async () => {
    const query = { Mt: '10050', Ref: 'ORD-123', Erreur: '00000' };
    const rawQuery = 'Mt=10050&Ref=ORD-123&Erreur=00000';

    mockOrderExists({
      ord_id: '123',
      ord_total_ttc: '100.50',
      ord_is_pay: '0',
    });

    const result = await service.validateCallback(rawQuery, query, {
      amount: '10050',
      orderReference: 'ORD-123',
      errorCode: '00000',
    });

    expect(result.result.checks.signature.present).toBe(false);
    expect(result.result.checks.signature.ok).toBe(false);
    // Signature is critical — missing = reject in strict
    expect(result.reject).toBe(true);
  });

  // ═══════════════════════════════════════════════════════════════
  // BONUS TEST 7: Merchant ID mismatch (anti-test callback in prod)
  // ═══════════════════════════════════════════════════════════════
  it('should reject when merchant ID does not match (anti-test callback)', async () => {
    const query = {
      Mt: '10050',
      Ref: 'ORD-123',
      Erreur: '00000',
      PBX_SITE: '1999888', // Test site, not matching expected 5259250
      K: 'fakesig',
    };
    const rawQuery = 'Mt=10050&Ref=ORD-123&Erreur=00000&PBX_SITE=1999888&K=fakesig';

    mockOrderExists({
      ord_id: '123',
      ord_total_ttc: '100.50',
      ord_is_pay: '0',
    });

    const result = await service.validateCallback(rawQuery, query, {
      amount: '10050',
      orderReference: 'ORD-123',
      errorCode: '00000',
      signature: 'fakesig',
    });

    expect(result.result.checks.merchantId.ok).toBe(false);
    expect(result.result.checks.merchantId.siteMatch).toBe(false);
    expect(result.reject).toBe(true);
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 8: No &K= separator in rawQuery → RSA returns NO_K_SEPARATOR
  // ═══════════════════════════════════════════════════════════════
  it('should handle missing K separator in raw query string', async () => {
    const query = { Mt: '10050', Ref: 'ORD-123', Erreur: '00000', Signature: 'somesig' };
    // No &K= in rawQuery — use Signature key instead
    const rawQuery = 'Mt=10050&Ref=ORD-123&Erreur=00000&Signature=somesig';

    mockOrderExists({
      ord_id: '123',
      ord_total_ttc: '100.50',
      ord_is_pay: '0',
    });

    const result = await service.validateCallback(rawQuery, query, {
      amount: '10050',
      orderReference: 'ORD-123',
      errorCode: '00000',
      signature: 'somesig',
    });

    expect(result.result.checks.signature.ok).toBe(false);
    expect(result.result.checks.signature.reason).toBe('NO_K_SEPARATOR');
  });
});
