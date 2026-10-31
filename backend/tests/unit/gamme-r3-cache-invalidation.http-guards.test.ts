/**
 * Invalidation des caches Redis R1 et R3 — protection admin prouvée au niveau HTTP.
 *
 * Avant correctif, POST /api/gamme-rest/:pgId/cache/invalidate effaçait le cache
 * R1 sur requête anonyme, et le cache R3 (TTL 24 h) n'avait aucun point d'entrée.
 * Ici : application Nest réelle (supertest), guards réels (AuthenticatedGuard puis
 * IsAdminGuard) ; seule la session Passport est simulée par un middleware
 * (`req.user` + `req.isAuthenticated`), comme la pose express-session + passport.
 * `x-test-session: none` garde `req.user` mais rend `isAuthenticated()` faux :
 * chaque guard est ainsi éprouvé seul.
 *
 * - anonyme et client authentifié non admin → 403, AUCUNE clé effacée ;
 * - administrateur sans session authentifiée → 403 (AuthenticatedGuard seul) ;
 * - administrateur (level >= 7 ou isAdmin) → les clés attendues sont effacées ;
 * - contre-exemples : guards neutralisés → la requête anonyme efface ;
 *   AuthenticatedGuard seul neutralisé → l'administrateur sans session efface
 *   (aucun des deux 403 n'est vacant) ;
 * - Redis indisponible (CacheService réel : client absent, ou DEL rejeté) → 503,
 *   aucun message de succès ;
 * - les routes de lecture restent publiques.
 *
 * Aucun appel réseau : CacheService est un double en mémoire, ou le service réel
 * sans connexion (`onModuleInit` neutralisé sur l'instance) ; services mockés.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';

import { AuthenticatedGuard } from '../../src/auth/authenticated.guard';
import { IsAdminGuard } from '../../src/auth/is-admin.guard';
import { CacheService } from '../../src/cache/cache.service';
import { R3GuideController } from '../../src/modules/blog/controllers/r3-guide.controller';
import { BlogArticleDataService } from '../../src/modules/blog/services/blog-article-data.service';
import { BlogArticleRelationService } from '../../src/modules/blog/services/blog-article-relation.service';
import { BlogSeoService } from '../../src/modules/blog/services/blog-seo.service';
import { R3GuideService } from '../../src/modules/blog/services/r3-guide.service';
import { R3ProjectionDecisionService } from '../../src/modules/blog/services/r3-projection-decision.service';
import { GammeRestRpcV2Controller } from '../../src/modules/gamme-rest/gamme-rest-rpc-v2.controller';
import { GammeResponseBuilderService } from '../../src/modules/gamme-rest/services';
import { GammeRpcService } from '../../src/modules/gamme-rest/services/gamme-rpc.service';
import { InternalLinkingService } from '../../src/modules/seo/internal-linking.service';
import { R6GuideLinkPolicyService } from '../../src/modules/seo/services/r6-guide-link-policy.service';

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

const PG_ID = '7';
const PG_ALIAS = 'filtre-a-huile';
const R1_KEYS = [
  `gamme:rpc:v2:${PG_ID}`,
  `gamme:rpc:v2:stale:${PG_ID}`,
  `gamme:resp:v2:r6c0:${PG_ID}`,
  `gamme:resp:v2:r6c1:${PG_ID}`,
];
const R3_KEYS = [
  `r3-guide:v3:r6c0:${PG_ALIAS}`,
  `r3-guide:v3:r6c1:${PG_ALIAS}`,
];
const R1_PATH = `/api/gamme-rest/${PG_ID}/cache/invalidate`;
const R3_PATH = `/api/r3-guide/${PG_ALIAS}/cache/invalidate`;

/** CacheService réduit à get/set/del sur une Map ; les clés R1 et R3 y sont posées. */
function makeCache() {
  const store = new Map<string, unknown>();
  const seed = () => {
    store.clear();
    for (const key of [...R1_KEYS, ...R3_KEYS]) store.set(key, { cached: key });
  };
  const cache = {
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    set: jest.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }),
    del: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    delStrict: jest.fn(async (keys: string[]) => {
      for (const key of keys) store.delete(key);
    }),
  };
  /** Clés passées à `delStrict`, dans l'ordre des appels. */
  const deleted = () => cache.delStrict.mock.calls.flatMap(([keys]) => keys);
  return { store, seed, cache, deleted };
}

