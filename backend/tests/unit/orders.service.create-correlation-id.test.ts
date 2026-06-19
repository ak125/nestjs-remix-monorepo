/**
 * OrdersService.createOrder — regression test for the P0 checkout outage (2026-06-15).
 *
 * Root cause (#993): createOrder passed `orderData.idempotencyKey` (a string
 * `ik-<ts>-<rand>`, NOT a uuid) into `create_order_atomic`'s `p_correlation_id`,
 * which is typed `uuid` → PostgreSQL `invalid input syntax for type uuid`.
 * The idempotency key is a DIFFERENT identifier (controller dedup via
 * order_idempotency) and must never flow into the uuid correlation slot.
 *
 * This test locks the invariant: the value handed to create_order_atomic's
 * p_correlation_id is ALWAYS a valid UUID, never the idempotency key.
 *
 * @see backend/src/modules/orders/services/orders.service.ts (createOrder)
 */

import { OrdersService } from '../../src/modules/orders/services/orders.service';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Chainable, network-free Supabase stub: every query resolves to {data:null}. */
function benignSupabase(): unknown {
  const chain: Record<string, unknown> = {};
  const passthrough = [
    'from',
    'select',
    'insert',
    'update',
    'upsert',
    'delete',
    'eq',
    'neq',
    'in',
    'is',
    'not',
    'gte',
    'lte',
    'gt',
    'lt',
    'order',
    'limit',
    'range',
    'match',
  ];
  for (const m of passthrough) chain[m] = () => chain;
  const resolved = () => Promise.resolve({ data: null, error: null });
  chain.single = resolved;
  chain.maybeSingle = resolved;
  // The Supabase query builder is itself thenable — model that so bare
  // `await supabase.from(x).select(y)` resolves to {data:null}.
  chain.then = (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
    resolved().then(onF, onR);
  return chain;
}

function makeService(): {
  service: OrdersService;
  callRpc: jest.Mock;
} {
  const calculationService = {
    calculateOrderTotal: jest
      .fn()
      .mockResolvedValue({ subtotal: 31.24, consigne_total: 0, total: 42.43 }),
  };
  const shippingCalculator = {
    getCartItemsWeight: jest.fn().mockResolvedValue(1000),
    calculateByWeight: jest.fn().mockReturnValue(11.19),
  };
  const eventEmitter = { emit: jest.fn() };

  const service = new OrdersService(
    calculationService as never,
    {} as never, // statusService — unused on the createOrder path
    {} as never, // shippingService — unused on the createOrder path
    shippingCalculator as never,
    eventEmitter as never,
    {} as never, // mailService — guarded out (benign supabase → no customer email)
  );

  // Override the protected readonly `supabase` + `callRpc` (same technique the
  // existing order-status.service.test.ts uses for callRpc).
  Object.defineProperty(service, 'supabase', {
    value: benignSupabase(),
    configurable: true,
  });
  const callRpc = jest.fn().mockResolvedValue({ error: null });
  Object.defineProperty(service, 'callRpc', {
    value: callRpc,
    configurable: true,
  });

  return { service, callRpc };
}

function orderData(idempotencyKey?: string) {
  const address = {
    firstName: 'Jean',
    lastName: 'Test',
    address: '1 rue de la Paix',
    zipCode: '75002',
    city: 'Paris',
    country: 'France',
  };
  return {
    customerId: '12345',
    orderLines: [
      {
        productId: 'p1',
        productName: 'Jeu de 4 plaquettes de frein',
        productReference: 'REF-1',
        quantity: 1,
        unitPrice: 31.24,
        vatRate: 0,
        discount: 0,
      },
    ],
    billingAddress: address,
    shippingAddress: address,
    ...(idempotencyKey ? { idempotencyKey } : {}),
  } as never;
}

describe('OrdersService.createOrder — p_correlation_id is always a UUID', () => {
  // SupabaseBaseService construction reads SUPABASE_URL/SERVICE_ROLE_KEY from
  // env (getAppConfig). Provide hermetic dummies — no real client is used
  // (supabase is overridden by benignSupabase). Same env-injection pattern as
  // backend/tests/unit/supabase-key-util.test.ts.
  beforeAll(() => {
    process.env.SUPABASE_URL ||= 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';
  });

  // create_order_atomic is invoked at the RPC line; createOrder's tail then
  // re-reads the order via getOrderById, which throws on the stubbed DB. That
  // post-insert read is irrelevant to the invariant under test (the RPC payload
  // is already captured), so swallow it.
  async function runCreate(
    service: OrdersService,
    data: ReturnType<typeof orderData>,
  ): Promise<void> {
    await service.createOrder(data).catch(() => undefined);
  }

  it('passes a valid UUID (NOT the idempotency key) to create_order_atomic', async () => {
    const { service, callRpc } = makeService();
    const IK = 'ik-1781539584991-g7xkle'; // the exact key that crashed PROD

    await runCreate(service, orderData(IK));

    expect(callRpc).toHaveBeenCalledTimes(1);
    const [rpcName, payload] = callRpc.mock.calls[0];
    expect(rpcName).toBe('create_order_atomic');
    expect(payload.p_correlation_id).toEqual(expect.stringMatching(UUID_RE));
    expect(payload.p_correlation_id).not.toBe(IK);
  });

  it('passes a valid UUID even when no idempotency key is present', async () => {
    const { service, callRpc } = makeService();

    await runCreate(service, orderData());

    const [, payload] = callRpc.mock.calls[0];
    expect(payload.p_correlation_id).toEqual(expect.stringMatching(UUID_RE));
  });
});
