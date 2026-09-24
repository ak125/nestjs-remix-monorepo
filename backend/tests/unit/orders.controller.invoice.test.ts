/**
 * Facture / bon de commande de « Mon compte » — GET /api/orders/:id/invoice.
 *
 * La page facture lisait la base directement depuis le serveur du site, avec
 * une jointure qui ne pouvait pas aboutir (aucune clé étrangère sur
 * `___xtr_order`) et un état « payée » jamais calculé. Elle passe désormais par
 * cette route, qui :
 *  - exige une session et ne sert que les commandes du client connecté, avec
 *    la même réponse 404 qu'une commande inexistante ;
 *  - renvoie uniquement ce que la facture imprime (ni e-mail ni téléphone) ;
 *  - lit les adresses enregistrées pour la commande, jamais l'adresse actuelle
 *    du client ;
 *  - calcule l'état de paiement avec `getOrderPaymentState`, la même règle que
 *    le lien de reprise et le rejeu de la validation.
 *
 * @see backend/src/modules/orders/controllers/orders.controller.ts (getOrderInvoice, getCustomerOrder)
 * @see backend/src/modules/orders/services/orders.service.ts (getOrderInvoiceAddresses)
 */

import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { TABLES } from '@repo/database-types';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { OrdersController } from '../../src/modules/orders/controllers/orders.controller';
import {
  OrderInvoiceAddresses,
  OrdersService,
} from '../../src/modules/orders/services/orders.service';

const ORDER_ID = 'ORD-1758000000000-123';
const OWNER = '81500';

const BILLING = {
  civility: null,
  firstName: 'Jean',
  lastName: 'Test',
  address: '1 rue de la Paix',
  addressLine2: null,
  zipCode: '75002',
  city: 'Paris',
  country: 'France',
};

function order(overrides: Record<string, unknown> = {}) {
  return {
    ord_id: ORDER_ID,
    ord_cst_id: OWNER,
    ord_parent: '0',
    ord_date: '2026-09-20 10:00:00',
    ord_date_pay: null,
    ord_ords_id: '1',
    ord_is_pay: '0',
    ord_amount_ttc: '40.00',
    ord_deposit_ttc: '0',
    ord_shipping_fee_ttc: '5.90',
    ord_total_ttc: '45.90',
    customer: {
      cst_id: OWNER,
      cst_mail: 'client@example.test',
      cst_tel: '0100000000',
    },
    lines: [],
    statusHistory: [],
    ...overrides,
  };
}

