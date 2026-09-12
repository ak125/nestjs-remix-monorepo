/**
 * SeoMonitoringController — protection admin prouvée au niveau HTTP (2026-09-11).
 *
 * Avant correctif, GET credentials/health répondait 200 sans session en PROD.
 * Ici : application Nest réelle (supertest), guards de classe réels
 * (AuthenticatedGuard puis IsAdminGuard) ; seule la session Passport est simulée
 * par un middleware (`req.user` + `req.isAuthenticated`), comme la pose
 * express-session + passport en amont des contrôleurs.
 *
 * - anonyme et client authentifié non admin → 403 sur les 12 routes, AUCUN appel
 *   service ni lecture base (routes POST déclenchant ingestion / audit incluses) ;
 * - administrateur (level >= 7 ou isAdmin) → route servie ;
 * - contre-exemple : guards neutralisés → la même requête anonyme atteint le service
 *   (le 403 ci-dessus n'est donc pas vacant) ;
 * - job interne (processor BullMQ) : appelle le fetcher sans requête HTTP ni session.
 *
 * Aucun appel réseau : services et client Supabase mockés.
 */
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));

import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createClient } from '@supabase/supabase-js';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';

import { AuthenticatedGuard } from '../../../src/auth/authenticated.guard';
import { IsAdminGuard } from '../../../src/auth/is-admin.guard';
import { SeoMonitoringController } from '../../../src/modules/seo-monitoring/controllers/seo-monitoring.controller';
import { SeoDailyFetchProcessor } from '../../../src/modules/seo-monitoring/processors/seo-daily-fetch.processor';
import { AuditFindingsService } from '../../../src/modules/seo-monitoring/services/audit-findings.service';
import { Ga4DailyFetcherService } from '../../../src/modules/seo-monitoring/services/ga4-daily-fetcher.service';
import { GoogleCredentialsService } from '../../../src/modules/seo-monitoring/services/google-credentials.service';
import { GscDailyFetcherService } from '../../../src/modules/seo-monitoring/services/gsc-daily-fetcher.service';
import { RContentAuditorService } from '../../../src/modules/seo-monitoring/services/r-content-auditor.service';
import { RagMirrorFreshnessService } from '../../../src/modules/seo-monitoring/services/rag-mirror-freshness.service';
import { SeoMonitoringRunsService } from '../../../src/modules/seo-monitoring/services/seo-monitoring-runs.service';

const BASE = '/api/admin/seo-monitoring';

type Persona = { id: string; email: string; isAdmin?: boolean; level?: number };
const PERSONAS: Record<string, Persona> = {
  customer: {
    id: 'u-1',
    email: 'client@example.test',
    isAdmin: false,
    level: 1,
  },
  level6: { id: 'u-6', email: 'staff6@example.test', level: 6 },
  level7: { id: 'u-7', email: 'staff7@example.test', level: 7 },
  adminFlag: { id: 'a-1', email: 'admin@example.test', isAdmin: true },
};

/** Les 12 routes du contrôleur (méthode, chemin, corps). */
const ROUTES: Array<[method: 'get' | 'post', path: string, body?: object]> = [
  ['get', '/credentials/health'],
  ['get', '/cron/health'],
  ['get', '/timeseries/gsc?from=2026-09-01&to=2026-09-08'],
  ['get', '/timeseries/ga4?from=2026-09-01&to=2026-09-08'],
  ['get', '/timeseries/cwv?from=2026-09-01&to=2026-09-08'],
  ['get', '/timeseries/crux'],
  ['get', '/runs'],
  ['post', '/run/gsc', { date: '2026-09-08' }],
  ['post', '/run/ga4', { date: '2026-09-08' }],
  ['get', '/audit/findings'],
  ['get', '/audit/findings/summary'],
  ['post', '/audit/r-content/run', { sources: ['conseil'] }],
];

