/**
 * Relance panier abandonné — cadence de la décision 61 (16-11-2026) et texte
 * sobre.
 *
 * Ce test verrouille :
 *  - deux e-mails seulement : le premier dès le constat d'abandon (une heure
 *    sans activité), le second vingt-quatre heures après l'abandon ; aucune
 *    étape `72h` n'est programmée ;
 *  - le drapeau `ABANDONED_CART_EMAIL_ENABLED` est relu à l'envoi : éteint, un
 *    e-mail déjà programmé ne part pas ;
 *  - une étape hors séquence (job `72h` resté en file) n'est jamais envoyée ;
 *  - le texte n'affirme ni urgence, ni rareté, ni échéance.
 *
 * @see backend/src/modules/cart/services/abandoned-cart.service.ts
 * @see backend/src/services/mail.service.ts (sendAbandonedCartEmail)
 */

const sendMail = jest.fn();
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail })),
}));

import { ConfigService } from '@nestjs/config';
import { MailService } from '../../src/services/mail.service';
import {
  ABANDONED_CART_SEQUENCE,
  AbandonedCartService,
} from '../../src/modules/cart/services/abandoned-cart.service';

const HOUR = 3600_000;

describe('AbandonedCartService — cadence 1 h puis 24 h, puis plus rien', () => {
  const CANDIDATE = { userId: 42, sessionId: 's-42', timestamp: 0 };

  function scanner() {
    const emailQueue = { add: jest.fn().mockResolvedValue(undefined) };
    const cache = {
      get: jest.fn((key: string) =>
        Promise.resolve(
          key === 'abandoned-cart:candidates' ? [CANDIDATE] : null,
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
    const data = {
      findRecentByCstId: jest.fn().mockResolvedValue(null),
      getCustomerEmail: jest
        .fn()
        .mockResolvedValue({ cst_mail: 'client@example.invalid' }),
      insert: jest.fn().mockResolvedValue({ id: 'rec-1' }),
    };
    const service = new AbandonedCartService(
      emailQueue as never,
      cache as never,
      cartData as never,
      data as never,
      { abandonedCartEmailEnabled: true } as never,
      {} as never,
    );
    return { service, emailQueue };
  }

  it('la séquence compte deux étapes, à 1 h et 24 h de l’abandon', () => {
    const abandonThreshold = HOUR;
    expect(
      ABANDONED_CART_SEQUENCE.map((s) => [
        s.step,
        abandonThreshold + s.delayMs,
      ]),
    ).toEqual([
      ['1h', HOUR],
      ['24h', 24 * HOUR],
    ]);
  });

  it('la détection programme 2 e-mails et aucun `72h`', async () => {
    const { service, emailQueue } = scanner();

    await expect(service.scanAndEnqueue()).resolves.toEqual({
      detected: 1,
      enqueued: 1,
    });
    expect(emailQueue.add.mock.calls).toEqual([
      [
        'abandoned-cart-email',
        { id: 'rec-1', step: '1h' },
        expect.objectContaining({ delay: 0 }),
      ],
      [
        'abandoned-cart-email',
        { id: 'rec-1', step: '24h' },
        expect.objectContaining({ delay: 23 * HOUR }),
      ],
    ]);
  });
});

describe('AbandonedCartService.sendSequenceEmail — drapeau et étapes', () => {
  function sender(enabled: boolean) {
    const data = {
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
        status: 'detected',
        expires_at: '2999-01-01T00:00:00Z',
      }),
      isUnsubscribedByCstId: jest.fn().mockResolvedValue(false),
      updateEmailSent: jest.fn().mockResolvedValue(undefined),
    };
    const mail = {
      sendAbandonedCartEmail: jest.fn().mockResolvedValue('sent'),
    };
    const service = new AbandonedCartService(
      {} as never,
      { get: jest.fn().mockResolvedValue(null), set: jest.fn() } as never,
      {} as never,
      data as never,
      { abandonedCartEmailEnabled: enabled } as never,
      mail as never,
    );
    return { service, data, mail };
  }

  it('drapeau éteint : un e-mail déjà programmé ne part pas', async () => {
    const { service, data, mail } = sender(false);

    await expect(service.sendSequenceEmail('rec-1', '1h')).resolves.toBe(false);
    expect(data.findById).not.toHaveBeenCalled();
    expect(mail.sendAbandonedCartEmail).not.toHaveBeenCalled();
    expect(data.updateEmailSent).not.toHaveBeenCalled();
  });

  it('étape `72h` restée en file : jamais envoyée', async () => {
    const { service, data, mail } = sender(true);

    await expect(service.sendSequenceEmail('rec-1', '72h')).resolves.toBe(
      false,
    );
    expect(mail.sendAbandonedCartEmail).not.toHaveBeenCalled();
    expect(data.updateEmailSent).not.toHaveBeenCalled();
  });

  it('étape `24h`, drapeau allumé : objet sobre, envoi enregistré', async () => {
    const { service, data, mail } = sender(true);

    await expect(service.sendSequenceEmail('rec-1', '24h')).resolves.toBe(true);
    expect(mail.sendAbandonedCartEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        step: '24h',
        subject: 'Client, votre panier est toujours enregistré',
      }),
    );
    expect(data.updateEmailSent).toHaveBeenCalledWith('rec-1', '24h');
  });
});

