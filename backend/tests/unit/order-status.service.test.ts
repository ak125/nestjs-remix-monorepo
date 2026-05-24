/**
 * OrderStatusService — Unit tests.
 *
 * Vault #301 PR-C: createStatusHistory now writes via the canonical RPC
 * `append_order_event` (single entry point for ___xtr_order_history) instead
 * of the broken `INSERT INTO ___xtr_order_status` (lookup table).
 *
 * Test target: appendOrderEvent (typed, primary) + createStatusHistory
 * (legacy-numeric wrapper for backward-compat callers).
 *
 * @see backend/src/modules/orders/services/order-status.service.ts
 */

import {
  OrderEventType,
  type OrderEventTypeCode,
} from '@repo/domain-commerce';
import { OrderStatusService } from '../../src/modules/orders/services/order-status.service';

function attachCallRpc(
  service: OrderStatusService,
  result: { error: unknown },
): jest.Mock {
  const callRpc = jest.fn().mockResolvedValue(result);
  Object.defineProperty(service, 'callRpc', {
    value: callRpc,
    configurable: true,
  });
  return callRpc;
}

describe('OrderStatusService.appendOrderEvent', () => {
  let service: OrderStatusService;

  beforeEach(() => {
    service = new OrderStatusService();
  });

  it('appelle la RPC canonique append_order_event avec p_correlation_id', async () => {
    const callRpc = attachCallRpc(service, { error: null });

    await service.appendOrderEvent({
      ordId: 'ORD-1',
      eventType: OrderEventType.STATUS_CHANGED,
      fromStatus: '1',
      toStatus: '2',
      payload: { trigger: 'test' },
      correlationId: '00000000-0000-0000-0000-000000000001',
      userId: 42,
    });

    expect(callRpc).toHaveBeenCalledTimes(1);
    expect(callRpc).toHaveBeenCalledWith(
      'append_order_event',
      expect.objectContaining({
        p_ord_id: 'ORD-1',
        p_event_type: 'STATUS_CHANGED',
        p_from_status: '1',
        p_to_status: '2',
        p_correlation_id: '00000000-0000-0000-0000-000000000001',
        p_user_id: 42,
      }),
      expect.objectContaining({ isServiceRole: true }),
    );
  });

  it('génère un correlation_id si absent (causalité préservée day 1)', async () => {
    const callRpc = attachCallRpc(service, { error: null });

    await service.appendOrderEvent({
      ordId: 'ORD-2',
      eventType: OrderEventType.NOTE_UPDATED,
      fromStatus: '1',
      toStatus: '1',
    });

    const args = callRpc.mock.calls[0][1] as { p_correlation_id: string };
    expect(args.p_correlation_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('propage l’erreur si la RPC échoue', async () => {
    attachCallRpc(service, { error: { message: 'boom' } });

    await expect(
      service.appendOrderEvent({
        ordId: 'ORD-3',
        eventType: OrderEventType.ORDER_CREATED,
        fromStatus: null,
        toStatus: '1',
      }),
    ).rejects.toBeDefined();
  });
});

describe('OrderStatusService.createStatusHistory (legacy wrapper)', () => {
  let service: OrderStatusService;

  beforeEach(() => {
    service = new OrderStatusService();
  });

  it('route vers la RPC append_order_event (event_type STATUS_CHANGED)', async () => {
    const callRpc = attachCallRpc(service, { error: null });

    await service.createStatusHistory(100, 2, 'cancel reason', 1);

    expect(callRpc).toHaveBeenCalledWith(
      'append_order_event',
      expect.objectContaining({
        p_ord_id: '100',
        p_event_type: 'STATUS_CHANGED',
        p_to_status: '2',
        p_user_id: 1,
      }),
      expect.objectContaining({ isServiceRole: true }),
    );
  });

  it('génère un commentaire par défaut depuis le libellé canon (5 valeurs)', async () => {
    const callRpc = attachCallRpc(service, { error: null });

    await service.createStatusHistory(200, 5);

    const args = callRpc.mock.calls[0][1] as {
      p_payload: { comment: string };
    };
    expect(args.p_payload.comment).toContain('Payée');
  });

  it('REJET statut hors-canon (sentinel Vault #301 : seulement 1..5 valides)', async () => {
    attachCallRpc(service, { error: null });

    await expect(service.createStatusHistory(300, 99)).rejects.toThrow(
      /hors-canon/,
    );
  });

  it('REJET ancien statut 6 (modèle-colis faux retiré par PR #696)', async () => {
    attachCallRpc(service, { error: null });

    await expect(service.createStatusHistory(400, 6)).rejects.toThrow(
      /hors-canon/,
    );
  });
});