/**
 * CacheService réel sans connexion : `onModuleInit` (connexion Redis) est
 * neutralisé sur l'instance ; `redis` remplace le client ioredis.
 */
function realCacheService(redis: { status: string; del: jest.Mock } | null) {
  const service = new CacheService();
  Object.assign(service, {
    onModuleInit: async () => undefined,
    redisClient: redis,
    redisReady: redis !== null,
  });
  return service;
}

async function makeApp(
  cacheDouble: ReturnType<typeof makeCache>,
  opts: {
    neutralize?: Array<typeof AuthenticatedGuard | typeof IsAdminGuard>;
    cacheService?: CacheService;
  } = {},
): Promise<INestApplication> {
  const cache = opts.cacheService ?? cacheDouble.cache;
  // GammeRpcService réel pour ses clés `gamme:rpc:v2:*` ; dépendances non utilisées.
  const rpcService = Object.create(
    GammeRpcService.prototype,
  ) as GammeRpcService;
  Object.assign(rpcService, {
    cacheService: cache,
    logger: { log: jest.fn(), debug: jest.fn(), error: jest.fn() },
  });
  let builder = Test.createTestingModule({
    controllers: [GammeRestRpcV2Controller, R3GuideController],
    providers: [
      R3GuideService,
      { provide: CacheService, useValue: cache },
      { provide: GammeRpcService, useValue: rpcService },
      {
        provide: GammeResponseBuilderService,
        useValue: { buildRpcV2Response: jest.fn() },
      },
      {
        provide: R6GuideLinkPolicyService,
        useValue: { cacheKeySegment: () => 'r6c0', getSnapshot: jest.fn() },
      },
      {
        provide: R3ProjectionDecisionService,
        useValue: { isTargeted: () => false, decide: jest.fn() },
      },
      { provide: BlogArticleDataService, useValue: {} },
      { provide: BlogSeoService, useValue: {} },
      { provide: BlogArticleRelationService, useValue: {} },
      { provide: InternalLinkingService, useValue: {} },
    ],
  });
  for (const guard of opts.neutralize ?? []) {
    builder = builder
      .overrideGuard(guard)
      .useValue({ canActivate: () => true });
  }
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication({ logger: false });
  // Session Passport simulée (en PROD : express-session + passport.session()).
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const persona = PERSONAS[req.header('x-test-persona') ?? ''];
    const session = req.header('x-test-session') !== 'none';
    Object.assign(req, {
      user: persona,
      isAuthenticated: () => session && persona !== undefined,
    });
    next();
  });
  await app.init();
  return app;
}

function post(
  app: INestApplication,
  path: string,
  persona?: string,
  opts: { noSession?: boolean } = {},
) {
  let req = request(app.getHttpServer()).post(path);
  if (persona) req = req.set('x-test-persona', persona);
  return opts.noSession ? req.set('x-test-session', 'none') : req;
}

