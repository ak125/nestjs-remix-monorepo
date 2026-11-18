/**
 * Mandat BN (2026-11-17) — immatriculation / VIN / référence facultative et
 * véhicule de la page d'achat, enregistrés avec la commande.
 *
 * Verrouille : champ vide accepté (commande créée, ord_vehicle_check null) ;
 * valeur enregistrée dans p_order.ord_vehicle_check et relue telle quelle ;
 * valeur invalide refusée AVANT toute écriture (aucun appel RPC).
 *
 * Même harnais réseau-libre que orders.service.create-correlation-id.test.ts.
 */

import { BadRequestException } from '@nestjs/common';
import { OrdersService } from '../../src/modules/orders/services/orders.service';
import {
  buildOrderVehicleCheck,
  OrderVehicleCheckValidationError,
} from '../../src/modules/orders/services/order-vehicle-check';

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
    {} as never, // piecePriceData — unused on the createOrder path
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

function orderData(extra: Record<string, unknown> = {}) {
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
    ...extra,
  } as never;
}

const NOW = new Date('2026-11-17T18:00:00.000Z');

describe('buildOrderVehicleCheck (pur)', () => {
  it('renvoie null quand tout est vide', () => {
    expect(buildOrderVehicleCheck(undefined, [])).toBeNull();
    expect(buildOrderVehicleCheck({ customerReference: '   ' }, [])).toBeNull();
    expect(
      buildOrderVehicleCheck({ customerReference: null }, [
        null,
        undefined,
        { type_id: '' },
        { productId: '1', type_id: null },
      ]),
    ).toBeNull();
  });

  it('enregistre la valeur brute nettoyée, sans la classer', () => {
    const v = buildOrderVehicleCheck(
      { customerReference: '  AB-123-CD  ' },
      [],
      NOW,
    );
    expect(v).toEqual({
      version: 1,
      customer_reference: 'AB-123-CD',
      purchase_vehicle: null,
      line_type_ids: [],
      lines: [],
      captured_at: '2026-11-17T18:00:00.000Z',
    });
  });

  it("garde le véhicule de la page d'achat et les type_id distincts des lignes", () => {
    const v = buildOrderVehicleCheck(
      {
        customerReference: '',
        purchaseVehicle: {
          typeId: '18376',
          brand: 'RENAULT',
          model: 'CLIO III',
          engine: '1.5 dCi',
        },
      },
      [
        { type_id: 18376 },
        { type_id: '18376' },
        { type_id: 9045 },
        { type_id: null },
      ],
      NOW,
    );
    expect(v?.customer_reference).toBeNull();
    expect(v?.purchase_vehicle).toEqual({
      type_id: 18376,
      brand: 'RENAULT',
      model: 'CLIO III',
      engine: '1.5 dCi',
      source: 'vehicle_context',
    });
    expect(v?.line_type_ids).toEqual([9045, 18376]);
  });

  it('garde le véhicule de chaque ligne, sa provenance et son rang (mandat CK)', () => {
    const v = buildOrderVehicleCheck(
      { customerReference: '' },
      [
        { productId: '1946026', type_id: 18376, vehicle_source: 'page' },
        { productId: 77, type_id: '9045', vehicle_source: 'selected_vehicle' },
        { productId: '5', type_id: null },
        // client antérieur à CK : type_id sans provenance = page véhicule
        { productId: '6', type_id: 18376 },
        // provenance inconnue : ramenée à « page », jamais inventée autrement
        { productId: '7', type_id: 18376, vehicle_source: 'devine' },
      ],
      NOW,
    );
    expect(v?.lines).toEqual([
      { position: 1, product_id: '1946026', type_id: 18376, source: 'page' },
      {
        position: 2,
        product_id: '77',
        type_id: 9045,
        source: 'selected_vehicle',
      },
      { position: 3, product_id: '5', type_id: null, source: null },
      { position: 4, product_id: '6', type_id: 18376, source: 'page' },
      { position: 5, product_id: '7', type_id: 18376, source: 'page' },
    ]);
    expect(v?.line_type_ids).toEqual([9045, 18376]);
  });

  it.each([
    ['caractères interdits', '<script>'],
    ['trop long', 'A'.repeat(41)],
    ['commence par un tiret', '-AB123'],
  ])('refuse une référence invalide (%s)', (_label, value) => {
    expect(() =>
      buildOrderVehicleCheck({ customerReference: value }, []),
    ).toThrow(OrderVehicleCheckValidationError);
  });

  it('refuse un type_id de véhicule non entier positif', () => {
    expect(() =>
      buildOrderVehicleCheck({ purchaseVehicle: { typeId: -3 } as never }, []),
    ).toThrow(OrderVehicleCheckValidationError);
  });
});

