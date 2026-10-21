/**
 * Consentement marketing (ADR-036) — `___xtr_customer.cst_marketing_consent_at`
 * + `cst_marketing_consent_source`, posés et retirés ensemble.
 *
 * Défauts corrigés :
 *  - la case « Je souhaite recevoir les offres et actualités AutoMecanik » de
 *    l'inscription était envoyée par le front, mais aucun parcours ne la lisait ;
 *  - la page Paramètres n'avait aucune source à lire ni à écrire ;
 *  - la relance panier abandonné ne vérifiait aucun consentement.
 *
 * Ce test verrouille :
 *  - inscription (formulaire et JSON) : consentement écrit dans la même
 *    insertion que le compte, source `register`, et seulement si la case est
 *    cochée ;
 *  - Paramètres : lecture et écriture par le client connecté, source fixée
 *    côté serveur (`account_settings`), corps strict, erreur base → 500 ;
 *  - pas de ré-horodatage d'un consentement déjà donné ; le retrait efface
 *    les deux colonnes ;
 *  - relance panier : aucun e-mail sans consentement, ni à la détection ni à
 *    l'envoi ; une erreur de lecture n'est jamais lue comme un accord.
 *
 * @see backend/supabase/migrations/20261019_customer_marketing_consent.sql
 * @see backend/src/modules/users/services/user-data-consolidated.service.ts
 * @see backend/src/modules/users/users-final.controller.ts
 * @see backend/src/auth/controllers/auth-login.controller.ts
 * @see backend/src/modules/cart/services/abandoned-cart.service.ts
 */

import 'reflect-metadata';
import type { Response } from 'express';
import { AuthLoginController } from '../../src/auth/controllers/auth-login.controller';
import RegisterSchema from '../../src/auth/dto/register.dto';
import { UsersFinalController } from '../../src/modules/users/users-final.controller';
import { UserDataConsolidatedService } from '../../src/modules/users/services/user-data-consolidated.service';
import { AbandonedCartService } from '../../src/modules/cart/services/abandoned-cart.service';
import { AbandonedCartDataService } from '../../src/modules/cart/services/abandoned-cart-data.service';

type Result = { data: unknown; error: unknown };

/** Chaîne Supabase factice : enregistre les appels, rend les résultats dans l'ordre. */
function supabaseChain(results: Result[]) {
  const calls: Array<[string, unknown[]]> = [];
  const queue = [...results];
  const chain: Record<string, (...args: unknown[]) => unknown> = {};
  for (const method of ['from', 'select', 'eq', 'limit', 'insert', 'update']) {
    chain[method] = (...args: unknown[]) => {
      calls.push([method, args]);
      return chain;
    };
  }
  const settle = () => Promise.resolve(queue.shift());
  chain.single = settle;
  chain.maybeSingle = settle;
  const payloadOf = (method: 'insert' | 'update') =>
    calls.filter(([m]) => m === method).map(([, args]) => args[0]);
  return { client: chain, calls, payloadOf };
}

function withSupabase<T extends object>(
  proto: T,
  results: Result[],
): { service: T; payloadOf: (m: 'insert' | 'update') => unknown[] } {
  const service = Object.create(proto) as T;
  const { client, payloadOf } = supabaseChain(results);
  Object.defineProperty(service, 'supabase', { value: client });
  Object.defineProperty(service, 'logger', {
    value: { error: jest.fn(), log: jest.fn(), warn: jest.fn() },
  });
  return { service, payloadOf };
}

const CONSENTED_ROW = {
  cst_marketing_consent_at: '2026-10-19T10:00:00.000Z',
  cst_marketing_consent_source: 'register',
};
const NO_CONSENT_ROW = {
  cst_marketing_consent_at: null,
  cst_marketing_consent_source: null,
};

// ── Inscription ────────────────────────────────────────────────────────────

