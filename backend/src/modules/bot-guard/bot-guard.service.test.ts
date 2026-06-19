import { BotGuardService } from './bot-guard.service';

/**
 * Builds a BotGuardService with in-memory mocks for ConfigService + CacheService.
 * No real network/Redis is touched; DNS is stubbed per-test via spyOn.
 */
function makeService(configOverrides: Record<string, string> = {}) {
  const configMap: Record<string, string> = {
    BOT_GUARD_ENABLED: 'true',
    BOT_GUARD_SUSPICION_THRESHOLD: '80',
    BOT_GUARD_BLOCKED_COUNTRIES: 'CN',
    BOT_GUARD_VERIFIED_BOT_BYPASS: 'true',
    ...configOverrides,
  };
  const config = {
    get: jest.fn((key: string, def?: string) =>
      configMap[key] !== undefined ? configMap[key] : def,
    ),
  };
  const store = new Map<string, unknown>();
  const cache = {
    get: jest.fn(async (key: string) =>
      store.has(key) ? store.get(key) : null,
    ),
    set: jest.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }),
  };
  const service = new BotGuardService(config as never, cache as never);
  return { service, config, cache, store };
}

const GOOGLEBOT_UA =
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const BINGBOT_UA =
  'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)';
const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

describe('BotGuardService.calculateSuspicionScore — Googlebot headroom', () => {
  it('scores a real Googlebot on a deep, non-target-country page at 55 (< 80 default → only 25 pts of headroom)', async () => {
    const { service } = makeService();
    await service.onModuleInit();

    const score = service.calculateSuspicionScore({
      ip: '66.249.66.1',
      country: 'US', // Googlebot crawls mostly from the US (not a TARGET_COUNTRY)
      userAgent: GOOGLEBOT_UA,
      path: '/pieces/disque-de-frein-82/iveco-84/daily-iv/3-0-d-34297.html',
      acceptLanguage: undefined, // Googlebot sends none → +30
      hasSession: false, // no session on a deep page → +15
    });

    // +30 (no Accept-Language) +15 (no session, deep page) +10 (non-target country)
    expect(score).toBe(55);
  });
});

