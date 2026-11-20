/**
 * Modification d'une commande par le client — PATCH /api/orders/:id.
 *
 * Règles verrouillées :
 *  - seul le propriétaire de la commande atteint le service (404 sinon, même
 *    réponse que GET et DELETE /api/orders/:id) ;
 *  - un client ne change pas le statut de sa commande par cette route :
 *    l'annulation passe par DELETE /api/orders/:id et sa règle
 *    (`getCustomerCancelRefusal`), les autres statuts sont posés par le
 *    paiement ou par l'administration ;
 *  - la note est une chaîne ; rien d'autre du corps n'atteint le service.
 *
 * @see backend/src/modules/orders/controllers/orders.controller.ts (updateOrder)
 */

import 'reflect-metadata';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OrdersController } from '../../src/modules/orders/controllers/orders.controller';

const ORDER_ID = 1234567;
const OWNER = '81500';
const OTHER = '99999';

function order(overrides: Record<string, unknown> = {}) {
  return {
    ord_id: String(ORDER_ID),
    ord_cst_id: OWNER,
    ord_ords_id: '1',
    ord_is_pay: '0',
    customer: null,
    lines: [],
    statusHistory: [],
    ...overrides,
  };
}

function makeController(found: Record<string, unknown> = order()) {
  const ordersService = {
    getOrderById: jest.fn().mockResolvedValue(found),
    updateOrder: jest.fn().mockResolvedValue(found),
  };
  const controller = new OrdersController(
    ordersService as never,
    {} as never, // authService — unused on this path
    {} as never, // mailService — unused on this path
    {} as never, // cacheService — unused on this path
  );
  return { controller, ordersService };
}

function req(userId?: string) {
  return { user: userId ? { id: userId } : undefined, session: {} } as never;
}

describe('PATCH /api/orders/:id — propriétaire seulement', () => {
  it("refuse (404) la commande d'un autre client, sans rien écrire", async () => {
    const { controller, ordersService } = makeController();

    await expect(
      controller.updateOrder(ORDER_ID, { comment: 'note' }, req(OTHER)),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(ordersService.updateOrder).not.toHaveBeenCalled();
  });

  it('refuse (404) une commande sans client rattaché', async () => {
    const { controller, ordersService } = makeController(
      order({ ord_cst_id: null }),
    );

    await expect(
      controller.updateOrder(ORDER_ID, { comment: 'note' }, req(OTHER)),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(ordersService.updateOrder).not.toHaveBeenCalled();
  });

  it('refuse (404) un appel sans utilisateur identifié', async () => {
    const { controller, ordersService } = makeController();

    await expect(
      controller.updateOrder(ORDER_ID, { comment: 'note' }, req()),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(ordersService.getOrderById).not.toHaveBeenCalled();
    expect(ordersService.updateOrder).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/orders/:id — ce que le propriétaire peut changer', () => {
  it.each([[1], [2], [3], [4], [5], ['2'], [null]])(
    'refuse (403) tout changement de statut demandé par le client (status=%p)',
    async (status) => {
      const { controller, ordersService } = makeController();

      await expect(
        controller.updateOrder(
          ORDER_ID,
          { status, comment: 'note' } as never,
          req(OWNER),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(ordersService.updateOrder).not.toHaveBeenCalled();
    },
  );

  it.each([[{ texte: 'x' }], [42], [['a']]])(
    'refuse (400) une note qui n’est pas une chaîne (%p)',
    async (comment) => {
      const { controller, ordersService } = makeController();

      await expect(
        controller.updateOrder(ORDER_ID, { comment } as never, req(OWNER)),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(ordersService.updateOrder).not.toHaveBeenCalled();
    },
  );

  it('transmet la note du propriétaire, et seulement la note', async () => {
    const { controller, ordersService } = makeController();

    await controller.updateOrder(
      ORDER_ID,
      {
        comment: 'Sonner au portail',
        billingAddress: { city: 'Ailleurs' },
        shippingAddress: { city: 'Ailleurs' },
      } as never,
      req(OWNER),
    );

    expect(ordersService.updateOrder).toHaveBeenCalledTimes(1);
    const [id, data] = ordersService.updateOrder.mock.calls[0];
    expect(id).toBe(String(ORDER_ID));
    expect(data.customerNote).toBe('Sonner au portail');
    expect(data.status).toBeUndefined();
    expect(data.billingAddress).toBeUndefined();
    expect(data.shippingAddress).toBeUndefined();
  });
});
