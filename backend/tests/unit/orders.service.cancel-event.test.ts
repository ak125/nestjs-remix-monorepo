/**
 * OrdersService.cancelOrder — ORDER_EVENTS.CANCELLED est émis après succès
 * de la RPC, et seulement dans ce cas.
 *
 * Avant ce correctif, l'annulation client passait par cancel_order_atomic
 * sans émettre d'événement : OrderEmailListener (e-mail d'annulation) et
 * OrderAuditListener n'étaient jamais déclenchés. L'événement ne doit jamais
 * partir quand la RPC refuse (commande payée, déjà annulée, introuvable) :
 * le client recevrait un e-mail d'annulation pour une commande toujours
 * active.
 *
 * @see backend/src/modules/orders/services/orders.service.ts (cancelOrder)
 */

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { OrdersService } from '../../src/modules/orders/services/orders.service';
import { ORDER_EVENTS } from '../../src/modules/orders/events/order.events';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ORDER_ID = 'ORD-TEST-1';
const CUSTOMER_ID = '81500';

function makeService(rpcResult: unknown = { error: null }) {
  const eventEmitter = { emit: jest.fn() };
  const service = new OrdersService(
    {} as never, // calculationService — unused on the cancel path
    {} as never, // statusService
    {} as never, // shippingService
    {} as never, // shippingCalculator
    eventEmitter as never,
    {} as never, // mailService — l'e-mail part du listener, pas du service
  );
  const callRpc =
    rpcResult instanceof Error
      ? jest.fn().mockRejectedValue(rpcResult)
      : jest.fn().mockResolvedValue(rpcResult);
  Object.defineProperty(service, 'callRpc', {
    value: callRpc,
    configurable: true,
  });
  return { service, callRpc, eventEmitter };
}

describe('OrdersService.cancelOrder — événement d’annulation', () => {
  beforeAll(() => {
    process.env.SUPABASE_URL ||= 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';
  });

  it('émet ORDER_EVENTS.CANCELLED une fois, avec le même correlationId que la RPC', async () => {
    const { service, callRpc, eventEmitter } = makeService();
    const correlationId = '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e';

    await service.cancelOrder(ORDER_ID, CUSTOMER_ID, {
      reason: 'Annulée par le client depuis son espace',
      correlationId,
    });

    expect(callRpc).toHaveBeenCalledTimes(1);
    const [rpcName, params] = callRpc.mock.calls[0];
    expect(rpcName).toBe('cancel_order_atomic');
    expect(params).toEqual({
      p_ord_id: ORDER_ID,
      p_reason: 'Annulée par le client depuis son espace',
      p_user_id: null,
      p_correlation_id: correlationId,
    });

    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    const [eventName, payload] = eventEmitter.emit.mock.calls[0];
    expect(eventName).toBe(ORDER_EVENTS.CANCELLED);
    expect(payload).toMatchObject({
      orderId: ORDER_ID,
      customerId: CUSTOMER_ID,
      reason: 'Annulée par le client depuis son espace',
      // Sans userId admin, l'acteur est le propriétaire vérifié.
      changedBy: CUSTOMER_ID,
      correlationId,
    });
    expect(Number.isNaN(Date.parse(payload.timestamp))).toBe(false);
  });

  it('génère un UUID unique partagé par la RPC et l’événement quand aucun n’est fourni', async () => {
    const { service, callRpc, eventEmitter } = makeService();

    await service.cancelOrder(ORDER_ID, CUSTOMER_ID);

    const rpcCorrelation = callRpc.mock.calls[0][1].p_correlation_id;
    expect(rpcCorrelation).toMatch(UUID_RE);
    expect(eventEmitter.emit.mock.calls[0][1].correlationId).toBe(
      rpcCorrelation,
    );
    // Motif par défaut identique côté RPC et événement.
    expect(callRpc.mock.calls[0][1].p_reason).toBe('Commande annulée');
    expect(eventEmitter.emit.mock.calls[0][1].reason).toBe('Commande annulée');
  });

  it('attribue l’action à l’admin quand un userId est fourni', async () => {
    const { service, callRpc, eventEmitter } = makeService();

    await service.cancelOrder(ORDER_ID, CUSTOMER_ID, { userId: 42 });

    expect(callRpc.mock.calls[0][1].p_user_id).toBe(42);
    expect(eventEmitter.emit.mock.calls[0][1].changedBy).toBe('42');
    expect(eventEmitter.emit.mock.calls[0][1].customerId).toBe(CUSTOMER_ID);
  });

  // Messages RAISE EXCEPTION réels de cancel_order_atomic
  // (backend/supabase/migrations/20260523_002_cancel_order_atomic.sql).
  it.each([
    [
      'commande payée',
      'cancel_order_atomic: order ORD-TEST-1 is paid (status 5) — refund workflow required',
      ConflictException,
    ],
    [
      'déjà annulée',
      'cancel_order_atomic: order ORD-TEST-1 already cancelled (status 2)',
      ConflictException,
    ],
    [
      'introuvable',
      'cancel_order_atomic: order ORD-TEST-1 not found',
      NotFoundException,
    ],
    [
      'autre refus',
      'cancel_order_atomic: p_correlation_id is required',
      BadRequestException,
    ],
  ])(
    'n’émet rien quand la RPC refuse (%s)',
    async (_label, message, expected) => {
      const { service, eventEmitter } = makeService({ error: { message } });

      await expect(
        service.cancelOrder(ORDER_ID, CUSTOMER_ID),
      ).rejects.toBeInstanceOf(expected);
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    },
  );

  it('n’émet rien quand l’appel RPC lui-même échoue', async () => {
    const { service, eventEmitter } = makeService(new Error('network down'));

    await expect(service.cancelOrder(ORDER_ID, CUSTOMER_ID)).rejects.toThrow(
      'network down',
    );
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});
