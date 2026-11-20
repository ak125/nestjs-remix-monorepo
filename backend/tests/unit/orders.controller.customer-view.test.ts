/**
 * Commande rendue à son client — colonnes limitées à ce que les écrans lisent.
 *
 * `OrdersService.getOrderById` lit toutes les colonnes de la commande et de ses
 * lignes : c'est la lecture de l'administration. Les routes du client
 * (GET /api/orders, GET /api/orders/:id, POST /api/orders, POST
 * /api/orders/guest, PATCH /api/orders/:id) n'en rendent qu'une vue : les
 * champs lus par `frontend/app/services/orders.server.ts` et
 * `frontend/app/services/order.server.ts`. Prix d'achat, marge et fournisseur
 * des lignes n'en font pas partie, ni aucune colonne ajoutée plus tard.
 *
 * @see backend/src/modules/orders/controllers/orders.controller.ts
 */

import 'reflect-metadata';
import { OrdersController } from '../../src/modules/orders/controllers/orders.controller';

const ORDER_ID = 'ORD-1758000000000-123';
const OWNER = '81500';

/** Champs que les écrans du client lisent dans une commande. */
const ORDER_FIELDS = [
  'ord_id',
  'ord_ords_id',
  'ord_is_pay',
  'ord_date',
  'ord_amount_ht',
  'ord_amount_ttc',
  'ord_tva',
  'ord_shipping_fee_ttc',
  'ord_total_ttc',
  'ord_tracking',
  'ord_tracking_url',
];

/** Champs que les écrans du client lisent dans une ligne. */
const LINE_FIELDS = [
  'orl_id',
  'orl_pg_id',
  'orl_pg_name',
  'orl_art_ref',
  'orl_art_quantity',
  'orl_art_price_sell_unit_ttc',
  'orl_art_price_sell_ttc',
  'orl_orls_id',
];

/** Commande telle que la rend `getOrderById` : toutes les colonnes. */
function fullOrder() {
  return {
    ord_id: ORDER_ID,
    ord_cst_id: OWNER,
    ord_ords_id: '1',
    ord_is_pay: '0',
    ord_date: '2026-11-18T10:00:00.000Z',
    ord_date_pay: null,
    ord_amount_ht: '26.03',
    ord_amount_ttc: '31.24',
    ord_tva: '5.21',
    ord_shipping_fee_ttc: '11.19',
    ord_total_ttc: '42.43',
    ord_tracking: null,
    ord_tracking_url: null,
    ord_info: 'Note interne',
    ord_parent: '0',
    ord_billing_snapshot: { city: 'Paris' },
    ord_shipping_snapshot: { city: 'Paris' },
    ga_client_id: 'GA1.1.1',
    landing_source: 'direct',
    customer: {
      cst_id: OWNER,
      cst_fname: 'Jean',
      cst_name: 'Test',
      cst_mail: 'client.test@example.test',
      cst_tel: '0100000000',
      cst_address: '1 rue de la Paix',
    },
    lines: [
      {
        orl_id: `${ORDER_ID}-L001`,
        orl_ord_id: ORDER_ID,
        orl_orls_id: '1',
        orl_pg_id: '101',
        orl_pg_name: 'Jeu de 4 plaquettes de frein',
        orl_pm_name: 'MARQUE',
        orl_art_ref: 'REF-101',
        orl_art_quantity: '1',
        orl_art_price_sell_unit_ttc: '31.24',
        orl_art_price_sell_ttc: '31.24',
        orl_art_price_sell_margin: '9.10',
        orl_art_price_buy_unit_ht: '16.93',
        orl_art_price_buy_unit_ttc: '20.32',
        orl_art_price_buy_ht: '16.93',
        orl_art_price_buy_ttc: '20.32',
        orl_art_price_buy_discount: '35',
        orl_art_price_buy_unit_public_ht: '26.05',
        orl_art_price_buy_unit_public_ttc: '31.26',
        orl_spl_id: '12',
        orl_spl_name: 'FOURNISSEUR',
        orl_spl_date: '2026-11-18',
        orl_spl_price_buy_ht: '16.93',
        orl_spl_price_buy_ttc: '20.32',
        orl_spl_price_buy_unit_ht: '16.93',
        orl_spl_price_buy_unit_ttc: '20.32',
        orl_equiv_id: null,
        orl_website_url: '/pieces/plaquettes',
      },
    ],
    statusHistory: [],
  };
}

function makeController() {
  const supabase = {
    from: () => {
      const builder: Record<string, unknown> = {};
      for (const m of ['insert', 'update', 'delete', 'select', 'eq']) {
        builder[m] = () => builder;
      }
      builder.single = () => Promise.resolve({ data: null, error: null });
      builder.then = (
        onF: (v: unknown) => unknown,
        onR?: (e: unknown) => unknown,
      ) => Promise.resolve({ data: null, error: null }).then(onF, onR);
      return builder;
    },
  };
  const ordersService = {
    getSupabaseClient: jest.fn(() => supabase),
    getOrderById: jest.fn().mockResolvedValue(fullOrder()),
    createOrder: jest.fn().mockResolvedValue(fullOrder()),
    updateOrder: jest.fn().mockResolvedValue({
      ...fullOrder(),
      ord_id: '1234567',
    }),
    listOrders: jest.fn().mockResolvedValue({
      data: [fullOrder()].map(({ customer: _c, lines: _l, ...row }) => row),
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    }),
  };
  const controller = new OrdersController(
    ordersService as never,
    {} as never, // authService — unused on these paths
    {} as never, // mailService — unused on these paths
    {} as never, // cacheService — unused on these paths
  );
  return { controller, ordersService };
}

