/**
 * Paiement d'une commande non payable — une seule règle serveur.
 *
 * Trois chemins mènent au paiement d'une commande EXISTANTE : le lien de
 * reprise (GET /api/orders/resume-token/:token), le rejeu idempotent de la
 * création (POST /api/orders et /api/orders/guest avec une clé déjà
 * aboutie) et le rappel de paiement admin. Aucun ne relisait le statut : une
 * commande annulée recevait un nouveau lien de paiement.
 *
 * Ce test verrouille :
 *  - `getOrderPaymentState` : payée (drapeau OU date) / payable (impayée et
 *    '1') / non payable (tout le reste, jamais payable par défaut) ;
 *  - les trois chemins : 409 `ORDER.NOT_PAYABLE` (ou 400 côté admin), aucun
 *    nouveau lien de reprise, aucun e-mail ;
 *  - la clé d'idempotence : seule la requête qui l'a posée peut la marquer
 *    'failed' (une clé 'failed' est recyclée → seconde commande).
 *
 * @see backend/src/modules/orders/services/orders.service.ts (getOrderPaymentState)
 * @see backend/src/modules/orders/controllers/orders.controller.ts
 * @see backend/src/modules/orders/controllers/order-actions.controller.ts
 */

import 'reflect-metadata';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { DomainConflictException } from '../../src/common/exceptions';
import { OrderActionsController } from '../../src/modules/orders/controllers/order-actions.controller';
import { OrdersController } from '../../src/modules/orders/controllers/orders.controller';
import {
  CreateOrderData,
  computeOrderFingerprint,
  getOrderNotPayableMessage,
  getOrderPaymentState,
} from '../../src/modules/orders/services/orders.service';

const ORDER_ID = 'ORD-1758000000000-123';
const USER_ID = '81500';
const KEY = 'ik-1758000000000-abc123';
const GUEST_EMAIL = 'client@example.com';

const CANCELLED_MESSAGE =
  'Cette commande a été annulée : elle ne peut plus être payée.';
const CONTACT_MESSAGE =
  'Cette commande ne peut pas être payée en ligne : contactez notre service client.';

function order(overrides: Record<string, unknown> = {}) {
  return {
    ord_id: ORDER_ID,
    ord_cst_id: USER_ID,
    ord_ords_id: '1',
    ord_is_pay: '0',
    ord_date_pay: null,
    ord_total_ttc: '62.35',
    customer: null,
    lines: [],
    statusHistory: [],
    ...overrides,
  };
}

// ── Faux client Supabase : réponses par table + journal des écritures ──────

type QueryResult = { data?: unknown; error?: unknown };
interface TableConfig {
  single?: QueryResult;
  insert?: QueryResult;
  /** Réponses successives des inserts (sinon `insert` pour tous). */
  inserts?: QueryResult[];
}
interface Call {
  table: string;
  op: 'select' | 'insert' | 'update' | 'delete';
  payload?: unknown;
}

function makeSupabase(tables: Record<string, TableConfig>) {
  const calls: Call[] = [];
  const from = (table: string) => {
    const cfg = tables[table] ?? {};
    const inserted = () =>
      calls.filter((c) => c.table === table && c.op === 'insert').length;
    const builder: Record<string, unknown> = {};
    Object.assign(builder, {
      select: (payload?: unknown) => {
        calls.push({ table, op: 'select', payload });
        return builder;
      },
      eq: () => builder,
      is: () => builder,
      lt: () => builder,
      single: async () =>
        cfg.single ?? { data: null, error: { message: 'no rows' } },
      insert: async (payload: unknown) => {
        const n = inserted();
        calls.push({ table, op: 'insert', payload });
        return cfg.inserts?.[n] ?? cfg.insert ?? { error: null };
      },
      update: (payload: unknown) => {
        calls.push({ table, op: 'update', payload });
        return builder;
      },
      delete: () => {
        calls.push({ table, op: 'delete' });
        return builder;
      },
      // `await supabase.from(t).update(...).eq(...)` résout ici
      then: (resolve: (v: QueryResult) => unknown) =>
        resolve({ data: null, error: null }),
    });
    return builder;
  };
  return { client: { from }, calls };
}

