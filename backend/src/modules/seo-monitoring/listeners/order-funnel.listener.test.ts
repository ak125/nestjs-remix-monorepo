/**
 * Unit tests — OrderFunnelListener (Commerce-Loop V1 PR-A).
 *
 * The listener extends SupabaseBaseService whose constructor calls createClient
 * and requires SUPABASE_URL; to keep these tests hermetic (no env / no network)
 * we build instances via Object.create and inject the collaborators directly.
 */
import { OrderFunnelListener } from './order-funnel.listener';
import type { OrderPaidEvent } from '../../orders/events/order.events';

type LoggerStub = {
  warn: jest.Mock;
  error: jest.Mock;
  debug: jest.Mock;
  log: jest.Mock;
};

interface Harness {
  flags?: { funnelServerEmitEnabled: boolean };
  funnelEvents?: { recordOnce: jest.Mock; readOrderFacts?: jest.Mock };
  isReadOnlyMode?: boolean;
  supabase?: unknown;
}

function makeListener(over: Harness = {}) {
  const logger: LoggerStub = {
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
  };
  const funnelEvents = {
    recordOnce: jest.fn().mockResolvedValue({ ok: true, deduped: false }),
    readOrderFacts: jest.fn(),
    ...over.funnelEvents,
  };
  const listener = Object.create(
    OrderFunnelListener.prototype,
  ) as OrderFunnelListener;
  Object.assign(listener, {
    logger,
    flags: over.flags ?? { funnelServerEmitEnabled: true },
    funnelEvents,
    isReadOnlyMode: over.isReadOnlyMode ?? false,
    supabase: over.supabase ?? {},
  });
  return { listener, logger, funnelEvents };
}

const PAID_EVENT: OrderPaidEvent = {
  orderId: 'ORD-123',
  customerId: 'CUST-1',
  amount: 49.9,
  paymentRef: 'PBX-REF',
  gateway: 'paybox',
  timestamp: '2026-06-23T10:00:00.000Z',
};

describe('OrderFunnelListener.onOrderPaid', () => {
  it('is inert when the flag is OFF (no fetch, no emit)', async () => {
    const { listener, funnelEvents } = makeListener({
      flags: { funnelServerEmitEnabled: false },
    });
    await listener.onOrderPaid(PAID_EVENT);
    expect(funnelEvents.readOrderFacts).not.toHaveBeenCalled();
    expect(funnelEvents.recordOnce).not.toHaveBeenCalled();
  });

  it('skips emission under READ_ONLY (PROD-only)', async () => {
    const { listener, funnelEvents } = makeListener({ isReadOnlyMode: true });
    await listener.onOrderPaid(PAID_EVENT);
    expect(funnelEvents.readOrderFacts).not.toHaveBeenCalled();
    expect(funnelEvents.recordOnce).not.toHaveBeenCalled();
  });

  it('records r2_order_placed with the correct payload on the happy path', async () => {
    const { listener, funnelEvents } = makeListener();
    funnelEvents.readOrderFacts.mockResolvedValue({
      itemCount: 2,
      revenueCents: 4990,
    });

    await listener.onOrderPaid(PAID_EVENT);

    expect(funnelEvents.recordOnce).toHaveBeenCalledTimes(1);
    expect(funnelEvents.recordOnce).toHaveBeenCalledWith({
      event_type: 'r2_order_placed',
      entity_url: null,
      payload: {
        session_id: null,
        order_id: 'ORD-123',
        item_count: 2,
        revenue_cents: 4990,
        referrer: null,
      },
    });
  });

  it('skips (no bogus row) and warns when the order has no readable lines', async () => {
    const { listener, logger, funnelEvents } = makeListener();
    funnelEvents.readOrderFacts.mockResolvedValue({
      itemCount: 0,
      revenueCents: null,
    });

    await listener.onOrderPaid(PAID_EVENT);

    expect(funnelEvents.recordOnce).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('surfaces a real insert failure at error (no silent fallback)', async () => {
    const recordOnce = jest
      .fn()
      .mockResolvedValue({ ok: false, deduped: false });
    const { listener, logger, funnelEvents } = makeListener({
      funnelEvents: { recordOnce },
    });
    funnelEvents.readOrderFacts.mockResolvedValue({
      itemCount: 1,
      revenueCents: 1000,
    });

    await listener.onOrderPaid(PAID_EVENT);

    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('treats an idempotent dedup as benign (debug, not error)', async () => {
    const recordOnce = jest.fn().mockResolvedValue({ ok: true, deduped: true });
    const { listener, logger, funnelEvents } = makeListener({
      funnelEvents: { recordOnce },
    });
    funnelEvents.readOrderFacts.mockResolvedValue({
      itemCount: 1,
      revenueCents: 1000,
    });

    await listener.onOrderPaid(PAID_EVENT);

    expect(logger.debug).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('never throws when fetching facts fails (non-blocking)', async () => {
    const { listener, logger, funnelEvents } = makeListener();
    funnelEvents.readOrderFacts.mockRejectedValue(new Error('boom'));

    await expect(listener.onOrderPaid(PAID_EVENT)).resolves.toBeUndefined();
    expect(funnelEvents.recordOnce).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});
