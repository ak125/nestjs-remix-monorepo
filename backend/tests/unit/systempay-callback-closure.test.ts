/**
 * Mandat AY (2026-11-16) — routes SystemPay/Cyberplus fermées par défaut.
 *
 * Le certificat SystemPay est exposé dans l'historique public du dépôt. Tant
 * que SYSTEMPAY_CALLBACK_ENABLED ne vaut pas exactement `true` :
 *   - POST /api/payments/callback/cyberplus répond 410 sans valider, sans
 *     écrire ic_postback, sans vérifier de signature, sans toucher au paiement ;
 *   - POST /api/payments/callback/error répond 410 sans passer de paiement
 *     en FAILED ;
 *   - GET /api/systempay/redirect répond 410 sans générer de formulaire ;
 *   - GET /api/payments/methods/available ne propose plus Cyberplus.
 * Avec la variable à `true`, le comportement antérieur revient à l'identique.
 *
 * @see backend/src/modules/payments/utils/systempay-closure.ts
 */
import { Logger } from '@nestjs/common';
import paymentConfigFactory, {
  PaymentMode,
  type PaymentConfig,
} from '../../src/config/payment.config';
import { CyberplusService } from '../../src/modules/payments/services/cyberplus.service';
import { PaymentCallbackController } from '../../src/modules/payments/controllers/payment-callback.controller';
import { SystemPayRedirectController } from '../../src/modules/payments/controllers/systempay-redirect.controller';
import { PaymentMethodsController } from '../../src/modules/payments/controllers/payment-methods.controller';
import { PaymentStatus } from '../../src/modules/payments/entities/payment.entity';

// Valeurs factices : aucun secret réel n'est lu ni écrit par ce test.
const CONFIG_ENV = {
  SYSTEMPAY_SITE_ID: 'site-fictif',
  SYSTEMPAY_CERTIFICATE_PROD: 'cert-fictif-prod',
  SYSTEMPAY_CERTIFICATE_TEST: 'cert-fictif-test',
  APP_URL: 'http://localhost:3000',
};

const CUSTOMER_MARKERS = ['CMD-778899', 'client@example.test', 'TX-445566'];

const signedLookingCallback = {
  vads_order_id: 'CMD-778899',
  vads_trans_id: 'TX-445566',
  vads_trans_status: 'AUTHORISED',
  vads_amount: '12345',
  vads_cust_email: 'client@example.test',
  signature: 'signature-quelconque',
};

function buildConfig(callbackEnabled?: boolean): PaymentConfig {
  return {
    systempay: {
      siteId: 'site-fictif',
      certificate: 'cert-fictif',
      certificateTest: 'cert-fictif',
      signatureMethod: 'HMAC',
      mode: PaymentMode.TEST,
      apiUrl: 'https://paiement.systempay.fr/vads-payment/',
      ...(callbackEnabled === undefined ? {} : { callbackEnabled }),
    },
    app: {
      url: 'http://localhost:3000',
      callbackPath: '/api/payments/callback',
    },
  };
}

function cyberplusFor(callbackEnabled?: boolean): CyberplusService {
  const configService = { get: jest.fn(() => buildConfig(callbackEnabled)) };
  return new CyberplusService(configService as any);
}

function mockResponse() {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.send = jest.fn(() => res);
  res.setHeader = jest.fn(() => res);
  return res;
}

function callbackDeps(enabled: boolean) {
  const insert = jest.fn(async () => ({ error: null }));
  const cyberplus = cyberplusFor(enabled);
  jest.spyOn(cyberplus, 'validateCallback').mockReturnValue(true);
  const paymentService = {
    handlePaymentCallback: jest.fn(async () => ({
      id: 'pay_1',
      status: 'completed',
    })),
    getPaymentByOrderId: jest.fn(async () => ({
      id: 'pay_1',
      status: PaymentStatus.PENDING,
    })),
    updatePaymentStatus: jest.fn(async () => undefined),
  };
  const paymentDataService = {
    supabase: { from: jest.fn(() => ({ insert })) },
  };
  const controller = new PaymentCallbackController(
    paymentService as any,
    cyberplus,
    paymentDataService as any,
  );
  return { controller, cyberplus, paymentService, paymentDataService, insert };
}

function warnMessages(spy: jest.SpyInstance): string {
  return spy.mock.calls.map((c) => String(c[0])).join('\n');
}

