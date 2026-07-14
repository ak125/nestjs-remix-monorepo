/**
 * Cache cutover proof (PR A) — REAL Nest app boot.
 *
 * Supersedes the earlier hand-rolled express() test: this boots an actual
 * NestApplication (Test.createTestingModule + createNestApplication + init) and
 * wires the session/passport middleware chain in the EXACT order of
 * backend/src/main.ts (session → passport.initialize → passport.session →
 * catch-all), then asserts the invariant on the real Nest routing stack.
 *
 * Precedent for booting a real Nest app with an @All('{*path}') catch-all and
 * zero external deps (no Supabase/Redis): backend/tests/unit/route-wildcard-
 * middleware.test.ts.
 *
 * Why a stand-in catch-all controller instead of the real RemixController:
 * RemixController.handler needs the SSR build artifact (getServerBuild()), which
 * is absent under jest → it can't boot here. But the session-write audit
 * (workflow we3zqodnc) proved RemixController is strictly READ-ONLY on the
 * session for anonymous GETs — it only reads request.user / cspNonce
 * (remix.controller.ts:95-105) and NEVER exposes req.session to loaders. The
 * stand-in below models that exact behaviour (reads req.user, writes nothing to
 * req.session), so the middleware-chain assertion is faithful. The remaining
 * gap (the real container end-to-end) is closed by the PREPROD curl probes
 * documented in the PR body, run post-merge.
 *
 * Store-independence: express-session never calls store.set for an unmodified
 * session, so the default MemoryStore is a faithful proxy for Redis w.r.t. the
 * Set-Cookie decision — saveUninitialized:false is the load-bearing option.
 */
import { All, Controller, Module, Req } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import session from 'express-session';
import passport from 'passport';
import request from 'supertest';
import { LandingAttributionController } from './controllers/landing-attribution.controller';

// Faithful stand-in for RemixController on anonymous GETs: reads req.user (as
// the real controller does), writes NOTHING to req.session, returns HTML.
@Controller()
class PublicSurfaceProbeController {
  @All('{*path}')
  handle(@Req() req: Request): string {
    void req.user; // read-only, exactly like RemixController — never assigns req.session
    return '<html>ok</html>';
  }
}

// LandingAttributionController FIRST so its POST route is registered before the
// catch-all (mirrors main.ts, where the Remix catch-all is mounted last).
@Module({
  controllers: [LandingAttributionController, PublicSurfaceProbeController],
})
class ProbeModule {}

const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';

// The 5 public cacheable surfaces from the review (representative slugs).
const PUBLIC_SURFACES = [
  '/',
  '/pieces/freinage',
  '/constructeurs/renault.html',
  '/reference-auto/x',
  '/blog-pieces-auto/x',
];

describe('cache cutover — anonymous GET emits NO Set-Cookie (real Nest app)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [ProbeModule],
    }).compile();
    app = mod.createNestApplication();

    // MIRROR main.ts order EXACTLY: session → passport.initialize →
    // passport.session → (catch-all). Options == SessionStoreService
    // .createSessionMiddleware() (session-store.service.ts:150-164);
    // saveUninitialized:false is the load-bearing bit. MemoryStore (default)
    // is immaterial to the Set-Cookie decision for an unmodified session.
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

  it.each(PUBLIC_SURFACES)(
    'anonymous mobile GET %s sets NO cookie (edge-cacheable)',
    async (url) => {
      const res = await request(app.getHttpServer())
        .get(url)
        .set('user-agent', MOBILE_UA)
        .set('referer', 'https://www.google.com/search?q=freins');
      expect(res.status).toBe(200);
      expect(res.headers['set-cookie']).toBeUndefined(); // ZERO connect.sid
    },
  );

  it('positive control: valid attribution POST materialises the session HERE (never CF-cached)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/attribution/landing')
      .set('user-agent', MOBILE_UA)
      .send({
        path: '/pieces/freinage',
        referer: 'https://www.google.com/search?q=x',
      });
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ ok: true });
    // The write path merely MOVED onto this POST — Set-Cookie here is expected
    // and safe (Cloudflare never caches POST responses).
    expect(String(res.headers['set-cookie'])).toMatch(/connect\.sid/);
  });

  it('bot POST + malformed POST: 202 no-op, NO cookie', async () => {
    const bot = await request(app.getHttpServer())
      .post('/api/attribution/landing')
      .set('user-agent', 'Googlebot/2.1 (+http://www.google.com/bot.html)')
      .send({ path: '/x' });
    expect(bot.status).toBe(202);
    expect(bot.body).toEqual({ ok: false });
    expect(bot.headers['set-cookie']).toBeUndefined();

    const bad = await request(app.getHttpServer())
      .post('/api/attribution/landing')
      .set('user-agent', MOBILE_UA)
      .send({ foo: 'bar', path: 123 });
    expect(bad.status).toBe(202);
    expect(bad.body).toEqual({ ok: false });
    expect(bad.headers['set-cookie']).toBeUndefined();
  });
});
