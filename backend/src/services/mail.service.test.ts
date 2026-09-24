/**
 * MailService — aucun envoi ne doit écrire l'adresse du destinataire dans les
 * journaux, ni la transporter dans l'erreur levée (dont le message, la pile
 * et les propriétés sont sérialisés par le logger).
 */
import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { MailDeliveryError, MailService } from './mail.service';

const sendMailMock = jest.fn();

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: sendMailMock })),
}));

const CUSTOMER = 'client.test@example.test';
const SENDER = 'boutique@example.test';

function makeConfig(configured: boolean): ConfigService {
  const values: Record<string, string> = configured
    ? { GMAIL_APP_PASSWORD: 'test-app-password', GMAIL_USER_EMAIL: SENDER }
    : { GMAIL_USER_EMAIL: SENDER };
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

const ORDER = {
  ord_id: 'ORD-TEST-1',
  ord_total_ttc: '10.00',
  ord_date: '2026-01-01T00:00:00Z',
  lines: [],
};
const CUSTOMER_DATA = {
  cst_mail: CUSTOMER,
  cst_fname: 'Prénom',
  cst_name: 'Nom',
};

/** Tout ce qui a été passé au logger, sous forme de texte. */
function loggedText(spies: jest.SpyInstance[]): string {
  return spies
    .flatMap((spy) => spy.mock.calls)
    .map((args) => JSON.stringify(args, errorReplacer))
    .join('\n');
}

function errorReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Error) {
    return { ...value, message: value.message, stack: value.stack };
  }
  return value;
}

/** Nodemailer reprend l'adresse refusée dans le message et les champs. */
function smtpRejection(): Error {
  return Object.assign(
    new Error(
      `Can't send mail - all recipients were rejected: 550 5.1.1 <${CUSTOMER}> unknown`,
    ),
    {
      code: 'EENVELOPE',
      responseCode: 550,
      command: 'RCPT TO',
      response: `550 5.1.1 <${CUSTOMER}> unknown`,
      recipient: CUSTOMER,
      rejected: [CUSTOMER],
    },
  );
}

describe('MailService — journaux sans adresse du destinataire', () => {
  let spies: jest.SpyInstance[];

  beforeEach(() => {
    sendMailMock.mockReset();
    spies = (['log', 'warn', 'error', 'debug'] as const).map((level) =>
      jest.spyOn(Logger.prototype, level).mockImplementation(() => undefined),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('succès : journalise le type et la commande, jamais le destinataire', async () => {
    sendMailMock.mockResolvedValue({ messageId: '<id@example.test>' });
    const service = new MailService(makeConfig(true));

    await service.sendOrderConfirmation(ORDER, CUSTOMER_DATA);

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: CUSTOMER }),
    );
    const text = loggedText(spies);
    expect(text).toContain('kind=order_confirmation order=ORD-TEST-1');
    expect(text).not.toContain(CUSTOMER);
  });

  it('transport absent (dry-run) : aucun destinataire ni objet journalisé', async () => {
    const service = new MailService(makeConfig(false));

    await service.sendWelcomeEmail(CUSTOMER, 'Prénom');

    expect(sendMailMock).not.toHaveBeenCalled();
    const text = loggedText(spies);
    expect(text).toContain('[DRY-RUN]');
    expect(text).toContain('kind=welcome');
    expect(text).not.toContain(CUSTOMER);
  });

  it("échec SMTP : l'erreur levée ne porte que les champs techniques", async () => {
    sendMailMock.mockRejectedValue(smtpRejection());
    const service = new MailService(makeConfig(true));

    const thrown = await service
      .sendCancellationEmail(ORDER, CUSTOMER_DATA, 'test')
      .then(
        () => null,
        (error: unknown) => error,
      );

    expect(thrown).toBeInstanceOf(MailDeliveryError);
    const failure = thrown as MailDeliveryError;
    expect(failure).toMatchObject({
      kind: 'order_cancelled',
      orderId: 'ORD-TEST-1',
      code: 'EENVELOPE',
      responseCode: 550,
      command: 'RCPT TO',
    });
    expect(failure.cause).toBeUndefined();
    expect(JSON.stringify(failure, errorReplacer)).not.toContain(CUSTOMER);
    expect(loggedText(spies)).not.toContain(CUSTOMER);
  });

  it('écarte un code ou une commande qui ne sont pas des jetons techniques', () => {
    const failure = new MailDeliveryError(
      { kind: 'welcome' },
      { code: CUSTOMER, command: `RCPT TO:<${CUSTOMER}>`, responseCode: '550' },
    );

    expect(failure.code).toBeUndefined();
    expect(failure.command).toBeUndefined();
    expect(failure.responseCode).toBeUndefined();
    expect(failure.message).toBe(
      'Email delivery failed: kind=welcome code=unknown responseCode=- command=-',
    );
  });

  it('accepte une erreur non objet sans planter', () => {
    const failure = new MailDeliveryError({ kind: 'refund', orderId: 7 }, null);

    expect(failure.message).toBe(
      'Email delivery failed: kind=refund order=7 code=unknown responseCode=- command=-',
    );
  });

  it('relance panier : les en-têtes de désinscription sont transmis', async () => {
    sendMailMock.mockResolvedValue({ messageId: '<id@example.test>' });
    const service = new MailService(makeConfig(true));

    await service.sendAbandonedCartEmail({
      to: CUSTOMER,
      firstName: 'Prénom',
      subject: `Votre panier (${CUSTOMER})`,
      items: [],
      subtotal: 0,
      recoveryUrl: 'https://www.example.test/panier',
      unsubscribeUrl: 'https://www.example.test/unsubscribe',
      trackingPixelUrl: 'https://www.example.test/pixel.gif',
      step: '1h',
    });

    const sent = sendMailMock.mock.calls[0][0] as {
      to: string;
      headers?: Record<string, string>;
    };
    expect(sent.to).toBe(CUSTOMER);
    expect(sent.headers).toEqual({
      'List-Unsubscribe': '<https://www.example.test/unsubscribe>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
    const text = loggedText(spies);
    expect(text).toContain('kind=abandoned_cart_1h');
    expect(text).not.toContain(CUSTOMER);
  });
});