function writes(calls: Call[], table: string, op: Call['op']) {
  return calls.filter((c) => c.table === table && c.op === op);
}

function makeOrdersController(opts: {
  tables?: Record<string, TableConfig>;
  existingOrder?: Record<string, unknown>;
  createOrder?: jest.Mock;
}) {
  const supabase = makeSupabase(opts.tables ?? {});
  const ordersService = {
    getSupabaseClient: jest.fn(() => supabase.client),
    getOrderById: jest.fn().mockResolvedValue(opts.existingOrder ?? order()),
    createOrder:
      opts.createOrder ?? jest.fn().mockResolvedValue({ ord_id: ORDER_ID }),
  };
  const authService = { checkIfUserExists: jest.fn() };
  const controller = new OrdersController(
    ordersService as never,
    authService as never,
    {} as never, // mailService — unused on these paths
    {} as never, // cacheService — unused on these paths
  );
  return { controller, ordersService, authService, calls: supabase.calls };
}

async function expectNotPayable(promise: Promise<unknown>, message: string) {
  const err = await promise.then(
    () => {
      throw new Error('expected a 409 ORDER.NOT_PAYABLE');
    },
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(DomainConflictException);
  const domainErr = err as DomainConflictException;
  expect(domainErr.getStatus()).toBe(409);
  expect(domainErr.code).toBe('ORDER.NOT_PAYABLE');
  expect(domainErr.message).toBe(message);
}

// ── 1. La règle ────────────────────────────────────────────────────────────

describe('getOrderPaymentState', () => {
  it.each([[null], [undefined], [''], ['   ']])(
    'payable: unpaid order in progress (status 1, pay date %p)',
    (payDate) => {
      expect(
        getOrderPaymentState({
          ord_ords_id: '1',
          ord_is_pay: '0',
          ord_date_pay: payDate,
        }),
      ).toBe('payable');
    },
  );

  it.each([
    ['1', '1', null], // payées historiques restées en '1'
    ['3', '1', null], // état posé par le callback Paybox
    ['5', '1', null],
    ['2', '1', null], // annulée mais encaissée : jamais un second paiement
    ['1', '0', '2026-01-15 10:00:00'], // payée par la date seule
    ['2', '0', '2026-01-15 10:00:00'],
  ])('paid: status %p, ord_is_pay %p, pay date %p', (status, isPay, date) => {
    expect(
      getOrderPaymentState({
        ord_ords_id: status,
        ord_is_pay: isPay,
        ord_date_pay: date,
      }),
    ).toBe('paid');
  });

  it.each([
    ['2', '0'], // annulée (client ou admin)
    ['6', '0'], // hors canon : annulation admin legacy
    ['3', '0'], // '3'/'4' impayés : données contradictoires → support
    ['4', '0'],
    [null, '0'], // statut absent
    [undefined, '0'],
    ['1', null], // paiement inconnu : jamais payable par défaut
    ['1', undefined],
    ['1', '2'],
  ])('not_payable: status %p, ord_is_pay %p', (status, isPay) => {
    expect(
      getOrderPaymentState({
        ord_ords_id: status,
        ord_is_pay: isPay,
        ord_date_pay: null,
      }),
    ).toBe('not_payable');
  });

  it('explains a cancelled order, otherwise points to support', () => {
    expect(getOrderNotPayableMessage({ ord_ords_id: '2' })).toBe(
      CANCELLED_MESSAGE,
    );
    expect(getOrderNotPayableMessage({ ord_ords_id: '6' })).toBe(
      CONTACT_MESSAGE,
    );
    expect(getOrderNotPayableMessage({ ord_ords_id: '3' })).toBe(
      CONTACT_MESSAGE,
    );
  });
});

// ── 2. Lien de reprise ─────────────────────────────────────────────────────

describe('GET /api/orders/resume-token/:token', () => {
  const validToken = {
    data: {
      order_id: ORDER_ID,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      used_at: null,
    },
    error: null,
  };

  function resume(found: Record<string, unknown>) {
    return makeOrdersController({
      tables: {
        order_resume_tokens: { single: validToken },
        ___xtr_order: { single: { data: found, error: null } },
        ___xtr_customer: {
          single: { data: { cst_mail: GUEST_EMAIL }, error: null },
        },
      },
    });
  }

  it('reads the pay date with the order (paid = flag OR date)', async () => {
    const { controller, calls } = resume(order());
    await controller.validateResumeToken('tok');
    const [orderSelect] = writes(calls, '___xtr_order', 'select');
    expect(String(orderSelect.payload)).toContain('ord_date_pay');
  });

  it('payable order → payment data, isPaid false', async () => {
    const { controller } = resume(order());
    await expect(controller.validateResumeToken('tok')).resolves.toEqual({
      orderId: ORDER_ID,
      totalTTC: 62.35,
      isPaid: false,
      orderStatus: '1',
      customerEmail: GUEST_EMAIL,
    });
  });

  it.each([
    ['flag', { ord_ords_id: '3', ord_is_pay: '1' }],
    ['date only', { ord_is_pay: '0', ord_date_pay: '2026-01-15 10:00:00' }],
  ])('paid order (%s) → isPaid true (confirmation page)', async (_, o) => {
    const { controller } = resume(order(o));
    await expect(controller.validateResumeToken('tok')).resolves.toMatchObject({
      isPaid: true,
    });
  });

  it('cancelled order → 409 ORDER.NOT_PAYABLE, customer never read', async () => {
    const { controller, calls } = resume(order({ ord_ords_id: '2' }));
    await expectNotPayable(
      controller.validateResumeToken('tok'),
      CANCELLED_MESSAGE,
    );
    expect(writes(calls, '___xtr_customer', 'select')).toEqual([]);
  });

  it("out-of-canon status '6' → 409 ORDER.NOT_PAYABLE", async () => {
    const { controller } = resume(order({ ord_ords_id: '6' }));
    await expectNotPayable(
      controller.validateResumeToken('tok'),
      CONTACT_MESSAGE,
    );
  });
});

// ── 3. Rejeu idempotent de la création ─────────────────────────────────────

const ORDER_BODY = {
  orderLines: [
    {
      productId: '12345',
      productName: 'Plaquettes de frein',
      productReference: 'REF-123',
      quantity: 1,
      unitPrice: 62.35,
      vatRate: 20,
      discount: 0,
    },
  ],
  shippingMethod: 'standard',
  idempotencyKey: KEY,
} as unknown as CreateOrderData;

function idempotencyTable(row: Record<string, unknown>): TableConfig {
  return {
    insert: { error: { code: '23505' } }, // clé déjà posée
    single: { data: row, error: null },
  };
}

const AUTH_FP = computeOrderFingerprint({
  ...ORDER_BODY,
  customerId: USER_ID,
});
const GUEST_FP = computeOrderFingerprint({
  ...ORDER_BODY,
  customerId: GUEST_EMAIL,
  guestEmail: GUEST_EMAIL,
} as CreateOrderData);

function authReq() {
  return { user: { id: USER_ID }, session: {} } as never;
}
function guestReq() {
  return { user: undefined, session: {} } as never;
}

describe('POST /api/orders — replay of a completed idempotency key', () => {
  function replay(existing: Record<string, unknown>) {
    return makeOrdersController({
      tables: {
        order_idempotency: idempotencyTable({
          order_id: ORDER_ID,
          status: 'completed',
          fingerprint: AUTH_FP,
        }),
      },
      existingOrder: existing,
    });
  }

  it('payable → same order + a fresh resume token', async () => {
    const { controller, calls } = replay(order());
    const res = (await controller.createOrder(ORDER_BODY, authReq())) as {
      ord_id: string;
      resumeToken?: string;
    };
    expect(res.ord_id).toBe(ORDER_ID);
    expect(typeof res.resumeToken).toBe('string');
    expect(writes(calls, 'order_resume_tokens', 'insert')).toHaveLength(1);
  });

  it('paid → same order, no new resume token', async () => {
    const { controller, calls } = replay(
      order({ ord_ords_id: '3', ord_is_pay: '1' }),
    );
    const res = (await controller.createOrder(ORDER_BODY, authReq())) as {
      resumeToken?: string;
    };
    expect(res.resumeToken).toBeUndefined();
    expect(writes(calls, 'order_resume_tokens', 'insert')).toEqual([]);
  });

  it('cancelled since → 409 ORDER.NOT_PAYABLE, no token, key left untouched', async () => {
    const { controller, calls } = replay(order({ ord_ords_id: '2' }));
    await expectNotPayable(
      controller.createOrder(ORDER_BODY, authReq()),
      CANCELLED_MESSAGE,
    );
    expect(writes(calls, 'order_resume_tokens', 'insert')).toEqual([]);
    expect(writes(calls, 'order_idempotency', 'update')).toEqual([]);
  });

  it('payload changed → 409 ORDER.IDEMPOTENCY_KEY_REUSED, key left untouched', async () => {
    const { controller, calls, ordersService } = makeOrdersController({
      tables: {
        order_idempotency: idempotencyTable({
          order_id: ORDER_ID,
          status: 'completed',
          fingerprint: 'another-payload',
        }),
      },
    });
    const err = await controller
      .createOrder(ORDER_BODY, authReq())
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DomainConflictException);
    expect((err as DomainConflictException).getStatus()).toBe(409);
    expect((err as DomainConflictException).code).toBe(
      'ORDER.IDEMPOTENCY_KEY_REUSED',
    );
    expect(writes(calls, 'order_idempotency', 'update')).toEqual([]);
    expect(ordersService.createOrder).not.toHaveBeenCalled();
  });

  it('still processing → 409, key NOT marked failed (it is not ours)', async () => {
    const { controller, calls } = makeOrdersController({
      tables: {
        order_idempotency: idempotencyTable({
          order_id: null,
          status: 'processing',
          fingerprint: AUTH_FP,
        }),
      },
    });
    await expect(
      controller.createOrder(ORDER_BODY, authReq()),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(writes(calls, 'order_idempotency', 'update')).toEqual([]);
  });

  it('own key + creation failure → key marked failed (retry allowed)', async () => {
    const { controller, calls } = makeOrdersController({
      tables: { order_idempotency: { insert: { error: null } } },
      createOrder: jest.fn().mockRejectedValue(new Error('rpc down')),
    });
    await expect(controller.createOrder(ORDER_BODY, authReq())).rejects.toThrow(
      'rpc down',
    );
    const updates = writes(calls, 'order_idempotency', 'update');
    expect(updates).toHaveLength(1);
    expect(updates[0].payload).toMatchObject({
      status: 'failed',
      order_id: null,
    });
  });

  // Clé 'failed' recyclée : la requête n'en devient propriétaire que si SA
  // ré-insertion réussit. Sinon une requête concurrente vient de la reprendre
  // et créer la commande ici en ferait une seconde.
  function recycle(opts: { reinsert: QueryResult; createOrder?: jest.Mock }) {
    return makeOrdersController({
      tables: {
        order_idempotency: {
          inserts: [{ error: { code: '23505' } }, opts.reinsert],
          single: {
            data: { order_id: null, status: 'failed', fingerprint: AUTH_FP },
            error: null,
          },
        },
      },
      createOrder: opts.createOrder,
    });
  }

  it("'failed' key recycled by this request → it owns the key", async () => {
    const createOrder = jest.fn().mockRejectedValue(new Error('rpc down'));
    const { controller, calls, ordersService } = recycle({
      reinsert: { error: null },
      createOrder,
    });
    await expect(controller.createOrder(ORDER_BODY, authReq())).rejects.toThrow(
      'rpc down',
    );
    expect(writes(calls, 'order_idempotency', 'delete')).toHaveLength(1);
    expect(ordersService.createOrder).toHaveBeenCalledTimes(1);
    // propriétaire → peut la marquer 'failed'
    expect(writes(calls, 'order_idempotency', 'update')).toHaveLength(1);
  });

  it("'failed' key re-taken by a concurrent request → 409, no order, key untouched", async () => {
    const { controller, calls, ordersService } = recycle({
      reinsert: { error: { code: '23505' } },
    });
    await expect(
      controller.createOrder(ORDER_BODY, authReq()),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(ordersService.createOrder).not.toHaveBeenCalled();
    expect(writes(calls, 'order_idempotency', 'update')).toEqual([]);
  });

  it('key row vanished between insert and read (concurrent recycle) → 409, no order', async () => {
    const { controller, calls, ordersService } = makeOrdersController({
      tables: {
        order_idempotency: {
          insert: { error: { code: '23505' } },
          single: { data: null, error: { code: 'PGRST116' } },
        },
      },
    });
    await expect(
      controller.createOrder(ORDER_BODY, authReq()),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(ordersService.createOrder).not.toHaveBeenCalled();
    expect(writes(calls, 'order_idempotency', 'delete')).toEqual([]);
    expect(writes(calls, 'order_idempotency', 'update')).toEqual([]);
  });

  it('key read fails → error propagated, no order, key untouched', async () => {
    const readError = { code: '57014', message: 'statement timeout' };
    const { controller, calls, ordersService } = makeOrdersController({
      tables: {
        order_idempotency: {
          insert: { error: { code: '23505' } },
          single: { data: null, error: readError },
        },
      },
    });
    await expect(controller.createOrder(ORDER_BODY, authReq())).rejects.toBe(
      readError,
    );
    expect(ordersService.createOrder).not.toHaveBeenCalled();
    expect(writes(calls, 'order_idempotency', 'update')).toEqual([]);
  });
});

describe('POST /api/orders/guest — replay of a completed idempotency key', () => {
  const guestBody = { ...ORDER_BODY, guestEmail: GUEST_EMAIL };

  it('cancelled since → 409 ORDER.NOT_PAYABLE before any account work', async () => {
    const { controller, calls, authService } = makeOrdersController({
      tables: {
        order_idempotency: idempotencyTable({
          order_id: ORDER_ID,
          status: 'completed',
          fingerprint: GUEST_FP,
        }),
      },
      existingOrder: order({ ord_ords_id: '2' }),
    });
    await expectNotPayable(
      controller.createGuestOrder(guestBody, guestReq()),
      CANCELLED_MESSAGE,
    );
    expect(authService.checkIfUserExists).not.toHaveBeenCalled();
    expect(writes(calls, 'order_resume_tokens', 'insert')).toEqual([]);
    expect(writes(calls, 'order_idempotency', 'update')).toEqual([]);
  });

  it('payable → same order + a fresh resume token', async () => {
    const { controller, calls } = makeOrdersController({
      tables: {
        order_idempotency: idempotencyTable({
          order_id: ORDER_ID,
          status: 'completed',
          fingerprint: GUEST_FP,
        }),
      },
    });
    const res = (await controller.createGuestOrder(guestBody, guestReq())) as {
      resumeToken?: string;
    };
    expect(typeof res.resumeToken).toBe('string');
    expect(writes(calls, 'order_resume_tokens', 'insert')).toHaveLength(1);
  });
});

// ── 4. Rappel de paiement (admin) ──────────────────────────────────────────

describe('POST /api/admin/orders/:orderId/payment-reminder', () => {
  function makeActions(found: Record<string, unknown>) {
    const orderActionsService = {
      getOrder: jest.fn().mockResolvedValue(found),
      getCustomer: jest.fn().mockResolvedValue({ cst_mail: GUEST_EMAIL }),
    };
    const mailService = { sendPaymentReminder: jest.fn() };
    const controller = new OrderActionsController(
      orderActionsService as never,
      mailService as never,
    );
    return { controller, mailService };
  }

  it('cancelled order → refused, no e-mail', async () => {
    const { controller, mailService } = makeActions(
      order({ ord_ords_id: '2' }),
    );
    await expect(
      controller.sendPaymentReminder(ORDER_ID),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mailService.sendPaymentReminder).not.toHaveBeenCalled();
  });

  it('paid by date only → « déjà payée », no e-mail', async () => {
    const { controller, mailService } = makeActions(
      order({ ord_date_pay: '2026-01-15 10:00:00' }),
    );
    await expect(controller.sendPaymentReminder(ORDER_ID)).rejects.toThrow(
      'Commande déjà payée',
    );
    expect(mailService.sendPaymentReminder).not.toHaveBeenCalled();
  });

  it('payable order → reminder sent', async () => {
    const { controller, mailService } = makeActions(order());
    await expect(
      controller.sendPaymentReminder(ORDER_ID),
    ).resolves.toMatchObject({ success: true });
    expect(mailService.sendPaymentReminder).toHaveBeenCalledTimes(1);
  });
});
