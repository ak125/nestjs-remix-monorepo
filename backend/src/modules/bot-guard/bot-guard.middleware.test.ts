import { createHmac, randomUUID } from 'node:crypto';
import express from 'express';
import session from 'express-session';
import { Passport } from 'passport';
import request from 'supertest';
import { BotGuardMiddleware } from './bot-guard.middleware';
import { BotGuardService } from './bot-guard.service';

type ServiceMock = Record<string, jest.Mock | (() => boolean)>;

function makeMiddleware(
  overrides: ServiceMock = {},
  probeVerify: () => boolean = () => false,
  probeEgress: (ip?: string) => boolean = () => false,
) {
  const service = {
    isEnabled: () => true,
    isIpBlocked: jest.fn(async () => false),
    isVerifiedSearchEngine: jest.fn(async () => false),
    isCountryBlocked: jest.fn(async () => false),
    calculateSuspicionScore: jest.fn(() => 0),
    getSuspicionThreshold: jest.fn(() => 80),
    logBlocked: jest.fn(async () => undefined),
    trackAllowed: jest.fn(async () => undefined),
    ...overrides,
  };
  // Synthetic-probe credential: par défaut verify=false ET egress=false (chemin
  // synthétique jamais pris → comportement existant inchangé).
  const syntheticProbe = {
    verify: jest.fn(probeVerify),
    isExemptEgressIp: jest.fn(probeEgress),
  };
  const middleware = new BotGuardMiddleware(
    service as never,
    syntheticProbe as never,
  );
  return { middleware, service, syntheticProbe };
}

function makeReqRes(
  headers: Record<string, string> = {},
  path = '/pieces/disque-de-frein-82/iveco-84/x-34297.html',
  peer = '172.18.0.5', // immediate TCP peer = co-located Caddy (Docker-internal)
) {
  const req = {
    path,
    headers,
    socket: { remoteAddress: peer },
  } as never;
  const res = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      (this as { statusCode: number }).statusCode = code;
      return this;
    },
    json(payload: unknown) {
      (this as { body: unknown }).body = payload;
      return this;
    },
  } as never;
  const next = jest.fn();
  return { req, res, next };
}

