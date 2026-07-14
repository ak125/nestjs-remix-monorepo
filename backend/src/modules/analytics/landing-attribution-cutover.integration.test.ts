import express from 'express';
import session from 'express-session';
import request from 'supertest';
import { LandingAttributionController } from './controllers/landing-attribution.controller';

/**
 * Cutover integration test (PR A) — proves the cache invariant end-to-end with a
 * REAL express-session (saveUninitialized:false, same as
 * session-store.service.ts:153):
 *
 *   T1  anonymous HTML GET               ⇒ ZERO Set-Cookie (edge-cacheable)
 *   cutover  valid attribution POST      ⇒ session materialised HERE (Set-Cookie
 *                                          on POST is safe — never CF-cached)
 *   T5  bot POST                         ⇒ no attribution, ZERO Set-Cookie
 *   T6  malformed POST                   ⇒ 202 no-op, no throw, ZERO Set-Cookie
 *
 * A plain express app mirrors the prod wiring (session middleware + the
 * controller) without booting Nest/Supabase, so the assertion is about
 * express-session's real Set-Cookie behaviour, not a mock.
 */
function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      // Allowlisted mock secret (.gitleaks.toml) — no real secret in tests.
      secret: 'test-secret-must-be-at-least-32-chars-long-xyz',
      resave: false,
      saveUninitialized: false, // ← identical to prod (no cookie unless session written)
      cookie: { httpOnly: true },
    }),
  );

  const controller = new LandingAttributionController();

  // Public "HTML" GET that writes NOTHING to the session — models the cutover
  // invariant: with the middleware removed, nothing on the GET path
  // materialises the session.
  app.get('/pieces/x', (_req, res) => res.send('<html>ok</html>'));

  app.post('/api/attribution/landing', (req, res) => {
    const out = controller.landing(
      req.body,
      req as never,
      req.get('user-agent'),
    );
    res.status(202).json(out);
  });

  return app;
}

const HUMAN_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)';

describe('landing attribution — cache cutover (integration)', () => {
  const app = makeApp();

  it('anonymous HTML GET sets NO cookie (T1 — edge-cacheable)', async () => {
    const res = await request(app)
      .get('/pieces/x')
      .set('user-agent', HUMAN_UA)
      .set('referer', 'https://www.google.com/search?q=freins');
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('valid attribution POST materialises the session HERE (Set-Cookie on POST is safe)', async () => {
    const res = await request(app)
      .post('/api/attribution/landing')
      .set('user-agent', HUMAN_UA)
      .send({
        path: '/pieces/x',
        referer: 'https://www.google.com/search?q=x',
      });
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ ok: true });
    // The session is created on the POST — this is the cookie we deliberately
    // moved off the cacheable GET onto a never-cached POST.
    const cookie = res.headers['set-cookie'];
    expect(cookie).toBeDefined();
    expect(String(cookie)).toMatch(/connect\.sid/);
  });

  it('bot POST writes nothing and sets NO cookie (T5)', async () => {
    const res = await request(app)
      .post('/api/attribution/landing')
      .set('user-agent', 'Googlebot/2.1 (+http://www.google.com/bot.html)')
      .send({ path: '/pieces/x' });
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ ok: false });
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('malformed POST is a 202 no-op with NO cookie and no crash (T6)', async () => {
    const res = await request(app)
      .post('/api/attribution/landing')
      .set('user-agent', HUMAN_UA)
      .send({ foo: 'bar', path: 123 });
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ ok: false });
    expect(res.headers['set-cookie']).toBeUndefined();
  });
});
