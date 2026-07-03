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
  funnelEvents?: { recordOnce: jest.Mock };
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
  const funnelEvents = over.funnelEvents ?? {
    recordOnce: jest.fn().mockResolvedValue({ ok: true, deduped: false }),
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

/** supabase mock returning a given line count + order total. */
function supabaseWith(opts: {
  count?: number | null;
  countError?: { message: string } | null;
  total?: unknown;
  orderError?: { message: string } | null;
}) {
  return {
    from: jest.fn((table: string) => {
      if (table === '___xtr_order_line') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() =>
              Promise.resolve({
                count: opts.count ?? 0,
                error: opts.countError ?? null,
              }),
            ),
          })),
        };
      }
      // ___xtr_order
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(() =>
              Promise.resolve({
                data:
                  opts.total === undefined
                    ? null
                    : { ord_total_ttc: opts.total },
                error: opts.orderError ?? null,
              }),
            ),
          })),
        })),
      };
    }),
  };
}

describe('OrderFunnelListener.onOrderPaid', () => {
  it('is inert when the flag is OFF (no fetch, no emit)', async () => {
    const { listener, funnelEvents } = makeListener({
      flags: { funnelServerEmitEnabled: false },
    });
    const fetchSpy = jest.spyOn(listener as never, 'fetchOrderFacts');
    await listener.onOrderPaid(PAID_EVENT);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(funnelEvents.recordOnce).not.toHaveBeenCalled();
  });

  it('skips emission under READ_ONLY (PROD-only)', async () => {
    const { listener, funnelEvents } = makeListener({ isReadOnlyMode: true });
    const fetchSpy = jest.spyOn(listener as never, 'fetchOrderFacts');
    await listener.onOrderPaid(PAID_EVENT);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(funnelEvents.recordOnce).not.toHaveBeenCalled();
  });

  it('records r2_order_placed with the correct payload on the happy path', async () => {
    const { listener, funnelEvents } = makeListener();
    jest
      .spyOn(listener as never, 'fetchOrderFacts')
      .mockResolvedValue({ itemCount: 2, revenueCents: 4990 } as never);

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
    jest
      .spyOn(listener as never, 'fetchOrderFacts')
      .mockResolvedValue({ itemCount: 0, revenueCents: null } as never);

    await listener.onOrderPaid(PAID_EVENT);

    expect(funnelEvents.recordOnce).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('surfaces a real insert failure at error (no silent fallback)', async () => {
    const recordOnce = jest
      .fn()
      .mockResolvedValue({ ok: false, deduped: false });
    const { listener, logger } = makeListener({ funnelEvents: { recordOnce } });
    jest
      .spyOn(listener as never, 'fetchOrderFacts')
      .mockResolvedValue({ itemCount: 1, revenueCents: 1000 } as never);

    await listener.onOrderPaid(PAID_EVENT);

    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('treats an idempotent dedup as benign (debug, not error)', async () => {
    const recordOnce = jest.fn().mockResolvedValue({ ok: true, deduped: true });
    const { listener, logger } = makeListener({ funnelEvents: { recordOnce } });
    jest
      .spyOn(listener as never, 'fetchOrderFacts')
      .mockResolvedValue({ itemCount: 1, revenueCents: 1000 } as never);

    await listener.onOrderPaid(PAID_EVENT);

    expect(logger.debug).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('never throws when fetching facts fails (non-blocking)', async () => {
    const { listener, logger, funnelEvents } = makeListener();
    jest
      .spyOn(listener as never, 'fetchOrderFacts')
      .mockRejectedValue(new Error('boom') as never);

    await expect(listener.onOrderPaid(PAID_EVENT)).resolves.toBeUndefined();
    expect(funnelEvents.recordOnce).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});

describe('OrderFunnelListener.fetchOrderFacts (supabase chain)', () => {
  it('reads line count + parses the order total into cents', async () => {
    const { listener } = makeListener({
      supabase: supabaseWith({ count: 3, total: '49.90' }),
    });
    const facts = await (
      listener as unknown as {
        fetchOrderFacts: (id: string) => Promise<unknown>;
      }
    ).fetchOrderFacts('ORD-123');
    expect(facts).toEqual({ itemCount: 3, revenueCents: 4990 });
  });

  it('returns null when the line-count read errors', async () => {
    const { listener } = makeListener({
      supabase: supabaseWith({
        count: null,
        countError: { message: 'db down' },
      }),
    });
    const facts = await (
      listener as unknown as {
        fetchOrderFacts: (id: string) => Promise<unknown>;
      }
    ).fetchOrderFacts('ORD-123');
    expect(facts).toBeNull();
  });

  it('yields null revenue when the total is absent/unparseable', async () => {
    const { listener } = makeListener({
      supabase: supabaseWith({ count: 1, total: 'n/a' }),
    });
    const facts = await (
      listener as unknown as {
        fetchOrderFacts: (
          id: string,
        ) => Promise<{ revenueCents: number | null }>;
      }
    ).fetchOrderFacts('ORD-123');
    expect(facts.revenueCents).toBeNull();
  });
});

describe('OrderFunnelListener.toCents', () => {
  const cents = (v: unknown) =>
    (
      makeListener().listener as unknown as {
        toCents: (v: unknown) => number | null;
      }
    ).toCents(v);

  it.each([
    ['49.90', 4990],
    ['10', 1000],
    ['0', 0],
  ])('parses %s → %s cents', (input, expected) => {
    expect(cents(input)).toBe(expected);
  });

  it.each([[null], [undefined], ['abc'], ['-5']])(
    'returns null for %s',
    (input) => {
      expect(cents(input)).toBeNull();
    },
  );
});
