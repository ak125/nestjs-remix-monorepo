/**
 * Annulation client depuis « Mon compte » — DELETE /api/orders/:id.
 *
 * Le bouton « Annuler la commande » n'a jamais abouti :
 *  - `ParseIntPipe` rejetait tout identifiant `ORD-<ms>-<n>` (format depuis 2025-10) ;
 *  - aucune vérification de propriétaire (n'importe quel compte connecté pouvait
 *    annuler la commande d'un autre) ;
 *  - aucune vérification de paiement : le callback Paybox pose `ord_is_pay='1'`
 *    avec `ord_ords_id='3'`, que `cancel_order_atomic` accepte d'annuler.
 *
 * Ce test verrouille : id texte, propriétaire strict (404 sinon), refus 409 des
 * commandes payées (drapeau ou date de paiement) ou qui ne sont plus « en cours »
 * ('1'), et la même règle exposée au GET (`customer_can_cancel`) pour
 * l'affichage du bouton.
 *
 * @see backend/src/modules/orders/controllers/orders.controller.ts (cancelOrder)
 * @see backend/src/modules/orders/services/orders.service.ts (getCustomerCancelRefusal)
 */

import 'reflect-metadata';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { OrdersController } from '../../src/modules/orders/controllers/orders.controller';
import { getCustomerCancelRefusal } from '../../src/modules/orders/services/orders.service';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ORDER_ID = 'ORD-1758000000000-123';
const OWNER = '81500';

function order(overrides: Record<string, unknown> = {}) {
  return {
    ord_id: ORDER_ID,
    ord_cst_id: OWNER,
    ord_ords_id: '1',
    ord_is_pay: '0',
    customer: null,
    lines: [],
    statusHistory: [],
    ...overrides,
  };
}