function makeController(
  found: Record<string, unknown> | Error,
  addresses: OrderInvoiceAddresses = { billing: BILLING, delivery: null },
) {
  const ordersService = {
    getOrderById:
      found instanceof Error
        ? jest.fn().mockRejectedValue(found)
        : jest.fn().mockResolvedValue(found),
    getOrderInvoiceAddresses: jest.fn().mockResolvedValue(addresses),
    cancelOrder: jest.fn(),
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

describe('GET /api/orders/:id/invoice', () => {
  it('requires a session (AuthenticatedGuard)', () => {
    const guards =
      Reflect.getMetadata(
        GUARDS_METADATA,
        OrdersController.prototype.getOrderInvoice,
      ) || [];
    expect(guards).toContain(AuthenticatedGuard);
  });

  it("returns the owner's invoice without the customer record", async () => {
    const { controller, ordersService } = makeController(order());

    const res = await controller.getOrderInvoice(ORDER_ID, req(OWNER));

    expect(ordersService.getOrderInvoiceAddresses).toHaveBeenCalledWith(
      expect.objectContaining({ ord_id: ORDER_ID, ord_cst_id: OWNER }),
    );
    expect(res.success).toBe(true);
    expect(res.data).toEqual({
      ord_id: ORDER_ID,
      ord_parent: '0',
      ord_date: '2026-09-20 10:00:00',
      ord_date_pay: null,
      ord_ords_id: '1',
      ord_amount_ttc: '40.00',
      ord_deposit_ttc: '0',
      ord_shipping_fee_ttc: '5.90',
      ord_total_ttc: '45.90',
      lines: [],
      billing_address: BILLING,
      delivery_address: null,
      payment_state: 'payable',
      payment_refusal: null,
    });
    const body = JSON.stringify(res);
    expect(body).not.toContain('client@example.test');
    expect(body).not.toContain('0100000000');
    expect(res.data).not.toHaveProperty('customer');
  });

  it.each([
    ['another customer', order({ ord_cst_id: '99999' })],
    ['no customer attached', order({ ord_cst_id: null })],
  ])('answers 404 for an order of %s', async (_label, found) => {
    const { controller, ordersService } = makeController(found);

    await expect(
      controller.getOrderInvoice(ORDER_ID, req(OWNER)),
    ).rejects.toThrow(new NotFoundException('Commande non trouvée'));
    expect(ordersService.getOrderInvoiceAddresses).not.toHaveBeenCalled();
  });

  it('answers 404 without loading the order when there is no session user', async () => {
    const { controller, ordersService } = makeController(order());

    await expect(controller.getOrderInvoice(ORDER_ID, req())).rejects.toThrow(
      NotFoundException,
    );
    expect(ordersService.getOrderById).not.toHaveBeenCalled();
  });

  it('gives an unknown order the same 404 message as a foreign one', async () => {
    const { controller } = makeController(
      new NotFoundException(`Commande #${ORDER_ID} introuvable`),
    );

    await expect(
      controller.getOrderInvoice(ORDER_ID, req(OWNER)),
    ).rejects.toThrow(new NotFoundException('Commande non trouvée'));
  });

  it('propagates a failure other than not-found', async () => {
    const { controller } = makeController(new Error('boom'));

    await expect(
      controller.getOrderInvoice(ORDER_ID, req(OWNER)),
    ).rejects.toThrow('boom');
  });

  it.each([
    ['paid flag', { ord_is_pay: '1', ord_ords_id: '3' }, 'paid', null],
    [
      'payment date',
      { ord_date_pay: '2026-09-20 10:05:00', ord_ords_id: '3' },
      'paid',
      null,
    ],
    ['unpaid, in progress', {}, 'payable', null],
    [
      'cancelled',
      { ord_ords_id: '2' },
      'not_payable',
      'Cette commande a été annulée : elle ne peut plus être payée.',
    ],
    [
      'unpaid, no longer in progress',
      { ord_ords_id: '3' },
      'not_payable',
      'Cette commande ne peut pas être payée en ligne : contactez notre service client.',
    ],
  ])(
    'reports the payment state (%s)',
    async (_label, overrides, state, refusal) => {
      const { controller } = makeController(order(overrides));

      const res = await controller.getOrderInvoice(ORDER_ID, req(OWNER));

      expect(res.data.payment_state).toBe(state);
      expect(res.data.payment_refusal).toBe(refusal);
    },
  );

  it('lists the lines in line-id order with only the printed columns', async () => {
    const line = (id: string) => ({
      orl_id: id,
      orl_ord_id: ORDER_ID,
      orl_pg_name: `Pièce ${id}`,
      orl_art_ref: 'REF',
      orl_art_quantity: '1',
      orl_art_price_buy_unit_ht: '9.99',
      orl_art_price_sell_unit_ttc: '20.00',
      orl_art_price_sell_ttc: '20.00',
    });
    const { controller } = makeController(
      order({ lines: [line('10'), line('9'), line('11')] }),
    );

    const res = await controller.getOrderInvoice(ORDER_ID, req(OWNER));

    expect(res.data.lines.map((l) => l.orl_id)).toEqual(['9', '10', '11']);
    expect(res.data.lines[0]).toEqual({
      orl_id: '9',
      orl_pg_name: 'Pièce 9',
      orl_art_quantity: '1',
      orl_art_price_sell_unit_ttc: '20.00',
      orl_art_price_sell_ttc: '20.00',
    });
  });
});

describe('GET /api/orders/:id — same ownership rule as the invoice', () => {
  it('gives an unknown order the same 404 message as a foreign one', async () => {
    const { controller } = makeController(
      new NotFoundException(`Commande #${ORDER_ID} introuvable`),
    );

    await expect(controller.getOrderById(ORDER_ID, req(OWNER))).rejects.toThrow(
      new NotFoundException('Commande non trouvée'),
    );
  });

  it('answers 404 for an order with no customer attached', async () => {
    const { controller } = makeController(order({ ord_cst_id: null }));

    await expect(controller.getOrderById(ORDER_ID, req(OWNER))).rejects.toThrow(
      new NotFoundException('Commande non trouvée'),
    );
  });
});

/** Faux client Supabase : une réponse par table, filtres `eq` enregistrés. */
function addressSupabase(
  rows: Record<string, { data: unknown; error: unknown }> = {},
) {
  const calls: { table: string; filters: [string, unknown][] }[] = [];
  const client = {
    from(table: string) {
      const call = { table, filters: [] as [string, unknown][] };
      calls.push(call);
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          call.filters.push([column, value]);
          return chain;
        },
        maybeSingle: () =>
          Promise.resolve(rows[table] ?? { data: null, error: null }),
      };
      return chain;
    },
  };
  return { client, calls };
}

function makeService(supabase: unknown): OrdersService {
  const service = new OrdersService(
    {} as never, // calculationService — unused here
    {} as never, // statusService — unused here
    {} as never, // shippingService — unused here
    {} as never, // shippingCalculator — unused here
    {} as never, // eventEmitter — unused here
    {} as never, // mailService — unused here
  );
  Object.defineProperty(service, 'supabase', {
    value: supabase,
    configurable: true,
  });
  return service;
}

const BILLING_ROW = {
  cba_civility: 'M.',
  cba_fname: 'Jean',
  cba_name: 'Test',
  cba_address: '1 rue de la Paix',
  cba_zip_code: '75002',
  cba_city: 'Paris',
  cba_country: 'France',
};

