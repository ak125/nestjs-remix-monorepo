/**
 * Annulation depuis le back-office — POST /api/admin/orders/:orderId/cancel.
 *
 * La route écrivait elle-même la commande : statut '6' (hors des 5 statuts de
 * ___xtr_order_status), aucun contrôle de paiement (seuls '4' et '5' étaient
 * refusés, or une commande payée est le plus souvent en '1' ou '3'), un
 * historique dans une table absente, et deux mails d'annulation au client
 * (l'écouteur de ORDER_EVENTS.CANCELLED, puis le contrôleur).
 *
 * Ce test verrouille : l'annulation passe par OrdersService.cancelOrder, seul
 * propriétaire de cancel_order_atomic (authority-graph.yaml,
 * order_lifecycle.cancellation), qui refuse une commande payée et journalise
 * ORDER_CANCELLED ; aucune écriture directe ; un seul événement, donc un seul
 * mail, envoyé par l'écouteur ; aucun événement si la RPC refuse.
 *
 * @see backend/src/modules/orders/services/order-actions.service.ts (cancelOrder)
 * @see backend/src/modules/orders/controllers/order-actions.controller.ts (cancelOrder)
 * @see .spec/00-canon/commerce-runtime/authority-graph.yaml
 */

import 'reflect-metadata';
import { ConflictException } from '@nestjs/common';
import { OrderActionsService } from '../../src/modules/orders/services/order-actions.service';
import { OrderActionsController } from '../../src/modules/orders/controllers/order-actions.controller';
import { ORDER_EVENTS } from '../../src/modules/orders/events/order.events';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ORDER_ID = 'ORD-1758000000000-123';
const CUSTOMER = '81500';
const REASON = 'Rupture fournisseur';

function makeService() {
  const emit = jest.fn();
  const ordersService = {
    cancelOrder: jest.fn().mockResolvedValue({
      success: true,
      message: 'Commande annulée',
      ord_id: ORDER_ID,
    }),
  };
  const service = new OrderActionsService(
    { emit } as never,
    ordersService as never,
  );
  // Tout accès direct aux tables passe par `from` : il ne doit y en avoir aucun.
  const from = jest.fn(() => {
    throw new Error('accès direct à une table');
  });
  Object.defineProperty(service, 'supabase', {
    value: { from },
    configurable: true,
  });
  jest.spyOn(service, 'getOrder').mockResolvedValue({
    ord_id: ORDER_ID,
    ord_cst_id: CUSTOMER,
    ord_ords_id: '1',
  } as never);
  return { service, ordersService, emit, from };
}

describe('OrderActionsService.cancelOrder', () => {
  beforeAll(() => {
    process.env.SUPABASE_URL ||= 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';
  });

  it('annule par OrdersService.cancelOrder, sans écrire la commande', async () => {
    const { service, ordersService, from } = makeService();

    await expect(service.cancelOrder(ORDER_ID, REASON)).resolves.toEqual({
      success: true,
      newStatus: '2',
      reason: REASON,
    });

    expect(ordersService.cancelOrder).toHaveBeenCalledTimes(1);
    const [orderId, reason, userId, correlationId] =
      ordersService.cancelOrder.mock.calls[0];
    expect({ orderId, reason, userId }).toEqual({
      orderId: ORDER_ID,
      reason: REASON,
      userId: undefined,
    });
    expect(correlationId).toMatch(UUID_RE);
    expect(from).not.toHaveBeenCalled();
  });

  it('émet un seul ORDER_EVENTS.CANCELLED, avec la corrélation de la RPC', async () => {
    const { service, ordersService, emit } = makeService();

    await service.cancelOrder(ORDER_ID, REASON);

    expect(emit).toHaveBeenCalledTimes(1);
    const [name, event] = emit.mock.calls[0];
    expect(name).toBe(ORDER_EVENTS.CANCELLED);
    expect(event).toMatchObject({
      orderId: ORDER_ID,
      customerId: CUSTOMER,
      reason: REASON,
      correlationId: ordersService.cancelOrder.mock.calls[0][3],
    });
  });

  it('refus de la RPC (commande payée) : erreur propagée, aucun événement', async () => {
    const { service, ordersService, emit } = makeService();
    ordersService.cancelOrder.mockRejectedValue(
      new ConflictException(
        "Annulation d'une commande payée requiert un workflow remboursement séparé, contactez le support.",
      ),
    );

    await expect(service.cancelOrder(ORDER_ID, REASON)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(emit).not.toHaveBeenCalled();
  });
});

describe('OrderActionsController.cancelOrder', () => {
  it("n'envoie aucun mail lui-même : l'écouteur de l'événement s'en charge", async () => {
    const orderActionsService = {
      cancelOrder: jest
        .fn()
        .mockResolvedValue({ success: true, newStatus: '2', reason: REASON }),
      getOrder: jest.fn(),
      getCustomer: jest.fn(),
    };
    const mailService = { sendCancellationEmail: jest.fn() };
    const controller = new OrderActionsController(
      orderActionsService as never,
      mailService as never,
      {} as never, // ordersService — hors du chemin de l'annulation
    );

    await expect(
      controller.cancelOrder(ORDER_ID, { reason: REASON }),
    ).resolves.toMatchObject({ success: true });

    expect(orderActionsService.cancelOrder).toHaveBeenCalledWith(
      ORDER_ID,
      REASON,
    );
    expect(mailService.sendCancellationEmail).not.toHaveBeenCalled();
  });
});