function makeController(found: Record<string, unknown>) {
  const ordersService = {
    getOrderById: jest.fn().mockResolvedValue(found),
    cancelOrder: jest.fn().mockResolvedValue({ success: true }),
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

describe('getCustomerCancelRefusal', () => {
  it.each([[null], [undefined], ['']])(
    'allows an unpaid order in progress (status 1, pay date %p)',
    (payDate) => {
      expect(
        getCustomerCancelRefusal({
          ord_ords_id: '1',
          ord_is_pay: '0',
          ord_date_pay: payDate,
        }),
      ).toBeNull();
    },
  );

  it.each([
    ['1', '1', null], // payées historiques restées en '1'
    ['3', '1', null], // état posé par le callback Paybox
    ['5', '1', null],
    ['1', '0', '2020-11-27 12:40:00'], // payée (PayPal) mais drapeau resté à '0'
    ['1', '0', '2000-01-01 00:00:00'], // date sentinelle : paiement enregistré
  ])(
    'refuses a paid order (status %s, is_pay %s, pay date %p) with a support message',
    (status, isPay, payDate) => {
      expect(
        getCustomerCancelRefusal({
          ord_ords_id: status,
          ord_is_pay: isPay,
          ord_date_pay: payDate,
        }),
      ).toMatch(/payée.*service client/);
    },
  );

  it.each([
    ['2', '0'], // déjà annulée
    ['3', '0'], // '3' n'est posé que par le paiement : impayé = contradictoire
    ['4', '0'], // suit '3'
    ['5', '0'],
    ['6', '0'], // hors canon (annulation admin)
    [null, '0'],
    [undefined, '0'],
    ['1', null], // paiement inconnu → refus (jamais d'annulation par défaut)
    ['1', undefined],
  ])('refuses status %s / is_pay %s', (status, isPay) => {
    expect(
      getCustomerCancelRefusal({ ord_ords_id: status, ord_is_pay: isPay }),
    ).toBe('Cette commande ne peut plus être annulée.');
  });
});

describe('OrdersController.cancelOrder (DELETE /api/orders/:id)', () => {
  it('takes the id as text — no ParseIntPipe on the route param', () => {
    const args = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      OrdersController,
      'cancelOrder',
    ) as Record<string, { data?: unknown; pipes?: unknown[] }>;
    const idArg = Object.values(args).find((a) => a.data === 'id');
    expect(idArg).toBeDefined();
    expect(idArg?.pipes ?? []).toHaveLength(0);
  });

  it('cancels an unpaid order of its owner through the RPC authority', async () => {
    const { controller, ordersService } = makeController(order());

    await controller.cancelOrder(ORDER_ID, req(OWNER));

    expect(ordersService.getOrderById).toHaveBeenCalledWith(ORDER_ID);
    expect(ordersService.cancelOrder).toHaveBeenCalledTimes(1);
    const [id, customerId, options] = ordersService.cancelOrder.mock.calls[0];
    expect(id).toBe(ORDER_ID);
    // Le propriétaire vérifié est transmis : il porte l'événement d'annulation
    // (e-mail + audit), jamais une autorisation.
    expect(customerId).toBe(OWNER);
    expect(options.reason).toBe('Annulée par le client depuis son espace');
    expect(options.userId).toBeUndefined();
    expect(options.correlationId).toMatch(UUID_RE);
  });

  it('works for a guest customer id that is not numeric', async () => {
    const { controller, ordersService } = makeController(
      order({ ord_cst_id: 'guest-7f3a' }),
    );

    await controller.cancelOrder(ORDER_ID, req('guest-7f3a'));

    expect(ordersService.cancelOrder).toHaveBeenCalledTimes(1);
    const [, customerId, options] = ordersService.cancelOrder.mock.calls[0];
    expect(customerId).toBe('guest-7f3a');
    expect(options.userId).toBeUndefined();
  });

  it("answers 404 on someone else's order and does not cancel", async () => {
    const { controller, ordersService } = makeController(order());

    await expect(
      controller.cancelOrder(ORDER_ID, req('99999')),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(ordersService.cancelOrder).not.toHaveBeenCalled();
  });

  it('answers 404 on an order without customer, whoever asks', async () => {
    const { controller, ordersService } = makeController(
      order({ ord_cst_id: null }),
    );

    await expect(
      controller.cancelOrder(ORDER_ID, req('null')),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(ordersService.cancelOrder).not.toHaveBeenCalled();
  });

  it('answers 404 without a user id and never loads the order', async () => {
    const { controller, ordersService } = makeController(order());

    await expect(
      controller.cancelOrder(ORDER_ID, req()),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(ordersService.getOrderById).not.toHaveBeenCalled();
    expect(ordersService.cancelOrder).not.toHaveBeenCalled();
  });

  it.each([
    ['paid via Paybox', { ord_ords_id: '3', ord_is_pay: '1' }],
    ['paid, legacy status 1', { ord_ords_id: '1', ord_is_pay: '1' }],
    ['unpaid flag but a pay date', { ord_date_pay: '2020-11-27 12:40:00' }],
    ['unpaid in status 3', { ord_ords_id: '3' }],
    ['already cancelled', { ord_ords_id: '2' }],
    ['admin-cancelled (6)', { ord_ords_id: '6' }],
  ])('answers 409 when the order is %s', async (_label, overrides) => {
    const { controller, ordersService } = makeController(order(overrides));

    await expect(
      controller.cancelOrder(ORDER_ID, req(OWNER)),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(ordersService.cancelOrder).not.toHaveBeenCalled();
  });
});

describe('OrdersController.getOrderById — customer_can_cancel', () => {
  it.each([
    [{}, true],
    [{ ord_is_pay: '1', ord_ords_id: '3' }, false],
    [{ ord_date_pay: '2000-01-01 00:00:00' }, false],
    [{ ord_ords_id: '2' }, false],
  ])(
    'exposes the same rule as DELETE (%o → %s)',
    async (overrides, expected) => {
      const { controller } = makeController(order(overrides));

      const res = await controller.getOrderById(ORDER_ID, req(OWNER));

      expect(res.data.customer_can_cancel).toBe(expected);
      expect(res.data.ord_id).toBe(ORDER_ID);
    },
  );
});
