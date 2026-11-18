/**
 * Mandat BM — expédition par numéro de suivi.
 *
 * Marwane saisit seulement le numéro. Ce test verrouille :
 * - la validation du numéro (espaces retirés, majuscules, 8 à 30 caractères) ;
 * - les préconditions : commande payée, pas encore expédiée, statut 3 ou 5 ;
 * - l'écriture conditionnelle (`ord_date_ship IS NULL`) : deux clics
 *   simultanés ne donnent qu'une expédition et qu'un mail ;
 * - la chaîne complète contrôleur → service → événement SHIPPED → écouteur →
 *   MailService réel en transport d'essai (`MAIL_TEST_TRANSPORT=true`) : UN
 *   mail, avec le numéro, le lien de suivi et le lien du compte client ;
 * - l'écouteur lit `cst_fname` / `cst_name` (les colonnes `cst_prenom` /
 *   `cst_nom` n'existent pas : la requête échouait et aucun mail ne partait).
 */
import 'reflect-metadata';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { OrderActionsService } from '../../src/modules/orders/services/order-actions.service';
import { OrderActionsController } from '../../src/modules/orders/controllers/order-actions.controller';
import { OrderEmailListener } from '../../src/modules/orders/listeners/order-email.listener';
import { MailService } from '../../src/services/mail.service';
import { ORDER_EVENTS } from '../../src/modules/orders/events/order.events';
import { REQUIRE_PERMISSION_KEY } from '../../src/auth/decorators/require-permission.decorator';
import { TABLES } from '@repo/database-types';

const ORDER_ID = 'ORD-1763000000000-001';
const TRACKING = '6A12345678901';

type Op = { method: string; args: unknown[] };
type Resolver = (
  table: string,
  ops: Op[],
) => { data: unknown; error: { message: string } | null };

/** Faux client Supabase : enregistre la chaîne d'appels, répond par table. */
function fakeSupabase(resolve: Resolver) {
  const calls: Array<{ table: string; ops: Op[] }> = [];
  const from = jest.fn((table: string) => {
    const ops: Op[] = [];
    calls.push({ table, ops });
    const chain: Record<string, unknown> = {};
    for (const m of [
      'select',
      'update',
      'insert',
      'upsert',
      'eq',
      'is',
      'order',
      'in',
    ]) {
      chain[m] = (...args: unknown[]) => {
        ops.push({ method: m, args });
        return chain;
      };
    }
    const done = () => Promise.resolve(resolve(table, ops));
    chain.single = () => done();
    chain.maybeSingle = () => done();
    chain.then = (f: (v: unknown) => unknown, r?: (e: unknown) => unknown) =>
      done().then(f, r);
    return chain;
  });
  return { client: { from }, calls };
}

function inject(target: object, client: unknown) {
  Object.defineProperty(target, 'supabase', {
    value: client,
    configurable: true,
  });
}

function paidOrder(overrides: Record<string, unknown> = {}) {
  return {
    ord_id: ORDER_ID,
    ord_cst_id: '81500',
    ord_is_pay: '1',
    ord_ords_id: '3',
    ord_date_ship: null,
    ord_tracking: null,
    ...overrides,
  };
}

function makeService(opts: {
  order?: Record<string, unknown>;
  updatedRows?: unknown[];
  paymentVoid?: { state: string; label: string } | null;
}) {
  const emitter = new EventEmitter2();
  const emitted: unknown[] = [];
  emitter.on(ORDER_EVENTS.SHIPPED, (e) => emitted.push(e));
  const billing = {
    paymentVoid: jest
      .fn()
      .mockResolvedValue({
        enabled: true,
        paymentVoid: opts.paymentVoid ?? null,
      }),
  };
  const service = new OrderActionsService(
    emitter,
    {} as never,
    {} as never,
    billing as never,
  );
  const db = fakeSupabase((table, ops) => {
    if (table === TABLES.xtr_order && ops[0]?.method === 'update') {
      return { data: opts.updatedRows ?? [{ ord_id: ORDER_ID }], error: null };
    }
    return { data: null, error: null };
  });
  inject(service, db.client);
  jest
    .spyOn(service, 'getOrder')
    .mockResolvedValue((opts.order ?? paidOrder()) as never);
  return { service, emitter, emitted, db };
}

