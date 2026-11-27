/**
 * Relance panier abandonné — sans exigence de consentement marketing, refus
 * gardé (décision 61 précisée par Marwane le 27-11-2026 : la condition « après
 * la base légale établie par le 18 » est retirée ; un client qui refuse ne
 * reçoit plus la relance).
 *
 * Ce test verrouille, drapeau `ABANDONED_CART_EMAIL_ENABLED` allumé :
 *  - client sans consentement marketing : la séquence 1 h + 24 h est
 *    programmée et l'e-mail part ; aucune lecture de consentement n'est faite ;
 *  - client désinscrit (clé Redis, ou base quand Redis ne l'a plus, ou statut
 *    `unsubscribed` de la fiche) : rien n'est programmé ni envoyé ;
 * et, drapeau éteint : rien n'est détecté ni envoyé.
 *
 * @see backend/src/modules/cart/services/abandoned-cart.service.ts
 * @see backend/src/modules/cart/controllers/cart-recovery.controller.ts (désinscription)
 */

import { AbandonedCartService } from '../../src/modules/cart/services/abandoned-cart.service';

const CANDIDATE = { userId: 42, sessionId: 's-42', timestamp: 0 };
const UNSUB_KEY = 'cart:unsubscribed:42';

/**
 * Double du service de données limité aux méthodes de la relance : toute
 * autre lecture (par exemple un contrôle de consentement) échoue le test.
 */
function strict<T extends object>(methods: T): T {
  return new Proxy(methods, {
    get(target, prop) {
      if (prop in target) return target[prop as keyof T];
      if (typeof prop === 'symbol' || prop === 'then') return undefined;
      throw new Error(`lecture inattendue du service de données : ${prop}`);
    },
  });
}

function scanner(opts: { enabled?: boolean; unsubscribed?: boolean } = {}) {
  const { enabled = true, unsubscribed = false } = opts;
  const emailQueue = { add: jest.fn().mockResolvedValue(undefined) };
  const cache = {
    get: jest.fn((key: string) =>
      Promise.resolve(
        key === 'abandoned-cart:candidates'
          ? [CANDIDATE]
          : key === UNSUB_KEY && unsubscribed
            ? true
            : null,
      ),
    ),
    set: jest.fn().mockResolvedValue(undefined),
  };
  const cartData = {
    getCartWithMetadata: jest.fn().mockResolvedValue({
      items: [{ product_name: 'Disque' }],
      stats: { subtotal: 10 },
    }),
  };
  // Client sans consentement marketing : la fiche n'en porte aucun.
  const data = strict({
    findRecentByCstId: jest.fn().mockResolvedValue(null),
    getCustomerEmail: jest
      .fn()
      .mockResolvedValue({ cst_mail: 'client@example.invalid' }),
    insert: jest.fn().mockResolvedValue({ id: 'rec-1' }),
  });
  const service = new AbandonedCartService(
    emailQueue as never,
    cache as never,
    cartData as never,
    data as never,
    { abandonedCartEmailEnabled: enabled } as never,
    {} as never,
  );
  return { service, emailQueue, cache, data };
}

describe('AbandonedCartService.scanAndEnqueue — sans consentement exigé', () => {
  it('client sans consentement : séquence 1 h + 24 h programmée', async () => {
    const { service, emailQueue, data } = scanner();

    await expect(service.scanAndEnqueue()).resolves.toEqual({
      detected: 1,
      enqueued: 1,
    });
    expect(data.insert).toHaveBeenCalledTimes(1);
    expect(emailQueue.add.mock.calls.map((c) => c[1])).toEqual([
      { id: 'rec-1', step: '1h' },
      { id: 'rec-1', step: '24h' },
    ]);
  });

  it('client désinscrit : rien capturé, rien programmé', async () => {
    const { service, emailQueue, data } = scanner({ unsubscribed: true });

    await expect(service.scanAndEnqueue()).resolves.toEqual({
      detected: 0,
      enqueued: 0,
    });
    expect(data.insert).not.toHaveBeenCalled();
    expect(emailQueue.add).not.toHaveBeenCalled();
  });

  it('drapeau éteint : aucune détection', async () => {
    const { service, emailQueue, cache, data } = scanner({ enabled: false });

    await expect(service.scanAndEnqueue()).resolves.toEqual({
      detected: 0,
      enqueued: 0,
    });
    expect(cache.get).not.toHaveBeenCalled();
    expect(data.insert).not.toHaveBeenCalled();
    expect(emailQueue.add).not.toHaveBeenCalled();
  });
});