function authController() {
  const userDataService = {
    create: jest.fn().mockResolvedValue({ id: 'usr_1' }),
  };
  // Le login échoue volontairement : seul l'appel de création est observé.
  const authService = {
    login: jest.fn().mockRejectedValue(new Error('stop after create')),
  };
  const controller = new AuthLoginController(
    {} as never,
    authService as never,
    userDataService as never,
    {} as never,
    {} as never,
  );
  return { controller, userDataService };
}

function registerForm(extra: Record<string, string> = {}) {
  return {
    body: {
      email: 'Client@Example.invalid',
      password: 'secret123',
      confirmPassword: 'secret123',
      firstName: 'Jean',
      lastName: 'Martin',
      ...extra,
    },
    session: {},
  } as unknown as Express.Request;
}

const redirectOnly = () => ({ redirect: jest.fn() }) as unknown as Response;

describe('POST /register-and-login — case de consentement', () => {
  it('cochée : consentement écrit à la création, source `register`', async () => {
    const { controller, userDataService } = authController();

    await controller.registerAndLogin(
      registerForm({ newsletterOptIn: 'on' }),
      redirectOnly(),
    );

    expect(userDataService.create).toHaveBeenCalledTimes(1);
    expect(userDataService.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'client@example.invalid' }),
      { marketingConsentSource: 'register' },
    );
  });

  it.each([
    ['absente', {}],
    ['valeur autre que « on »', { newsletterOptIn: 'true' }],
  ])('%s : aucun consentement', async (_label, extra) => {
    const { controller, userDataService } = authController();

    await controller.registerAndLogin(registerForm(extra), redirectOnly());

    expect(userDataService.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'client@example.invalid' }),
      {},
    );
  });
});

describe('POST /auth/register — newsletterOptIn', () => {
  const payload = {
    email: 'client@example.invalid',
    password: 'secret123',
    firstName: 'Jean',
    lastName: 'Martin',
  };

  it('le schéma conserve le champ au lieu de le retirer', () => {
    expect(
      RegisterSchema.parse({ ...payload, newsletterOptIn: true }),
    ).toMatchObject({ newsletterOptIn: true });
    expect(
      RegisterSchema.safeParse({ ...payload, newsletterOptIn: 'on' }).success,
    ).toBe(false);
  });

  it.each([
    [true, { marketingConsentSource: 'register' }],
    [false, {}],
    [undefined, {}],
  ])('newsletterOptIn=%s → options %j', async (optIn, expected) => {
    const { controller, userDataService } = authController();

    await controller.register(
      RegisterSchema.parse({ ...payload, newsletterOptIn: optIn }),
      { session: {} } as never,
    );

    expect(userDataService.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: payload.email }),
      expected,
    );
  });
});

// ── Couche données ─────────────────────────────────────────────────────────

