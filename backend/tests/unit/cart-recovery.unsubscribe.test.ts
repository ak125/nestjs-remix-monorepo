/**
 * Désabonnement des relances panier — en-têtes et serveur alignés (RFC 8058).
 *
 * L'e-mail annonce `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, mais
 * le contrôleur n'exposait qu'un GET, qui désabonnait immédiatement (les
 * scanners anti-spam pré-chargent les URL GET) et affichait « confirmée » même
 * pour un lien inconnu ou une erreur base.
 *
 * Ce test verrouille :
 *  - GET n'écrit rien : il affiche une page de confirmation qui POSTe vers la
 *    même URL ;
 *  - POST (sans cookie, corps ignoré) enregistre l'opposition et répond 200,
 *    jamais une redirection (RFC 8058 §3.2) ;
 *  - lien mal formé → 400, lien inconnu → 404, erreur base → 500, sans jamais
 *    annoncer une désinscription qui n'a pas eu lieu.
 *
 * @see backend/src/modules/cart/controllers/cart-recovery.controller.ts
 * @see backend/src/modules/cart/services/abandoned-cart-data.service.ts (updateUnsubscribed)
 */

import 'reflect-metadata';
import { INestApplication, RequestMethod } from '@nestjs/common';
import {
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { CartRecoveryController } from '../../src/modules/cart/controllers/cart-recovery.controller';
import { AbandonedCartDataService } from '../../src/modules/cart/services/abandoned-cart-data.service';
import { AbandonedCartService } from '../../src/modules/cart/services/abandoned-cart.service';
import { CartDataService } from '../../src/database/services/cart-data.service';

const TOKEN = 'ab12'.repeat(16);

function response() {
  const res = {
    statusCode: 200,
    body: '',
    headers: {} as Record<string, string>,
    redirect: jest.fn(),
    status: jest.fn((code: number) => {
      res.statusCode = code;
      return res;
    }),
    set: jest.fn((key: string, value: string) => {
      res.headers[key] = value;
      return res;
    }),
    send: jest.fn((body: string) => {
      res.body = body;
      return res;
    }),
  };
  return res;
}

function controller(
  updateUnsubscribed: jest.Mock = jest.fn().mockResolvedValue({ cst_id: 42 }),
) {
  const data = { updateUnsubscribed };
  const service = { markUnsubscribed: jest.fn().mockResolvedValue(undefined) };
  const ctrl = new CartRecoveryController(
    data as never,
    service as never,
    {} as never, // cartDataService — unused by unsubscribe
  );
  return { ctrl, data, service };
}

describe('GET /api/cart/unsubscribe/:token — confirmation sans écriture', () => {
  it('affiche un formulaire POST vers la même URL et n’enregistre rien', async () => {
    const { ctrl, data, service } = controller();
    const res = response();

    await ctrl.unsubscribePage(TOKEN, res as never);

    expect(data.updateUnsubscribed).not.toHaveBeenCalled();
    expect(service.markUnsubscribed).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('method="post"');
    expect(res.body).toContain(`action="/api/cart/unsubscribe/${TOKEN}"`);
    expect(res.body).not.toMatch(/confirm[ée]e/i);
  });

  it('refuse un lien mal formé sans le réafficher', async () => {
    const { ctrl } = controller();
    const res = response();
    const injected = '"><script>x</script>'.padEnd(64, 'a');

    await ctrl.unsubscribePage(injected, res as never);

    expect(res.statusCode).toBe(400);
    expect(res.body).not.toContain('<script>');
    expect(res.body).not.toContain('method="post"');
  });
});

describe('POST /api/cart/unsubscribe/:token — one-click (RFC 8058)', () => {
  it('est déclaré en POST sur le même chemin que le lien, en 200', () => {
    const handler = CartRecoveryController.prototype.unsubscribe;
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
      RequestMethod.POST,
    );
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(
      'unsubscribe/:token',
    );
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(200);
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        CartRecoveryController.prototype.unsubscribePage,
      ),
    ).toBe('unsubscribe/:token');
  });

  it('enregistre l’opposition et répond 200 sans redirection', async () => {
    const { ctrl, data, service } = controller();
    const res = response();

    await ctrl.unsubscribe(TOKEN, res as never);

    expect(data.updateUnsubscribed).toHaveBeenCalledWith(TOKEN);
    expect(service.markUnsubscribed).toHaveBeenCalledWith(42);
    expect(res.redirect).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatch(/Désinscription confirmée/);
  });

  it('répond 404 sans annoncer de désinscription pour un lien inconnu', async () => {
    const { ctrl, service } = controller(jest.fn().mockResolvedValue(null));
    const res = response();

    await ctrl.unsubscribe(TOKEN, res as never);

    expect(service.markUnsubscribed).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(404);
    expect(res.body).not.toMatch(/confirm[ée]e/i);
  });

  it('répond 400 sans toucher la base pour un lien mal formé', async () => {
    const { ctrl, data } = controller();
    const res = response();

    await ctrl.unsubscribe('short', res as never);

    expect(data.updateUnsubscribed).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
  });

  it('répond 500 sans annoncer de désinscription quand la base échoue', async () => {
    const { ctrl, service } = controller(
      jest.fn().mockRejectedValue(new Error('db down')),
    );
    const res = response();

    await ctrl.unsubscribe(TOKEN, res as never);

    expect(service.markUnsubscribed).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toMatch(/confirm[ée]e/i);
  });
});