const DELIVERY_ROW = {
  cda_civility: 'Mme',
  cda_fname: 'Anne',
  cda_name: 'Essai',
  cda_address: '2 avenue du Test',
  cda_zip_code: '69001',
  cda_city: 'Lyon',
  cda_country: 'France',
};

describe('OrdersService.getOrderInvoiceAddresses', () => {
  it('prefers the snapshots recorded at checkout and reads no address row', async () => {
    const supabase = addressSupabase();
    const service = makeService(supabase.client);

    const res = await service.getOrderInvoiceAddresses({
      ord_cst_id: OWNER,
      ord_cba_id: '5',
      ord_cda_id: '6',
      ord_billing_snapshot: {
        firstName: 'Jean',
        lastName: 'Test',
        address: '1 rue de la Paix',
        addressLine2: 'Bâtiment B',
        zipCode: '75002',
        city: 'Paris',
        country: 'France',
        phone: '0100000000',
      },
      ord_shipping_snapshot: {
        firstName: 'Anne',
        lastName: 'Essai',
        address: '2 avenue du Test',
        zipCode: '69001',
        city: 'Lyon',
        country: 'France',
      },
    });

    expect(supabase.calls).toEqual([]);
    expect(res.billing).toEqual({
      civility: null,
      firstName: 'Jean',
      lastName: 'Test',
      address: '1 rue de la Paix',
      addressLine2: 'Bâtiment B',
      zipCode: '75002',
      city: 'Paris',
      country: 'France',
    });
    expect(res.billing).not.toHaveProperty('phone');
    expect(res.delivery?.city).toBe('Lyon');
  });

  it("falls back to the referenced rows, restricted to the order's customer", async () => {
    const supabase = addressSupabase({
      [TABLES.xtr_customer_billing_address]: { data: BILLING_ROW, error: null },
      [TABLES.xtr_customer_delivery_address]: {
        data: DELIVERY_ROW,
        error: null,
      },
    });
    const service = makeService(supabase.client);

    const res = await service.getOrderInvoiceAddresses({
      ord_cst_id: OWNER,
      ord_cba_id: '5',
      ord_cda_id: '6',
      ord_billing_snapshot: null,
      ord_shipping_snapshot: null,
    });

    expect(supabase.calls).toEqual([
      {
        table: TABLES.xtr_customer_billing_address,
        filters: [
          ['cba_id', '5'],
          ['cba_cst_id', OWNER],
        ],
      },
      {
        table: TABLES.xtr_customer_delivery_address,
        filters: [
          ['cda_id', '6'],
          ['cda_cst_id', OWNER],
        ],
      },
    ]);
    expect(res.billing).toEqual({
      civility: 'M.',
      firstName: 'Jean',
      lastName: 'Test',
      address: '1 rue de la Paix',
      addressLine2: null,
      zipCode: '75002',
      city: 'Paris',
      country: 'France',
    });
    expect(res.delivery?.civility).toBe('Mme');
    expect(res.delivery?.city).toBe('Lyon');
  });

  it('returns null when the referenced row is not owned (no row returned)', async () => {
    const supabase = addressSupabase();
    const service = makeService(supabase.client);

    const res = await service.getOrderInvoiceAddresses({
      ord_cst_id: OWNER,
      ord_cba_id: '5',
      ord_cda_id: '6',
    });

    expect(res).toEqual({ billing: null, delivery: null });
  });

  it.each([
    ['no address id', { ord_cst_id: OWNER, ord_cba_id: null, ord_cda_id: '' }],
    ['no customer', { ord_cst_id: null, ord_cba_id: '5', ord_cda_id: '6' }],
  ])('reads nothing when there is %s', async (_label, fields) => {
    const supabase = addressSupabase();
    const service = makeService(supabase.client);

    const res = await service.getOrderInvoiceAddresses(fields);

    expect(supabase.calls).toEqual([]);
    expect(res).toEqual({ billing: null, delivery: null });
  });

  it.each([['a text'], [['an', 'array']], [42]])(
    'ignores a snapshot that is not an object (%p)',
    async (snapshot) => {
      const supabase = addressSupabase({
        [TABLES.xtr_customer_billing_address]: {
          data: BILLING_ROW,
          error: null,
        },
      });
      const service = makeService(supabase.client);

      const res = await service.getOrderInvoiceAddresses({
        ord_cst_id: OWNER,
        ord_cba_id: '5',
        ord_billing_snapshot: snapshot,
      });

      expect(res.billing?.civility).toBe('M.');
    },
  );

  it('fails instead of printing an invoice without its addresses on a read error', async () => {
    const supabase = addressSupabase({
      [TABLES.xtr_customer_delivery_address]: {
        data: null,
        error: { message: 'timeout' },
      },
    });
    const service = makeService(supabase.client);

    await expect(
      service.getOrderInvoiceAddresses({
        ord_cst_id: OWNER,
        ord_cba_id: '5',
        ord_cda_id: '6',
      }),
    ).rejects.toThrow('Lecture des adresses de facture impossible: timeout');
  });
});
