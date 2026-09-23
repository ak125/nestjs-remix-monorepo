/**
 * Unit tests — OrderEmailListener.
 *
 * Régression : la lecture du client demandait des colonnes inexistantes de
 * ___xtr_customer (cst_prenom, cst_nom). PostgREST refusait la requête, le
 * client revenait vide et le listener sortait sans rien dire : aucun e-mail
 * d'expédition, d'annulation ni de remboursement n'est jamais parti.
 *
 * Construit via Object.create (même technique que order-funnel.listener.test.ts)
 * pour rester hermétique : pas d'env, pas de réseau.
 */
import { TABLES } from '@repo/database-types';
import { OrderEmailListener } from './order-email.listener';
import type {
  OrderCancelledEvent,
  OrderShippedEvent,
} from '../events/order.events';

type QueryResult = { data: unknown; error: { message: string } | null };

/** Supabase stub : un résultat par table, et trace des colonnes demandées. */
function supabaseWith(results: Record<string, QueryResult>) {
  const selects: Record<string, string> = {};
  return {
    selects,
    client: {
      from(table: string) {
        const chain = {
          select(cols: string) {
            selects[table] = cols;
            return chain;
          },
          eq() {
            return chain;
          },
          single: () =>
            Promise.resolve(results[table] ?? { data: null, error: null }),
        };
        return chain;
      },
    },
  };
}

const ORDER_ROW = {
  ord_id: 'ORD-1',
  ord_cst_id: 'CST-1',
  ord_total_ttc: '42.00',
  ord_date: '2026-09-20T10:00:00.000Z',
};
const CUSTOMER_ROW = {
  cst_mail: 'client@example.test',
  cst_fname: 'Prénom',
  cst_name: 'Nom',
};

function makeListener(results: Record<string, QueryResult>) {
  const logger = { warn: jest.fn(), log: jest.fn(), error: jest.fn() };
  const mailService = {
    sendShippingNotification: jest.fn().mockResolvedValue(undefined),
    sendCancellationEmail: jest.fn().mockResolvedValue(undefined),
    sendRefundConfirmation: jest.fn().mockResolvedValue(undefined),
  };
  const supabase = supabaseWith(results);
  const listener = Object.create(
    OrderEmailListener.prototype,
  ) as OrderEmailListener;
  Object.assign(listener, { logger, mailService, supabase: supabase.client });
  return { listener, logger, mailService, selects: supabase.selects };
}

const CANCELLED: OrderCancelledEvent = {
  orderId: 'ORD-1',
  customerId: 'CST-1',
  reason: 'Annulée par le client depuis son espace',
  changedBy: 'CST-1',
  timestamp: '2026-09-24T10:00:00.000Z',
};

const SHIPPED: OrderShippedEvent = {
  orderId: 'ORD-1',
  customerId: 'CST-1',
  trackingNumber: 'TRACK-1',
  timestamp: '2026-09-24T10:00:00.000Z',
};

// Clés = TABLES (mockées en Jest par tests/__mocks__/@repo/database-types.ts).
const OK_RESULTS = {
  [TABLES.xtr_order]: { data: ORDER_ROW, error: null },
  [TABLES.xtr_customer]: { data: CUSTOMER_ROW, error: null },
};

describe('OrderEmailListener', () => {
  it('ne demande que des colonnes réelles de ___xtr_customer', async () => {
    const { listener, selects } = makeListener(OK_RESULTS);

    await listener.onOrderCancelled(CANCELLED);

    expect(selects[TABLES.xtr_customer]).toBe('cst_mail, cst_fname, cst_name');
  });

  it('envoie l’e-mail d’annulation avec le nom du client et le motif', async () => {
    const { listener, mailService } = makeListener(OK_RESULTS);

    await listener.onOrderCancelled(CANCELLED);

    expect(mailService.sendCancellationEmail).toHaveBeenCalledTimes(1);
    expect(mailService.sendCancellationEmail).toHaveBeenCalledWith(
      {
        ord_id: 'ORD-1',
        ord_total_ttc: '42.00',
        ord_date: '2026-09-20T10:00:00.000Z',
      },
      { cst_mail: 'client@example.test', cst_fname: 'Prénom', cst_name: 'Nom' },
      'Annulée par le client depuis son espace',
    );
  });

  it('envoie l’e-mail d’expédition avec le numéro de suivi', async () => {
    const { listener, mailService } = makeListener(OK_RESULTS);

    await listener.onOrderShipped(SHIPPED);

    expect(mailService.sendShippingNotification).toHaveBeenCalledTimes(1);
    expect(mailService.sendShippingNotification.mock.calls[0][1]).toEqual({
      cst_mail: 'client@example.test',
      cst_fname: 'Prénom',
      cst_name: 'Nom',
    });
    expect(mailService.sendShippingNotification.mock.calls[0][2]).toBe(
      'TRACK-1',
    );
  });

  it('journalise (sans envoyer) quand la lecture du client échoue', async () => {
    const { listener, mailService, logger } = makeListener({
      [TABLES.xtr_order]: { data: ORDER_ROW, error: null },
      [TABLES.xtr_customer]: {
        data: null,
        error: { message: 'column does not exist' },
      },
    });

    await listener.onOrderCancelled(CANCELLED);

    expect(mailService.sendCancellationEmail).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('column does not exist'),
    );
  });

  it('journalise (sans envoyer) quand la commande est introuvable', async () => {
    const { listener, mailService, logger } = makeListener({
      [TABLES.xtr_order]: { data: null, error: { message: 'no rows' } },
    });

    await listener.onOrderCancelled(CANCELLED);

    expect(mailService.sendCancellationEmail).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('ORD-1'));
  });

  it('un échec d’envoi est journalisé et ne remonte pas', async () => {
    const { listener, mailService, logger } = makeListener(OK_RESULTS);
    mailService.sendCancellationEmail.mockRejectedValue(new Error('smtp down'));

    await expect(listener.onOrderCancelled(CANCELLED)).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('smtp down'),
    );
  });
});
