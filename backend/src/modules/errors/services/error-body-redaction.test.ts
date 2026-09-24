import type { Request } from 'express';
import { ErrorService } from './error.service';

/**
 * Le corps de requête accompagne l'erreur transmise à ErrorLogService
 * (`msg_content` + `errorMetadata.request_body`). Les secrets y étaient déjà
 * masqués ; les identifiants personnels directs (email, téléphone, nom,
 * adresse) doivent l'être aussi, à toute profondeur.
 */
describe('ErrorService.logError — corps de requête sans identifiant personnel', () => {
  type CapturedErrorData = {
    msg_content?: string;
    errorMetadata?: { request_body?: Record<string, unknown> | null };
  };

  const EMAIL = 'client.test@example.test';
  const PHONE = '0600000000';

  function makeService() {
    const captured: CapturedErrorData[] = [];
    const errorLogService = {
      logError: jest.fn((errorData: CapturedErrorData) => {
        captured.push(errorData);
        return Promise.resolve(null);
      }),
    } as unknown as ConstructorParameters<typeof ErrorService>[0];
    const redirectService = {} as unknown as ConstructorParameters<
      typeof ErrorService
    >[1];
    const service = new ErrorService(errorLogService, redirectService);
    return { service, captured };
  }

  function makeRequest(body: Record<string, unknown>): Request {
    return {
      originalUrl: '/api/test',
      url: '/api/test',
      method: 'POST',
      headers: {},
      body,
      get: () => undefined,
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as Request;
  }

  async function loggedBody(body: Record<string, unknown>) {
    const { service, captured } = makeService();
    await service.logError(new Error('boom'), makeRequest(body), {
      status: 500,
    });
    expect(captured).toHaveLength(1);
    return captured[0];
  }

  it('masque email, téléphone, nom et adresses, y compris imbriqués', async () => {
    const entry = await loggedBody({
      guestEmail: EMAIL,
      customer: {
        cst_mail: EMAIL,
        cst_fname: 'Prénom',
        cst_name: 'Nom',
        cst_prenom: 'Prénom',
        cst_tel: PHONE,
        cst_gsm: PHONE,
        cst_pswd: 'hash',
      },
      billingAddress: {
        firstName: 'Prénom',
        lastName: 'Nom',
        address: '1 rue du Test',
        phone: PHONE,
      },
      shippingAddress: { address: '1 rue du Test', mobile: PHONE },
      tel: PHONE,
      quantity: 2,
    });

    expect(entry.msg_content).not.toContain(EMAIL);
    expect(entry.msg_content).not.toContain(PHONE);
    expect(entry.msg_content).not.toContain('rue du Test');
    expect(entry.errorMetadata?.request_body).toEqual({
      guestEmail: '[REDACTED]',
      customer: {
        cst_mail: '[REDACTED]',
        cst_fname: '[REDACTED]',
        cst_name: '[REDACTED]',
        cst_prenom: '[REDACTED]',
        cst_tel: '[REDACTED]',
        cst_gsm: '[REDACTED]',
        cst_pswd: '[REDACTED]',
      },
      billingAddress: '[REDACTED]',
      shippingAddress: '[REDACTED]',
      tel: '[REDACTED]',
      quantity: 2,
    });
  });

  it('masque les noms et téléphones portés directement par le corps', async () => {
    const entry = await loggedBody({
      name: 'Prénom Nom',
      nom: 'Nom',
      customerName: 'Prénom Nom',
      customer_name: 'Prénom Nom',
      firstName: 'Prénom',
      first_name: 'Prénom',
      lastName: 'Nom',
      last_name: 'Nom',
      fullName: 'Prénom Nom',
      author_name: 'Prénom Nom',
      phone: PHONE,
      mobile: PHONE,
      subject: 'Question',
    });

    expect(entry.msg_content).not.toContain('Prénom');
    expect(entry.msg_content).not.toContain(PHONE);
    expect(entry.errorMetadata?.request_body).toEqual({
      name: '[REDACTED]',
      nom: '[REDACTED]',
      customerName: '[REDACTED]',
      customer_name: '[REDACTED]',
      firstName: '[REDACTED]',
      first_name: '[REDACTED]',
      lastName: '[REDACTED]',
      last_name: '[REDACTED]',
      fullName: '[REDACTED]',
      author_name: '[REDACTED]',
      phone: '[REDACTED]',
      mobile: '[REDACTED]',
      subject: 'Question',
    });
  });

  it("garde les champs qui contiennent 'tel' ou 'name' sans être personnels", async () => {
    const body = {
      rateLimit: 10,
      autoGenerateLatest: true,
      product_name: 'Filtre à huile',
      productName: 'Filtre à huile',
      pg_name: 'Filtres',
      gammeName: 'Filtres',
    };
    const entry = await loggedBody(body);

    expect(entry.errorMetadata?.request_body).toEqual(body);
  });

  it('continue de masquer les secrets', async () => {
    const entry = await loggedBody({ password: 'hunter2', apiKey: 'k' });

    expect(entry.errorMetadata?.request_body).toEqual({
      password: '[REDACTED]',
      apiKey: '[REDACTED]',
    });
  });
});