describe('HTTP — requête one-click telle qu’un fournisseur de messagerie l’émet', () => {
  let app: INestApplication;
  const updateUnsubscribed = jest.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [CartRecoveryController],
      providers: [
        { provide: AbandonedCartDataService, useValue: { updateUnsubscribed } },
        {
          provide: AbandonedCartService,
          useValue: {
            markUnsubscribed: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: CartDataService, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    updateUnsubscribed.mockReset().mockResolvedValue({ cst_id: 42 });
  });

  it('POST multipart sans cookie → 200, aucune redirection', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/cart/unsubscribe/${TOKEN}`)
      .field('List-Unsubscribe', 'One-Click');

    expect(res.status).toBe(200);
    expect(res.headers.location).toBeUndefined();
    expect(res.text).toMatch(/Désinscription confirmée/);
    expect(updateUnsubscribed).toHaveBeenCalledWith(TOKEN);
  });

  it('POST urlencoded (formulaire de confirmation) → 200', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/cart/unsubscribe/${TOKEN}`)
      .type('form')
      .send('List-Unsubscribe=One-Click');

    expect(res.status).toBe(200);
    expect(res.headers.location).toBeUndefined();
  });

  it('GET → page de confirmation, aucune écriture', async () => {
    const res = await request(app.getHttpServer()).get(
      `/api/cart/unsubscribe/${TOKEN}`,
    );

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.text).toContain('method="post"');
    expect(updateUnsubscribed).not.toHaveBeenCalled();
  });
});

describe('AbandonedCartDataService.updateUnsubscribed — inconnu ≠ erreur', () => {
  function dataService(result: { data: unknown; error: unknown }) {
    const service = Object.create(
      AbandonedCartDataService.prototype,
    ) as AbandonedCartDataService;
    const chain = {
      update: () => chain,
      eq: () => chain,
      select: () => chain,
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

  it('rend null quand aucun enregistrement ne porte ce lien', async () => {
    await expect(
      dataService({ data: null, error: null }).updateUnsubscribed(TOKEN),
    ).resolves.toBeNull();
  });

  it('lève l’erreur base au lieu de la confondre avec un lien inconnu', async () => {
    await expect(
      dataService({
        data: null,
        error: { message: 'connection refused' },
      }).updateUnsubscribed(TOKEN),
    ).rejects.toThrow(/connection refused/);
  });

  it('rend le client désabonné', async () => {
    await expect(
      dataService({ data: { cst_id: 42 }, error: null }).updateUnsubscribed(
        TOKEN,
      ),
    ).resolves.toEqual({ cst_id: 42 });
  });
});