describe('BotGuardMiddleware ordering', () => {
  it('lets a verified crawler through (next) and bypasses geo + behavioral', async () => {
    const { middleware, service } = makeMiddleware({
      isVerifiedSearchEngine: jest.fn(async () => true),
      isCountryBlocked: jest.fn(async () => true), // would block if consulted
    });
    const { req, res, next } = makeReqRes({
      'cf-ipcountry': 'US',
      'cf-connecting-ip': '66.249.66.1',
    });

    await middleware.use(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as { isVerifiedBot?: boolean }).isVerifiedBot).toBe(true);
    expect((res as { statusCode: number }).statusCode).toBe(200);
    // geo never consulted because the verified bypass returned first
    expect(service.isCountryBlocked).not.toHaveBeenCalled();
  });

  it('lets a verified synthetic probe through (dedicated flag) and bypasses geo + behavioral', async () => {
    const { middleware, service, syntheticProbe } = makeMiddleware(
      {
        isVerifiedSearchEngine: jest.fn(async () => false), // NOT a search engine
        isCountryBlocked: jest.fn(async () => true), // would block if consulted
        calculateSuspicionScore: jest.fn(() => 100), // would block if consulted
      },
      () => true, // valid HMAC credential
    );
    const { req, res, next } = makeReqRes({
      'cf-ipcountry': 'DE',
      'cf-connecting-ip': '203.0.113.7', // public client IP → reaches the probe check
    });

    await middleware.use(req, res, next);

    expect(syntheticProbe.verify).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
    expect(
      (req as { isVerifiedSyntheticProbe?: boolean }).isVerifiedSyntheticProbe,
    ).toBe(true);
    // distinct from the search-engine flag (least-privilege; skipIf scopes it)
    expect((req as { isVerifiedBot?: boolean }).isVerifiedBot).toBeUndefined();
    expect((res as { statusCode: number }).statusCode).toBe(200);
    expect(service.isCountryBlocked).not.toHaveBeenCalled();
    expect(service.calculateSuspicionScore).not.toHaveBeenCalled();
  });

  it('does NOT set the synthetic flag without a valid credential (verify=false → normal flow)', async () => {
    const { middleware, syntheticProbe } = makeMiddleware(); // default verify=false
    const { req, res, next } = makeReqRes({
      'cf-ipcountry': 'DE',
      'cf-connecting-ip': '203.0.113.7',
    });

    await middleware.use(req, res, next);

    expect(syntheticProbe.verify).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
    expect(
      (req as { isVerifiedSyntheticProbe?: boolean }).isVerifiedSyntheticProbe,
    ).toBeUndefined();
  });

  it('recognizes the synthetic probe by its egress IP when the HMAC header is absent (defense-in-depth floor)', async () => {
    // verify=false (en-tête HMAC retiré par le CDN) MAIS isExemptEgressIp=true
    // (cf-connecting-ip de la sonde dans l'allowlist) → exemption maintenue.
    const { middleware, service, syntheticProbe } = makeMiddleware(
      {
        isCountryBlocked: jest.fn(async () => true), // would block if consulted
        calculateSuspicionScore: jest.fn(() => 100), // would block if consulted
      },
      () => false, // HMAC absent / stripped
      () => true, // egress IP recognized
    );
    const { req, res, next } = makeReqRes({
      'cf-ipcountry': 'DE',
      'cf-connecting-ip': '203.0.113.7',
    });

    await middleware.use(req, res, next);

    expect(syntheticProbe.verify).toHaveBeenCalledTimes(1);
    // getClientIp's anti-spoofed IP is passed to the egress check
    expect(syntheticProbe.isExemptEgressIp).toHaveBeenCalledWith('203.0.113.7');
    expect(next).toHaveBeenCalledTimes(1);
    expect(
      (req as { isVerifiedSyntheticProbe?: boolean }).isVerifiedSyntheticProbe,
    ).toBe(true);
    expect((req as { isVerifiedBot?: boolean }).isVerifiedBot).toBeUndefined();
    expect(service.isCountryBlocked).not.toHaveBeenCalled();
    expect(service.calculateSuspicionScore).not.toHaveBeenCalled();
  });

  it('still honors an explicit operator IP block even for a would-be verified crawler (ip_block wins, no DNS work)', async () => {
    const verifySpy = jest.fn(async () => true);
    const { middleware, res, next, req, service } = (() => {
      const m = makeMiddleware({
        isIpBlocked: jest.fn(async () => true),
        isVerifiedSearchEngine: verifySpy,
      });
      const rr = makeReqRes({
        'cf-ipcountry': 'US',
        'cf-connecting-ip': '66.249.66.1',
      });
      return { middleware: m.middleware, service: m.service, ...rr };
    })();

    await middleware.use(req, res, next);

    expect((res as { statusCode: number }).statusCode).toBe(403);
    expect((res as { body: { code: string } }).body.code).toBe('IP_BLOCKED');
    expect(next).not.toHaveBeenCalled();
    // ip_block short-circuits before any FCrDNS lookup
    expect(service.isVerifiedSearchEngine).not.toHaveBeenCalled();
  });

  it('lets a verified crawler through even from a geo-blocked country', async () => {
    const { middleware, service } = makeMiddleware({
      isVerifiedSearchEngine: jest.fn(async () => true),
      isCountryBlocked: jest.fn(async () => true),
    });
    const { req, res, next } = makeReqRes({
      'cf-ipcountry': 'CN',
      'cf-connecting-ip': '66.249.66.1',
    });

    await middleware.use(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((res as { statusCode: number }).statusCode).toBe(200);
    expect(service.isCountryBlocked).not.toHaveBeenCalled();
  });
});