describe('Invalidation des caches R1/R3 — guards admin (HTTP)', () => {
  let cacheDouble: ReturnType<typeof makeCache>;
  let app: INestApplication;

  beforeAll(async () => {
    cacheDouble = makeCache();
    app = await makeApp(cacheDouble);
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    cacheDouble.seed();
    Object.values(cacheDouble.cache).forEach((fn) => fn.mockClear());
  });

  it.each([
    ['anonyme', undefined],
    ['client authentifié', 'customer'],
    ['niveau 6', 'level6'],
  ])('%s → 403 sur R1 et R3, aucune clé effacée', async (_label, persona) => {
    for (const path of [R1_PATH, R3_PATH]) {
      const res = await post(app, path, persona);
      expect(res.status).toBe(403);
    }
    expect(cacheDouble.cache.del).not.toHaveBeenCalled();
    expect(cacheDouble.cache.delStrict).not.toHaveBeenCalled();
    expect([...cacheDouble.store.keys()].sort()).toEqual(
      [...R1_KEYS, ...R3_KEYS].sort(),
    );
  });

  it.each([['level7'], ['adminFlag']])(
    'administrateur (%s) sans session authentifiée → 403 sur R1 et R3, aucune clé effacée',
    async (persona) => {
      for (const path of [R1_PATH, R3_PATH]) {
        const res = await post(app, path, persona, { noSession: true });
        expect(res.status).toBe(403);
      }
      expect(cacheDouble.cache.delStrict).not.toHaveBeenCalled();
      expect(cacheDouble.store.size).toBe(R1_KEYS.length + R3_KEYS.length);
    },
  );

  it.each([['level7'], ['adminFlag']])(
    'administrateur (%s) → R1 efface ses 4 clés, rien de R3',
    async (persona) => {
      const res = await post(app, R1_PATH, persona);
      expect(res.status).toBe(201);
      expect(res.body.message).toBe(`Cache invalidé pour gamme ${PG_ID}`);
      expect(cacheDouble.deleted().sort()).toEqual([...R1_KEYS].sort());
      expect(cacheDouble.cache.del).not.toHaveBeenCalled();
      expect([...cacheDouble.store.keys()].sort()).toEqual([...R3_KEYS].sort());
    },
  );

  it.each([['level7'], ['adminFlag']])(
    'administrateur (%s) → R3 efface ses 2 clés et les renvoie, rien de R1',
    async (persona) => {
      const res = await post(app, R3_PATH, persona);
      expect(res.status).toBe(201);
      expect(res.body.keys).toEqual(R3_KEYS);
      expect(cacheDouble.deleted()).toEqual(R3_KEYS);
      expect(cacheDouble.cache.del).not.toHaveBeenCalled();
      expect([...cacheDouble.store.keys()].sort()).toEqual([...R1_KEYS].sort());
    },
  );

  it('contre-exemple : guards neutralisés → la requête anonyme efface', async () => {
    const open = await makeApp(cacheDouble, {
      neutralize: [AuthenticatedGuard, IsAdminGuard],
    });
    try {
      expect((await post(open, R1_PATH)).status).toBe(201);
      expect((await post(open, R3_PATH)).status).toBe(201);
      expect(cacheDouble.store.size).toBe(0);
    } finally {
      await open.close();
    }
  });

  it('contre-exemple : AuthenticatedGuard seul neutralisé → l’administrateur sans session efface', async () => {
    const open = await makeApp(cacheDouble, {
      neutralize: [AuthenticatedGuard],
    });
    try {
      for (const path of [R1_PATH, R3_PATH]) {
        const res = await post(open, path, 'level7', { noSession: true });
        expect(res.status).toBe(201);
      }
      expect(cacheDouble.store.size).toBe(0);
      // IsAdminGuard reste actif : le client sans session est toujours refusé.
      cacheDouble.seed();
      expect(
        (await post(open, R3_PATH, 'customer', { noSession: true })).status,
      ).toBe(403);
    } finally {
      await open.close();
    }
  });

  it.each([
    ['client Redis absent', null],
    [
      'DEL rejeté par Redis',
      {
        status: 'ready',
        del: jest.fn().mockRejectedValue(new Error('ECONNRESET')),
      },
    ],
  ])(
    'Redis indisponible (%s) → 503 sur R1 et R3, aucun message de succès',
    async (_label, redis) => {
      const down = await makeApp(cacheDouble, {
        cacheService: realCacheService(redis),
      });
      try {
        for (const path of [R1_PATH, R3_PATH]) {
          const res = await post(down, path, 'adminFlag');
          expect(res.status).toBe(503);
          expect(JSON.stringify(res.body)).not.toContain('Cache invalidé');
          expect(res.body.keys).toBeUndefined();
        }
        // Le DEL a bien atteint le client : le 503 vient de son rejet.
        if (redis) expect(redis.del).toHaveBeenCalledTimes(2);
      } finally {
        await down.close();
      }
    },
  );

  it('la lecture R3 reste publique (le cache posé est servi sans session)', async () => {
    const res = await request(app.getHttpServer()).get(
      `/api/r3-guide/${PG_ALIAS}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ cached: R3_KEYS[0] });
  });
});