describe('OrdersService.createOrder — ord_vehicle_check (mandat BN)', () => {
  beforeAll(() => {
    process.env.SUPABASE_URL ||= 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';
  });

  async function runCreate(
    service: OrdersService,
    data: ReturnType<typeof orderData>,
  ): Promise<void> {
    // La relecture post-insertion échoue sur la base simulée : sans objet ici.
    await service.createOrder(data).catch(() => undefined);
  }

  it('champ vide accepté : commande créée, ord_vehicle_check null', async () => {
    const { service, callRpc } = makeService();
    await runCreate(
      service,
      orderData({ vehicleCheck: { customerReference: '' } }),
    );
    expect(callRpc).toHaveBeenCalledTimes(1);
    const [, payload] = callRpc.mock.calls[0];
    expect(payload.p_order).toHaveProperty('ord_vehicle_check', null);
  });

  it('sans champ du tout (ancien client) : commande créée, ord_vehicle_check null', async () => {
    const { service, callRpc } = makeService();
    await runCreate(service, orderData());
    const [, payload] = callRpc.mock.calls[0];
    expect(payload.p_order.ord_vehicle_check).toBeNull();
  });

  it('valeur enregistrée et relue telle quelle dans p_order', async () => {
    const { service, callRpc } = makeService();
    await runCreate(
      service,
      orderData({
        vehicleCheck: {
          customerReference: 'VF1BB05CF12345678',
          purchaseVehicle: {
            typeId: 18376,
            brand: 'RENAULT',
            model: 'CLIO III',
          },
        },
      }),
    );
    const [, payload] = callRpc.mock.calls[0];
    // Relecture : la valeur traverse la sérialisation JSON (jsonb) sans perte.
    const stored = JSON.parse(
      JSON.stringify(payload.p_order.ord_vehicle_check),
    );
    expect(stored.customer_reference).toBe('VF1BB05CF12345678');
    expect(stored.purchase_vehicle.type_id).toBe(18376);
    expect(stored.version).toBe(1);
  });

  it('véhicule de chaque ligne transmis dans p_order, champ vide accepté (mandat CK)', async () => {
    const { service, callRpc } = makeService();
    const data = orderData({ vehicleCheck: { customerReference: '' } });
    data.orderLines = data.orderLines.map((l) => ({
      ...l,
      type_id: 9045,
      vehicle_source: 'selected_vehicle',
    }));
    await runCreate(service, data);
    expect(callRpc).toHaveBeenCalledTimes(1);
    const [, payload] = callRpc.mock.calls[0];
    const stored = JSON.parse(
      JSON.stringify(payload.p_order.ord_vehicle_check),
    );
    expect(stored.customer_reference).toBeNull();
    expect(stored.lines[0]).toMatchObject({
      position: 1,
      type_id: 9045,
      source: 'selected_vehicle',
    });
  });

  it('valeur invalide refusée avant toute écriture', async () => {
    const { service, callRpc } = makeService();
    await expect(
      service.createOrder(
        orderData({ vehicleCheck: { customerReference: 'DROP TABLE;' } }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(callRpc).not.toHaveBeenCalled();
  });
});
