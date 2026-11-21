/**
 * OrdersService.createOrder — les montants viennent de l'autorité de prix.
 *
 * `createOrder` consomme les lignes postées par le checkout (invariant F2 : pas
 * de relecture du panier). Le prix, la consigne et l'identité de l'article
 * n'en sont pas moins des données du serveur : ils sont relus dans le tarif
 * vendable (`PiecePriceDataService`, P35) et dans le catalogue. Le total écrit
 * par `create_order_atomic` est celui que le paiement débite.
 *
 * Règles verrouillées :
 *  - ligne mal formée (article, quantité, prix) → 400, rien n'est écrit ;
 *  - article sans tarif vendable → 409, aucun prix de repli ;
 *  - montant écrit = tarif en vigueur, jamais le prix de la requête ;
 *  - tarif en vigueur supérieur au montant annoncé par la requête → 409 : le
 *    client ne paie jamais plus que ce que son panier affichait ;
 *  - total au tarif en vigueur, port compris, supérieur au total que le panier
 *    affichait pour les lignes annoncées → 409 : une baisse de prix qui fait
 *    repasser la commande sous le seuil du port offert ne se paie pas plus cher ;
 *  - référence, nom et marque écrits = ceux du catalogue ;
 *  - lecture du tarif en échec → l'erreur remonte, rien n'est écrit.
 *
 * @see backend/src/modules/orders/services/orders.service.ts (createOrder)
 * @see backend/src/database/services/piece-price-data.service.ts
 */

import { BadRequestException, ConflictException } from '@nestjs/common';
import { computeShippingAndTotal } from '../../src/modules/cart/controllers/cart-controller.utils';
import { ShippingCalculatorService } from '../../src/modules/cart/services/shipping-calculator.service';
import { OrderCalculationService } from '../../src/modules/orders/services/order-calculation.service';
import { OrdersService } from '../../src/modules/orders/services/orders.service';

const PIECE = 101;
const AUTRE_PIECE = 202;

type Tarif = { pri_vente_ttc_n: number; pri_consigne_ttc_n: number | null };

/** Client Supabase factice : `single()` répond selon la table interrogée. */
function makeSupabase(rows: Record<string, unknown>) {
  const from = (table: string) => {
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'order', 'limit', 'range']) {
      chain[m] = () => chain;
    }
    const resolved = () =>
      Promise.resolve({ data: rows[table] ?? null, error: null });
    chain.single = resolved;
    chain.maybeSingle = resolved;
    chain.then = (
      onF: (v: unknown) => unknown,
      onR?: (e: unknown) => unknown,
    ) => resolved().then(onF, onR);
    return chain;
  };
  return { from };
}

function makeService(
  opts: {
    tarifs?: Array<[number, Tarif]>;
    tarifError?: Error;
    catalogue?: Record<string, unknown>;
    /** Calculateur de port réel (seuil de gratuité compris) à la place du port fixe. */
    portReel?: ShippingCalculatorService;
  } = {},
) {
  const tarifs = new Map<number, Tarif>(
    opts.tarifs ?? [[PIECE, { pri_vente_ttc_n: 31.24, pri_consigne_ttc_n: 0 }]],
  );
  const piecePriceData = {
    findSellablePrices: opts.tarifError
      ? jest.fn().mockRejectedValue(opts.tarifError)
      : jest.fn().mockResolvedValue(tarifs),
  };
  const shippingCalculator = opts.portReel ?? {
    getCartItemsWeight: jest.fn().mockResolvedValue(1000),
    calculateByWeight: jest.fn().mockReturnValue(11.19),
  };
  const eventEmitter = { emit: jest.fn() };

  const service = new OrdersService(
    new OrderCalculationService(),
    {} as never, // statusService — unused on the createOrder path
    {} as never, // shippingService — unused on the createOrder path
    shippingCalculator as never,
    eventEmitter as never,
    {} as never, // mailService — no customer row in the stub, no mail sent
    piecePriceData as never,
  );

  Object.defineProperty(service, 'supabase', {
    value: makeSupabase(opts.catalogue ?? {}),
    configurable: true,
  });
  const callRpc = jest.fn().mockResolvedValue({ error: null });
  Object.defineProperty(service, 'callRpc', {
    value: callRpc,
    configurable: true,
  });
  // La relecture finale de la commande est hors du sujet de ce test.
  jest
    .spyOn(service, 'getOrderById')
    .mockResolvedValue({ ord_id: 'ORD-TEST' } as never);

  return { service, callRpc, piecePriceData, shippingCalculator };
}

