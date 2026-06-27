import type { ConfigService } from '@nestjs/config';
import type { SeoCriticality } from '@repo/registry';
import { CriticalityLoaderService } from '../../services/criticality-loader.service';
import { SyntheticCrawlerService } from './synthetic-crawler.service';
import { SYNTHETIC_USER_AGENT } from '../../types';

const VALID_CONFIG: SeoCriticality = {
  schemaVersion: '1.0.0',
  slo_window_minutes: 60,
  tiers: {
    tier0: {
      slo: 0.997,
      sampling_weight: 0.6,
      alerting: {
        breach_threshold_minutes: 5,
        channel: 'pagerduty',
        auto_issue: true,
      },
      routes: ['pieces/*'],
    },
    tier1: {
      slo: 0.99,
      sampling_weight: 0.3,
      alerting: {
        breach_threshold_minutes: 15,
        channel: 'slack',
        auto_issue: false,
      },
      routes: ['blog/*'],
    },
    tier2: {
      slo: 0.98,
      sampling_weight: 0.1,
      alerting: {
        breach_threshold_minutes: 60,
        channel: 'log',
        auto_issue: false,
      },
      routes: ['support/*'],
    },
  },
  excluded: { routes: ['admin/*', 'api/*', 'sitemap*.xml', 'robots.txt'] },
  metadata: {
    adr_reference: 'ADR-064',
    introduced_in_pr: 'TBD',
    last_review: '2026-05-14',
    next_review_due: '2026-08-14',
  },
};

interface MockResponse {
  status: number;
  body: string;
  headers: Record<string, string>;
}

function mockFetch(responses: Map<string, MockResponse>): jest.Mock {
  return jest.fn().mockImplementation(async (url: string) => {
    const r = responses.get(url);
    if (!r) {
      const err = new Error(`Mock fetch: no response registered for ${url}`);
      err.name = 'TypeError';
      throw err;
    }
    return {
      status: r.status,
      ok: r.status >= 200 && r.status < 300,
      text: async () => r.body,
      headers: {
        get: (k: string): string | null => r.headers[k.toLowerCase()] ?? null,
      },
    };
  });
}

function makeConfigService(
  overrides: Record<string, string | number> = {},
): ConfigService {
  // Le pacer (probeMinIntervalMs) ralentit volontairement les départs. Par
  // défaut on le neutralise (intervalle ~0) pour garder les tests existants
  // rapides ; le test de pacing dédié réinjecte des knobs réalistes.
  const env: Record<string, string | number> = {
    SEO_CP_MAX_RPS: 1_000_000,
    SEO_CP_MAX_RPM: 1_000_000,
    ...overrides,
  };
  return {
    get: (key: string, def?: unknown): unknown => env[key] ?? def,
  } as unknown as ConfigService;
}

/**
 * Build a SyntheticCrawlerService with the Supabase base init bypassed.
 * SupabaseBaseService's constructor tries to validate SUPABASE_URL /
 * SUPABASE_SERVICE_ROLE_KEY and create a real client — we skip the whole
 * inheritance chain and patch a fake `supabase` field with a stub `from`.
 */
function buildSvc(
  crit: CriticalityLoaderService,
  cfg: ConfigService,
  spyInsert: jest.Mock,
): SyntheticCrawlerService {
  const svc = Object.create(
    SyntheticCrawlerService.prototype,
  ) as SyntheticCrawlerService;
  // assign private/protected fields without invoking real Supabase init
  Object.assign(svc, {
    logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    criticality: crit,
    cfg,
    // Exemption inactive en test → buildProbeHeaders n'ajoute que l'UA (comportement
    // identique à l'existant ; pas de header HMAC).
    probeCredential: { isActive: () => false, sign: jest.fn() },
    supabase: {
      from: (_table: string) => ({ insert: spyInsert }),
    },
  });
  return svc;
}

