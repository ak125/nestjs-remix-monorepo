/**
 * Routes `seo-logs/kpi` — application Nest réelle (pipes compris), appels
 * sortants simulés.
 *
 * Prouve : (1) une entrée valide produit un appel HTTP natif vers la cible
 * fixe de la configuration et la forme de réponse attendue ; (2) une entrée
 * hors contrat reçoit un 400 avant tout appel sortant ; (3) aucun processus
 * n'est lancé, quelle que soit l'entrée.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { SeoKpiController } from './seo-kpi.controller';

jest.mock('child_process', () => ({
  exec: jest.fn(),
  execSync: jest.fn(),
  execFile: jest.fn(),
  execFileSync: jest.fn(),
  spawn: jest.fn(),
  spawnSync: jest.fn(),
  fork: jest.fn(),
}));

// Caractères qu'un interpréteur de commandes traite à part. Chacun est accolé
// à une valeur valide : la requête entière doit être refusée.
const SHELL_SPECIAL_CHARACTERS = [...' \t\n;&|$`\\\'"<>(){}[]*?!#~=%'] as const;

const LOKI_BASE = 'http://loki.test:3100';
const SITEMAP = 'https://sitemap.test/sitemap.xml';

const lokiBody = (
  rows: Array<{ metric: Record<string, string>; hits: number }>,
) =>
  JSON.stringify({
    status: 'success',
    data: {
      resultType: 'vector',
      result: rows.map((row) => ({
        metric: row.metric,
        value: [1763531730, String(row.hits)],
      })),
    },
  });

describe('SeoKpiController — sans commande shell, entrées validées', () => {
  let app: INestApplication;
  let fetchMock: jest.SpyInstance;
  const savedEnv = {
    LOKI_URL: process.env.LOKI_URL,
    SITEMAP_URL: process.env.SITEMAP_URL,
  };

  const expectNoProcessLaunched = () => {
    const launchers = Object.values(
      jest.requireMock<Record<string, jest.Mock>>('child_process'),
    );
    expect(launchers).toHaveLength(7);
    for (const launcher of launchers) {
      expect(launcher).not.toHaveBeenCalled();
    }
  };

  /** Appels sortants reçus : cible sans paramètres, paramètres, options. */
  const outgoingCalls = () =>
    fetchMock.mock.calls.map(([target, init]) => {
      const url = new URL(String(target));
      return {
        target: `${url.origin}${url.pathname}`,
        params: Object.fromEntries(url.searchParams),
        init: init as RequestInit,
      };
    });

  beforeAll(async () => {
    process.env.LOKI_URL = LOKI_BASE;
    process.env.SITEMAP_URL = SITEMAP;

    const moduleRef = await Test.createTestingModule({
      controllers: [SeoKpiController],
    })
      .overrideGuard(AuthenticatedGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(IsAdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    for (const [name, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  describe('GET /seo-logs/kpi/crawl-rate', () => {
    const mockSitemapThenLoki = (sitemapLocs: number, crawledPaths: number) => {
      fetchMock
        .mockResolvedValueOnce(
          new Response('<url><loc>x</loc></url>'.repeat(sitemapLocs)),
        )
        .mockResolvedValueOnce(
          new Response(
            lokiBody(
              Array.from({ length: crawledPaths }, (_, i) => ({
                metric: { path: `/p${i}` },
                hits: 1,
              })),
            ),
          ),
        );
    };

    it('entrée par défaut : deux GET natifs vers les cibles fixes, même forme de réponse', async () => {
      mockSitemapThenLoki(4, 3);

      const res = await request(app.getHttpServer()).get(
        '/seo-logs/kpi/crawl-rate',
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: {
          timeWindow: '72h',
          sitemap: { url: SITEMAP, totalUrls: 4 },
          crawl: {
            crawledUrls: 3,
            crawlRate: 75,
            status: 'good',
            threshold: 80,
          },
          evaluation: { status: 'good', recommendation: expect.any(String) },
          updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        },
      });

      const [sitemapCall, lokiCall] = outgoingCalls();
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(sitemapCall.target).toBe(SITEMAP);
      expect(sitemapCall.params).toEqual({});
      expect(lokiCall.target).toBe(`${LOKI_BASE}/loki/api/v1/query`);
      expect(lokiCall.params).toEqual({
        query:
          'count(count_over_time({job="caddy-access"} | json | bot != "" | __error__="" [72h])) by (path)',
        time: expect.stringMatching(/^\d{10}$/),
      });
      for (const call of [sitemapCall, lokiCall]) {
        expect(call.init.redirect).toBe('manual');
        expect(call.init.signal).toBeInstanceOf(AbortSignal);
        expect(call.init.method).toBeUndefined();
      }
      expectNoProcessLaunched();
    });

    it.each([['24h'], ['72h'], ['7d'], ['30d']])(
      'accepte timeWindow=%s et le reporte dans la requête Loki',
      async (timeWindow) => {
        mockSitemapThenLoki(10, 9);

        const res = await request(app.getHttpServer())
          .get('/seo-logs/kpi/crawl-rate')
          .query({ timeWindow });

        expect(res.status).toBe(200);
        expect(res.body.data.timeWindow).toBe(timeWindow);
        expect(res.body.data.crawl.status).toBe('excellent');
        expect(outgoingCalls()[1].params.query).toContain(`[${timeWindow}]`);
      },
    );

    it.each([['1h'], ['3d'], ['72H'], ['72'], ['']])(
      'refuse timeWindow=%j en 400, sans appel sortant',
      async (timeWindow) => {
        const res = await request(app.getHttpServer())
          .get('/seo-logs/kpi/crawl-rate')
          .query({ timeWindow });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Validation failed');
        expect(res.body.errors[0].field).toBe('timeWindow');
        expect(fetchMock).not.toHaveBeenCalled();
        expectNoProcessLaunched();
      },
    );

    it('refuse un paramètre répété en 400', async () => {
      const res = await request(app.getHttpServer()).get(
        '/seo-logs/kpi/crawl-rate?timeWindow=72h&timeWindow=7d',
      );

      expect(res.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each(SHELL_SPECIAL_CHARACTERS.map((char) => [char]))(
      'refuse en 400 une fenêtre accompagnée du caractère %j : rien n’est appelé ni lancé',
      async (char) => {
        for (const timeWindow of [`72h${char}`, `${char}72h`]) {
          const res = await request(app.getHttpServer())
            .get('/seo-logs/kpi/crawl-rate')
            .query({ timeWindow });

          expect(res.status).toBe(400);
        }
        expect(fetchMock).not.toHaveBeenCalled();
        expectNoProcessLaunched();
      },
    );

    it('sitemap en erreur HTTP : échec dit, pas un taux nul', async () => {
      fetchMock.mockResolvedValueOnce(new Response('absent', { status: 404 }));

      const res = await request(app.getHttpServer()).get(
        '/seo-logs/kpi/crawl-rate',
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: false,
        error: 'Sitemap : réponse HTTP 404',
        message: 'Erreur lors du calcul du KPI de crawl',
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('redirection de la cible : non suivie, échec dit', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(null, {
          status: 301,
          headers: { location: 'https://ailleurs.test/' },
        }),
      );

      const res = await request(app.getHttpServer()).get(
        '/seo-logs/kpi/crawl-rate',
      );

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Sitemap : réponse HTTP 301');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /seo-logs/kpi/top-crawlers', () => {
    it('entrée valide : requête Loki bornée par la limite, même forme de réponse', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          lokiBody([
            { metric: { bot: 'botA' }, hits: 75 },
            { metric: { bot: 'botB' }, hits: 25 },
          ]),
        ),
      );

      const res = await request(app.getHttpServer())
        .get('/seo-logs/kpi/top-crawlers')
        .query({ timeWindow: '7d', limit: '5' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: {
          timeWindow: '7d',
          totalCrawlers: 2,
          totalHits: 100,
          crawlers: [
            { name: 'botA', rank: 1, bot: 'botA', hits: 75, percentage: 75 },
            { name: 'botB', rank: 2, bot: 'botB', hits: 25, percentage: 25 },
          ],
        },
      });

      const [lokiCall] = outgoingCalls();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(lokiCall.target).toBe(`${LOKI_BASE}/loki/api/v1/query`);
      expect(lokiCall.params.query).toBe(
        'topk(5, sum by (bot) (count_over_time({job="caddy-access"} | json | bot != "" | __error__="" [7d])))',
      );
      expect(lokiCall.init.redirect).toBe('manual');
      expect(lokiCall.init.signal).toBeInstanceOf(AbortSignal);
      expectNoProcessLaunched();
    });

    it('sans paramètre : défauts 72h et 10', async () => {
      fetchMock.mockResolvedValueOnce(new Response(lokiBody([])));

      const res = await request(app.getHttpServer()).get(
        '/seo-logs/kpi/top-crawlers',
      );

      expect(res.status).toBe(200);
      expect(res.body.data.timeWindow).toBe('72h');
      expect(outgoingCalls()[0].params.query).toMatch(/^topk\(10, .*\[72h\]/);
    });

    it.each([['1'], ['50']])('accepte la borne limit=%s', async (limit) => {
      fetchMock.mockResolvedValueOnce(new Response(lokiBody([])));

      const res = await request(app.getHttpServer())
        .get('/seo-logs/kpi/top-crawlers')
        .query({ limit });

      expect(res.status).toBe(200);
      expect(outgoingCalls()[0].params.query).toContain(`topk(${limit}, `);
    });

    it.each([['0'], ['51'], ['-1'], ['1.5'], ['05'], ['abc'], ['']])(
      'refuse limit=%j en 400, sans appel sortant',
      async (limit) => {
        const res = await request(app.getHttpServer())
          .get('/seo-logs/kpi/top-crawlers')
          .query({ limit });

        expect(res.status).toBe(400);
        expect(res.body.errors[0].field).toBe('limit');
        expect(fetchMock).not.toHaveBeenCalled();
        expectNoProcessLaunched();
      },
    );

    it.each(SHELL_SPECIAL_CHARACTERS.map((char) => [char]))(
      'refuse en 400 une limite ou une fenêtre accompagnée du caractère %j',
      async (char) => {
        const queries = [
          { limit: `5${char}` },
          { limit: `${char}5` },
          { timeWindow: `7d${char}`, limit: '5' },
        ];
        for (const query of queries) {
          const res = await request(app.getHttpServer())
            .get('/seo-logs/kpi/top-crawlers')
            .query(query);

          expect(res.status).toBe(400);
        }
        expect(fetchMock).not.toHaveBeenCalled();
        expectNoProcessLaunched();
      },
    );

    it('Loki en erreur HTTP : échec dit, pas une liste vide', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response('indisponible', { status: 503 }),
      );

      const res = await request(app.getHttpServer()).get(
        '/seo-logs/kpi/top-crawlers',
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: false,
        error: 'Loki : réponse HTTP 503',
      });
    });

    it('Loki injoignable ou délai dépassé : échec dit', async () => {
      fetchMock.mockRejectedValueOnce(
        new DOMException('The operation timed out', 'TimeoutError'),
      );

      const res = await request(app.getHttpServer()).get(
        '/seo-logs/kpi/top-crawlers',
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toEqual(expect.any(String));
    });
  });

  describe('GET /seo-logs/kpi/most-crawled-urls', () => {
    it('entrée valide : même forme de réponse', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          lokiBody([
            { metric: { path: '/a' }, hits: 12 },
            { metric: { path: '/b' }, hits: 7 },
          ]),
        ),
      );

      const res = await request(app.getHttpServer())
        .get('/seo-logs/kpi/most-crawled-urls')
        .query({ timeWindow: '24h', limit: '2' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: {
          timeWindow: '24h',
          totalUrls: 2,
          urls: [
            { rank: 1, path: '/a', crawls: 12 },
            { rank: 2, path: '/b', crawls: 7 },
          ],
        },
      });
      expect(outgoingCalls()[0].params.query).toBe(
        'topk(2, sum by (path) (count_over_time({job="caddy-access"} | json | bot != "" | __error__="" [24h])))',
      );
      expectNoProcessLaunched();
    });

    it('sans paramètre : défauts 72h et 20 ; borne haute 100 acceptée', async () => {
      fetchMock.mockImplementation(async () => new Response(lokiBody([])));

      const byDefault = await request(app.getHttpServer()).get(
        '/seo-logs/kpi/most-crawled-urls',
      );
      const atMax = await request(app.getHttpServer())
        .get('/seo-logs/kpi/most-crawled-urls')
        .query({ limit: '100' });

      expect(byDefault.status).toBe(200);
      expect(atMax.status).toBe(200);
      expect(outgoingCalls()[0].params.query).toMatch(/^topk\(20, .*\[72h\]/);
      expect(outgoingCalls()[1].params.query).toMatch(/^topk\(100, /);
    });

    it.each([['0'], ['101'], ['1000'], ['abc']])(
      'refuse limit=%j en 400, sans appel sortant',
      async (limit) => {
        const res = await request(app.getHttpServer())
          .get('/seo-logs/kpi/most-crawled-urls')
          .query({ limit });

        expect(res.status).toBe(400);
        expect(fetchMock).not.toHaveBeenCalled();
        expectNoProcessLaunched();
      },
    );

    it.each(SHELL_SPECIAL_CHARACTERS.map((char) => [char]))(
      'refuse en 400 une limite ou une fenêtre accompagnée du caractère %j',
      async (char) => {
        const queries = [{ limit: `2${char}0` }, { timeWindow: `${char}30d` }];
        for (const query of queries) {
          const res = await request(app.getHttpServer())
            .get('/seo-logs/kpi/most-crawled-urls')
            .query(query);

          expect(res.status).toBe(400);
        }
        expect(fetchMock).not.toHaveBeenCalled();
        expectNoProcessLaunched();
      },
    );
  });
});
