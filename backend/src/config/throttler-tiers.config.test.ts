/**
 * Contrat des tiers de rate-limiting — preuve sur un vrai Nest booté.
 *
 * Régression couverte (incident 2026-09-09, introduite par #390 le 2026-05-08) :
 * un throttler NOMMÉ dans `ThrottlerModule.forRoot` s'applique à **toutes** les
 * routes — @nestjs/throttler 6.5.0, `throttler.guard.js:66` boucle sur
 * `this.throttlers` dans `canActivate()`, sans aucune notion de portée. Le tier
 * `payment_callback` (30/min), pensé pour resserrer les 2 callbacks passerelle,
 * a donc plafonné le SITE ENTIER à 30 req/min/IP pendant 4 mois.
 *
 * Preuve terrain avant correctif (DEV:3000, cadence 5/s sur le handler catch-all
 * `remix.controller.ts:160 @All('{*path}')`, IP fictive) : 1er 429 à la **31e**
 * requête alors que `medium` affichait encore 69/100 et `short` 10/15.
 *
 * Le test lit les en-têtes `X-RateLimit-Limit-*` : ce sont les valeurs que le
 * guard a réellement résolues (`throttler.guard.js:135`, après `resolveValue` des
 * overrides de route), pas une relecture de la config. Précédent de boot Nest réel
 * sans dépendance externe : `modules/analytics/landing-attribution-cutover.nest.test.ts`.
 */
import { Controller, Get, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerModule, Throttle } from '@nestjs/throttler';
import request from 'supertest';

import { CloudflareThrottlerGuard } from '../common/guards/cloudflare-throttler.guard';
import { THROTTLER_TIERS } from './throttler-tiers.config';

/** Route ordinaire : modélise le catch-all SSR et toute route sans @Throttle. */
@Controller()
class PlainController {
  @Get('plain')
  plain(): { ok: true } {
    return { ok: true };
  }
}

/**
 * Route qui déclare explicitement le tier `payment_callback`.
 * Modélise `payments/controllers/{paybox-,payment-}callback.controller.ts`, qui
 * portent déjà `@Throttle({ payment_callback: { limit: 30, ttl: 60000 } })` et
 * restent intouchés (zone STOP owner — `.claude/rules/payments.md`).
 */
@Controller()
class ScopedController {
  @Throttle({ payment_callback: { limit: 30, ttl: 60000 } })
  @Get('scoped')
  scoped(): { ok: true } {
    return { ok: true };
  }
}

describe('THROTTLER_TIERS — portée des tiers nommés', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot({ throttlers: THROTTLER_TIERS })],
      controllers: [PlainController, ScopedController],
      providers: [{ provide: APP_GUARD, useClass: CloudflareThrottlerGuard }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  const limitsOf = async (path: string, ip: string) => {
    const res = await request(app.getHttpServer())
      .get(path)
      .set('Cf-Connecting-Ip', ip)
      .expect(200);
    const num = (h: string) => Number(res.headers[h.toLowerCase()]);
    return {
      short: num('X-RateLimit-Limit-short'),
      medium: num('X-RateLimit-Limit-medium'),
      long: num('X-RateLimit-Limit-long'),
      paymentCallback: num('X-RateLimit-Limit-payment_callback'),
    };
  };

  it('aucun tier de portée route ne resserre une route ordinaire sous `medium`', async () => {
    const limits = await limitsOf('/plain', '198.51.100.11');

    // Le défaut exact de #390 : payment_callback=30 < medium=100 sur une route
    // qui n'a jamais demandé ce tier ⇒ plafond réel du site à 30/min.
    expect(limits.medium).toBe(100);
    expect(limits.paymentCallback).toBeGreaterThanOrEqual(limits.medium);
  });

  it('les 2 fenêtres de rafale et horaire restent inchangées', async () => {
    const limits = await limitsOf('/plain', '198.51.100.12');

    expect(limits.short).toBe(15); // 15 req/s
    expect(limits.long).toBe(2000); // 2000 req/h
  });

  it('une route qui déclare `payment_callback` obtient bien ses 30/min', async () => {
    const limits = await limitsOf('/scoped', '198.51.100.13');

    // Protection paiement préservée (ADR-043 Sprint 1 ticket #6) : la valeur
    // opérante est posée PAR LA ROUTE. Si le tier disparaissait de forRoot,
    // l'override deviendrait inerte et cette assertion tomberait.
    expect(limits.paymentCallback).toBe(30);
  });
});
