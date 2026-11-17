/**
 * OrdersService.createOrder — le total écrit sur la commande est le sous-total
 * plus le port (mandat BJ : forfait 9,90 € TTC sous 100 € TTC, offert dès 100 €).
 *
 * `ord_total_ttc` est le montant que le paiement relit en base avant de l'envoyer
 * à Paybox (`paybox-redirect.controller.ts` : « Re-read amount from DB ») : c'est
 * donc lui qui prouve que le montant payé inclut le port.
 *
 * Calculateur de port et calcul des totaux RÉELS ; seule la base est simulée.
 */

process.env.SUPABASE_URL ||= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';

import { ShippingCalculatorService } from '../../src/modules/cart/services/shipping-calculator.service';
import { OrderCalculationService } from '../../src/modules/orders/services/order-calculation.service';
import { OrdersService } from '../../src/modules/orders/services/orders.service';

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
  chain.then = (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
    resolved().then(onF, onR);
  return chain;
}

/** `poidsG` : poids connu de la pièce ; `undefined` = pièce sans poids en base. */
function makeService(poidsG: number | undefined) {
  const piecePriceData = {
    findWeightsInGrams: jest
      .fn()
      .mockResolvedValue(new Map(poidsG === undefined ? [] : [[4242, poidsG]])),
  };
  const shippingCalculator = new ShippingCalculatorService(
    piecePriceData as never,
  );

  const service = new OrdersService(
    new OrderCalculationService(),
    {} as never, // statusService — unused on the createOrder path
    {} as never, // shippingService — unused on the createOrder path
    shippingCalculator,
    { emit: jest.fn() } as never,
    {} as never, // mailService — guarded out (benign supabase → no customer email)
    {} as never, // piecePriceData — unused on the createOrder path
  );

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

function orderData(unitPrice: number, quantity = 1) {
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
        productId: '4242',
        productName: 'Jeu de 4 plaquettes de frein',
        productReference: 'REF-1',
        quantity,
        unitPrice,
        vatRate: 0,
        discount: 0,
      },
    ],
    billingAddress: address,
    shippingAddress: address,
  } as never;
}

/** La commande écrite par `create_order_atomic` (la relecture finale est hors sujet). */
async function commandeEcrite(
  poidsG: number | undefined,
  unitPrice: number,
  quantity = 1,
): Promise<Record<string, string>> {
  const { service, callRpc } = makeService(poidsG);
  await service
    .createOrder(orderData(unitPrice, quantity))
    .catch(() => undefined);

  expect(callRpc).toHaveBeenCalledTimes(1);
  const [rpcName, payload] = callRpc.mock.calls[0];
  expect(rpcName).toBe('create_order_atomic');
  return payload.p_order;
}

describe('OrdersService.createOrder — total payé = sous-total + port', () => {
  it('54,38 € à 2 018 g → port 9,90 €, total 64,28 €', async () => {
    const commande = await commandeEcrite(2018, 54.38);

    expect(commande.ord_amount_ttc).toBe('54.38');
    expect(commande.ord_shipping_fee_ttc).toBe('9.90');
    expect(commande.ord_total_ttc).toBe('64.28');
  });

  it('99,99 € → port 9,90 €, total 109,89 €', async () => {
    const commande = await commandeEcrite(2018, 99.99);

    expect(commande.ord_shipping_fee_ttc).toBe('9.90');
    expect(commande.ord_total_ttc).toBe('109.89');
  });

  it('100,00 € → port offert, total 100,00 €', async () => {
    const commande = await commandeEcrite(2018, 100);

    expect(commande.ord_shipping_fee_ttc).toBe('0.00');
    expect(commande.ord_total_ttc).toBe('100.00');
  });

  it('deux pièces à 50,00 € → seuil atteint par le sous-total, port offert', async () => {
    const commande = await commandeEcrite(2018, 50, 2);

    expect(commande.ord_amount_ttc).toBe('100.00');
    expect(commande.ord_shipping_fee_ttc).toBe('0.00');
    expect(commande.ord_total_ttc).toBe('100.00');
  });

  it('pièce sans poids en base → port 9,90 €', async () => {
    const commande = await commandeEcrite(undefined, 54.38);

    expect(commande.ord_shipping_fee_ttc).toBe('9.90');
    expect(commande.ord_total_ttc).toBe('64.28');
  });

  it('colis de 45 kg → port 9,90 € (plus de multi-colis en métropole)', async () => {
    const commande = await commandeEcrite(45000, 80);

    expect(commande.ord_shipping_fee_ttc).toBe('9.90');
    expect(commande.ord_total_ttc).toBe('89.90');
  });
});
