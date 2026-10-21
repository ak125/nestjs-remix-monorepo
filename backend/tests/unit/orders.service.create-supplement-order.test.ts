/**
 * OrdersService.createSupplementOrder — commande de supplément après une rupture.
 *
 * Une pièce payée est en rupture chez le fournisseur ; l'équivalent disponible
 * coûte plus cher. Le client paie la différence par une commande ENFANT
 * (`ord_parent` = commande d'origine), non payée, que lit le lien de paiement.
 * Jusqu'ici, cette commande ne pouvait être créée que par un script SQL tenu à
 * la main (skill order-rupture-equivalence, supplement-create.sql).
 *
 * Ce test verrouille les règles de ce script, portées dans le service :
 * - création par create_order_atomic seulement (commande + ligne + ORDER_CREATED
 *   dans une transaction), avec une corrélation explicite ;
 * - commande d'origine payée, non annulée, montants égaux à ses lignes ;
 * - ligne en rupture dans la commande d'origine ;
 * - aucun autre supplément non annulé sur la commande ;
 * - équivalent affiché, vendable selon PiecePriceDataService, autre que la
 *   pièce en rupture, sans consigne, jamais vendu à perte (achat en base ET
 *   achat confirmé chez le fournisseur) ;
 * - supplément = quantité × prix TTC − montant payé pour la ligne, strictement
 *   positif et divisible au centime par la quantité ;
 * - port et consigne à 0 ; aucun mail envoyé ; aucune écriture directe ;
 * - un refus n'écrit rien et n'émet rien.
 *
 * Identifiants fictifs : aucune donnée client.
 *
 * @see backend/src/modules/orders/services/orders.service.ts (createSupplementOrder)
 * @see .claude/skills/order-rupture-equivalence/supplement-create.sql
 */

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { TABLES } from '@repo/database-types';
import { SITE_ORIGIN } from '../../src/config/site.constants';
import { OrdersService } from '../../src/modules/orders/services/orders.service';
import { ORDER_EVENTS } from '../../src/modules/orders/events/order.events';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PARENT = 'ORD-1758000000000-123';
const LINE = `${PARENT}-L001`;
const CUSTOMER = '81500';
const EMAIL = 'client@example.test';
const RUPTURE_PIECE = 1001;
const EQUIVALENT = 2002;

type Row = Record<string, unknown>;

/**
 * Base factice en lecture seule : `from(table).select().eq()…` filtre les
 * lignes en mémoire. Aucune méthode d'écriture n'existe : un insert ou un
 * update direct lèverait une TypeError et ferait échouer le test.
 */
function fakeSupabase(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      const filters: Array<[string, unknown]> = [];
      const rows = () =>
        (tables[table] ?? []).filter((r) =>
          filters.every(([col, val]) => String(r[col]) === String(val)),
        );
      const builder = {
        select: () => builder,
        eq: (col: string, val: unknown) => {
          filters.push([col, val]);
          return builder;
        },
        maybeSingle: async () => {
          const r = rows();
          return r.length > 1
            ? { data: null, error: { message: 'plusieurs lignes' } }
            : { data: r[0] ?? null, error: null };
        },
        then: (
          resolve: (v: { data: Row[]; error: null }) => unknown,
          reject: (e: unknown) => unknown,
        ) =>
          Promise.resolve({ data: rows(), error: null }).then(resolve, reject),
      };
      return builder;
    },
  };
}

function parentOrder(over: Row = {}): Row {
  return {
    ord_id: PARENT,
    ord_cst_id: CUSTOMER,
    ord_parent: '0',
    ord_is_pay: '1',
    ord_date_pay: '2026-09-01 10:00:00',
    ord_ords_id: '1',
    ord_amount_ttc: '60.00',
    ord_deposit_ttc: '0.00',
    ord_cba_id: '11',
    ord_cda_id: '12',
    ord_billing_snapshot: { city: 'Exempleville' },
    ord_shipping_snapshot: { city: 'Exempleville' },
    ...over,
  };
}

function parentLine(over: Row = {}): Row {
  return {
    orl_id: LINE,
    orl_ord_id: PARENT,
    orl_pg_id: String(RUPTURE_PIECE),
    orl_pm_name: 'MARQUE A',
    orl_art_ref: 'REF-A',
    orl_art_quantity: '1',
    orl_art_price_sell_ttc: '60.00',
    orl_art_deposit_ttc: null,
    ...over,
  };
}