let warnSpy: jest.SpyInstance;
beforeEach(() => {
  warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('payment.config — SYSTEMPAY_CALLBACK_ENABLED', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it.each([
    [undefined, false],
    ['', false],
    ['false', false],
    ['TRUE', false],
    ['1', false],
    ['yes', false],
    ['true', true],
  ])('value %p → callbackEnabled %p', (value, expected) => {
    process.env = { ...saved, ...CONFIG_ENV, READ_ONLY: 'false' };
    if (value === undefined) delete process.env.SYSTEMPAY_CALLBACK_ENABLED;
    else process.env.SYSTEMPAY_CALLBACK_ENABLED = value;
    expect(paymentConfigFactory().systempay.callbackEnabled).toBe(expected);
  });

  it('read-only mode is closed by default too', () => {
    process.env = { ...saved, READ_ONLY: 'true' };
    delete process.env.SYSTEMPAY_CALLBACK_ENABLED;
    expect(paymentConfigFactory().systempay.callbackEnabled).toBe(false);
  });
});

describe('CyberplusService.isCallbackEnabled', () => {
  it('closed when the field is absent, false, or anything but true', () => {
    expect(cyberplusFor(undefined).isCallbackEnabled()).toBe(false);
    expect(cyberplusFor(false).isCallbackEnabled()).toBe(false);
    expect(cyberplusFor(true).isCallbackEnabled()).toBe(true);
  });
});

describe('POST /api/payments/callback/cyberplus', () => {
  it('closed by default: 410, nothing validated, written or updated', async () => {
    const { controller, cyberplus, paymentService, paymentDataService } =
      callbackDeps(false);
    const res = mockResponse();

    const out = await controller.handleCyberplusCallback(
      { ...signedLookingCallback },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(410);
    expect(out).toEqual({
      statusCode: 410,
      error: 'Gone',
      message: 'SystemPay is disabled on this server',
    });
    expect(cyberplus.validateCallback).not.toHaveBeenCalled();
    expect(paymentDataService.supabase.from).not.toHaveBeenCalled();
    expect(paymentService.handlePaymentCallback).not.toHaveBeenCalled();
  });

  it('closed refusal is logged with the route only, no customer data', async () => {
    const { controller } = callbackDeps(false);
    await controller.handleCyberplusCallback(
      { ...signedLookingCallback },
      mockResponse(),
    );
    const logged = warnMessages(warnSpy);
    expect(logged).toContain('REFUSED POST /api/payments/callback/cyberplus');
    for (const marker of CUSTOMER_MARKERS) {
      expect(logged).not.toContain(marker);
    }
  });

  it('explicitly enabled: previous processing path runs unchanged', async () => {
    const { controller, cyberplus, paymentService, insert } =
      callbackDeps(true);
    const res = mockResponse();

    const out = await controller.handleCyberplusCallback(
      { ...signedLookingCallback },
      res,
    );

    expect(res.status).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledTimes(1);
    expect(cyberplus.validateCallback).toHaveBeenCalledTimes(1);
    expect(paymentService.handlePaymentCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentReference: 'CMD-778899',
        transactionId: 'TX-445566',
        status: 'AUTHORISED',
      }),
    );
    expect(out).toEqual(
      expect.objectContaining({ success: true, paymentId: 'pay_1' }),
    );
  });
});

describe('POST /api/payments/callback/error', () => {
  it('closed by default: 410, no payment moved to FAILED', async () => {
    const { controller, paymentService } = callbackDeps(false);
    const res = mockResponse();

    const out = await controller.handleErrorReturn(
      { order_id: 'CMD-778899', error: 'x' },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(410);
    expect(out).toEqual(expect.objectContaining({ statusCode: 410 }));
    expect(paymentService.getPaymentByOrderId).not.toHaveBeenCalled();
    expect(paymentService.updatePaymentStatus).not.toHaveBeenCalled();
    expect(warnMessages(warnSpy)).not.toContain('CMD-778899');
  });

  it('explicitly enabled: a PENDING payment is marked FAILED as before', async () => {
    const { controller, paymentService } = callbackDeps(true);

    await controller.handleErrorReturn(
      { order_id: 'CMD-778899', error: 'x' },
      mockResponse(),
    );

    expect(paymentService.updatePaymentStatus).toHaveBeenCalledWith(
      'pay_1',
      PaymentStatus.FAILED,
    );
  });
});

describe('GET /api/systempay/redirect', () => {
  function redirectFor(enabled: boolean) {
    const cyberplus = cyberplusFor(enabled);
    jest
      .spyOn(cyberplus, 'generatePaymentForm')
      .mockReturnValue({ html: '<form></form>' } as any);
    const configService = { get: jest.fn(() => 'http://localhost:3000') };
    return {
      cyberplus,
      controller: new SystemPayRedirectController(
        cyberplus,
        configService as any,
      ),
    };
  }

  it('closed by default: 410 JSON, no SystemPay form generated', async () => {
    const { controller, cyberplus } = redirectFor(false);
    const res = mockResponse();

    await controller.redirect(
      'CMD-778899',
      '123.45',
      'client@example.test',
      res,
    );

    expect(res.status).toHaveBeenCalledWith(410);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 410 }),
    );
    expect(cyberplus.generatePaymentForm).not.toHaveBeenCalled();
    const logged = warnMessages(warnSpy);
    for (const marker of CUSTOMER_MARKERS) {
      expect(logged).not.toContain(marker);
    }
  });

  it('explicitly enabled: the SystemPay form is served as before', async () => {
    const { controller, cyberplus } = redirectFor(true);
    const res = mockResponse();

    await controller.redirect(
      'CMD-778899',
      '123.45',
      'client@example.test',
      res,
    );

    expect(cyberplus.generatePaymentForm).toHaveBeenCalledTimes(1);
    expect(res.send).toHaveBeenCalledWith('<form></form>');
  });
});

describe('GET /api/payments/methods/available', () => {
  async function methodIds(enabled: boolean): Promise<string[]> {
    const controller = new PaymentMethodsController(
      {} as any,
      {} as any,
      cyberplusFor(enabled),
    );
    const out = await controller.getAvailablePaymentMethods();
    return out.data.map((m: { id: string }) => m.id);
  }

  it('closed by default: Cyberplus is not offered to the customer', async () => {
    const ids = await methodIds(false);
    expect(ids).not.toContain('cyberplus');
    expect(ids.length).toBeGreaterThan(0);
  });

  it('explicitly enabled: Cyberplus is offered again', async () => {
    expect(await methodIds(true)).toContain('cyberplus');
  });
});
