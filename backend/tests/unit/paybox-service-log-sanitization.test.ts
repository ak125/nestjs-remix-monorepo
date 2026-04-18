/**
 * PayboxService — log sanitization unit tests
 *
 * Garantit que les logs de PayboxService ne fuitent AUCUNE donnée sensible :
 *   - PBX_SITE       (merchant ID)
 *   - PBX_IDENTIFIANT (merchant ID)
 *   - PBX_PORTEUR    (email client = PII)
 *   - HMAC_KEY       (secret HMAC-SHA512)
 *   - Signature HMAC  calculée (résultat non plus puisque 20/128 chars = 15%
 *                                du secret était exposé dans la version v1)
 *
 * Contexte : CVE interne post-incident 2026-04-14. Les logs INFO Docker
 * contenaient `Signature string: PBX_SITE=...&PBX_IDENTIFIANT=...&PBX_PORTEUR=...`
 * sur 100 chars. N'importe qui avec accès host aurait lu les merchant IDs
 * Paybox + les emails clients en clair.
 *
 * Ce test capture tous les appels Logger.log/warn et assert que les secrets
 * bien connus du test n'apparaissent jamais dans aucun log.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { PayboxService } from '../../src/modules/payments/services/paybox.service';

describe('PayboxService — log sanitization', () => {
  // Valeurs sentinelles reconnaissables pour detection via assert
  const SENTINEL_SITE = '9999999SITEX';
  const SENTINEL_IDENT = '8888888IDENTY';
  const SENTINEL_EMAIL = 'pii-leak-canary@example.test';
  const SENTINEL_HMAC_KEY = Buffer.from('deadbeef'.repeat(16)).toString('hex');

  const mockConfig = {
    get: jest.fn((key: string, def?: string) => {
      const cfg: Record<string, string> = {
        PAYBOX_SITE: SENTINEL_SITE,
        PAYBOX_RANG: '042',
        PAYBOX_IDENTIFIANT: SENTINEL_IDENT,
        PAYBOX_HMAC_KEY: SENTINEL_HMAC_KEY,
        PAYBOX_MODE: 'PRODUCTION',
        PAYBOX_PAYMENT_URL: 'https://tpeweb.paybox.com/cgi/test.cgi',
        BASE_URL: 'https://www.automecanik.test',
      };
      return cfg[key] ?? def ?? '';
    }),
  };

  let service: PayboxService;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  const allLogMessages = (): string[] => [
    ...logSpy.mock.calls.map((c) => String(c[0])),
    ...warnSpy.mock.calls.map((c) => String(c[0])),
  ];

  beforeEach(async () => {
    // Spy sur le prototype Logger AVANT instanciation du service
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayboxService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<PayboxService>(PayboxService);
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('constructor ne doit pas loguer PBX_SITE en clair', () => {
    const joined = allLogMessages().join('\n');
    expect(joined).not.toContain(SENTINEL_SITE);
  });

  it('constructor ne doit pas loguer PBX_IDENTIFIANT en clair', () => {
    const joined = allLogMessages().join('\n');
    expect(joined).not.toContain(SENTINEL_IDENT);
  });

  it("constructor peut loguer un suffixe masqué (last 3 chars) pour disambiguer", () => {
    const joined = allLogMessages().join('\n');
    // Le log doit contenir soit site=***XXX soit une forme masquée
    // On teste que la forme "Paybox account" est présente (signal log existe)
    expect(joined).toMatch(/Paybox account|Paybox configure/i);
    // Et que les 3 derniers chars sont visibles pour debugging
    expect(joined).toContain(SENTINEL_SITE.slice(-3));
    // Mais PAS le site complet
    expect(joined).not.toContain(SENTINEL_SITE);
  });

  it('generatePaymentForm ne doit pas loguer PBX_SITE en clair', () => {
    service.generatePaymentForm({
      amount: 42.99,
      currency: 'EUR',
      orderId: 'ORD-TEST-1',
      customerEmail: SENTINEL_EMAIL,
      returnUrl: '',
      cancelUrl: '',
      notifyUrl: '',
    });
    const joined = allLogMessages().join('\n');
    expect(joined).not.toContain(SENTINEL_SITE);
  });

  it('generatePaymentForm ne doit pas loguer PBX_IDENTIFIANT en clair', () => {
    service.generatePaymentForm({
      amount: 42.99,
      currency: 'EUR',
      orderId: 'ORD-TEST-2',
      customerEmail: SENTINEL_EMAIL,
      returnUrl: '',
      cancelUrl: '',
      notifyUrl: '',
    });
    const joined = allLogMessages().join('\n');
    expect(joined).not.toContain(SENTINEL_IDENT);
  });

  it("generatePaymentForm ne doit pas loguer l'email client (PII)", () => {
    service.generatePaymentForm({
      amount: 42.99,
      currency: 'EUR',
      orderId: 'ORD-TEST-3',
      customerEmail: SENTINEL_EMAIL,
      returnUrl: '',
      cancelUrl: '',
      notifyUrl: '',
    });
    const joined = allLogMessages().join('\n');
    expect(joined).not.toContain(SENTINEL_EMAIL);
  });

  it('generatePaymentForm ne doit pas loguer la signature HMAC calculée (ni partiellement)', () => {
    const result = service.generatePaymentForm({
      amount: 42.99,
      currency: 'EUR',
      orderId: 'ORD-TEST-4',
      customerEmail: SENTINEL_EMAIL,
      returnUrl: '',
      cancelUrl: '',
      notifyUrl: '',
    });
    const hmac = result.parameters.PBX_HMAC;
    expect(hmac).toBeDefined();
    expect(hmac.length).toBe(128); // SHA512 hex = 128 chars

    const joined = allLogMessages().join('\n');
    // Aucune fraction de 8+ chars de la signature ne doit apparaître dans les logs
    for (let i = 0; i + 16 <= hmac.length; i += 16) {
      const chunk = hmac.substring(i, i + 16);
      expect(joined).not.toContain(chunk);
    }
  });

  it('generatePaymentForm ne doit pas loguer la HMAC_KEY (secret)', () => {
    service.generatePaymentForm({
      amount: 42.99,
      currency: 'EUR',
      orderId: 'ORD-TEST-5',
      customerEmail: SENTINEL_EMAIL,
      returnUrl: '',
      cancelUrl: '',
      notifyUrl: '',
    });
    const joined = allLogMessages().join('\n');
    expect(joined).not.toContain(SENTINEL_HMAC_KEY);
    // Et pas non plus une sous-chaîne de 16 chars de la key
    for (let i = 0; i + 16 <= SENTINEL_HMAC_KEY.length; i += 16) {
      const chunk = SENTINEL_HMAC_KEY.substring(i, i + 16);
      expect(joined).not.toContain(chunk);
    }
  });

  it('generatePaymentForm peut loguer des métadonnées structurelles (length, param count)', () => {
    service.generatePaymentForm({
      amount: 42.99,
      currency: 'EUR',
      orderId: 'ORD-TEST-6',
      customerEmail: SENTINEL_EMAIL,
      returnUrl: '',
      cancelUrl: '',
      notifyUrl: '',
    });
    const joined = allLogMessages().join('\n');
    // On veut garder un log utile pour debugging — pas de secret
    expect(joined).toMatch(/Signature string built.*length=/i);
    expect(joined).toMatch(/HMAC signature computed.*length=128/i);
  });

  it('generatePaymentForm retourne bien un formulaire valide (non-régression)', () => {
    const result = service.generatePaymentForm({
      amount: 42.99,
      currency: 'EUR',
      orderId: 'ORD-TEST-7',
      customerEmail: SENTINEL_EMAIL,
      returnUrl: '',
      cancelUrl: '',
      notifyUrl: '',
    });
    expect(result.url).toBe('https://tpeweb.paybox.com/cgi/test.cgi');
    expect(result.parameters.PBX_SITE).toBe(SENTINEL_SITE);
    expect(result.parameters.PBX_IDENTIFIANT).toBe(SENTINEL_IDENT);
    expect(result.parameters.PBX_PORTEUR).toBe(SENTINEL_EMAIL);
    expect(result.parameters.PBX_TOTAL).toBe('4299');
    expect(result.parameters.PBX_HMAC).toBeDefined();
    expect(result.parameters.PBX_HMAC.length).toBe(128);
  });
});
