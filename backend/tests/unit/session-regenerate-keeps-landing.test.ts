/**
 * Mandat BE — la provenance d'une commande survit à la connexion.
 *
 * Chaîne réelle : le beacon first-touch écrit `session.landing`
 * (LandingAttributionController), puis orders.controller la relit pour
 * `___xtr_order.landing_*`. Entre les deux, toute connexion ou inscription
 * régénère la session (protection contre la fixation) : la provenance était
 * perdue, et le beacon ne la renvoie pas (une fois par onglet).
 *
 * Ce test monte une vraie application Nest avec express-session et passport
 * dans l'ordre de `backend/src/main.ts`, le vrai contrôleur du beacon et les
 * vrais helpers de session, appelés dans l'ordre de auth-login.controller
 * (regenerate → login → save). La sonde `/probe/order-read` lit la session
 * comme orders.controller (`req.session?.landing`).
 *
 * Le store mémoire d'express-session suffit : la régénération et la recopie
 * passent par les méthodes de Session, jamais par le store.
 */
import { Controller, Get, Module, Post, Req } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import session from 'express-session';
import passport from 'passport';
import request from 'supertest';
import { LandingAttributionController } from '../../src/modules/analytics/controllers/landing-attribution.controller';
import {
  promisifyLoginNoRegenerate,
  promisifySessionRegenerate,
  promisifySessionSave,
} from '../../src/utils/promise-helpers';

@Controller('probe')
class SessionProbeController {
  /** Même séquence que les six connexions de auth-login.controller. */
  @Post('login')
  async login(@Req() req: Request) {
    const before = req.sessionID;
    await promisifySessionRegenerate(req);
    await promisifyLoginNoRegenerate(req, { id: 'user-1' });
    await promisifySessionSave(req.session);
    return { before, after: req.sessionID };
  }

  /** Contrôle négatif : la régénération nue, telle qu'avant le correctif. */
  @Post('login-bare-regenerate')
  async loginBare(@Req() req: Request) {
    await new Promise<void>((resolve, reject) =>
      req.session.regenerate((err) => (err ? reject(err) : resolve())),
    );
    await promisifyLoginNoRegenerate(req, { id: 'user-1' });
    await promisifySessionSave(req.session);
    return { ok: true };
  }

  /** Pose une donnée de pré-connexion qui ne doit PAS être recopiée. */
  @Post('nonce')
  async nonce(@Req() req: Request) {
    req.session.googleNonce = 'nonce-avant-connexion';
    await promisifySessionSave(req.session);
    return { ok: true };
  }

  /** Lecture identique à orders.controller : `req.session?.landing`. */
  @Get('order-read')
  orderRead(@Req() req: Request) {
    return {
      landing: req.session?.landing ?? null,
      googleNonce: req.session?.googleNonce ?? null,
      authenticated: Boolean(req.user),
    };
  }
}

@Module({
  controllers: [LandingAttributionController, SessionProbeController],
})
class ProbeModule {}

const BROWSER_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
const LANDING_PATH = '/pieces/plaquette-de-frein-402.html';