function req(userId?: string) {
  return { user: userId ? { id: userId } : undefined, session: {} } as never;
}

function createBody() {
  return {
    orderLines: [
      {
        productId: '101',
        productName: 'Jeu de 4 plaquettes de frein',
        productReference: 'REF-101',
        quantity: 1,
        unitPrice: 31.24,
      },
    ],
    billingAddress: {},
    shippingAddress: {},
  } as never;
}

/** Aucune clé hors de la vue du client, à aucun niveau. */
function expectCustomerView(
  view: Record<string, unknown>,
  extraKeys: string[] = [],
) {
  const allowed = new Set([
    ...ORDER_FIELDS,
    'customer',
    'lines',
    'statusHistory',
    ...extraKeys,
  ]);
  expect(Object.keys(view).filter((k) => !allowed.has(k))).toEqual([]);

  for (const l of (view.lines ?? []) as Array<Record<string, unknown>>) {
    expect(Object.keys(l).filter((k) => !LINE_FIELDS.includes(k))).toEqual([]);
  }
  if (view.customer) {
    expect(Object.keys(view.customer as object)).toEqual(['cst_mail']);
  }

  const texte = JSON.stringify(view);
  expect(texte).not.toMatch(/price_buy|sell_margin|orl_spl_/);
}

describe('routes du client — vue limitée de la commande', () => {
  it('GET /api/orders/:id rend les champs des écrans, sans achat ni marge', async () => {
    const { controller } = makeController();

    const res = await controller.getOrderById(ORDER_ID, req(OWNER));
    const view: Record<string, unknown> = res.data;

    expectCustomerView(view, ['customer_can_cancel']);
    // Ce que l'écran « Ma commande » lit reste servi.
    expect(view).toMatchObject({
      ord_id: ORDER_ID,
      ord_ords_id: '1',
      ord_is_pay: '0',
      ord_total_ttc: '42.43',
      ord_amount_ttc: '31.24',
      ord_shipping_fee_ttc: '11.19',
      customer_can_cancel: true,
      statusHistory: [],
    });
    expect(view.lines).toEqual([
      {
        orl_id: `${ORDER_ID}-L001`,
        orl_pg_id: '101',
        orl_pg_name: 'Jeu de 4 plaquettes de frein',
        orl_art_ref: 'REF-101',
        orl_art_quantity: '1',
        orl_art_price_sell_unit_ttc: '31.24',
        orl_art_price_sell_ttc: '31.24',
        orl_orls_id: '1',
      },
    ]);
  });

  it('POST /api/orders rend la vue du client et ce que le paiement lit', async () => {
    const { controller } = makeController();

    const res = (await controller.createOrder(
      createBody(),
      req(OWNER),
    )) as Record<string, unknown>;

    expectCustomerView(res, ['resumeToken']);
    expect(res).toMatchObject({
      ord_id: ORDER_ID,
      ord_total_ttc: '42.43',
      ord_is_pay: '0',
      customer: { cst_mail: 'client.test@example.test' },
    });
    expect(typeof res.resumeToken).toBe('string');
  });

  it('POST /api/orders/guest (client déjà connecté) rend la même vue', async () => {
    const { controller } = makeController();

    const res = (await controller.createGuestOrder(
      createBody(),
      req(OWNER),
    )) as Record<string, unknown>;

    expectCustomerView(res, ['resumeToken']);
    expect(res).toMatchObject({ ord_id: ORDER_ID, ord_total_ttc: '42.43' });
  });

  it('PATCH /api/orders/:id rend la vue du client', async () => {
    const { controller } = makeController();

    const res = (await controller.updateOrder(
      1234567,
      { comment: 'Sonner au portail' },
      req(OWNER),
    )) as Record<string, unknown>;

    expectCustomerView(res);
    expect(res).toMatchObject({ ord_id: '1234567', ord_total_ttc: '42.43' });
  });

  it('GET /api/orders rend la vue du client pour chaque commande', async () => {
    const { controller } = makeController();

    const res = await controller.listMyOrders({}, req(OWNER));

    expect(res.pagination).toMatchObject({ page: 1, total: 1 });
    expect(res.data).toHaveLength(1);
    expectCustomerView(res.data[0] as Record<string, unknown>);
    expect(res.data[0]).toMatchObject({
      ord_id: ORDER_ID,
      ord_ords_id: '1',
      ord_total_ttc: '42.43',
      ord_date: '2026-11-18T10:00:00.000Z',
    });
  });

  it('la lecture de l’administration garde toutes les colonnes', async () => {
    const { controller } = makeController();

    const res = (await controller.getOrderByIdAdmin(
      ORDER_ID as never,
    )) as Record<string, unknown>;

    expect(JSON.stringify(res)).toMatch(/orl_art_price_buy_unit_ht/);
  });
});