function sender(
  opts: {
    enabled?: boolean;
    redisUnsubscribed?: boolean;
    dbUnsubscribed?: boolean;
    status?: string;
  } = {},
) {
  const {
    enabled = true,
    redisUnsubscribed = false,
    dbUnsubscribed = false,
    status = 'detected',
  } = opts;
  const cache = {
    get: jest.fn((key: string) =>
      Promise.resolve(key === UNSUB_KEY && redisUnsubscribed ? true : null),
    ),
    set: jest.fn().mockResolvedValue(undefined),
  };
  const data = strict({
    findById: jest.fn().mockResolvedValue({
      id: 'rec-1',
      cst_id: 42,
      cst_mail: 'client@example.invalid',
      cst_fname: 'Client',
      cart_snapshot: [],
      cart_subtotal: 10,
      cart_item_count: 1,
      recovery_token: 'a'.repeat(64),
      email_1h_sent_at: null,
      email_24h_sent_at: null,
      email_72h_sent_at: null,
      status,
      expires_at: '2999-01-01T00:00:00Z',
    }),
    isUnsubscribedByCstId: jest.fn().mockResolvedValue(dbUnsubscribed),
    updateEmailSent: jest.fn().mockResolvedValue(undefined),
  });
  const mail = {
    sendAbandonedCartEmail: jest.fn().mockResolvedValue('sent'),
  };
  const service = new AbandonedCartService(
    {} as never,
    cache as never,
    {} as never,
    data as never,
    { abandonedCartEmailEnabled: enabled } as never,
    mail as never,
  );
  return { service, cache, data, mail };
}

describe('AbandonedCartService.sendSequenceEmail — sans consentement exigé, refus gardé', () => {
  it('client sans consentement : l’e-mail part et l’étape est enregistrée', async () => {
    const { service, data, mail } = sender();

    await expect(service.sendSequenceEmail('rec-1', '1h')).resolves.toBe(true);
    expect(mail.sendAbandonedCartEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'client@example.invalid',
        step: '1h',
        unsubscribeUrl: expect.stringContaining(
          '/api/cart/unsubscribe/' + 'a'.repeat(64),
        ),
      }),
    );
    expect(data.updateEmailSent).toHaveBeenCalledWith('rec-1', '1h');
  });

  it('désinscrit (clé Redis) : rien envoyé', async () => {
    const { service, data, mail } = sender({ redisUnsubscribed: true });

    await expect(service.sendSequenceEmail('rec-1', '24h')).resolves.toBe(
      false,
    );
    expect(mail.sendAbandonedCartEmail).not.toHaveBeenCalled();
    expect(data.updateEmailSent).not.toHaveBeenCalled();
  });

  it('désinscrit en base, clé Redis perdue : rien envoyé, clé reconstruite', async () => {
    const { service, cache, data, mail } = sender({ dbUnsubscribed: true });

    await expect(service.sendSequenceEmail('rec-1', '24h')).resolves.toBe(
      false,
    );
    expect(data.isUnsubscribedByCstId).toHaveBeenCalledWith(42);
    expect(cache.set).toHaveBeenCalledWith(UNSUB_KEY, true, expect.any(Number));
    expect(mail.sendAbandonedCartEmail).not.toHaveBeenCalled();
    expect(data.updateEmailSent).not.toHaveBeenCalled();
  });

  it('fiche au statut `unsubscribed` : rien envoyé', async () => {
    const { service, data, mail } = sender({ status: 'unsubscribed' });

    await expect(service.sendSequenceEmail('rec-1', '1h')).resolves.toBe(false);
    expect(mail.sendAbandonedCartEmail).not.toHaveBeenCalled();
    expect(data.updateEmailSent).not.toHaveBeenCalled();
  });

  it('drapeau éteint : rien envoyé', async () => {
    const { service, data, mail } = sender({ enabled: false });

    await expect(service.sendSequenceEmail('rec-1', '1h')).resolves.toBe(false);
    expect(data.findById).not.toHaveBeenCalled();
    expect(mail.sendAbandonedCartEmail).not.toHaveBeenCalled();
  });
});
