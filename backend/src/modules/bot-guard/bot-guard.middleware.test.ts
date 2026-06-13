import { BotGuardMiddleware } from './bot-guard.middleware';

type ServiceMock = Record<string, jest.Mock | (() => boolean)>;

function makeMiddleware(overrides: ServiceMock = {}) {
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
  const middleware = new BotGuardMiddleware(service as never);
  return { middleware, service };
}

function makeReqRes(
  headers: Record<string, string> = {},
  path = '/pieces/disque-de-frein-82/iveco-84/x-34297.html',
) {
  const req = {
    path,
    headers,
    socket: { remoteAddress: '66.249.66.1' },
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
    const { req, res, next } = makeReqRes({ 'cf-ipcountry': 'US' });

    await middleware.use(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as { isVerifiedBot?: boolean }).isVerifiedBot).toBe(true);
    expect((res as { statusCode: number }).statusCode).toBe(200);
    // geo never consulted because the verified bypass returned first
    expect(service.isCountryBlocked).not.toHaveBeenCalled();
  });

  it('still honors an explicit operator IP block even for a would-be verified crawler (ip_block wins, no DNS work)', async () => {
    const verifySpy = jest.fn(async () => true);
    const { middleware, res, next, req, service } = (() => {
      const m = makeMiddleware({
        isIpBlocked: jest.fn(async () => true),
        isVerifiedSearchEngine: verifySpy,
      });
      const rr = makeReqRes({ 'cf-ipcountry': 'US' });
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
    const { req, res, next } = makeReqRes({ 'cf-ipcountry': 'CN' });

    await middleware.use(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((res as { statusCode: number }).statusCode).toBe(200);
    expect(service.isCountryBlocked).not.toHaveBeenCalled();
  });
});