describe('UserDataConsolidatedService — écriture du consentement', () => {
  const proto = UserDataConsolidatedService.prototype;
  const newUser = {
    email: 'client@example.invalid',
    password: 'secret123',
    firstName: 'Jean',
  };
  const insertedRow = { cst_id: 'usr_1', cst_mail: newUser.email };

  it('create avec source : date et source dans la même insertion', async () => {
    const { service, payloadOf } = withSupabase(proto, [
      { data: null, error: null }, // pas de doublon d'e-mail
      { data: insertedRow, error: null },
    ]);

    await service.create(newUser, { marketingConsentSource: 'register' });

    const [inserted] = payloadOf('insert') as Array<Record<string, unknown>>;
    expect(inserted.cst_marketing_consent_source).toBe('register');
    expect(
      Date.parse(inserted.cst_marketing_consent_at as string),
    ).not.toBeNaN();
  });

  it('create sans source : aucune colonne de consentement', async () => {
    const { service, payloadOf } = withSupabase(proto, [
      { data: null, error: null },
      { data: insertedRow, error: null },
    ]);

    await service.create(newUser);

    const [inserted] = payloadOf('insert') as Array<Record<string, unknown>>;
    expect(Object.keys(inserted)).not.toEqual(
      expect.arrayContaining(['cst_marketing_consent_at']),
    );
    expect(Object.keys(inserted)).not.toEqual(
      expect.arrayContaining(['cst_marketing_consent_source']),
    );
  });

  it('get : erreur base levée, jamais « pas de consentement »', async () => {
    const { service } = withSupabase(proto, [
      { data: null, error: { message: 'connection refused' } },
    ]);

    await expect(service.getMarketingConsent('usr_1')).rejects.toThrow(
      /connection refused/,
    );
  });

  it('get : client introuvable levé', async () => {
    const { service } = withSupabase(proto, [{ data: null, error: null }]);

    await expect(service.getMarketingConsent('usr_1')).rejects.toThrow(
      /introuvable/,
    );
  });

  it('get : état lu tel quel', async () => {
    const { service } = withSupabase(proto, [
      { data: CONSENTED_ROW, error: null },
    ]);

    await expect(service.getMarketingConsent('usr_1')).resolves.toEqual({
      granted: true,
      grantedAt: CONSENTED_ROW.cst_marketing_consent_at,
      source: 'register',
    });
  });

  it('get : source hors contrat levée', async () => {
    const { service } = withSupabase(proto, [
      {
        data: { ...CONSENTED_ROW, cst_marketing_consent_source: 'newsletter' },
        error: null,
      },
    ]);

    await expect(service.getMarketingConsent('usr_1')).rejects.toThrow();
  });

  it('set : déjà donné → aucune écriture, date et source d’origine gardées', async () => {
    const { service, payloadOf } = withSupabase(proto, [
      { data: CONSENTED_ROW, error: null },
    ]);

    await expect(
      service.setMarketingConsent('usr_1', true, 'account_settings'),
    ).resolves.toMatchObject({ granted: true, source: 'register' });
    expect(payloadOf('update')).toHaveLength(0);
  });

  it('set : donner depuis les Paramètres', async () => {
    const { service, payloadOf } = withSupabase(proto, [
      { data: NO_CONSENT_ROW, error: null },
      {
        data: {
          cst_marketing_consent_at: '2026-10-19T11:00:00.000Z',
          cst_marketing_consent_source: 'account_settings',
        },
        error: null,
      },
    ]);

    await expect(
      service.setMarketingConsent('usr_1', true, 'account_settings'),
    ).resolves.toMatchObject({ granted: true, source: 'account_settings' });
    const [update] = payloadOf('update') as Array<Record<string, unknown>>;
    expect(update.cst_marketing_consent_source).toBe('account_settings');
    expect(Date.parse(update.cst_marketing_consent_at as string)).not.toBeNaN();
  });

  it('set : le retrait efface les deux colonnes', async () => {
    const { service, payloadOf } = withSupabase(proto, [
      { data: CONSENTED_ROW, error: null },
      { data: NO_CONSENT_ROW, error: null },
    ]);

    await expect(
      service.setMarketingConsent('usr_1', false, 'account_settings'),
    ).resolves.toEqual({ granted: false, grantedAt: null, source: null });
    expect(payloadOf('update')).toEqual([NO_CONSENT_ROW]);
  });

  it('set : erreur d’écriture levée', async () => {
    const { service } = withSupabase(proto, [
      { data: NO_CONSENT_ROW, error: null },
      { data: null, error: { message: 'check violation' } },
    ]);

    await expect(
      service.setMarketingConsent('usr_1', true, 'account_settings'),
    ).rejects.toThrow(/check violation/);
  });
});

// ── Paramètres du compte ───────────────────────────────────────────────────

