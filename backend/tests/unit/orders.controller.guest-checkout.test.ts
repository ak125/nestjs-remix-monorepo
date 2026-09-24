/**
 * Commande invité — POST /api/orders/guest.
 *
 * Règle verrouillée : saisir une adresse email ne prouve pas qu'on la possède.
 *  - email déjà associé à un compte → 409 `USER.DUPLICATE_EMAIL`, rien n'est
 *    créé, aucune session n'est ouverte (le checkout affiche la connexion) ;
 *  - nouvel email → compte créé (activation par email), commande créée, AUCUNE
 *    session ouverte : la possession de l'email n'est prouvée qu'à l'activation ;
 *  - vérification d'existence en échec → l'erreur remonte (fail-closed), jamais
 *    lue comme « email libre » ;
 *  - commande sans ligne → 400 avant tout effet (ni clé, ni vérification, ni
 *    compte) ;
 *  - l'adresse est normalisée (trim + minuscules) avant tout usage, et
 *    n'apparaît dans aucun log du contrôleur. Les journaux des services
 *    partagés (envoi d'email, création de commande) ne sont pas couverts ici.
 *
 * @see backend/src/modules/orders/controllers/orders.controller.ts (createGuestOrder)
 * @see backend/src/auth/auth.service.ts (isEmailRegistered)
 */

import 'reflect-metadata';
import { BadRequestException, HttpException, Logger } from '@nestjs/common';
import { DomainConflictException, ErrorCodes } from '@common/exceptions';
import { OrdersController } from '../../src/modules/orders/controllers/orders.controller';
import {
  computeOrderFingerprint,
  type CreateOrderData,
} from '../../src/modules/orders/services/orders.service';

const ORDER_ID = 'ORD-1758000000000-7';
const NEW_USER_ID = 'usr_guest_test';
const EMAIL = 'client.test@example.test';

type Call = {
  table: string;
  op: string;
  payload?: unknown;
  filters: Array<[string, unknown]>;
};

