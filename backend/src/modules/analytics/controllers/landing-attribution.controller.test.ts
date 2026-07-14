import { LandingAttributionController } from './landing-attribution.controller';

/**
 * Unit tests for the first-touch attribution endpoint (cutover cache HTML, PR A).
 * Covers the owner-required acceptance criteria T2–T7 at the controller level;
 * T1 (anonymous GET ⇒ 0 Set-Cookie) is proven end-to-end in the sibling
 * `landing-attribution-cutover.integration.test.ts` with a real express-session.
 */
function mkReq(over: Record<string, unknown> = {}): any {
  return {
    headers: { host: 'www.automecanik.com' },
    get(name: string) {
      return (this.headers as Record<string, string>)[name.toLowerCase()];
    },
    session: {},
    ...over,
  };
}

describe('LandingAttributionController', () => {
  const controller = new LandingAttributionController();

  // ── T2 : first ping creates attribution ──────────────────────────────────
  it('records first-touch attribution on the first valid ping (T2)', () => {
    const req = mkReq();
    const out = controller.landing(
      {
        path: '/pieces/plaquettes',
        referer: 'https://www.google.com/search?q=x',
      },
      req,
      'Mozilla/5.0',
    );
    expect(out).toEqual({ ok: true });
    expect(req.session.landing.source).toBe('organic');
    expect(req.session.landing.path).toBe('/pieces/plaquettes');
    expect(typeof req.session.landing.firstSeenAt).toBe('string');
  });

  it('classifies from the body query (paid click-id) — server-side (T2)', () => {
    const req = mkReq();
    controller.landing(
      { path: '/x', query: { gclid: 'abc' } },
      req,
      'Mozilla/5.0',
    );
    expect(req.session.landing.source).toBe('paid');
  });

  it('uses the server host (not the client) as selfHost — anti-spoof (T2)', () => {
    // Referer on the self host ⇒ internal navigation ⇒ direct.
    const req = mkReq();
    controller.landing(
      { path: '/x', referer: 'https://www.automecanik.com/pieces' },
      req,
      'Mozilla/5.0',
    );
    expect(req.session.landing.source).toBe('direct');
  });

  // ── T3 : repeated ping — first-touch never overwritten ────────────────────
  it('never overwrites an existing session.landing (T3)', () => {
    const existing = {
      source: 'paid' as const,
      path: '/x',
      firstSeenAt: '2026-01-01T00:00:00.000Z',
    };
    const req = mkReq({ session: { landing: existing } });
    const out = controller.landing(
      { path: '/other', referer: 'https://www.google.com/' },
      req,
      'Mozilla/5.0',
    );
    expect(out).toEqual({ ok: true });
    expect(req.session.landing).toEqual(existing);
  });

  // ── T4 : existing session (auth/cart) unchanged ───────────────────────────
  it('touches only session.landing — auth/cart untouched (T4)', () => {
    const req = mkReq({
      session: { cart: { items: 3 }, passport: { user: 42 } },
    });
    controller.landing({ path: '/pieces/x' }, req, 'Mozilla/5.0');
    expect(req.session.cart).toEqual({ items: 3 });
    expect(req.session.passport).toEqual({ user: 42 });
    expect(req.session.landing).toBeDefined();
  });

  // ── T5 : bots produce no attribution ──────────────────────────────────────
  it('skips crawlers — no attribution written (T5)', () => {
    const req = mkReq();
    const out = controller.landing({ path: '/pieces/x' }, req, 'Googlebot/2.1');
    expect(out).toEqual({ ok: false });
    expect(req.session.landing).toBeUndefined();
  });

  it('skips when the UA is empty (T5)', () => {
    const req = mkReq();
    const out = controller.landing({ path: '/x' }, req, undefined);
    expect(out).toEqual({ ok: false });
    expect(req.session.landing).toBeUndefined();
  });

  // ── T6 : malformed / degraded input never throws, never writes ────────────
  it('rejects a malformed payload with 202-equivalent no-op, no throw (T6)', () => {
    const req = mkReq();
    let out: { ok: boolean } | undefined;
    expect(() => {
      out = controller.landing({ foo: 'bar', path: 123 }, req, 'Mozilla/5.0');
    }).not.toThrow();
    expect(out).toEqual({ ok: false });
    expect(req.session.landing).toBeUndefined();
  });

  it('rejects unknown fields at the root (strict schema) (T6)', () => {
    const req = mkReq();
    const out = controller.landing(
      { path: '/x', evil: 'nope' },
      req,
      'Mozilla/5.0',
    );
    expect(out).toEqual({ ok: false });
    expect(req.session.landing).toBeUndefined();
  });

  it('rejects an unknown key INSIDE query (nested strict allowlist) (T6)', () => {
    const req = mkReq();
    const out = controller.landing(
      { path: '/x', query: { utm_source: 'news', evil: 'nope' } },
      req,
      'Mozilla/5.0',
    );
    expect(out).toEqual({ ok: false });
    expect(req.session.landing).toBeUndefined();
  });

  it('accepts a valid allowlisted query value and classifies it (T2)', () => {
    const req = mkReq();
    const out = controller.landing(
      { path: '/x', query: { utm_medium: 'cpc' } },
      req,
      'Mozilla/5.0',
    );
    expect(out).toEqual({ ok: true });
    expect(req.session.landing.source).toBe('paid'); // cpc = paid medium
  });

  it('rejects an over-long query value (size bound) (T6)', () => {
    const req = mkReq();
    const out = controller.landing(
      { path: '/x', query: { utm_medium: 'x'.repeat(65) } }, // max 64
      req,
      'Mozilla/5.0',
    );
    expect(out).toEqual({ ok: false });
    expect(req.session.landing).toBeUndefined();
  });

  it('is a no-op (no throw) when there is no session (T6)', () => {
    const req = mkReq({ session: undefined });
    expect(() =>
      controller.landing({ path: '/x' }, req, 'Mozilla/5.0'),
    ).not.toThrow();
  });

  // ── T7 : written shape matches exactly what orders.controller persists ─────
  it('writes exactly {source,path,firstSeenAt} consumed by orders (T7)', () => {
    const req = mkReq();
    controller.landing(
      { path: '/pieces/x?a=1&utm_source=news', query: { utm_source: 'news' } },
      req,
      'Mozilla/5.0',
    );
    const landing = req.session.landing;
    // Exact contract read by orders.controller → ___xtr_order.landing_{source,path,first_seen_at}.
    expect(Object.keys(landing).sort()).toEqual([
      'firstSeenAt',
      'path',
      'source',
    ]);
    // pathname only — query string stripped (PII invariant, matches old middleware).
    expect(landing.path).toBe('/pieces/x');
    expect(landing.source).toBe('campaign');
  });
});