describe('Mandat BM — expédition par numéro de suivi', () => {
  beforeAll(() => {
    process.env.SUPABASE_URL ||= 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';
  });

  describe('route POST /api/admin/orders/:orderId/ship', () => {
    const handler = OrderActionsController.prototype.shipOrder;

    it('est protégée par canShip', () => {
      expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(':orderId/ship');
      expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
        RequestMethod.POST,
      );
      expect(Reflect.getMetadata(REQUIRE_PERMISSION_KEY, handler)).toBe(
        'canShip',
      );
    });

    function controllerWith(shipOrder: jest.Mock) {
      return new OrderActionsController(
        { shipOrder } as never,
        {} as never,
        {} as never,
        {} as never,
      );
    }

    it('normalise le numéro (espaces, majuscules) et ne demande que lui', async () => {
      const shipOrder = jest.fn().mockResolvedValue({
        success: true,
        newStatus: '7',
        trackingNumber: TRACKING,
        trackingUrl: 'https://www.laposte.fr/outils/suivre-vos-envois?code=X',
      });
      const ctrl = controllerWith(shipOrder);
      const res = await ctrl.shipOrder(
        ORDER_ID,
        { trackingNumber: ' 6a 1234 5678 901 ' },
        { user: { id: 7 } } as never,
      );
      expect(shipOrder).toHaveBeenCalledWith(ORDER_ID, TRACKING, '7');
      expect(res.trackingNumber).toBe(TRACKING);
      expect(res.trackingUrl).toMatch(/^https:\/\//);
    });

    it.each([
      [{}],
      [{ trackingNumber: '' }],
      [{ trackingNumber: 'ABC' }],
      [{ trackingNumber: 'A'.repeat(31) }],
      [{ trackingNumber: '6A1234567<script>' }],
      [{ trackingNumber: TRACKING, carrier: 'UPS' }],
    ])('refuse %j sans appeler le service', async (body) => {
      const shipOrder = jest.fn();
      const ctrl = controllerWith(shipOrder);
      await expect(
        ctrl.shipOrder(ORDER_ID, body, {} as never),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(shipOrder).not.toHaveBeenCalled();
    });

    it('refuse un identifiant de commande hors format', async () => {
      const shipOrder = jest.fn();
      await expect(
        controllerWith(shipOrder).shipOrder(
          '../x',
          { trackingNumber: TRACKING },
          {} as never,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(shipOrder).not.toHaveBeenCalled();
    });
  });

  describe('OrderActionsService.shipOrder', () => {
    it('écrit « Expédiée » (7), date, numéro et lien, sous condition « pas encore expédiée »', async () => {
      const { service, emitted, db } = makeService({});
      const res = await service.shipOrder(ORDER_ID, TRACKING, '7');
      expect(res).toEqual({
        success: true,
        newStatus: '7',
        trackingNumber: TRACKING,
        trackingUrl: `https://www.laposte.fr/outils/suivre-vos-envois?code=${TRACKING}`,
      });
      const update = db.calls.find(
        (c) => c.table === TABLES.xtr_order && c.ops[0].method === 'update',
      )!;
      const patch = update.ops[0].args[0] as Record<string, unknown>;
      expect(patch).toMatchObject({
        ord_ords_id: '7',
        ord_tracking: TRACKING,
        ord_tracking_url: res.trackingUrl,
      });
      expect(typeof patch.ord_date_ship).toBe('string');
      expect(update.ops).toEqual(
        expect.arrayContaining([
          { method: 'eq', args: ['ord_id', ORDER_ID] },
          { method: 'is', args: ['ord_date_ship', null] },
        ]),
      );
      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toMatchObject({
        orderId: ORDER_ID,
        trackingNumber: TRACKING,
        trackingUrl: res.trackingUrl,
        changedBy: '7',
      });
    });

    it.each([
      ['non payée', paidOrder({ ord_is_pay: '0' })],
      ['déjà expédiée', paidOrder({ ord_date_ship: '2026-11-17T10:00:00Z' })],
      ['annulée (statut 2)', paidOrder({ ord_ords_id: '2' })],
      ['statut 1', paidOrder({ ord_ords_id: '1' })],
    ])('refuse une commande %s, sans écrire ni notifier', async (_l, order) => {
      const { service, emitted, db } = makeService({ order });
      await expect(
        service.shipOrder(ORDER_ID, TRACKING, '7'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(db.calls).toHaveLength(0);
      expect(emitted).toHaveLength(0);
    });

    // Complément BM n° 2 : paiement annulé ou remboursé dans Paybox.
    it.each([
      ['cancelled', 'Paiement annulé'],
      ['refunded', 'Remboursée — ne pas expédier'],
    ])(
      'refuse une commande payée dont l’encaissement est %s, sans écrire ni notifier',
      async (state, label) => {
        const { service, emitted, db } = makeService({
          paymentVoid: { state, label },
        });
        await expect(
          service.shipOrder(ORDER_ID, TRACKING, '7'),
        ).rejects.toThrow(`${label}, expédition refusée`);
        expect(db.calls).toHaveLength(0);
        expect(emitted).toHaveLength(0);
      },
    );

    it('accepte le statut 5', async () => {
      const { service, emitted } = makeService({
        order: paidOrder({ ord_ords_id: '5' }),
      });
      await service.shipOrder(ORDER_ID, TRACKING);
      expect(emitted).toHaveLength(1);
    });

    it('course : expédiée entre la lecture et l’écriture ⇒ 409, aucun événement', async () => {
      const { service, emitted } = makeService({ updatedRows: [] });
      await expect(
        service.shipOrder(ORDER_ID, TRACKING),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(emitted).toHaveLength(0);
    });
  });

  // Décision du 2026-11-17 : Livrer écrit « Livrée » = 8 (identifiant donné
  // par BN #2147, ORDER_FULFILMENT_STATUS).
  describe('OrderActionsService.markAsDelivered', () => {
    const shipped = (o: Record<string, unknown> = {}) =>
      paidOrder({
        ord_ords_id: '4',
        ord_date_ship: '2026-11-17T17:00:00Z',
        ...o,
      });

    it.each([
      ['« Expédiée » (7)', shipped({ ord_ords_id: '7' })],
      ['expédiée avant les statuts nouveaux (4 + date)', shipped()],
    ])(
      'livre une commande %s : écrit « Livrée » (8) et la date',
      async (_l, order) => {
        const { service, db } = makeService({ order });
        const res = await service.markAsDelivered(ORDER_ID, 7);
        expect(res).toEqual({ success: true, newStatus: '8' });
        const update = db.calls.find(
          (c) => c.table === TABLES.xtr_order && c.ops[0].method === 'update',
        )!;
        const patch = update.ops[0].args[0] as Record<string, unknown>;
        expect(patch.ord_ords_id).toBe('8');
        expect(typeof patch.ord_date_deliv).toBe('string');
      },
    );

    it.each([
      ['non expédiée', paidOrder({ ord_ords_id: '3' })],
      [
        'déjà livrée',
        shipped({ ord_ords_id: '8', ord_date_deliv: '2026-11-19T10:00:00Z' }),
      ],
      [
        'livrée avant les statuts nouveaux',
        shipped({ ord_ords_id: '5', ord_date_deliv: '2026-11-19T10:00:00Z' }),
      ],
      ['annulée', shipped({ ord_ords_id: '2' })],
    ])('refuse une commande %s, sans écrire', async (_l, order) => {
      const { service, db } = makeService({ order });
      await expect(service.markAsDelivered(ORDER_ID, 7)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(
        db.calls.filter((c) => c.ops[0]?.method === 'update'),
      ).toHaveLength(0);
    });
  });

  describe('chaîne complète, mail en transport d’essai', () => {
    function mailServiceInTestMode() {
      const env: Record<string, string> = {
        MAIL_TEST_TRANSPORT: 'true',
        APP_URL: 'https://dev.example.test',
        // Identifiants factices : le transport d'essai doit rester prioritaire.
        GMAIL_CLIENT_ID: 'x',
        GMAIL_CLIENT_SECRET: 'x',
        GMAIL_REFRESH_TOKEN: 'x',
      };
      const mail = new MailService({
        get: (k: string) => env[k],
      } as never);
      const transporter = (
        mail as unknown as {
          transporter: {
            sendMail: (m: unknown) => Promise<{ message: string }>;
          };
        }
      ).transporter;
      const sent: Array<Record<string, unknown>> = [];
      const real = transporter.sendMail.bind(transporter);
      transporter.sendMail = async (m: unknown) => {
        const info = await real(m);
        sent.push(JSON.parse(info.message));
        return info;
      };
      return { mail, sent };
    }

    it('un seul mail, avec numéro, lien de suivi et lien du compte ; rien ne part', async () => {
      const { service, emitter } = makeService({});
      const { mail, sent } = mailServiceInTestMode();
      const listener = new OrderEmailListener(mail);
      const customerSelects: unknown[] = [];
      inject(
        listener,
        fakeSupabase((table, ops) => {
          if (table === TABLES.xtr_order) {
            return {
              data: {
                ord_id: ORDER_ID,
                ord_cst_id: '81500',
                ord_total_ttc: '89.90',
                ord_date: '2026-11-10T09:00:00Z',
                ord_tracking_url: null,
              },
              error: null,
            };
          }
          customerSelects.push(ops[0].args[0]);
          return {
            data: {
              cst_mail: 'client@example.test',
              cst_fname: 'Léa',
              cst_name: "O'Brien <b>",
            },
            error: null,
          };
        }).client,
      );
      const pending: Promise<void>[] = [];
      emitter.on(ORDER_EVENTS.SHIPPED, (e) =>
        pending.push(listener.onOrderShipped(e)),
      );

      const ctrl = new OrderActionsController(
        service,
        mail,
        {} as never,
        {} as never,
      );
      const res = await ctrl.shipOrder(
        ORDER_ID,
        { trackingNumber: '6a12345678901' },
        { user: { id: 7 } } as never,
      );
      await Promise.all(pending);

      expect(res.success).toBe(true);
      expect(customerSelects).toEqual(['cst_mail, cst_fname, cst_name']);
      expect(sent).toHaveLength(1);
      const msg = sent[0];
      expect(msg.to).toEqual([{ address: 'client@example.test', name: '' }]);
      expect(msg.subject).toContain(ORDER_ID);
      const html = String(msg.html);
      expect(html).toContain(TRACKING);
      expect(html).toContain(
        `https://www.laposte.fr/outils/suivre-vos-envois?code=${TRACKING}`,
      );
      expect(html).toContain(
        `https://dev.example.test/account/orders/${ORDER_ID}`,
      );
      // Nom du client échappé dans le HTML.
      expect(html).toContain('O&#39;Brien &lt;b&gt;');
      expect(html).not.toContain('<b>');
    });

    it("sans mail client : l'écouteur n'envoie rien et ne jette pas", async () => {
      const { mail, sent } = mailServiceInTestMode();
      const listener = new OrderEmailListener(mail);
      inject(
        listener,
        fakeSupabase((table) =>
          table === TABLES.xtr_order
            ? {
                data: { ord_id: ORDER_ID, ord_cst_id: '1', ord_total_ttc: '1' },
                error: null,
              }
            : { data: null, error: { message: 'no rows' } },
        ).client,
      );
      await expect(
        listener.onOrderShipped({
          orderId: ORDER_ID,
          customerId: '1',
          trackingNumber: TRACKING,
          timestamp: new Date().toISOString(),
        } as never),
      ).resolves.toBeUndefined();
      expect(sent).toHaveLength(0);
    });
  });
});