function makeMocks() {
  const supabaseFrom = jest.fn(() => {
    const builder: Record<string, unknown> = {};
    for (const op of [
      'select',
      'eq',
      'in',
      'gte',
      'lte',
      'lt',
      'order',
      'ilike',
      'limit',
    ]) {
      builder[op] = () => builder;
    }
    builder.then = (resolve: (v: unknown) => unknown) =>
      resolve({ data: [], error: null });
    return builder;
  });
  (createClient as jest.Mock).mockReturnValue({
    from: supabaseFrom,
    rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
  });
  const services = {
    credentials: {
      isMonitoringEnabled: jest.fn(() => false),
      checkReadiness: jest.fn(() => ({
        gsc: { ready: true },
        ga4: { ready: true },
      })),
      getGSCSiteUrl: jest.fn(() => 'sc-domain:example.test'),
      getGA4PropertyName: jest.fn(() => 'properties/0'),
    },
    gscFetcher: {
      ingestionConfig: { floorDate: '2026-06-01' },
      fetchAndPersist: jest.fn().mockResolvedValue({ runId: 'mock' }),
    },
    ga4Fetcher: {
      fetchAndPersist: jest.fn().mockResolvedValue({ runId: 'mock' }),
    },
    auditFindings: {
      listOpen: jest.fn().mockResolvedValue([]),
      countOpenBySeverity: jest.fn().mockResolvedValue({}),
    },
    rContentAuditor: { audit: jest.fn().mockResolvedValue({ by_source: {} }) },
    runsService: { getRunsHealth: jest.fn().mockResolvedValue({}) },
    ragMirrorFreshness: {
      checkFreshness: jest.fn().mockResolvedValue({ status: 'ok' }),
    },
  };
  const allServiceFns = () => [
    ...Object.values(services).flatMap((s) =>
      Object.values(s).filter((v): v is jest.Mock => jest.isMockFunction(v)),
    ),
    supabaseFrom,
  ];
  return { services, supabaseFrom, allServiceFns };
}

async function makeApp(
  mocks: ReturnType<typeof makeMocks>,
  opts: { neutralizeGuards?: boolean } = {},
): Promise<INestApplication> {
  let builder = Test.createTestingModule({
    controllers: [SeoMonitoringController],
    providers: [
      {
        provide: GoogleCredentialsService,
        useValue: mocks.services.credentials,
      },
      { provide: GscDailyFetcherService, useValue: mocks.services.gscFetcher },
      { provide: Ga4DailyFetcherService, useValue: mocks.services.ga4Fetcher },
      { provide: AuditFindingsService, useValue: mocks.services.auditFindings },
      {
        provide: RContentAuditorService,
        useValue: mocks.services.rContentAuditor,
      },
      {
        provide: SeoMonitoringRunsService,
        useValue: mocks.services.runsService,
      },
      {
        provide: RagMirrorFreshnessService,
        useValue: mocks.services.ragMirrorFreshness,
      },
      {
        provide: ConfigService,
        useValue: {
          get: (key: string) =>
            key === 'SUPABASE_URL' ? 'https://supabase.test' : undefined,
        },
      },
    ],
  });
  if (opts.neutralizeGuards) {
    builder = builder
      .overrideGuard(AuthenticatedGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(IsAdminGuard)
      .useValue({ canActivate: () => true });
  }
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication({ logger: false });
  // Session Passport simulée (en PROD : express-session + passport.session()).
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const persona = PERSONAS[req.header('x-test-persona') ?? ''];
    Object.assign(req, {
      user: persona,
      isAuthenticated: () => persona !== undefined,
    });
    next();
  });
  await app.init();
  return app;
}

function send(
  app: INestApplication,
  [method, path, body]: (typeof ROUTES)[number],
  persona?: keyof typeof PERSONAS,
) {
  let req = request(app.getHttpServer())[method](`${BASE}${path}`);
  if (persona) req = req.set('x-test-persona', persona);
  return body ? req.send(body) : req;
}