describe('MailService.sendAbandonedCartEmail — texte sans urgence', () => {
  beforeEach(() => sendMail.mockReset());

  const FORBIDDEN = [
    /stocks? (sont |est )?limit/i,
    /derni[eè]re chance/i,
    /expire/i,
    /supprim/i,
    /ne manquez pas/i,
    /vous attend/i,
  ];

  it.each(['1h', '24h'] as const)('étape %s', async (step) => {
    sendMail.mockResolvedValue({ messageId: 'm1' });
    const mail = new MailService({
      get: (key: string) =>
        key === 'GMAIL_APP_PASSWORD' ? 'app-password' : undefined,
    } as unknown as ConfigService);

    await expect(
      mail.sendAbandonedCartEmail({
        to: 'client@example.invalid',
        firstName: 'Client',
        subject: 'Votre panier',
        items: [{ product_name: 'Disque', quantity: 1, price: 10 }],
        subtotal: 10,
        recoveryUrl: 'https://example.invalid/panier/recover/t',
        unsubscribeUrl: 'https://example.invalid/api/cart/unsubscribe/t',
        trackingPixelUrl: 'https://example.invalid/api/cart/track/open/t',
        step,
      }),
    ).resolves.toBe('sent');

    const html = String(sendMail.mock.calls[0][0].html);
    for (const pattern of FORBIDDEN) {
      expect(html).not.toMatch(pattern);
    }
    expect(html).toContain('Sous-total (hors livraison)');
    expect(html).toContain('Ne plus recevoir ces rappels');
  });
});

/**
 * Pied du mail : la relance ne demande plus de consentement marketing
 * (décision 61 précisée par Marwane le 27-11-2026). Le pied ne peut donc plus
 * affirmer un accord du client ; le lien et les en-têtes de désinscription
 * restent.
 */
describe('MailService.sendAbandonedCartEmail — pied sans consentement affirmé', () => {
  beforeEach(() => sendMail.mockReset());

  it.each(['1h', '24h'] as const)('étape %s', async (step) => {
    sendMail.mockResolvedValue({ messageId: 'm1' });
    const mail = new MailService({
      get: (key: string) =>
        key === 'GMAIL_APP_PASSWORD' ? 'app-password' : undefined,
    } as unknown as ConfigService);
    const unsubscribeUrl = 'https://example.invalid/api/cart/unsubscribe/t';

    await mail.sendAbandonedCartEmail({
      to: 'client@example.invalid',
      firstName: 'Client',
      subject: 'Votre panier',
      items: [{ product_name: 'Disque', quantity: 1, price: 10 }],
      subtotal: 10,
      recoveryUrl: 'https://example.invalid/panier/recover/t',
      unsubscribeUrl,
      trackingPixelUrl: 'https://example.invalid/api/cart/track/open/t',
      step,
    });

    const sent = sendMail.mock.calls[0][0];
    const html = String(sent.html);
    expect(html).toContain(
      'Vous recevez cet e-mail car un panier est enregistré sur votre compte Automecanik.',
    );
    expect(html).not.toMatch(/accept[ée]|consent|votre accord/i);
    expect(html).toContain(`<a href="${unsubscribeUrl}"`);
    expect(sent.headers).toEqual({
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
  });
});
