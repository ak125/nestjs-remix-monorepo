/**
 * Espace client — état de paiement exposé par GET /api/orders et
 * GET /api/orders/:id (`payment_state`).
 *
 * La page « Mes commandes » déduisait « payée » de `ord_is_pay` seul. Une
 * commande dont seule la date de paiement est renseignée paraissait donc non
 * payée (pas de bouton Facture). Le backend porte la règle unique
 * (`getOrderPaymentState`, drapeau OU date de paiement) : la page lit ce
 * verdict et ne recalcule rien depuis les colonnes.
 *
 * @see backend/src/modules/orders/controllers/orders.controller.ts (listMyOrders, getOrderById)
 * @see backend/src/modules/orders/services/orders.service.ts (getOrderPaymentState)
 */

import 'reflect-metadata';
import { OrdersController } from '../../src/modules/orders/controllers/orders.controller';
import { getOrderPaymentState } from '../../src/modules/orders/services/orders.service';

const ORDER_ID = 'ORD-TEST-1';
const OWNER = 'cst-test';

function order(overrides: Record<string, unknown> = {}) {
  return {
    ord_id: ORDER_ID,
    ord_cst_id: OWNER,
    ord_ords_id: '1',
    ord_is_pay: '0',
    ord_date_pay: null,
    lines: [],
    ...overrides,
  };
}

const PAGINATION = {
  page: 2,
  limit: 10,
  total: 23,
  totalPages: 3,
  hasNextPage: true,
  hasPreviousPage: true,
};

function makeController(opts: {
  found?: Record<string, unknown>;
  list?: Record<string, unknown>[];
}) {
  const ordersService = {
    getOrderById: jest.fn().mockResolvedValue(opts.found ?? null),
    listOrders: jest
      .fn()
      .mockResolvedValue({ data: opts.list ?? [], pagination: PAGINATION }),
  };
  const controller = new OrdersController(
    ordersService as never,
    {} as never, // authService — unused on these paths
    {} as never, // mailService — unused on these paths
    {} as never, // cacheService — unused on these paths
  );
  return { controller, ordersService };
}

function req(userId?: string) {
  return { user: userId ? { id: userId } : undefined, session: {} } as never;
}

// [colonnes, verdict attendu] — le verdict vient de getOrderPaymentState.
const CASES: Array<[Record<string, unknown>, string]> = [
  [{}, 'payable'],
  [{ ord_ords_id: '3', ord_is_pay: '1' }, 'paid'],
  // Payée d'après la date seule : `ord_is_pay` reste à '0'.
  [{ ord_date_pay: '2000-01-01 00:00:00' }, 'paid'],
  [{ ord_ords_id: '2' }, 'not_payable'],
];

describe('OrdersController.listMyOrders — payment_state', () => {
  it('ajoute à chaque commande le verdict de getOrderPaymentState', async () => {
    const list = CASES.map(([overrides], i) =>
      order({ ord_id: `ORD-TEST-${i}`, ...overrides }),
    );
    const { controller, ordersService } = makeController({ list });

    const res = await controller.listMyOrders(
      { page: '2' } as never,
      req(OWNER),
    );

    expect(ordersService.listOrders).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: OWNER, page: 2 }),
    );
    expect(res.data.map((o) => o.payment_state)).toEqual(
      CASES.map(([, expected]) => expected),
    );
    // Même verdict que la règle appliquée à la ligne brute du service.
    expect(res.data.map((o) => o.payment_state)).toEqual(
      list.map((row) => getOrderPaymentState(row)),
    );
    // Les colonnes et la pagination du service sont renvoyées telles quelles.
    expect(res.data).toEqual(list.map((row) => expect.objectContaining(row)));
    expect(res.pagination).toEqual(PAGINATION);
  });
});

describe('OrdersController.getOrderById — payment_state', () => {
  it.each(CASES)('%o → %s', async (overrides, expected) => {
    const { controller } = makeController({ found: order(overrides) });

    const res = await controller.getOrderById(ORDER_ID, req(OWNER));

    expect(res.data.payment_state).toBe(expected);
    expect(res.data.ord_id).toBe(ORDER_ID);
  });
});