function tariff(over: Row = {}): Row {
  return {
    pri_piece_id_i: EQUIVALENT,
    pri_type: '1',
    pri_dispo: '1',
    pri_vente_ttc_n: 50,
    pri_vente_ht_n: 41.67,
    pri_achat_ht_n: 30,
    pri_consigne_ttc_n: 0,
    ...over,
  };
}

interface Setup {
  parent?: Row | null;
  lines?: Row[];
  children?: Row[];
  piece?: Row | null;
  brand?: Row | null;
  customer?: Row | null;
  price?: Row | null;
}

function makeService(setup: Setup = {}) {
  const parent = setup.parent === undefined ? parentOrder() : setup.parent;
  const piece =
    setup.piece === undefined
      ? {
          piece_id: EQUIVALENT,
          piece_name: 'Disque de frein',
          piece_ref: 'EQ-22',
          piece_pm_id: 7,
          piece_display: true,
        }
      : setup.piece;
  const brand =
    setup.brand === undefined
      ? { pm_id: '7', pm_name: 'MARQUE B' }
      : setup.brand;
  const customer =
    setup.customer === undefined
      ? { cst_id: CUSTOMER, cst_mail: EMAIL }
      : setup.customer;

  const db = fakeSupabase({
    [TABLES.xtr_order]: [
      ...(parent ? [parent] : []),
      ...(setup.children ?? []),
    ],
    [TABLES.xtr_order_line]: setup.lines ?? [parentLine()],
    [TABLES.pieces]: piece ? [piece] : [],
    [TABLES.pieces_marque]: brand ? [brand] : [],
    [TABLES.xtr_customer]: customer ? [customer] : [],
  });

  const emit = jest.fn();
  const mailService = {
    sendOrderConfirmation: jest.fn(),
    sendPaymentReminder: jest.fn(),
  };
  const price = setup.price === undefined ? tariff() : setup.price;
  const piecePriceData = {
    findSellablePrice: jest.fn().mockResolvedValue(price),
  };

  const service = new OrdersService(
    {} as never, // calculationService — hors du chemin du supplément
    {} as never, // statusService
    {} as never, // shippingService
    {} as never, // shippingCalculator
    { emit } as never,
    mailService as never,
    piecePriceData as never,
  );
  const callRpc = jest.fn().mockResolvedValue({ data: 'ok', error: null });
  Object.defineProperty(service, 'callRpc', {
    value: callRpc,
    configurable: true,
  });
  Object.defineProperty(service, 'supabase', {
    value: db,
    configurable: true,
  });

  return { service, callRpc, emit, mailService, piecePriceData };
}

const INPUT = {
  lineId: LINE,
  pieceId: EQUIVALENT,
  quantity: 2,
  confirmedPurchaseHt: 35,
};

