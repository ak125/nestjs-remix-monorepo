/**
 * OrdersService.updateOrder — une commande payée ne s'annule pas par la mise à
 * jour générique.
 *
 * Le paiement pose `ord_is_pay = '1'` avec le statut '3' ; le canon des
 * transitions permet '3' → '2' et '4' → '2'. Sans garde de paiement, la mise à
 * jour générique annulait donc une commande payée sans remboursement, alors
 * que `cancel_order_atomic` (voie d'annulation) la refuse. La lecture du
 * paiement est celle de `getCustomerCancelRefusal` : drapeau `ord_is_pay` ou
 * date de paiement.
 *
 * @see backend/src/modules/orders/services/orders.service.ts (updateOrder)
 */

import { ConflictException } from '@nestjs/common';
import { OrdersService } from '../../src/modules/orders/services/orders.service';

const ORDER_ID = '1234567';

function makeService(existing: Record<string, unknown>) {
  const update = jest.fn();
  const supabase = {
    from: () => ({
      update: (payload: unknown) => {
        update(payload);
        return { eq: () => Promise.resolve({ error: null }) };
      },
    }),
  };
  const statusService = {
    appendOrderEvent: jest.fn().mockResolvedValue(undefined),
  };

  const service = new OrdersService(
    {} as never, // calculationService — unused on the updateOrder path
    statusService as never,
    {} as never, // shippingService
    {} as never, // shippingCalculator
    {} as never, // eventEmitter
    {} as never, // mailService
    {} as never, // piecePriceData
  );
  Object.defineProperty(service, 'supabase', {
    value: supabase,
    configurable: true,
  });
  jest.spyOn(service, 'getOrderById').mockResolvedValue(existing as never);

  return { service, update, statusService };
}

function order(overrides: Record<string, unknown>) {
  return {
    ord_id: ORDER_ID,
    ord_cst_id: '81500',
    ord_ords_id: '3',
    ord_is_pay: '1',
    ord_date_pay: '2026-11-18T10:00:00.000Z',
    ord_info: null,
    ...overrides,
  };
}

describe('OrdersService.updateOrder — commande payée', () => {
  beforeAll(() => {
    process.env.SUPABASE_URL ||= 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';
  });

  it.each([
    ['drapeau de paiement, statut 3', { ord_ords_id: '3' }],
    ['drapeau de paiement, statut 4', { ord_ords_id: '4' }],
    ['date de paiement seule, statut 3', { ord_ords_id: '3', ord_is_pay: '0' }],
    [
      'drapeau seul, statut 1 (commande payée historique)',
      { ord_ords_id: '1', ord_date_pay: null },
    ],
  ])('refuse (409) le passage à annulée : %s', async (_label, overrides) => {
    const { service, update, statusService } = makeService(order(overrides));

    await expect(
      service.updateOrder(ORDER_ID, { status: '2' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(update).not.toHaveBeenCalled();
    expect(statusService.appendOrderEvent).not.toHaveBeenCalled();
  });

  it('laisse une commande payée avancer (3 → 4)', async () => {
    const { service, update } = makeService(order({ ord_ords_id: '3' }));

    await service.updateOrder(ORDER_ID, { status: '4' });

    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0]).toMatchObject({ ord_ords_id: '4' });
  });

  it('laisse une commande impayée être annulée (1 → 2)', async () => {
    const { service, update } = makeService(
      order({ ord_ords_id: '1', ord_is_pay: '0', ord_date_pay: null }),
    );

    await service.updateOrder(ORDER_ID, { status: '2' });

    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0]).toMatchObject({ ord_ords_id: '2' });
  });
});