describe('/api/users/profile/marketing-consent', () => {
  const consent = { granted: true, grantedAt: 'x', source: 'account_settings' };

  function usersController() {
    const usersService = {
      getMarketingConsent: jest.fn().mockResolvedValue(consent),
      setMarketingConsent: jest.fn().mockResolvedValue(consent),
    };
    const controller = new UsersFinalController(usersService as never);
    return { controller, usersService };
  }

  const req = (userId?: string) =>
    ({ user: userId ? { id: userId } : undefined }) as never;

  it('GET : état du client connecté', async () => {
    const { controller, usersService } = usersController();

    await expect(controller.getMarketingConsent(req('usr_1'))).resolves.toEqual(
      { success: true, data: consent },
    );
    expect(usersService.getMarketingConsent).toHaveBeenCalledWith('usr_1');
  });

  it('GET : erreur de lecture → 500', async () => {
    const { controller, usersService } = usersController();
    usersService.getMarketingConsent.mockRejectedValue(new Error('db down'));

    await expect(
      controller.getMarketingConsent(req('usr_1')),
    ).rejects.toMatchObject({ status: 500 });
  });

  it.each([true, false])(
    'PUT granted=%s : source fixée à account_settings',
    async (granted) => {
      const { controller, usersService } = usersController();

      await controller.updateMarketingConsent(req('usr_1'), { granted });

      expect(usersService.setMarketingConsent).toHaveBeenCalledWith(
        'usr_1',
        granted,
        'account_settings',
      );
    },
  );

  it.each([
    ['corps vide', {}],
    ['chaîne au lieu d’un booléen', { granted: 'on' }],
    ['source imposée par le client', { granted: true, source: 'register' }],
  ])('PUT %s → 400, rien écrit', async (_label, body) => {
    const { controller, usersService } = usersController();

    await expect(
      controller.updateMarketingConsent(req('usr_1'), body),
    ).rejects.toMatchObject({ status: 400 });
    expect(usersService.setMarketingConsent).not.toHaveBeenCalled();
  });

  it('PUT : erreur d’écriture → 500', async () => {
    const { controller, usersService } = usersController();
    usersService.setMarketingConsent.mockRejectedValue(new Error('db down'));

    await expect(
      controller.updateMarketingConsent(req('usr_1'), { granted: true }),
    ).rejects.toMatchObject({ status: 500 });
  });

  it.each(['get', 'put'])('%s anonyme → 401', async (verb) => {
    const { controller, usersService } = usersController();
    const call =
      verb === 'get'
        ? controller.getMarketingConsent(req())
        : controller.updateMarketingConsent(req(), { granted: true });

    await expect(call).rejects.toMatchObject({ status: 401 });
    expect(usersService.getMarketingConsent).not.toHaveBeenCalled();
    expect(usersService.setMarketingConsent).not.toHaveBeenCalled();
  });
});

// ── Relance panier abandonné ───────────────────────────────────────────────

describe('AbandonedCartDataService.hasMarketingConsent', () => {
  const proto = AbandonedCartDataService.prototype;

  it('erreur base levée, jamais lue comme un accord', async () => {
    const { service } = withSupabase(proto, [
      { data: null, error: { message: 'connection refused' } },
    ]);

    await expect(service.hasMarketingConsent(42)).rejects.toThrow(
      /connection refused/,
    );
  });

  it.each([
    ['client introuvable', false, null],
    ['sans consentement', false, { cst_marketing_consent_at: null }],
    ['consentement daté', true, CONSENTED_ROW],
  ])('%s → %s', async (_label, expected, data) => {
    const { service } = withSupabase(proto, [{ data, error: null }]);

    await expect(service.hasMarketingConsent(42)).resolves.toBe(expected);
  });
});