describe('BotGuardService.isVerifiedSearchEngine (FCrDNS)', () => {
  it('returns false instantly for a normal browser UA — no DNS lookup at all', async () => {
    const { service } = makeService();
    await service.onModuleInit();
    const reverseSpy = jest.spyOn(
      service as never,
      'reverseDnsLookup' as never,
    );

    const result = await service.isVerifiedSearchEngine(
      '203.0.113.5',
      CHROME_UA,
    );

    expect(result).toBe(false);
    expect(reverseSpy).not.toHaveBeenCalled();
  });

  it('verifies a genuine Googlebot: rDNS ends in .googlebot.com AND forward-resolves back to the same IP', async () => {
    const { service } = makeService();
    await service.onModuleInit();
    jest
      .spyOn(service as never, 'reverseDnsLookup' as never)
      .mockResolvedValue(['crawl-66-249-66-1.googlebot.com'] as never);
    jest
      .spyOn(service as never, 'forwardDnsLookup' as never)
      .mockResolvedValue(['66.249.66.1'] as never);

    expect(
      await service.isVerifiedSearchEngine('66.249.66.1', GOOGLEBOT_UA),
    ).toBe(true);
  });

  it('rejects a spoofer: UA claims Googlebot but rDNS is an unrelated domain (no forward lookup needed)', async () => {
    const { service } = makeService();
    await service.onModuleInit();
    jest
      .spyOn(service as never, 'reverseDnsLookup' as never)
      .mockResolvedValue(['host.evil-attacker.com'] as never);
    const forwardSpy = jest.spyOn(
      service as never,
      'forwardDnsLookup' as never,
    );

    expect(
      await service.isVerifiedSearchEngine('203.0.113.9', GOOGLEBOT_UA),
    ).toBe(false);
    expect(forwardSpy).not.toHaveBeenCalled();
  });

  it('rejects a forged PTR: rDNS ends in .googlebot.com but forward-resolves to a DIFFERENT IP', async () => {
    const { service } = makeService();
    await service.onModuleInit();
    jest
      .spyOn(service as never, 'reverseDnsLookup' as never)
      .mockResolvedValue(['fake.googlebot.com'] as never);
    jest
      .spyOn(service as never, 'forwardDnsLookup' as never)
      .mockResolvedValue(['10.20.30.40'] as never);

    expect(
      await service.isVerifiedSearchEngine('203.0.113.9', GOOGLEBOT_UA),
    ).toBe(false);
  });

  it('does not fall for the substring trick: evilgooglebot.com must NOT match .googlebot.com', async () => {
    const { service } = makeService();
    await service.onModuleInit();
    jest
      .spyOn(service as never, 'reverseDnsLookup' as never)
      .mockResolvedValue(['evilgooglebot.com'] as never);
    const forwardSpy = jest.spyOn(
      service as never,
      'forwardDnsLookup' as never,
    );

    expect(
      await service.isVerifiedSearchEngine('203.0.113.9', GOOGLEBOT_UA),
    ).toBe(false);
    expect(forwardSpy).not.toHaveBeenCalled();
  });

  it('caches the verdict per IP — DNS is queried only once', async () => {
    const { service } = makeService();
    await service.onModuleInit();
    const reverseSpy = jest
      .spyOn(service as never, 'reverseDnsLookup' as never)
      .mockResolvedValue(['crawl.googlebot.com'] as never);
    jest
      .spyOn(service as never, 'forwardDnsLookup' as never)
      .mockResolvedValue(['66.249.66.2'] as never);

    await service.isVerifiedSearchEngine('66.249.66.2', GOOGLEBOT_UA);
    await service.isVerifiedSearchEngine('66.249.66.2', GOOGLEBOT_UA);

    expect(reverseSpy).toHaveBeenCalledTimes(1);
  });

  it('normalizes IPv4-mapped IPv6 (::ffff:) before comparing forward-resolved IPs', async () => {
    const { service } = makeService();
    await service.onModuleInit();
    jest
      .spyOn(service as never, 'reverseDnsLookup' as never)
      .mockResolvedValue(['crawl.googlebot.com'] as never);
    jest
      .spyOn(service as never, 'forwardDnsLookup' as never)
      .mockResolvedValue(['66.249.66.3'] as never);

    expect(
      await service.isVerifiedSearchEngine('::ffff:66.249.66.3', GOOGLEBOT_UA),
    ).toBe(true);
  });

  it('returns false when the feature flag is off — even for a genuine Googlebot', async () => {
    const { service } = makeService({ BOT_GUARD_VERIFIED_BOT_BYPASS: 'false' });
    await service.onModuleInit();
    const reverseSpy = jest.spyOn(
      service as never,
      'reverseDnsLookup' as never,
    );

    expect(
      await service.isVerifiedSearchEngine('66.249.66.1', GOOGLEBOT_UA),
    ).toBe(false);
    expect(reverseSpy).not.toHaveBeenCalled();
  });

  it('verifies Bingbot via .search.msn.com', async () => {
    const { service } = makeService();
    await service.onModuleInit();
    jest
      .spyOn(service as never, 'reverseDnsLookup' as never)
      .mockResolvedValue(['msnbot-157-55-39-1.search.msn.com'] as never);
    jest
      .spyOn(service as never, 'forwardDnsLookup' as never)
      .mockResolvedValue(['157.55.39.1'] as never);

    expect(
      await service.isVerifiedSearchEngine('157.55.39.1', BINGBOT_UA),
    ).toBe(true);
  });

  it('is failsafe: a DNS resolution error yields false without throwing', async () => {
    const { service } = makeService();
    await service.onModuleInit();
    jest
      .spyOn(service as never, 'reverseDnsLookup' as never)
      .mockRejectedValue(new Error('ENOTFOUND') as never);

    expect(
      await service.isVerifiedSearchEngine('203.0.113.9', GOOGLEBOT_UA),
    ).toBe(false);
  });
});