function line(overrides: Record<string, unknown> = {}) {
  return {
    productId: String(PIECE),
    productName: 'Jeu de 4 plaquettes de frein',
    productReference: 'REF-101',
    productBrand: 'MARQUE',
    quantity: 1,
    unitPrice: 31.24,
    consigne_unit: 0,
    has_consigne: false,
    ...overrides,
  };
}

function orderData(lines: Array<Record<string, unknown>>) {
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
    orderLines: lines,
    billingAddress: address,
    shippingAddress: address,
  } as never;
}

function rpcPayload(callRpc: jest.Mock) {
  expect(callRpc).toHaveBeenCalledTimes(1);
  const [rpcName, payload] = callRpc.mock.calls[0];
  expect(rpcName).toBe('create_order_atomic');
  return payload as {
    p_order: Record<string, unknown>;
    p_lines: Array<Record<string, unknown>>;
  };
}

describe('OrdersService.createOrder — montants de l’autorité de prix', () => {
  beforeAll(() => {
    process.env.SUPABASE_URL ||= 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';
  });

  it('écrit le tarif en vigueur quand la requête annonce le même prix', async () => {
    const { service, callRpc, piecePriceData } = makeService();

    await service.createOrder(orderData([line({ quantity: 3 })]));

    expect(piecePriceData.findSellablePrices).toHaveBeenCalledWith([PIECE]);
    const { p_order, p_lines } = rpcPayload(callRpc);
    expect(p_lines[0]).toMatchObject({
      orl_pg_id: String(PIECE),
      orl_art_quantity: '3',
      orl_art_price_sell_unit_ttc: '31.24',
      orl_art_price_sell_ttc: '93.72',
      orl_art_deposit_unit_ttc: null,
      orl_art_deposit_ttc: null,
    });
    expect(p_order).toMatchObject({
      ord_amount_ttc: '93.72',
      ord_deposit_ttc: '0.00',
      ord_shipping_fee_ttc: '11.19',
      ord_total_ttc: '104.91',
    });
  });

  it('refuse (409) une requête qui annonce un prix inférieur au tarif', async () => {
    const { service, callRpc } = makeService();

    await expect(
      service.createOrder(orderData([line({ unitPrice: 0.01 })])),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(callRpc).not.toHaveBeenCalled();
  });

  it('applique le tarif en vigueur quand il a baissé depuis l’ajout au panier', async () => {
    const { service, callRpc, shippingCalculator } = makeService();

    await service.createOrder(
      orderData([line({ quantity: 2, unitPrice: 35 })]),
    );

    const { p_order, p_lines } = rpcPayload(callRpc);
    expect(p_lines[0]).toMatchObject({
      orl_art_price_sell_unit_ttc: '31.24',
      orl_art_price_sell_ttc: '62.48',
    });
    expect(p_order).toMatchObject({
      ord_amount_ttc: '62.48',
      ord_total_ttc: '73.67',
    });
    // Le seuil des frais de port se calcule sur le sous-total du tarif.
    expect(shippingCalculator.calculateByWeight).toHaveBeenCalledWith(
      1000,
      62.48,
    );
  });

  it('écrit la consigne du tarif, pas celle de la requête', async () => {
    const { service, callRpc } = makeService({
      tarifs: [[PIECE, { pri_vente_ttc_n: 31.24, pri_consigne_ttc_n: 20 }]],
    });

    await service.createOrder(
      orderData([line({ quantity: 2, consigne_unit: 25, has_consigne: true })]),
    );

    const { p_order, p_lines } = rpcPayload(callRpc);
    expect(p_lines[0]).toMatchObject({
      orl_art_price_sell_unit_ttc: '31.24',
      orl_art_deposit_unit_ttc: '20.00',
      orl_art_deposit_ttc: '40.00',
    });
    expect(p_order).toMatchObject({
      ord_amount_ttc: '62.48',
      ord_deposit_ttc: '40.00',
      ord_total_ttc: '113.67',
    });
  });

  it('refuse (409) une requête qui omet la consigne due', async () => {
    const { service, callRpc } = makeService({
      tarifs: [[PIECE, { pri_vente_ttc_n: 31.24, pri_consigne_ttc_n: 20 }]],
    });

    await expect(
      service.createOrder(
        orderData([line({ consigne_unit: 0, has_consigne: false })]),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(callRpc).not.toHaveBeenCalled();
  });

  it('refuse (409) un article sans tarif vendable, sans prix de repli', async () => {
    const { service, callRpc } = makeService();

    await expect(
      service.createOrder(
        orderData([line(), line({ productId: String(AUTRE_PIECE) })]),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(callRpc).not.toHaveBeenCalled();
  });

  it('ne lit le tarif qu’une fois par article', async () => {
    const { service, piecePriceData } = makeService();

    await service.createOrder(orderData([line(), line()]));

    expect(piecePriceData.findSellablePrices).toHaveBeenCalledTimes(1);
    expect(piecePriceData.findSellablePrices).toHaveBeenCalledWith([PIECE]);
  });

  it('laisse remonter un échec de lecture du tarif, sans rien écrire', async () => {
    const { service, callRpc } = makeService({
      tarifError: new Error('lecture pieces_price indisponible'),
    });

    await expect(service.createOrder(orderData([line()]))).rejects.toThrow(
      'lecture pieces_price indisponible',
    );
    expect(callRpc).not.toHaveBeenCalled();
  });

  it.each([[0], [-1], [1.5], ['2'], [Number.NaN], [null], [undefined]])(
    'refuse (400) une quantité qui n’est pas un entier positif (%p)',
    async (quantity) => {
      const { service, callRpc, piecePriceData } = makeService();

      await expect(
        service.createOrder(orderData([line({ quantity })])),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(piecePriceData.findSellablePrices).not.toHaveBeenCalled();
      expect(callRpc).not.toHaveBeenCalled();
    },
  );

  it.each([['p1'], ['101abc'], [''], ['0'], ['-101'], ['1.5'], [null]])(
    'refuse (400) un identifiant d’article invalide (%p)',
    async (productId) => {
      const { service, callRpc, piecePriceData } = makeService();

      await expect(
        service.createOrder(orderData([line({ productId })])),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(piecePriceData.findSellablePrices).not.toHaveBeenCalled();
      expect(callRpc).not.toHaveBeenCalled();
    },
  );

  it.each([['31.24'], [-1], [Number.NaN], [Number.POSITIVE_INFINITY], [null]])(
    'refuse (400) un prix annoncé qui n’est pas un montant (%p)',
    async (unitPrice) => {
      const { service, callRpc } = makeService();

      await expect(
        service.createOrder(orderData([line({ unitPrice })])),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(callRpc).not.toHaveBeenCalled();
    },
  );
});

/** Port de la grille factice : un seul palier, payant sous le seuil de gratuité. */
const PORT_PAYANT = 11.19;

/**
 * `ShippingCalculatorService` réel : son seuil de gratuité et sa règle sont ceux
 * du code. Seule la grille (lue en base au démarrage) est remplacée par un
 * palier unique ; un article sans poids connu pèse le forfait du service.
 */
function makePortReel() {
  const calc = new ShippingCalculatorService({
    findWeightsInGrams: jest.fn().mockResolvedValue(new Map()),
  } as never);
  (calc as unknown as { zoneTiers: Map<string, unknown[]> }).zoneTiers.set(
    'france',
    [{ minWeightG: 0, maxWeightG: 999999, feeTTC: PORT_PAYANT, feeHT: 9.33 }],
  );
  return calc;
}

/**
 * Total que le panier affiche pour ces lignes : le calcul de `GET /api/cart`
 * (`cart-core.controller.ts`), prix enregistrés à l'ajout, port du calculateur.
 */
async function totalAffiche(
  calc: ShippingCalculatorService,
  lines: Array<ReturnType<typeof line>>,
) {
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const consigne_total = lines.reduce(
    (s, l) => s + l.consigne_unit * l.quantity,
    0,
  );
  const poids = await calc.getCartItemsWeight(
    lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
  );
  return computeShippingAndTotal({
    subtotal,
    consigne_total,
    shippingCost: calc.calculateByWeight(poids, subtotal),
  }).totalWithShipping;
}

const centimes = (montant: number) => Math.round(montant * 100);

describe('OrdersService.createOrder — total débité plafonné par le total affiché', () => {
  beforeAll(() => {
    process.env.SUPABASE_URL ||= 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';
  });

  const tarif = (prix: number, consigne = 0): Tarif => ({
    pri_vente_ttc_n: prix,
    pri_consigne_ttc_n: consigne,
  });

  // [cas, lignes annoncées (prix du panier), tarifs en vigueur]
  const cas: Array<
    [string, Array<ReturnType<typeof line>>, Array<[number, Tarif]>]
  > = [
    [
      'prix inchangé, au seuil du port offert',
      [line({ quantity: 3, unitPrice: 50 })],
      [[PIECE, tarif(50)]],
    ],
    [
      'prix inchangé, sous le seuil',
      [line({ quantity: 2, unitPrice: 50 })],
      [[PIECE, tarif(50)]],
    ],
    [
      'baisse d’un centime qui passe sous le seuil du port offert',
      [line({ quantity: 3, unitPrice: 50 })],
      [[PIECE, tarif(49.99)]],
    ],
    [
      'baisse sur une ligne parmi deux, qui passe sous le seuil',
      [
        line({ unitPrice: 100 }),
        line({ productId: String(AUTRE_PIECE), unitPrice: 50 }),
      ],
      [
        [PIECE, tarif(100)],
        [AUTRE_PIECE, tarif(45)],
      ],
    ],
    [
      'baisse sous le seuil, plus forte que le port rétabli',
      [line({ quantity: 3, unitPrice: 50 })],
      [[PIECE, tarif(40)]],
    ],
    [
      'baisse qui reste au-dessus du seuil',
      [line({ quantity: 4, unitPrice: 50 })],
      [[PIECE, tarif(49.99)]],
    ],
    [
      'baisse sous le seuil des deux côtés',
      [line({ quantity: 2, unitPrice: 35 })],
      [[PIECE, tarif(31.24)]],
    ],
    [
      'baisse sous le seuil avec consigne (hors seuil)',
      [line({ quantity: 3, unitPrice: 50, consigne_unit: 20 })],
      [[PIECE, tarif(49.99, 20)]],
    ],
    [
      'hausse de prix',
      [line({ quantity: 3, unitPrice: 50 })],
      [[PIECE, tarif(50.01)]],
    ],
  ];

  it.each(cas)(
    'ne débite jamais plus que le total affiché — %s',
    async (_cas, lines, tarifs) => {
      const portReel = makePortReel();
      const { service, callRpc } = makeService({ tarifs, portReel });
      const affiche = await totalAffiche(portReel, lines);

      const issue = await service.createOrder(orderData(lines)).then(
        () => 'créée' as const,
        (e: unknown) => e,
      );

      if (issue === 'créée') {
        const { p_order } = rpcPayload(callRpc);
        expect(centimes(Number(p_order.ord_total_ttc))).toBeLessThanOrEqual(
          centimes(affiche),
        );
      } else {
        // Seul refus admis : le 409 du contrôle de prix, sans rien écrire.
        expect(issue).toBeInstanceOf(ConflictException);
        expect(callRpc).not.toHaveBeenCalled();
      }
    },
  );

  it('refuse (409) une baisse de prix qui rétablit un port supérieur à la baisse', async () => {
    const portReel = makePortReel();
    const { service, callRpc } = makeService({
      tarifs: [[PIECE, tarif(49.99)]],
      portReel,
    });
    const lines = [line({ quantity: 3, unitPrice: 50 })];
    // Affiché : 150,00 € port offert. Au tarif : 149,97 € + port.
    expect(await totalAffiche(portReel, lines)).toBe(150);

    await expect(service.createOrder(orderData(lines))).rejects.toThrow(
      new ConflictException(
        "Le prix d'un article de votre panier a changé. Retirez-le du panier puis ajoutez-le de nouveau pour voir le prix à jour.",
      ),
    );
    expect(callRpc).not.toHaveBeenCalled();
  });

  it('refuse la même commande dès la vérification des lignes du parcours invité', async () => {
    const { service } = makeService({
      tarifs: [[PIECE, tarif(49.99)]],
      portReel: makePortReel(),
    });

    await expect(
      service.lignesAuTarifEnVigueur([
        line({ quantity: 3, unitPrice: 50 }),
      ] as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('crée la commande, port compris, quand la baisse dépasse le port rétabli', async () => {
    const { service, callRpc } = makeService({
      tarifs: [[PIECE, tarif(40)]],
      portReel: makePortReel(),
    });

    await service.createOrder(
      orderData([line({ quantity: 3, unitPrice: 50 })]),
    );

    // Affiché : 150,00 € port offert. Débité : 120,00 € + 11,19 € de port.
    expect(rpcPayload(callRpc).p_order).toMatchObject({
      ord_amount_ttc: '120.00',
      ord_shipping_fee_ttc: '11.19',
      ord_total_ttc: '131.19',
    });
  });

  it('garde le port offert et le total affiché quand le prix n’a pas changé', async () => {
    const { service, callRpc } = makeService({
      tarifs: [[PIECE, tarif(50)]],
      portReel: makePortReel(),
    });

    await service.createOrder(
      orderData([line({ quantity: 3, unitPrice: 50 })]),
    );

    expect(rpcPayload(callRpc).p_order).toMatchObject({
      ord_amount_ttc: '150.00',
      ord_shipping_fee_ttc: '0.00',
      ord_total_ttc: '150.00',
    });
  });
});

describe('OrdersService.createOrder — identité de l’article', () => {
  beforeAll(() => {
    process.env.SUPABASE_URL ||= 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';
  });

  it('écrit la référence, le nom et la marque du catalogue', async () => {
    const { service, callRpc } = makeService({
      catalogue: {
        pieces: {
          piece_id: PIECE,
          piece_name: 'Plaquettes de frein avant',
          piece_ref: 'CAT-101',
          piece_pm_id: 7,
        },
        pieces_marque: { pm_name: 'MARQUE DU CATALOGUE' },
      },
    });

    await service.createOrder(
      orderData([
        line({
          productName: 'Un autre article',
          productReference: 'AUTRE-REF',
          productBrand: 'AUTRE MARQUE',
        }),
      ]),
    );

    const { p_lines } = rpcPayload(callRpc);
    expect(p_lines[0]).toMatchObject({
      orl_pg_id: String(PIECE),
      orl_pg_name: 'Plaquettes de frein avant',
      orl_art_ref: 'CAT-101',
      orl_pm_name: 'MARQUE DU CATALOGUE',
    });
  });
});
