import { BotGuardMiddleware } from './bot-guard.middleware';

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