describe('SyntheticCrawlerService', () => {
  let crit: CriticalityLoaderService;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    crit = new CriticalityLoaderService();
    crit.setConfigForTest(VALID_CONFIG);
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('uses the AutoMecanik identifiable UA on every fetch (never spoof Googlebot)', async () => {
    const responses = new Map<string, MockResponse>([
      [
        'https://www.automecanik.com/sitemap.xml',
        {
          status: 200,
          body: '<sitemap><loc>https://www.automecanik.com/sitemap-pieces-1.xml</loc></sitemap>',
          headers: {},
        },
      ],
      [
        'https://www.automecanik.com/sitemap-pieces-1.xml',
        {
          status: 200,
          body: '<url><loc>https://www.automecanik.com/pieces/foo-1.html</loc></url>',
          headers: {},
        },
      ],
      [
        'https://www.automecanik.com/pieces/foo-1.html',
        {
          status: 200,
          body: '<html><head><title>OK</title></head></html>',
          headers: {},
        },
      ],
    ]);
    const fetchMock = mockFetch(responses);
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const insertSpy = jest.fn().mockResolvedValue({ error: null });
    const svc = buildSvc(
      crit,
      makeConfigService({ SEO_CP_SAMPLE_SIZE: 3, SEO_CP_CONCURRENCY: 1 }),
      insertSpy,
    );

    await svc.run({ triggeredBy: 'test' });

    // Every fetch call must carry the identifiable UA, never Googlebot.
    for (const call of fetchMock.mock.calls) {
      const init = call[1] as RequestInit | undefined;
      const ua = (init?.headers as Record<string, string> | undefined)?.[
        'User-Agent'
      ];
      expect(ua).toBe(SYNTHETIC_USER_AGENT);
      expect(ua).not.toMatch(/googlebot/i);
      expect(ua).not.toMatch(/bingbot/i);
    }
  });

  it('persists snapshots with tier classification + aggregates rate_5xx by tier', async () => {
    const responses = new Map<string, MockResponse>([
      [
        'https://www.automecanik.com/sitemap.xml',
        {
          status: 200,
          body: '<sitemap><loc>https://www.automecanik.com/sitemap-pieces-1.xml</loc></sitemap>',
          headers: {},
        },
      ],
      [
        'https://www.automecanik.com/sitemap-pieces-1.xml',
        {
          status: 200,
          body:
            '<url><loc>https://www.automecanik.com/pieces/foo-1.html</loc></url>' +
            '<url><loc>https://www.automecanik.com/pieces/bar-2.html</loc></url>',
          headers: {},
        },
      ],
      [
        'https://www.automecanik.com/pieces/foo-1.html',
        {
          status: 200,
          body: '<html><head><title>OK</title><link rel="canonical" href="/pieces/foo-1.html"></head><body><h1>OK</h1></body></html>',
          headers: {
            'cache-control': 'public, s-maxage=86400',
            'cf-cache-status': 'HIT',
          },
        },
      ],
      [
        'https://www.automecanik.com/pieces/bar-2.html',
        { status: 503, body: 'Service Unavailable', headers: {} },
      ],
    ]);
    globalThis.fetch = mockFetch(
      responses,
    ) as unknown as typeof globalThis.fetch;

    const insertSpy = jest.fn().mockResolvedValue({ error: null });
    const svc = buildSvc(
      crit,
      makeConfigService({ SEO_CP_SAMPLE_SIZE: 5, SEO_CP_CONCURRENCY: 2 }),
      insertSpy,
    );

    const result = await svc.run({ triggeredBy: 'test' });

    expect(result.totals.http_2xx).toBe(1);
    expect(result.totals.http_5xx).toBe(1);
    expect(result.by_tier.tier0.probed).toBe(2);
    expect(result.by_tier.tier0.rate_5xx).toBe(0.5);
    expect(insertSpy).toHaveBeenCalledTimes(1);
    const inserted = insertSpy.mock.calls[0][0] as Array<{
      tier: string;
      http_code: number;
    }>;
    expect(inserted).toHaveLength(2);
    expect(inserted.every((s) => s.tier === 'tier0')).toBe(true);
  });

  it('skips excluded routes (admin/*, sitemap*.xml) — does not probe nor persist', async () => {
    const responses = new Map<string, MockResponse>([
      [
        'https://www.automecanik.com/sitemap.xml',
        {
          status: 200,
          body: '<sitemap><loc>https://www.automecanik.com/sitemap-pieces-1.xml</loc></sitemap>',
          headers: {},
        },
      ],
      [
        'https://www.automecanik.com/sitemap-pieces-1.xml',
        {
          status: 200,
          body:
            '<url><loc>https://www.automecanik.com/admin/dashboard</loc></url>' +
            '<url><loc>https://www.automecanik.com/api/health</loc></url>',
          headers: {},
        },
      ],
    ]);
    globalThis.fetch = mockFetch(
      responses,
    ) as unknown as typeof globalThis.fetch;

    const insertSpy = jest.fn().mockResolvedValue({ error: null });
    const svc = buildSvc(
      crit,
      makeConfigService({ SEO_CP_SAMPLE_SIZE: 5 }),
      insertSpy,
    );
    const result = await svc.run({ triggeredBy: 'test' });
    expect(result.sample_size_effective).toBe(0);
    expect(result.skipped).toBe('no_sitemap');
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('returns skipped=no_sitemap and does not throw when sitemap.xml is unreachable', async () => {
    globalThis.fetch = jest
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('ECONNREFUSED'), { name: 'TypeError' }),
      ) as unknown as typeof globalThis.fetch;

    const insertSpy = jest.fn().mockResolvedValue({ error: null });
    const svc = buildSvc(crit, makeConfigService(), insertSpy);

    const result = await svc.run({ triggeredBy: 'test' });
    expect(result.skipped).toBe('no_sitemap');
    expect(result.errorMessage).toMatch(/ECONNREFUSED|fetch/i);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('seed produces deterministic sample selection (same seed → same probed URLs)', async () => {
    const responses = new Map<string, MockResponse>();
    responses.set('https://www.automecanik.com/sitemap.xml', {
      status: 200,
      body: '<sitemap><loc>https://www.automecanik.com/sitemap-pieces-1.xml</loc></sitemap>',
      headers: {},
    });
    let subBody = '';
    for (let i = 1; i <= 20; i++) {
      const u = `https://www.automecanik.com/pieces/p${i}-${i}.html`;
      subBody += `<url><loc>${u}</loc></url>`;
      responses.set(u, { status: 200, body: '<html></html>', headers: {} });
    }
    responses.set('https://www.automecanik.com/sitemap-pieces-1.xml', {
      status: 200,
      body: subBody,
      headers: {},
    });

    const runOnce = async (): Promise<string[]> => {
      globalThis.fetch = mockFetch(
        new Map(responses),
      ) as unknown as typeof globalThis.fetch;
      const spy = jest.fn().mockResolvedValue({ error: null });
      const svc = buildSvc(
        crit,
        makeConfigService({ SEO_CP_SAMPLE_SIZE: 5, SEO_CP_CONCURRENCY: 1 }),
        spy,
      );
      await svc.run({ triggeredBy: 'test', seed: 42 });
      return (spy.mock.calls[0]?.[0] as Array<{ url: string }>)
        .map((r) => r.url)
        .sort();
    };

    const urlsA = await runOnce();
    const urlsB = await runOnce();
    expect(urlsA).toEqual(urlsB);
  });

  it('paces outbound probes via a shared monotonic cursor (no concurrency burst past the rate cap)', async () => {
    // 10 page URLs + concurrency 10 : SANS pacer, les 10 fetch partent dans le
    // même tick (span ~0). Le curseur partagé doit les étaler de minIntervalMs.
    const PAGES = 10;
    const responses = new Map<string, MockResponse>([
      [
        'https://www.automecanik.com/sitemap.xml',
        {
          status: 200,
          body: '<sitemap><loc>https://www.automecanik.com/sitemap-pieces-1.xml</loc></sitemap>',
          headers: {},
        },
      ],
    ]);
    let subBody = '';
    for (let i = 1; i <= PAGES; i++) {
      const u = `https://www.automecanik.com/pieces/p${i}-${i}.html`;
      subBody += `<url><loc>${u}</loc></url>`;
      responses.set(u, { status: 200, body: '<html></html>', headers: {} });
    }
    responses.set('https://www.automecanik.com/sitemap-pieces-1.xml', {
      status: 200,
      body: subBody,
      headers: {},
    });

    const baseMock = mockFetch(responses);
    const pageDispatchedAt: number[] = [];
    globalThis.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (/\/pieces\/p\d+-\d+\.html$/.test(url)) {
        pageDispatchedAt.push(Date.now());
      }
      return baseMock(url, init);
    }) as unknown as typeof globalThis.fetch;

    const insertSpy = jest.fn().mockResolvedValue({ error: null });
    // minIntervalMs = max(1000/40, 60000/1200) = max(25, 50) = 50 ms
    const svc = buildSvc(
      crit,
      makeConfigService({
        SEO_CP_SAMPLE_SIZE: 30,
        SEO_CP_CONCURRENCY: 10,
        SEO_CP_MAX_RPS: 40,
        SEO_CP_MAX_RPM: 1200,
      }),
      insertSpy,
    );

    await svc.run({ triggeredBy: 'test' });

    expect(pageDispatchedAt).toHaveLength(PAGES);
    const sorted = [...pageDispatchedAt].sort((a, b) => a - b);
    const span = sorted[sorted.length - 1] - sorted[0];
    // 10 départs à 50 ms d'intervalle partagé → span >= ~450 ms (setTimeout ne
    // déclenche jamais en avance). Un burst de concurrency aurait span ~0.
    // Seuil >=300 ms : prouve sans ambiguïté que le pacing a eu lieu.
    expect(span).toBeGreaterThanOrEqual(300);
  });

  it('captures meta-description + Open Graph balises (present + absent cases)', async () => {
    const rich = 'https://www.automecanik.com/pieces/foo-1.html';
    const bare = 'https://www.automecanik.com/pieces/bar-2.html';
    const responses = new Map<string, MockResponse>([
      [
        'https://www.automecanik.com/sitemap.xml',
        {
          status: 200,
          body: '<sitemap><loc>https://www.automecanik.com/sitemap-pieces-1.xml</loc></sitemap>',
          headers: {},
        },
      ],
      [
        'https://www.automecanik.com/sitemap-pieces-1.xml',
        {
          status: 200,
          body: `<url><loc>${rich}</loc></url><url><loc>${bare}</loc></url>`,
          headers: {},
        },
      ],
      [
        rich,
        {
          status: 200,
          body:
            '<html><head><title>T</title>' +
            '<meta name="description" content="Ma description sœur">' +
            '<meta property="og:title" content="OG Titre">' +
            '<meta property="og:description" content="OG Desc">' +
            '<meta property="og:image" content="https://img.example/x.webp">' +
            '<meta property="og:url" content="https://www.automecanik.com/pieces/foo-1.html">' +
            '<link rel="canonical" href="/pieces/foo-1.html"></head>' +
            '<body><h1>H</h1></body></html>',
          headers: {},
        },
      ],
      [
        bare,
        {
          status: 200,
          body: '<html><head><title>Bare</title></head><body><h1>B</h1></body></html>',
          headers: {},
        },
      ],
    ]);
    globalThis.fetch = mockFetch(
      responses,
    ) as unknown as typeof globalThis.fetch;

    const insertSpy = jest.fn().mockResolvedValue({ error: null });
    const svc = buildSvc(
      crit,
      makeConfigService({ SEO_CP_SAMPLE_SIZE: 5, SEO_CP_CONCURRENCY: 1 }),
      insertSpy,
    );
    await svc.run({ triggeredBy: 'test' });

    const inserted = insertSpy.mock.calls[0][0] as Array<
      Record<string, unknown>
    >;
    const richSnap = inserted.find((s) => s.url === rich)!;
    const bareSnap = inserted.find((s) => s.url === bare)!;

    // Present case — captured verbatim.
    expect(richSnap.meta_description).toBe('Ma description sœur');
    expect(richSnap.has_meta_description).toBe(true);
    expect(richSnap.og_title).toBe('OG Titre');
    expect(richSnap.og_description).toBe('OG Desc');
    expect(richSnap.og_image).toBe('https://img.example/x.webp');
    expect(richSnap.og_url).toBe(
      'https://www.automecanik.com/pieces/foo-1.html',
    );
    expect(richSnap.has_og).toBe(true);
    // Sitemap mode → no catalog ids.
    expect(richSnap.pg_id).toBeNull();
    expect(richSnap.type_id).toBeNull();
    expect(richSnap.modele_id).toBeNull();

    // Absent case — flags false, fields null (never undefined, never throws).
    expect(bareSnap.meta_description).toBeNull();
    expect(bareSnap.has_meta_description).toBe(false);
    expect(bareSnap.og_title).toBeNull();
    expect(bareSnap.has_og).toBe(false);
  });

  it('seed-list mode: crawls explicit URLs exhaustively (bypass sitemap) + carries catalog ids + skips excluded', async () => {
    const target =
      'https://www.automecanik.com/pieces/disque/renault/clio/1-5-dci.html';
    const responses = new Map<string, MockResponse>([
      [
        target,
        {
          status: 200,
          body: '<html><head><title>S</title></head><body><h1>S</h1></body></html>',
          headers: {},
        },
      ],
    ]);
    const fetchMock = mockFetch(responses);
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const insertSpy = jest.fn().mockResolvedValue({ error: null });
    const svc = buildSvc(
      crit,
      makeConfigService({ SEO_CP_CONCURRENCY: 1 }),
      insertSpy,
    );

    const result = await svc.run({
      triggeredBy: 'test',
      seedEntries: [
        { url: target, pgId: 7, typeId: 1234, modeleId: 140004 },
        { url: 'https://www.automecanik.com/admin/x', pgId: 9 }, // excluded → skipped
      ],
    });

    // Sitemap is never fetched in seed-list mode.
    const fetchedUrls = fetchMock.mock.calls.map((c) => c[0]);
    expect(fetchedUrls).not.toContain(
      'https://www.automecanik.com/sitemap.xml',
    );
    // Excluded seed dropped → exactly the one valid URL probed.
    expect(result.sample_size_effective).toBe(1);
    expect(fetchedUrls).toEqual([target]);

    const snap = (
      insertSpy.mock.calls[0][0] as Array<Record<string, unknown>>
    )[0];
    expect(snap.url).toBe(target);
    expect(snap.pg_id).toBe(7);
    expect(snap.type_id).toBe(1234);
    expect(snap.modele_id).toBe(140004);
  });
});