/** Client Supabase factice : enregistre les appels, simule la table d'idempotence. */
function makeSupabase(
  opts: {
    idempotencyInsertError?: { code: string };
    idempotencyRow?: Record<string, unknown>;
  } = {},
) {
  const calls: Call[] = [];
  let idempotencyInserts = 0;

  const from = (table: string) => {
    const call: Call = { table, op: 'select', filters: [] };
    calls.push(call);
    const result = () => {
      if (table === 'order_idempotency' && call.op === 'insert') {
        idempotencyInserts += 1;
        return {
          error:
            idempotencyInserts === 1
              ? (opts.idempotencyInsertError ?? null)
              : null,
        };
      }
      if (table === 'order_idempotency' && call.op === 'select') {
        return { data: opts.idempotencyRow ?? null, error: null };
      }
      return { data: null, error: null };
    };
    const builder: Record<string, unknown> = {};
    for (const op of ['insert', 'update', 'delete']) {
      builder[op] = (payload?: unknown) => {
        call.op = op;
        call.payload = payload;
        return builder;
      };
    }
    builder.select = () => builder;
    builder.eq = (column: string, value: unknown) => {
      call.filters.push([column, value]);
      return builder;
    };
    builder.single = () => builder;
    builder.then = (
      onFulfilled: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(result()).then(onFulfilled, onRejected);
    return builder;
  };

  return { client: { from }, calls };
}

function createdOrder() {
  return {
    ord_id: ORDER_ID,
    ord_total_ttc: '42.00',
    customer: { cst_mail: EMAIL },
  };
}

function makeController(
  opts: {
    emailRegistered?: boolean;
    lookupError?: Error;
    supabase?: ReturnType<typeof makeSupabase>;
  } = {},
) {
  const supabase = opts.supabase ?? makeSupabase();
  const ordersService = {
    getSupabaseClient: jest.fn(() => supabase.client),
    createOrder: jest.fn().mockResolvedValue(createdOrder()),
    getOrderById: jest.fn().mockResolvedValue(createdOrder()),
  };
  const authService = {
    isEmailRegistered: opts.lookupError
      ? jest.fn().mockRejectedValue(opts.lookupError)
      : jest.fn().mockResolvedValue(opts.emailRegistered ?? false),
    register: jest.fn().mockResolvedValue({ id: NEW_USER_ID, email: EMAIL }),
    checkIfUserExists: jest.fn(),
  };
  const mailService = {
    sendGuestAccountActivation: jest.fn().mockResolvedValue(undefined),
  };
  const cacheService = { set: jest.fn().mockResolvedValue(undefined) };
  const controller = new OrdersController(
    ordersService as never,
    authService as never,
    mailService as never,
    cacheService as never,
  );
  return {
    controller,
    ordersService,
    authService,
    mailService,
    cacheService,
    supabase,
  };
}

function guestRequest(session: Record<string, unknown> = {}) {
  return {
    user: undefined,
    session: {
      regenerate: jest.fn(),
      save: jest.fn(),
      ...session,
    },
    login: jest.fn(),
    logIn: jest.fn(),
  };
}

function body(overrides: Record<string, unknown> = {}) {
  return {
    guestEmail: EMAIL,
    orderLines: [
      {
        productId: '1',
        productName: 'Produit',
        quantity: 1,
        unitPrice: 42,
      },
    ],
    billingAddress: { firstName: 'Prénom', lastName: 'Nom' },
    ...overrides,
  } as never;
}

function expectNoSessionOpened(req: ReturnType<typeof guestRequest>) {
  expect(req.session.regenerate).not.toHaveBeenCalled();
  expect(req.session.save).not.toHaveBeenCalled();
  expect(req.login).not.toHaveBeenCalled();
  expect(req.logIn).not.toHaveBeenCalled();
}

describe('OrdersController.createGuestOrder', () => {
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function loggedText(): string {
    return [logSpy, warnSpy, errorSpy]
      .flatMap((spy) => spy.mock.calls)
      .map((args) => args.map((a: unknown) => String(a)).join(' '))
      .join('\n');
  }

  describe('email déjà associé à un compte', () => {
    it('refuse en 409 USER.DUPLICATE_EMAIL sans rien créer ni ouvrir de session', async () => {
      const { controller, ordersService, authService, mailService } =
        makeController({ emailRegistered: true });
      const req = guestRequest();

      const error = await controller
        .createGuestOrder(body(), req as never)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(DomainConflictException);
      expect((error as DomainConflictException).getStatus()).toBe(409);
      expect((error as DomainConflictException).code).toBe(
        ErrorCodes.USER.DUPLICATE_EMAIL,
      );
      expect(authService.register).not.toHaveBeenCalled();
      expect(authService.checkIfUserExists).not.toHaveBeenCalled();
      expect(ordersService.createOrder).not.toHaveBeenCalled();
      expect(mailService.sendGuestAccountActivation).not.toHaveBeenCalled();
      expectNoSessionOpened(req);
    });

    it('marque la clé d’idempotence en échec, sans commande rattachée', async () => {
      const supabase = makeSupabase();
      const { controller } = makeController({
        emailRegistered: true,
        supabase,
      });

      await expect(
        controller.createGuestOrder(
          body({ idempotencyKey: 'ik-test-1' }),
          guestRequest() as never,
        ),
      ).rejects.toBeInstanceOf(DomainConflictException);

      const finalize = supabase.calls.find(
        (c) => c.table === 'order_idempotency' && c.op === 'update',
      );
      expect(finalize?.payload).toMatchObject({
        order_id: null,
        status: 'failed',
      });
    });

    it('normalise l’adresse (espaces, majuscules) avant la vérification', async () => {
      const { controller, authService } = makeController({
        emailRegistered: true,
      });

      await expect(
        controller.createGuestOrder(
          body({ guestEmail: '  Client.Test@EXAMPLE.test ' }),
          guestRequest() as never,
        ),
      ).rejects.toBeInstanceOf(DomainConflictException);

      expect(authService.isEmailRegistered).toHaveBeenCalledWith(EMAIL);
    });

    it('une clé consommée par ce refus ne peut pas porter une autre adresse (le checkout en génère une nouvelle)', async () => {
      // Première tentative refusée : la clé reste en échec avec l'empreinte
      // de la première adresse.
      const { guestEmail: _email, ...orderData } = body({
        idempotencyKey: 'ik-test-conflict',
      }) as Record<string, unknown>;
      void _email;
      const supabase = makeSupabase({
        idempotencyInsertError: { code: '23505' },
        idempotencyRow: {
          order_id: null,
          status: 'failed',
          fingerprint: computeOrderFingerprint({
            ...orderData,
            customerId: EMAIL,
            guestEmail: EMAIL,
          } as CreateOrderData),
        },
      });
      const { controller, authService, ordersService } = makeController({
        supabase,
      });

      // Même clé, autre adresse : refus générique, aucun effet.
      const error = await controller
        .createGuestOrder(
          body({
            idempotencyKey: 'ik-test-conflict',
            guestEmail: 'autre.adresse@example.test',
          }),
          guestRequest() as never,
        )
        .catch((e: unknown) => e);

      // Refus propre à la clé (409), jamais confondu avec « compte existant ».
      expect((error as HttpException).getStatus()).toBe(409);
      expect((error as { code?: string }).code).not.toBe(
        ErrorCodes.USER.DUPLICATE_EMAIL,
      );
      expect(authService.isEmailRegistered).not.toHaveBeenCalled();
      expect(authService.register).not.toHaveBeenCalled();
      expect(ordersService.createOrder).not.toHaveBeenCalled();

      // Nouvelle clé (ce que fait le checkout après EMAIL_CONFLICT) : la
      // commande passe.
      const fresh = makeController();
      await expect(
        fresh.controller.createGuestOrder(
          body({
            idempotencyKey: 'ik-test-conflict-2',
            guestEmail: 'autre.adresse@example.test',
          }),
          guestRequest() as never,
        ),
      ).resolves.toMatchObject({ ord_id: ORDER_ID });
    });
  });

  it('commande sans ligne → 400 avant tout effet (ni clé, ni vérification, ni compte)', async () => {
    const supabase = makeSupabase();
    const { controller, authService, ordersService } = makeController({
      supabase,
    });

    await expect(
      controller.createGuestOrder(
        body({ orderLines: [], idempotencyKey: 'ik-test-empty' }),
        guestRequest() as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(authService.isEmailRegistered).not.toHaveBeenCalled();
    expect(authService.register).not.toHaveBeenCalled();
    expect(ordersService.createOrder).not.toHaveBeenCalled();
    // La clé n'est jamais posée : aucune insertion dans la table d'idempotence.
    expect(
      supabase.calls.filter(
        (c) => c.table === 'order_idempotency' && c.op === 'insert',
      ),
    ).toEqual([]);
  });

  it('échec de création après le compte : l’erreur remonte, sans email d’activation ; une nouvelle tentative passe par la connexion', async () => {
    const failure = new Error('rpc down');
    const { controller, authService, ordersService, mailService } =
      makeController();
    ordersService.createOrder.mockRejectedValueOnce(failure);
    const req = guestRequest();

    await expect(
      controller.createGuestOrder(body(), req as never),
    ).rejects.toBe(failure);

    expect(authService.register).toHaveBeenCalledTimes(1);
    expect(mailService.sendGuestAccountActivation).not.toHaveBeenCalled();
    expectNoSessionOpened(req);

    // Le compte existe désormais : la nouvelle tentative est refusée comme
    // pour tout compte existant (connexion ou « mot de passe oublié »).
    authService.isEmailRegistered.mockResolvedValueOnce(true);
    const retry = await controller
      .createGuestOrder(body(), guestRequest() as never)
      .catch((e: unknown) => e);

    expect(retry).toBeInstanceOf(DomainConflictException);
    expect((retry as DomainConflictException).code).toBe(
      ErrorCodes.USER.DUPLICATE_EMAIL,
    );
    expect(authService.register).toHaveBeenCalledTimes(1);
  });

  it('vérification impossible → l’erreur remonte, aucun compte ni commande (fail-closed)', async () => {
    const lookupError = new Error('rpc down');
    const { controller, authService, ordersService } = makeController({
      lookupError,
    });
    const req = guestRequest();

    await expect(
      controller.createGuestOrder(body(), req as never),
    ).rejects.toBe(lookupError);

    expect(authService.register).not.toHaveBeenCalled();
    expect(ordersService.createOrder).not.toHaveBeenCalled();
    expectNoSessionOpened(req);
  });

  describe('nouvel email', () => {
    it('crée le compte et la commande sans ouvrir de session', async () => {
      const { controller, authService, ordersService, mailService } =
        makeController();
      const req = guestRequest();

      const result = (await controller.createGuestOrder(
        body({ guestEmail: ' Client.Test@Example.TEST' }),
        req as never,
      )) as Record<string, unknown>;

      expect(authService.register).toHaveBeenCalledTimes(1);
      expect(authService.register.mock.calls[0][0]).toMatchObject({
        email: EMAIL,
        firstName: 'Prénom',
        lastName: 'Nom',
      });
      expect(ordersService.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({ customerId: NEW_USER_ID }),
      );
      expect(mailService.sendGuestAccountActivation).toHaveBeenCalledWith(
        EMAIL,
        expect.any(String),
        ORDER_ID,
      );
      expectNoSessionOpened(req);

      // Le checkout construit le redirect Paybox depuis CETTE réponse.
      expect(result).toMatchObject({
        ord_id: ORDER_ID,
        ord_total_ttc: '42.00',
        customer: { cst_mail: EMAIL },
      });
      expect(typeof result.resumeToken).toBe('string');
    });

    it('stocke le jeton d’activation avec l’adresse normalisée', async () => {
      const { controller, cacheService } = makeController();

      await controller.createGuestOrder(
        body({ guestEmail: 'CLIENT.TEST@example.test' }),
        guestRequest() as never,
      );

      expect(cacheService.set).toHaveBeenCalledTimes(1);
      const [key, value] = cacheService.set.mock.calls[0];
      expect(key).toMatch(/^guest_activation:[0-9a-f]{64}$/);
      expect(JSON.parse(value as string)).toEqual({
        userId: NEW_USER_ID,
        email: EMAIL,
      });
    });

    it('conserve l’attribution landing (session non régénérée)', async () => {
      const supabase = makeSupabase();
      const { controller } = makeController({ supabase });
      const landing = {
        source: 'google',
        path: '/pieces/test',
        firstSeenAt: '2026-09-24T00:00:00.000Z',
      };

      await controller.createGuestOrder(
        body(),
        guestRequest({ landing }) as never,
      );

      const patch = supabase.calls.find(
        (c) => c.table === '___xtr_order' && c.op === 'update',
      );
      expect(patch?.payload).toEqual({
        landing_source: 'google',
        landing_path: '/pieces/test',
        landing_first_seen_at: '2026-09-24T00:00:00.000Z',
      });
      expect(patch?.filters).toEqual([['ord_id', ORDER_ID]]);
      expect(loggedText()).toContain(
        '[attribution_capture] scope=guest_order landing=present',
      );
    });
  });

  it('rejoue une commande déjà créée (même clé, même contenu) sans rien recréer', async () => {
    // Adresse saisie avec espaces et majuscules : l'empreinte doit porter
    // l'adresse normalisée pour retrouver la commande.
    const payload = body({
      idempotencyKey: 'ik-test-replay',
      guestEmail: '  Client.Test@EXAMPLE.test ',
    });
    const { guestEmail: _email, ...orderData } = payload as Record<
      string,
      unknown
    >;
    void _email;
    const supabase = makeSupabase({
      idempotencyInsertError: { code: '23505' },
      idempotencyRow: {
        order_id: ORDER_ID,
        status: 'completed',
        // Empreinte calculée sur l'adresse normalisée, comme le contrôleur.
        fingerprint: computeOrderFingerprint({
          ...orderData,
          customerId: EMAIL,
          guestEmail: EMAIL,
        } as CreateOrderData),
      },
    });
    const { controller, authService, ordersService } = makeController({
      supabase,
    });

    const result = (await controller.createGuestOrder(
      payload,
      guestRequest() as never,
    )) as Record<string, unknown>;

    expect(authService.isEmailRegistered).not.toHaveBeenCalled();
    expect(authService.register).not.toHaveBeenCalled();
    expect(ordersService.createOrder).not.toHaveBeenCalled();
    expect(ordersService.getOrderById).toHaveBeenCalledWith(ORDER_ID);
    expect(result).toMatchObject({ ord_id: ORDER_ID, ord_total_ttc: '42.00' });
    expect(typeof result.resumeToken).toBe('string');
  });

  it('client déjà connecté → délègue au parcours authentifié', async () => {
    const { controller, authService } = makeController();
    const delegated = { delegated: true };
    const createOrder = jest
      .spyOn(controller, 'createOrder')
      .mockResolvedValue(delegated as never);
    const req = { ...guestRequest(), user: { id: 'usr_connected' } };

    await expect(
      controller.createGuestOrder(body(), req as never),
    ).resolves.toBe(delegated);

    expect(createOrder).toHaveBeenCalledTimes(1);
    expect(authService.isEmailRegistered).not.toHaveBeenCalled();
  });

  it.each([[undefined], [''], ['   '], ['pas-un-email']])(
    'email invalide (%p) → 400',
    async (guestEmail) => {
      const { controller, authService } = makeController();

      await expect(
        controller.createGuestOrder(
          body({ guestEmail }),
          guestRequest() as never,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(authService.isEmailRegistered).not.toHaveBeenCalled();
    },
  );

  it('aucun log du contrôleur ne contient l’adresse email, quel que soit le parcours', async () => {
    const conflict = makeController({ emailRegistered: true });
    await conflict.controller
      .createGuestOrder(body(), guestRequest() as never)
      .catch(() => undefined);

    const created = makeController();
    await created.controller.createGuestOrder(body(), guestRequest() as never);

    const text = loggedText().toLowerCase();
    expect(text).not.toContain(EMAIL);
    expect(text).toContain('guest_checkout outcome=email_conflict');
    expect(text).toContain('guest_checkout outcome=account_created');
  });
});