describe('BotGuardMiddleware client-IP trust (anti-spoof)', () => {
  it('IGNORES a spoofed cf-connecting-ip when the TCP peer is a public IP (direct-to-app) — verifies the real peer, not the header', async () => {
    const { middleware, service } = makeMiddleware({
      isVerifiedSearchEngine: jest.fn(async () => false),
    });
    // Attacker connects directly (public peer) and forges a real Googlebot IP.
    const { req, res, next } = makeReqRes(
      { 'cf-connecting-ip': '66.249.66.1', 'cf-ipcountry': 'US' },
      '/pieces/x.html',
      '203.0.113.50', // public peer = NOT our reverse proxy
    );

    await middleware.use(req, res, next);

    // FCrDNS must run against the real peer, never the spoofed header.
    expect(service.isVerifiedSearchEngine).toHaveBeenCalledWith(
      '203.0.113.50',
      expect.any(String),
    );
  });

  it('TRUSTS cf-connecting-ip when the TCP peer is the internal reverse proxy', async () => {
    const { middleware, service } = makeMiddleware({
      isVerifiedSearchEngine: jest.fn(async () => false),
    });
    const { req, res, next } = makeReqRes(
      { 'cf-connecting-ip': '66.249.66.1', 'cf-ipcountry': 'US' },
      '/pieces/x.html',
      '172.18.0.5', // internal peer (Caddy)
    );

    await middleware.use(req, res, next);

    expect(service.isVerifiedSearchEngine).toHaveBeenCalledWith(
      '66.249.66.1',
      expect.any(String),
    );
  });
});

// Keep the scoring service real: the cookie and threshold defects only appear
// when the middleware's decision is exercised with the actual score calculation.
async function makePolicyMiddleware(
  envThreshold = '80',
  storedThreshold?: number,
) {
  const values: Record<string, string> = {
    BOT_GUARD_SUSPICION_THRESHOLD: envThreshold,
  };
  const store = new Map<string, unknown>();
  if (storedThreshold !== undefined) {
    store.set('bot-guard:config', { suspicionThreshold: storedThreshold });
  }
  const service = new BotGuardService(
    {
      get: (key: string, fallback: string) => values[key] ?? fallback,
    } as never,
    {
      get: async (key: string) => store.get(key) ?? null,
      set: async (key: string, value: unknown) => {
        store.set(key, value);
      },
    } as never,
  );
  await service.onModuleInit();
  const middleware = new BotGuardMiddleware(service, {
    verify: () => false,
    isExemptEgressIp: () => false,
  } as never);
  return { middleware, service, store };
}

const SCRAPER_HEADERS = {
  'cf-connecting-ip': '203.0.113.50',
  'cf-ipcountry': 'US',
  'user-agent': 'curl/8.0.0',
};

