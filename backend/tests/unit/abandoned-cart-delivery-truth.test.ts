/**
 * Relance panier abandonné — une étape n'est enregistrée « envoyée » que si un
 * e-mail est réellement parti.
 *
 * Défaut corrigé : sans identifiants Gmail, `MailService` journalisait
 * `[DRY-RUN]` puis rendait la main comme un envoi réussi ; `sendSequenceEmail`
 * enchaînait alors `updateEmailSent()` et inscrivait `email_<step>_sent_at`
 * pour un message jamais émis.
 *
 * Ce test verrouille :
 *  - `sendAbandonedCartEmail` rend l'issue réelle (`sent` | `dry-run`) ;
 *  - `sendSequenceEmail` échoue (job Bull en échec, visible) sans rien
 *    enregistrer quand l'issue n'est pas `sent` ;
 *  - une erreur base sur le contrôle de désabonnement bloque l'envoi au lieu
 *    de valoir « non désabonné ».
 *
 * @see backend/src/services/mail.service.ts (sendAbandonedCartEmail)
 * @see backend/src/modules/cart/services/abandoned-cart.service.ts (sendSequenceEmail)
 * @see backend/src/modules/cart/services/abandoned-cart-data.service.ts (isUnsubscribedByCstId)
 */

const sendMail = jest.fn();
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail })),
}));

import { ConfigService } from '@nestjs/config';
import { MailService } from '../../src/services/mail.service';
import { AbandonedCartService } from '../../src/modules/cart/services/abandoned-cart.service';
import {
  AbandonedCartDataService,
  type AbandonedCartRecord,
} from '../../src/modules/cart/services/abandoned-cart-data.service';

function mailService(env: Record<string, string>): MailService {
  return new MailService({
    get: (key: string) => env[key],
  } as unknown as ConfigService);
}

const params = {
  to: 'client@example.invalid',
  firstName: 'Client',
  subject: 'Votre panier',
  items: [],
  subtotal: 10,
  recoveryUrl: 'https://example.invalid/panier/recover/t',
  unsubscribeUrl: 'https://example.invalid/api/cart/unsubscribe/t',
  trackingPixelUrl: 'https://example.invalid/api/cart/track/open/t',
  step: '1h' as const,
};

describe('MailService.sendAbandonedCartEmail — issue réelle', () => {
  beforeEach(() => sendMail.mockReset());

  it('rend `dry-run` et ne transmet rien quand le transport est absent', async () => {
    const mail = mailService({});

    await expect(mail.sendAbandonedCartEmail(params)).resolves.toBe('dry-run');
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('rend `sent` avec les en-têtes de désabonnement quand le transport émet', async () => {
    sendMail.mockResolvedValue({ messageId: 'm1' });
    const mail = mailService({ GMAIL_APP_PASSWORD: 'app-password' });

    await expect(mail.sendAbandonedCartEmail(params)).resolves.toBe('sent');
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: {
          'List-Unsubscribe': `<${params.unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }),
    );
  });
});

function record(): AbandonedCartRecord {
  return {
    id: 'rec-1',
    cst_id: 42,
    cst_mail: 'client@example.invalid',
    cst_fname: 'Client',
    session_id: 's',
    cart_snapshot: [],
    cart_subtotal: 10,
    cart_item_count: 1,
    recovery_token: 'a'.repeat(64),
    email_1h_sent_at: null,
    email_24h_sent_at: null,
    email_72h_sent_at: null,
    email_opened_at: null,
    email_clicked_at: null,
    recovered_at: null,
    unsubscribed_at: null,
    status: 'detected',
    created_at: '2026-10-19T00:00:00Z',
    updated_at: '2026-10-19T00:00:00Z',
    expires_at: '2999-01-01T00:00:00Z',
  };
}

function sequence(delivery: 'sent' | 'dry-run') {
  const data = {
    findById: jest.fn().mockResolvedValue(record()),
    isUnsubscribedByCstId: jest.fn().mockResolvedValue(false),
    hasMarketingConsent: jest.fn().mockResolvedValue(true),
    updateEmailSent: jest.fn().mockResolvedValue(undefined),
  };
  const mail = {
    sendAbandonedCartEmail: jest.fn().mockResolvedValue(delivery),
  };
  const service = new AbandonedCartService(
    {} as never, // emailQueue — unused by sendSequenceEmail
    { get: jest.fn().mockResolvedValue(null), set: jest.fn() } as never,
    {} as never, // cartDataService — unused by sendSequenceEmail
    data as never,
    {} as never, // featureFlags — unused by sendSequenceEmail
    mail as never,
  );
  return { service, data, mail };
}

describe('AbandonedCartService.sendSequenceEmail — étape enregistrée seulement si envoyée', () => {
  it('enregistre l’étape après un envoi réel', async () => {
    const { service, data } = sequence('sent');

    await expect(service.sendSequenceEmail('rec-1', '1h')).resolves.toBe(true);
    expect(data.updateEmailSent).toHaveBeenCalledWith('rec-1', '1h');
  });

  it('échoue sans rien enregistrer quand aucun e-mail n’est parti', async () => {
    const { service, data, mail } = sequence('dry-run');

    await expect(service.sendSequenceEmail('rec-1', '1h')).rejects.toThrow(
      /not sent/i,
    );
    expect(mail.sendAbandonedCartEmail).toHaveBeenCalledTimes(1);
    expect(data.updateEmailSent).not.toHaveBeenCalled();
  });

  it('n’envoie rien quand le contrôle de désabonnement est indisponible', async () => {
    const { service, data, mail } = sequence('sent');
    data.isUnsubscribedByCstId.mockRejectedValue(new Error('db down'));

    await expect(service.sendSequenceEmail('rec-1', '1h')).rejects.toThrow(
      'db down',
    );
    expect(mail.sendAbandonedCartEmail).not.toHaveBeenCalled();
    expect(data.updateEmailSent).not.toHaveBeenCalled();
  });
});

describe('AbandonedCartDataService.isUnsubscribedByCstId — erreur ≠ « non désabonné »', () => {
  function dataService(result: { data: unknown; error: unknown }) {
    const service = Object.create(
      AbandonedCartDataService.prototype,
    ) as AbandonedCartDataService;
    const chain = {
      select: () => chain,
      eq: () => chain,
      limit: () => chain,
      maybeSingle: () => Promise.resolve(result),
    };
    Object.defineProperty(service, 'supabase', {
      value: { from: () => chain },
    });
    Object.defineProperty(service, 'logger', {
      value: { error: jest.fn() },
    });
    return service;
  }

  it('lève l’erreur base au lieu de répondre false', async () => {
    const service = dataService({
      data: null,
      error: { message: 'connection refused' },
    });

    await expect(service.isUnsubscribedByCstId(42)).rejects.toThrow(
      /connection refused/,
    );
  });

  it('répond true quand une opposition existe', async () => {
    const service = dataService({ data: { id: 'rec-1' }, error: null });

    await expect(service.isUnsubscribedByCstId(42)).resolves.toBe(true);
  });

  it('répond false quand aucune opposition n’existe', async () => {
    const service = dataService({ data: null, error: null });

    await expect(service.isUnsubscribedByCstId(42)).resolves.toBe(false);
  });
});
