import { LandingAttributionMiddleware } from './landing-attribution.middleware';

function mkReq(over: Record<string, unknown> = {}): any {
  return {
    method: 'GET',
    path: '/pieces/plaquettes-de-frein',
    originalUrl: '/pieces/plaquettes-de-frein?utm_source=x',
    query: {},
    headers: {
      host: 'www.automecanik.com',
      referer: 'https://www.google.com/search?q=x',
      'user-agent': 'Mozilla/5.0',
    },
    get(name: string) {
      return (this.headers as Record<string, string>)[name.toLowerCase()];
    },
    session: {},
    ...over,
  };
}

describe('LandingAttributionMiddleware', () => {
  const mw = new LandingAttributionMiddleware();

  it('writes session.landing on the first organic hit', () => {
    const req = mkReq();
    const next = jest.fn();
    mw.use(req, {} as any, next);
    expect(req.session.landing).toBeDefined();
    expect(req.session.landing.source).toBe('organic');
    expect(req.session.landing.path).toBe('/pieces/plaquettes-de-frein');
    expect(typeof req.session.landing.firstSeenAt).toBe('string');
    expect(next).toHaveBeenCalled();
  });

  it('does not overwrite an existing session.landing', () => {
    const existing = {
      source: 'paid' as const,
      path: '/x',
      firstSeenAt: '2026-01-01T00:00:00.000Z',
    };
    const req = mkReq({ session: { landing: existing } });
    mw.use(req, {} as any, jest.fn());
    expect(req.session.landing).toEqual(existing);
  });

  it('skips non-GET requests', () => {
    const req = mkReq({ method: 'POST' });
    mw.use(req, {} as any, jest.fn());
    expect(req.session.landing).toBeUndefined();
  });

  it('skips static asset paths', () => {
    const req = mkReq({ path: '/assets/app.css' });
    mw.use(req, {} as any, jest.fn());
    expect(req.session.landing).toBeUndefined();
  });

  it('skips obvious crawlers', () => {
    const req = mkReq({
      headers: { host: 'www.automecanik.com', 'user-agent': 'Googlebot/2.1' },
    });
    mw.use(req, {} as any, jest.fn());
    expect(req.session.landing).toBeUndefined();
  });

  it('always calls next() even when it skips', () => {
    const req = mkReq({ method: 'POST' });
    const next = jest.fn();
    mw.use(req, {} as any, next);
    expect(next).toHaveBeenCalled();
  });

  it('is a no-op (but calls next) when there is no session', () => {
    const req = mkReq({ session: undefined });
    const next = jest.fn();
    expect(() => mw.use(req, {} as any, next)).not.toThrow();
    expect(next).toHaveBeenCalled();
  });
});