describe('OrdersService.createSupplementOrder — création', () => {
  beforeAll(() => {
    process.env.SUPABASE_URL ||= 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';
  });

  it('crée la commande enfant par create_order_atomic : supplément = 2 × 50,00 − 60,00', async () => {
    const { service, callRpc } = makeService();

    const result = await service.createSupplementOrder(PARENT, INPUT);

    expect(callRpc).toHaveBeenCalledTimes(1);
    const [rpc, params, options] = callRpc.mock.calls[0];
    expect(rpc).toBe('create_order_atomic');
    expect(options).toEqual({ isServiceRole: true, source: 'internal' });
    expect(params.p_correlation_id).toMatch(UUID_RE);

    const child = params.p_order.ord_id;
    expect(child).toMatch(/^ORD-\d+-\d{3}$/);
    expect(child).not.toBe(PARENT);
    expect(params.p_order).toMatchObject({
      ord_cst_id: CUSTOMER,
      ord_parent: PARENT,
      ord_is_pay: '0',
      ord_date_pay: null,
      ord_amount_ttc: '40.00',
      ord_deposit_ttc: '0.00',
      ord_shipping_fee_ttc: '0.00',
      ord_total_ttc: '40.00',
      ord_ords_id: '1',
      ord_cba_id: '11',
      ord_cda_id: '12',
      ord_billing_snapshot: { city: 'Exempleville' },
      ord_shipping_snapshot: { city: 'Exempleville' },
    });
    expect(params.p_order.ord_info).toContain(PARENT);
    expect(params.p_order.ord_info).toContain('MARQUE A REF-A');
    expect(params.p_order.ord_info).toContain('MARQUE B EQ-22');

    expect(params.p_lines).toEqual([
      {
        orl_id: `${child}-L001`,
        orl_ord_id: child,
        orl_pg_id: String(EQUIVALENT),
        orl_pg_name:
          'Disque de frein — supplément échange (remplace MARQUE A REF-A)',
        orl_pm_name: 'MARQUE B',
        orl_art_ref: 'EQ-22',
        orl_art_quantity: '2',
        orl_art_price_sell_unit_ttc: '20.00',
        orl_art_price_sell_ttc: '40.00',
        orl_art_deposit_unit_ttc: null,
        orl_art_deposit_ttc: null,
        orl_website_url: null,
      },
    ]);

    expect(result).toMatchObject({
      orderId: child,
      parentOrderId: PARENT,
      totalTtc: 40,
      unitTtc: 20,
      quantity: 2,
    });
  });

  it('rend le lien de paiement du site, lu par /api/paybox/redirect', async () => {
    const { service, callRpc } = makeService();

    const { paymentUrl } = await service.createSupplementOrder(PARENT, INPUT);

    const url = new URL(paymentUrl);
    expect(url.origin).toBe(SITE_ORIGIN);
    expect(url.pathname).toBe('/api/paybox/redirect');
    expect(url.searchParams.get('orderId')).toBe(
      callRpc.mock.calls[0][1].p_order.ord_id,
    );
    expect(url.searchParams.get('amount')).toBe('40.00');
    expect(url.searchParams.get('email')).toBe(EMAIL);
  });

  it('émet un seul ORDER_EVENTS.CREATED avec la corrélation de la RPC, sans envoyer de mail', async () => {
    const { service, callRpc, emit, mailService } = makeService();

    await service.createSupplementOrder(PARENT, INPUT);

    expect(emit).toHaveBeenCalledTimes(1);
    const [name, event] = emit.mock.calls[0];
    expect(name).toBe(ORDER_EVENTS.CREATED);
    expect(event).toMatchObject({
      orderId: callRpc.mock.calls[0][1].p_order.ord_id,
      customerId: CUSTOMER,
      totalTtc: 40,
      linesCount: 1,
      correlationId: callRpc.mock.calls[0][1].p_correlation_id,
    });
    expect(mailService.sendOrderConfirmation).not.toHaveBeenCalled();
    expect(mailService.sendPaymentReminder).not.toHaveBeenCalled();
  });

  it("lit le tarif de l'équivalent par PiecePriceDataService, autorité unique", async () => {
    const { service, piecePriceData } = makeService();

    await service.createSupplementOrder(PARENT, INPUT);

    expect(piecePriceData.findSellablePrice).toHaveBeenCalledWith(EQUIVALENT);
  });

  it('un supplément annulé ne bloque pas une nouvelle proposition', async () => {
    const { service, callRpc } = makeService({
      children: [
        {
          ord_id: 'ORD-1758000000001-456',
          ord_parent: PARENT,
          ord_is_pay: '0',
          ord_ords_id: '2',
        },
      ],
    });

    await service.createSupplementOrder(PARENT, INPUT);

    expect(callRpc).toHaveBeenCalledTimes(1);
  });

  it('refus de la RPC : 400, aucun événement', async () => {
    const { service, callRpc, emit } = makeService();
    callRpc.mockResolvedValue({
      data: null,
      error: { message: 'duplicate key value' },
    });

    await expect(
      service.createSupplementOrder(PARENT, INPUT),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(emit).not.toHaveBeenCalled();
  });
});

describe('OrdersService.createSupplementOrder — refus, sans écriture ni événement', () => {
  beforeAll(() => {
    process.env.SUPABASE_URL ||= 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';
  });

  const cases: Array<{
    name: string;
    setup?: Setup;
    input?: Partial<typeof INPUT>;
    type: new (...args: never[]) => Error;
  }> = [
    // Saisie
    {
      name: 'ligne absente de la saisie',
      input: { lineId: '' },
      type: BadRequestException,
    },
    {
      name: 'pièce invalide',
      input: { pieceId: 0 },
      type: BadRequestException,
    },
    {
      name: 'quantité nulle',
      input: { quantity: 0 },
      type: BadRequestException,
    },
    {
      name: 'quantité non entière',
      input: { quantity: 1.5 },
      type: BadRequestException,
    },
    {
      name: "prix d'achat fournisseur non confirmé",
      input: { confirmedPurchaseHt: 0 },
      type: BadRequestException,
    },
    // Commande d'origine
    {
      name: "commande d'origine introuvable",
      setup: { parent: null },
      type: NotFoundException,
    },
    {
      name: "commande d'origine non payée",
      setup: { parent: parentOrder({ ord_is_pay: '0' }) },
      type: ConflictException,
    },
    {
      name: "commande d'origine sans date de paiement",
      setup: { parent: parentOrder({ ord_date_pay: '' }) },
      type: ConflictException,
    },
    {
      name: "commande d'origine annulée",
      setup: { parent: parentOrder({ ord_ords_id: '2' }) },
      type: ConflictException,
    },
    {
      name: 'montant des pièces ≠ somme des lignes (remise ou retouche)',
      setup: { parent: parentOrder({ ord_amount_ttc: '55.00' }) },
      type: ConflictException,
    },
    {
      name: 'consigne de la commande ≠ somme des lignes',
      setup: { parent: parentOrder({ ord_deposit_ttc: '5.00' }) },
      type: ConflictException,
    },
    // Ligne en rupture
    {
      name: "ligne absente de la commande d'origine",
      input: { lineId: 'ORD-1758000000000-999-L001' },
      type: NotFoundException,
    },
    // Suppléments existants
    {
      name: 'un supplément non payé est déjà en attente',
      setup: {
        children: [
          {
            ord_id: 'ORD-1758000000001-456',
            ord_parent: PARENT,
            ord_is_pay: '0',
            ord_ords_id: '1',
          },
        ],
      },
      type: ConflictException,
    },
    {
      name: 'un supplément payé existe déjà',
      setup: {
        children: [
          {
            ord_id: 'ORD-1758000000001-456',
            ord_parent: PARENT,
            ord_is_pay: '1',
            ord_ords_id: '5',
          },
        ],
      },
      type: ConflictException,
    },
    // Équivalent
    {
      name: 'équivalent sans tarif vendable',
      setup: { price: null },
      type: ConflictException,
    },
    {
      name: 'équivalent non affiché sur le site',
      setup: {
        piece: {
          piece_id: EQUIVALENT,
          piece_name: 'Disque de frein',
          piece_ref: 'EQ-22',
          piece_pm_id: 7,
          piece_display: false,
        },
      },
      type: ConflictException,
    },
    {
      name: 'équivalent introuvable',
      setup: { piece: null },
      type: ConflictException,
    },
    {
      name: "marque de l'équivalent introuvable",
      setup: { brand: null },
      type: ConflictException,
    },
    {
      name: "l'équivalent est la pièce en rupture",
      setup: { price: tariff({ pri_piece_id_i: RUPTURE_PIECE }) },
      input: { pieceId: RUPTURE_PIECE },
      type: ConflictException,
    },
    {
      name: 'équivalent à consigne',
      setup: { price: tariff({ pri_consigne_ttc_n: 12 }) },
      type: ConflictException,
    },
    {
      name: 'prix de vente HT absent',
      setup: { price: tariff({ pri_vente_ht_n: null }) },
      type: ConflictException,
    },
    {
      name: 'vente à perte : achat HT en base supérieur à la vente HT',
      setup: { price: tariff({ pri_achat_ht_n: 45 }) },
      type: ConflictException,
    },
    {
      name: 'vente à perte : achat HT confirmé chez le fournisseur supérieur à la vente HT',
      input: { confirmedPurchaseHt: 42 },
      type: ConflictException,
    },
    // Montant
    {
      name: 'supplément nul ou négatif (1 × 50,00 − 60,00)',
      input: { quantity: 1 },
      type: ConflictException,
    },
    {
      name: 'supplément non divisible au centime (2 × 50,00 − 60,01)',
      setup: {
        parent: parentOrder({ ord_amount_ttc: '60.01' }),
        lines: [parentLine({ orl_art_price_sell_ttc: '60.01' })],
      },
      type: ConflictException,
    },
    {
      name: 'montant payé pour la ligne illisible',
      setup: {
        parent: parentOrder({ ord_amount_ttc: '0.00' }),
        lines: [parentLine({ orl_art_price_sell_ttc: '' })],
      },
      type: ConflictException,
    },
    // Client
    {
      name: 'client sans e-mail : le lien de paiement serait refusé',
      setup: { customer: { cst_id: CUSTOMER, cst_mail: '' } },
      type: ConflictException,
    },
  ];

  it.each(cases)('$name', async ({ setup, input, type }) => {
    const { service, callRpc, emit } = makeService(setup);

    await expect(
      service.createSupplementOrder(PARENT, { ...INPUT, ...input }),
    ).rejects.toBeInstanceOf(type);
    expect(callRpc).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });
});