describe('SeoMonitoringController — guards admin (HTTP)', () => {
  const originalEnv = process.env;
  let mocks: ReturnType<typeof makeMocks>;
  let app: INestApplication;

  beforeAll(async () => {
    process.env = { ...originalEnv, SUPABASE_SERVICE_ROLE_KEY: 'svc-key' };
    mocks = makeMocks();
    app = await makeApp(mocks);
  });
  afterAll(async () => {
    await app.close();
    process.env = originalEnv;
  });
  beforeEach(() => {
    mocks.allServiceFns().forEach((fn) => fn.mockClear());
  });

  it.each(ROUTES)(
    'anonyme → 403 sans effet de bord : %s %s',
    async (...route) => {
      const res = await send(app, route);
      expect(res.status).toBe(403);
      for (const fn of mocks.allServiceFns()) expect(fn).not.toHaveBeenCalled();
    },
  );

  it.each(ROUTES)(
    'client authentifié non admin → 403 sans effet de bord : %s %s',
    async (...route) => {
      const res = await send(app, route, 'customer');
      expect(res.status).toBe(403);
      for (const fn of mocks.allServiceFns()) expect(fn).not.toHaveBeenCalled();
    },
  );

  it('frontière du niveau admin : level 6 refusé, level 7 autorisé', async () => {
    const route = ROUTES[0];
    expect((await send(app, route, 'level6')).status).toBe(403);
    expect(
      mocks.services.credentials.isMonitoringEnabled,
    ).not.toHaveBeenCalled();
    const ok = await send(app, route, 'level7');
    expect(ok.status).toBe(200);
    expect(ok.body.gsc_site_url).toBe('sc-domain:example.test');
  });

  it('administrateur (isAdmin) → lecture servie', async () => {
    const res = await send(app, ROUTES[6], 'adminFlag');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ rows: [] });
    expect(mocks.supabaseFrom).toHaveBeenCalledWith('__seo_event_log');
  });

  it('administrateur → POST run/gsc atteint le fetcher (mock, aucun appel réel)', async () => {
    const res = await request(app.getHttpServer())
      .post(`${BASE}/run/gsc`)
      .set('x-test-persona', 'level7')
      .send({ date: '2026-09-08', dryRun: true });
    expect(res.status).toBe(201);
    expect(mocks.services.gscFetcher.fetchAndPersist).toHaveBeenCalledTimes(1);
    expect(mocks.services.gscFetcher.fetchAndPersist).toHaveBeenCalledWith({
      date: '2026-09-08',
      dryRun: true,
    });
  });
});

describe('SeoMonitoringController — contre-exemple : guards neutralisés', () => {
  const originalEnv = process.env;
  afterAll(() => {
    process.env = originalEnv;
  });

  it('sans guards, la même requête anonyme déclenche le fetcher → le 403 protège réellement', async () => {
    process.env = { ...originalEnv, SUPABASE_SERVICE_ROLE_KEY: 'svc-key' };
    const mocks = makeMocks();
    const app = await makeApp(mocks, { neutralizeGuards: true });
    try {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/run/gsc`)
        .send({ date: '2026-09-08' });
      expect(res.status).toBe(201);
      expect(mocks.services.gscFetcher.fetchAndPersist).toHaveBeenCalledWith({
        date: '2026-09-08',
        dryRun: undefined,
      });
    } finally {
      await app.close();
    }
  });
});

describe('Job interne légitime — non concerné par les guards HTTP', () => {
  const originalEnv = process.env;
  afterAll(() => {
    process.env = originalEnv;
  });

  it('le processor daily-fetch appelle le fetcher GSC directement, sans requête ni session', async () => {
    process.env = { ...originalEnv, READ_ONLY: 'false' };
    const gscFetcher = {
      fetchAndPersistMultiGrain: jest.fn().mockResolvedValue({
        rowsInserted: 0,
        warnings: [],
        dates: {
          refresh: [],
          backfill: [],
          deferred: [],
          ingested: ['2026-09-08'],
          realZero: [],
          notFinal: [],
          finalityUnknown: [],
          failed: [],
        },
      }),
    };
    const jobHealth = {
      recordSuccess: jest.fn().mockResolvedValue(undefined),
      recordFailure: jest.fn().mockResolvedValue(undefined),
    };
    const processor = new (SeoDailyFetchProcessor as unknown as new (
      ...args: unknown[]
    ) => SeoDailyFetchProcessor)(gscFetcher, {}, {}, {}, {}, {}, jobHealth);
    const result = await processor.handleDailyFetch({
      id: 1,
      data: { date: '2026-09-08', task: 'gsc', triggeredBy: 'scheduler' },
      progress: jest.fn().mockResolvedValue(undefined),
    } as never);

    expect(gscFetcher.fetchAndPersistMultiGrain).toHaveBeenCalledWith({
      date: '2026-09-08',
      triggeredBy: 'scheduler',
    });
    expect(result.perSource).toEqual([
      expect.objectContaining({ source: 'gsc', status: 'ok' }),
    ]);
    expect(jobHealth.recordSuccess).toHaveBeenCalledWith(
      'seo-daily-fetch',
      expect.any(Number),
    );
  });
});