describe('provenance de commande à travers la connexion (mandat BE)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    passport.serializeUser((user, done) => done(null, user));
    passport.deserializeUser((user: Express.User, done) => done(null, user));

    const mod = await Test.createTestingModule({
      imports: [ProbeModule],
    }).compile();
    app = mod.createNestApplication();
    const http = app.getHttpAdapter().getInstance();
    http.use(
      session({
        secret: 'test-secret-must-be-at-least-32-chars-long-xyz', // allowlisted mock (.gitleaks.toml)
        resave: false,
        saveUninitialized: false,
        name: 'connect.sid',
        cookie: { httpOnly: true, sameSite: 'lax', path: '/' },
      }),
    );
    http.use(passport.initialize());
    http.use(passport.session());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  /** Première visite : le beacon réel pose la provenance et le cookie. */
  async function firstVisit() {
    const agent = request.agent(app.getHttpServer());
    const ping = await agent
      .post('/api/attribution/landing')
      .set('user-agent', BROWSER_UA)
      .send({
        path: LANDING_PATH,
        referer: 'https://www.google.com/search?q=plaquettes',
      });
    expect(ping.body).toEqual({ ok: true });
    return agent;
  }

  it('la provenance de la première visite est lue à la commande après connexion', async () => {
    const agent = await firstVisit();

    const avant = await agent.get('/probe/order-read');
    expect(avant.body.landing).toMatchObject({
      source: 'organic',
      path: LANDING_PATH,
    });
    const firstSeenAt = avant.body.landing.firstSeenAt;

    const login = await agent.post('/probe/login');
    expect(login.status).toBe(201);

    const apres = await agent.get('/probe/order-read');
    expect(apres.body.authenticated).toBe(true);
    // Mêmes trois champs, même horodatage : c'est la première visite, pas une
    // recapture au retour de connexion.
    expect(apres.body.landing).toEqual({
      source: 'organic',
      path: LANDING_PATH,
      firstSeenAt,
    });
  });

  it("la régénération a bien lieu : nouvel identifiant, l'ancien ne vaut plus rien", async () => {
    const agent = await firstVisit();
    const login = await agent.post('/probe/login');
    expect(login.body.after).not.toBe(login.body.before);

    // Témoin : un cookie forgé avec le NOUVEL identifiant ouvre bien la
    // session, donc le refus ci-dessous ne vient pas d'une signature fausse.
    const fresh = await request(app.getHttpServer())
      .get('/probe/order-read')
      .set('Cookie', signedSessionCookie(login.body.after));
    expect(fresh.body.authenticated).toBe(true);

    // Rejoue l'ancien cookie de pré-connexion : session inconnue du store.
    const stale = await request(app.getHttpServer())
      .get('/probe/order-read')
      .set('Cookie', signedSessionCookie(login.body.before));
    expect(stale.body).toEqual({
      landing: null,
      googleNonce: null,
      authenticated: false,
    });
  });

  it('seule la provenance est recopiée : une autre donnée de pré-connexion est effacée', async () => {
    const agent = await firstVisit();
    await agent.post('/probe/nonce');
    await agent.post('/probe/login');

    const apres = await agent.get('/probe/order-read');
    expect(apres.body.googleNonce).toBeNull();
    expect(apres.body.landing).toMatchObject({ path: LANDING_PATH });
  });

  it('sans provenance en session, la connexion ne crée rien', async () => {
    const agent = request.agent(app.getHttpServer());
    const login = await agent.post('/probe/login');
    expect(login.status).toBe(201);

    const apres = await agent.get('/probe/order-read');
    expect(apres.body).toEqual({
      landing: null,
      googleNonce: null,
      authenticated: true,
    });
  });

  it('un second beacon après connexion ne remplace pas la première visite', async () => {
    const agent = await firstVisit();
    await agent.post('/probe/login');
    await agent
      .post('/api/attribution/landing')
      .set('user-agent', BROWSER_UA)
      .send({ path: '/checkout', referer: 'https://accounts.google.com/' });

    const apres = await agent.get('/probe/order-read');
    expect(apres.body.landing).toMatchObject({
      source: 'organic',
      path: LANDING_PATH,
    });
  });

  it('contrôle négatif : la régénération nue perd la provenance (cause du défaut)', async () => {
    const agent = await firstVisit();
    await agent.post('/probe/login-bare-regenerate');

    const apres = await agent.get('/probe/order-read');
    expect(apres.body.authenticated).toBe(true);
    expect(apres.body.landing).toBeNull();
  });

  it('une erreur de régénération est propagée', async () => {
    const landing = {
      source: 'organic' as const,
      path: LANDING_PATH,
      firstSeenAt: '2026-11-16T22:00:00.000Z',
    };
    const fakeSession = {
      landing,
      regenerate: (cb: (err?: Error) => void) => cb(new Error('store down')),
    };
    const req = { session: fakeSession } as never;

    await expect(promisifySessionRegenerate(req)).rejects.toThrow('store down');
  });
});

/**
 * Cookie de session signé pour un identifiant donné. Même secret que le middleware du test ;
 * `cookie-signature` est la dépendance d'express-session pour cette signature.
 */
function signedSessionCookie(sessionId: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- dépendance transitive d'express-session, sans types
  const { sign } = require('cookie-signature') as {
    sign: (value: string, secret: string) => string;
  };
  const signed = sign(
    sessionId,
    'test-secret-must-be-at-least-32-chars-long-xyz',
  );
  return `connect.sid=${encodeURIComponent(`s:${signed}`)}`;
}