describe('BotGuardMiddleware real scoring policy', () => {
  it.each([
    'connect.sid=forged',
    'unrelated=connect.sid',
    'connect.sid=s%3Aforged.invalid-signature',
    'cf_clearance=unverified',
  ])(
    'does not lower a scraper score for the client-controlled cookie %s',
    async (cookie) => {
      const { middleware } = await makePolicyMiddleware();
      const { req, res, next } = makeReqRes(
        { ...SCRAPER_HEADERS, cookie },
        '/api/catalog/items',
      );
      await middleware.use(req, res, next);
      // Missing language + curl + unauthenticated deep request + US + catalog = 85.
      expect(res).toMatchObject({
        statusCode: 403,
        body: { code: 'SUSPICIOUS' },
      });
      expect(next).not.toHaveBeenCalled();
    },
  );

  it('uses the server-authenticated Passport session, not a raw cookie', async () => {
    const { middleware } = await makePolicyMiddleware();
    const { req, res, next } = makeReqRes(
      SCRAPER_HEADERS,
      '/api/catalog/items',
    );
    Object.assign(req, { isAuthenticated: () => true });
    await middleware.use(req, res, next);
    expect(res).toMatchObject({ statusCode: 200 }); // authenticated score = 70
    expect(next).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['FR', 'fr-FR'],
    ['US', 'en-US'],
    ['DE', 'de-DE'],
  ])(
    'allows an ordinary anonymous browser from %s without a session',
    async (country, language) => {
      const { middleware } = await makePolicyMiddleware();
      const { req, res, next } = makeReqRes({
        ...SCRAPER_HEADERS,
        'cf-ipcountry': country,
        'accept-language': language,
        'user-agent': 'Mozilla/5.0 Chrome/146.0.0.0 Safari/537.36',
      });
      await middleware.use(req, res, next);
      expect(res).toMatchObject({ statusCode: 200 });
      expect(next).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    ['80', undefined, 403],
    ['85', undefined, 403],
    ['86', undefined, 200],
    ['90', undefined, 200],
    ['80', 90, 200],
  ])(
    'applies env threshold %s and stored override %s to the real score',
    async (env, stored, status) => {
      const { middleware } = await makePolicyMiddleware(env, stored);
      const { req, res, next } = makeReqRes(
        SCRAPER_HEADERS,
        '/api/catalog/items',
      );
      await middleware.use(req, res, next);
      expect(res).toMatchObject({ statusCode: status });
      expect(next).toHaveBeenCalledTimes(status === 200 ? 1 : 0);
    },
  );

  it('applies an operator threshold update on the next request', async () => {
    const { middleware, service } = await makePolicyMiddleware();
    await service.updateConfig({ suspicionThreshold: 90 });
    const { req, res, next } = makeReqRes(
      SCRAPER_HEADERS,
      '/api/catalog/items',
    );
    await middleware.use(req, res, next);
    expect(res).toMatchObject({ statusCode: 200 });
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('BotGuardMiddleware with the session/Passport HTTP chain', () => {
  const sessionSecret = 'bot-guard-test-only-not-a-deployment-secret';

  async function authenticatedCookie(store: session.MemoryStore) {
    const sessionId = randomUUID();
    // Seed an already authenticated server session; no test login endpoint.
    const data = Object.assign(
      {
        cookie: Object.assign(new session.Cookie(), {
          secure: true,
          httpOnly: true,
        }),
      },
      { passport: { user: 42 } },
    );
    await new Promise<void>((resolve, reject) => {
      store.set(sessionId, data, (err) => (err ? reject(err) : resolve()));
    });
    // express-session cookie-signature wire format, using Node's HMAC primitive.
    // Successful restoration below proves the cookie is accepted by the real middleware.
    const signature = createHmac('sha256', sessionSecret)
      .update(sessionId)
      .digest('base64')
      .replace(/=+$/, '');
    return `connect.sid=${encodeURIComponent(`s:${sessionId}.${signature}`)}`;
  }
  async function makeHttpApp() {
    const { middleware } = await makePolicyMiddleware();
    const app = express();
    // Model TLS termination at the trusted local reverse proxy.
    app.set('trust proxy', 'loopback');
    const sessionStore = new session.MemoryStore();
    const passport = new Passport();
    passport.serializeUser((user, done) => done(null, user.id_utilisateur));
    passport.deserializeUser((id: number, done) =>
      done(null, { id_utilisateur: id, email: 'fixture@example.test' }),
    );
    app.use(
      session({
        store: sessionStore,
        secret: sessionSecret,
        cookie: { secure: true, httpOnly: true, sameSite: 'lax' },
        resave: false,
        saveUninitialized: false,
      }),
    );
    app.use(passport.initialize());
    app.use(passport.session());
    app.use((req, res, next) => {
      void middleware.use(req, res, next);
    });
    app.get('/api/catalog/items', (_req, res) => res.json({ ok: true }));
    return { app, sessionStore };
  }

  it('blocks unsigned and invalidly signed session cookies after express-session has processed them', async () => {
    const { app } = await makeHttpApp();
    for (const cookie of [
      'connect.sid=forged',
      'connect.sid=s%3Aforged.invalid-signature',
    ]) {
      const response = await request(app)
        .get('/api/catalog/items')
        .set(SCRAPER_HEADERS)
        .set('X-Forwarded-Proto', 'https')
        .set('Cookie', cookie);
      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        error: 'Access denied',
        code: 'SUSPICIOUS',
      });
    }
  });

  it('does not trust a valid signed cookie after its server session is gone', async () => {
    const { app, sessionStore } = await makeHttpApp();
    const cookie = await authenticatedCookie(sessionStore);
    await new Promise<void>((resolve, reject) => {
      sessionStore.clear((err) => (err ? reject(err) : resolve()));
    });
    const response = await request(app)
      .get('/api/catalog/items')
      .set(SCRAPER_HEADERS)
      .set('X-Forwarded-Proto', 'https')
      .set('Cookie', cookie);
    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: 'Access denied',
      code: 'SUSPICIOUS',
    });
  });

  it('recognizes the restored authenticated session on the following HTTP request', async () => {
    const { app, sessionStore } = await makeHttpApp();
    const cookie = await authenticatedCookie(sessionStore);
    const response = await request(app)
      .get('/api/catalog/items')
      .set(SCRAPER_HEADERS)
      .set('X-Forwarded-Proto', 'https')
      .set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });
});
