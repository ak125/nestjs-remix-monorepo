/**
 * Supplément après rupture depuis le back-office —
 * POST /api/admin/orders/:orderId/supplements.
 *
 * La route expose OrdersService.createSupplementOrder, qui porte toutes les
 * règles (commande payée, équivalent vendable, jamais à perte, création par
 * create_order_atomic). Ce test verrouille ce que la route ajoute :
 * - réservée à la permission canCreateOrders (ADMIN, SUPER_ADMIN), derrière
 *   AuthenticatedGuard et PermissionsGuard ;
 * - délègue au service avec l'administrateur connecté comme acteur ;
 * - n'envoie aucun mail : le texte proposé au client est validé par l'owner ;
 * - un refus du service est propagé tel quel (409, 404, 400).
 *
 * Identifiants fictifs : aucune donnée client.
 *
 * @see backend/src/modules/orders/controllers/order-actions.controller.ts (createSupplementOrder)
 * @see backend/src/modules/orders/services/orders.service.ts (createSupplementOrder)
 */

import 'reflect-metadata';
import { ConflictException, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { REQUIRE_PERMISSION_KEY } from '@auth/decorators/require-permission.decorator';
import { OrderActionsController } from '../../src/modules/orders/controllers/order-actions.controller';

const PARENT = 'ORD-1758000000000-123';
const CHILD = 'ORD-1758000000001-456';
const ADMIN_ID = 'adm-1';
const BODY = {
  lineId: `${PARENT}-L001`,
  pieceId: 2002,
  quantity: 2,
  confirmedPurchaseHt: 35,
};
const RESULT = {
  orderId: CHILD,
  parentOrderId: PARENT,
  totalTtc: 40,
  unitTtc: 20,
  quantity: 2,
  paymentUrl: `https://example.test/api/paybox/redirect?orderId=${CHILD}`,
};

function makeController() {
  const orderActionsService = {};
  const mailService = {
    sendOrderConfirmation: jest.fn(),
    sendPaymentReminder: jest.fn(),
    sendCancellationEmail: jest.fn(),
  };
  const ordersService = {
    createSupplementOrder: jest.fn().mockResolvedValue(RESULT),
  };
  const controller = new OrderActionsController(
    orderActionsService as never,
    mailService as never,
    ordersService as never,
  );
  return { controller, ordersService, mailService };
}

const req = { user: { id: ADMIN_ID } } as never;

describe('OrderActionsController.createSupplementOrder', () => {
  it('POST :orderId/supplements, réservée à canCreateOrders', () => {
    const handler = OrderActionsController.prototype.createSupplementOrder;

    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(
      ':orderId/supplements',
    );
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
      RequestMethod.POST,
    );
    expect(Reflect.getMetadata(REQUIRE_PERMISSION_KEY, handler)).toBe(
      'canCreateOrders',
    );
  });

  it("délègue à OrdersService.createSupplementOrder avec l'administrateur connecté", async () => {
    const { controller, ordersService } = makeController();

    await expect(
      controller.createSupplementOrder(PARENT, BODY, req),
    ).resolves.toMatchObject({ success: true, ...RESULT });

    expect(ordersService.createSupplementOrder).toHaveBeenCalledTimes(1);
    expect(ordersService.createSupplementOrder).toHaveBeenCalledWith(
      PARENT,
      BODY,
      { userId: ADMIN_ID },
    );
  });

  it("n'envoie aucun mail : le texte au client est validé par l'owner", async () => {
    const { controller, mailService } = makeController();

    await controller.createSupplementOrder(PARENT, BODY, req);

    for (const envoi of Object.values(mailService)) {
      expect(envoi).not.toHaveBeenCalled();
    }
  });

  it('propage le refus du service tel quel', async () => {
    const { controller, ordersService } = makeController();
    const refus = new ConflictException('Vente à perte refusée');
    ordersService.createSupplementOrder.mockRejectedValue(refus);

    await expect(
      controller.createSupplementOrder(PARENT, BODY, req),
    ).rejects.toBe(refus);
  });
});