describe('AbandonedCartService — aucune relance sans consentement', () => {
  const CANDIDATE = { userId: 42, sessionId: 's-42', timestamp: 0 };

  function scanner(consent: () => Promise<boolean>) {
    const emailQueue = { add: jest.fn().mockResolvedValue(undefined) };
    const cache = {
      get: jest.fn((key: string) =>
        Promise.resolve(
          key === 'abandoned-cart:candidates' ? [CANDIDATE] : null,
        ),
      ),
      set: jest.fn().mockResolvedValue(undefined),
    };
    const cartData = {
      getCartWithMetadata: jest.fn().mockResolvedValue({
        items: [{ product_name: 'Disque' }],
        stats: { subtotal: 10 },
      }),
    };
    const data = {
      hasMarketingConsent: jest.fn(consent),
      findRecentByCstId: jest.fn().mockResolvedValue(null),
      getCustomerEmail: jest
        .fn()
        .mockResolvedValue({ cst_mail: 'client@example.invalid' }),
      insert: jest.fn().mockResolvedValue({ id: 'rec-1' }),
    };
    const service = new AbandonedCartService(
      emailQueue as never,
      cache as never,
      cartData as never,
      data as never,
      { abandonedCartEmailEnabled: true } as never,
      {} as never,
    );
    return { service, emailQueue, cache, data };
  }

  it('détection : client consentant → séquence programmée', async () => {
    const { service, emailQueue, data } = scanner(() => Promise.resolve(true));

    await expect(service.scanAndEnqueue()).resolves.toEqual({
      detected: 1,
      enqueued: 1,
    });
    expect(data.hasMarketingConsent).toHaveBeenCalledWith(42);
    expect(emailQueue.add).toHaveBeenCalledTimes(3);
  });

  it('détection : sans consentement → rien capturé, rien programmé', async () => {
    const { service, emailQueue, data } = scanner(() => Promise.resolve(false));

    await expect(service.scanAndEnqueue()).resolves.toEqual({
      detected: 0,
      enqueued: 0,
    });
    expect(data.insert).not.toHaveBeenCalled();
    expect(emailQueue.add).not.toHaveBeenCalled();
  });

  it('détection : lecture impossible → candidat gardé pour le prochain passage', async () => {
    const { service, emailQueue, cache, data } = scanner(() =>
      Promise.reject(new Error('db down')),
    );

    await service.scanAndEnqueue();

    expect(data.insert).not.toHaveBeenCalled();
    expect(emailQueue.add).not.toHaveBeenCalled();
    expect(cache.set).toHaveBeenCalledWith(
      'abandoned-cart:candidates',
      [CANDIDATE],
      expect.any(Number),
    );
  });

  function sender(consent: () => Promise<boolean>) {
    const data = {
      findById: jest.fn().mockResolvedValue({
        id: 'rec-1',
        cst_id: 42,
        cst_mail: 'client@example.invalid',
        cst_fname: 'Client',
        cart_snapshot: [],
        cart_subtotal: 10,
        cart_item_count: 1,
        recovery_token: 'a'.repeat(64),
        email_1h_sent_at: null,
        status: 'detected',
        expires_at: '2999-01-01T00:00:00Z',
      }),
      isUnsubscribedByCstId: jest.fn().mockResolvedValue(false),
      hasMarketingConsent: jest.fn(consent),
      updateEmailSent: jest.fn().mockResolvedValue(undefined),
    };
    const mail = {
      sendAbandonedCartEmail: jest.fn().mockResolvedValue('sent'),
    };
    const service = new AbandonedCartService(
      {} as never,
      { get: jest.fn().mockResolvedValue(null), set: jest.fn() } as never,
      {} as never,
      data as never,
      {} as never,
      mail as never,
    );
    return { service, data, mail };
  }

  it('envoi : consentement retiré depuis la détection → rien envoyé', async () => {
    const { service, data, mail } = sender(() => Promise.resolve(false));

    await expect(service.sendSequenceEmail('rec-1', '24h')).resolves.toBe(
      false,
    );
    expect(mail.sendAbandonedCartEmail).not.toHaveBeenCalled();
    expect(data.updateEmailSent).not.toHaveBeenCalled();
  });

  it('envoi : lecture impossible → job en échec, rien envoyé', async () => {
    const { service, data, mail } = sender(() =>
      Promise.reject(new Error('db down')),
    );

    await expect(service.sendSequenceEmail('rec-1', '24h')).rejects.toThrow(
      'db down',
    );
    expect(mail.sendAbandonedCartEmail).not.toHaveBeenCalled();
    expect(data.updateEmailSent).not.toHaveBeenCalled();
  });
});
