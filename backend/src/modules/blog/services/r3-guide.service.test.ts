/**
 * R3GuideService — cache, single-flight (anti-stampede), invalidation tests.
 *
 * Couvre les invariants critiques du cache R3 :
 *   - TTL respecté (régression test seconds vs ms)
 *   - Single-flight : N appels concurrents ⇒ 1 seul `computeLegacyPayload`
 *   - Invalidation event-driven (`@OnEvent('article.published'|'article.updated')`)
 *   - Cache write best-effort : `cacheService.set` qui throw ne masque pas le payload
 *   - `onArticleChanged` log warn quand le payload n'a pas de pg_alias
 *
 * Pas d'I/O réseau ; mocks minimaux. CacheService est mocké via une Map
 * en mémoire avec TTL relatif émulé (Date.now()).
 */

import { Test, type TestingModule } from '@nestjs/testing';
import { CacheService } from '../../../cache/cache.service';
import { BlogArticleDataService } from './blog-article-data.service';
import { BlogSeoService } from './blog-seo.service';
import { BlogArticleRelationService } from './blog-article-relation.service';
import { InternalLinkingService } from '../../seo/internal-linking.service';
import { R3ProjectionDecisionService } from './r3-projection-decision.service';
import { R3GuideService } from './r3-guide.service';

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

/**
 * In-memory CacheService stub. TTL en secondes (cohérent avec ioredis SETEX).
 * Resté minimal : juste ce qu'il faut pour valider get/set/del + expiration.
 */
class InMemoryCacheServiceStub {
  private readonly store = new Map<string, CacheEntry>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttl: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
}

const PG_ALIAS = 'emetteur-d-embrayage';
const PG_ID = 124;

const articleStub = {
  legacy_id: 999,
  slug: PG_ALIAS,
  title: 'Émetteur d’embrayage',
  h1: 'Émetteur d’embrayage',
  excerpt: 'Excerpt',
  publishedAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  keywords: [],
  viewsCount: 0,
  featuredImage: null,
  tags: [],
  cta_link: null,
  cta_anchor: null,
  sections: [],
  seo_data: null,
};

const gammeDataStub = { pg_id: PG_ID, pg_alias: PG_ALIAS };

function makeMocks() {
  const dataService = {
    getArticleByGamme: jest
      .fn()
      .mockResolvedValue({ article: articleStub, gammeData: gammeDataStub }),
    getRelatedArticles: jest.fn().mockResolvedValue([]),
    getAdjacentArticles: jest
      .fn()
      .mockResolvedValue({ previous: null, next: null }),
  };
  const seoService = {
    getGammeConseil: jest.fn().mockResolvedValue([]),
    getSeoItemSwitches: jest.fn().mockResolvedValue([]),
    getSeoBrief: jest.fn().mockResolvedValue(null),
    hasPublishedR6Guide: jest.fn().mockResolvedValue(false),
    getApprovedImages: jest.fn().mockResolvedValue([]),
  };
  const relationService = {
    getCompatibleVehicles: jest.fn().mockResolvedValue([]),
  };
  const internalLinkingService = {
    processLinkGamme: jest.fn().mockImplementation(async (s: string) => s),
  };
  // Par défaut : HORS canary (flags OFF en prod) → le chemin legacy caché reste inchangé.
  const projectionDecision = {
    isTargeted: jest.fn().mockReturnValue(false),
    decide: jest.fn(),
  };
  return {
    dataService,
    seoService,
    relationService,
    internalLinkingService,
    projectionDecision,
  };
}

async function buildService(): Promise<{
  service: R3GuideService;
  cache: InMemoryCacheServiceStub;
  dataService: ReturnType<typeof makeMocks>['dataService'];
  relationService: ReturnType<typeof makeMocks>['relationService'];
  projectionDecision: ReturnType<typeof makeMocks>['projectionDecision'];
}> {
  const cache = new InMemoryCacheServiceStub();
  const mocks = makeMocks();

  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      R3GuideService,
      { provide: CacheService, useValue: cache },
      { provide: BlogArticleDataService, useValue: mocks.dataService },
      { provide: BlogSeoService, useValue: mocks.seoService },
      { provide: BlogArticleRelationService, useValue: mocks.relationService },
      {
        provide: InternalLinkingService,
        useValue: mocks.internalLinkingService,
      },
      {
        provide: R3ProjectionDecisionService,
        useValue: mocks.projectionDecision,
      },
    ],
  }).compile();

  const service = moduleRef.get(R3GuideService);
  return {
    service,
    cache,
    dataService: mocks.dataService,
    relationService: mocks.relationService,
    projectionDecision: mocks.projectionDecision,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('R3GuideService — cache + single-flight + invalidation (PR-A)', () => {
  describe('cache hit / miss', () => {
    it('first call computes; second call returns cached payload without recomputing', async () => {
      const { service, dataService } = await buildService();

      const first = await service.getR3GuidePayload(PG_ALIAS);
      const second = await service.getR3GuidePayload(PG_ALIAS);

      expect(first).not.toBeNull();
      expect(second).toBe(first);
      expect(dataService.getArticleByGamme).toHaveBeenCalledTimes(1);
    });

    it('returns null + skips cache write when no article matches the gamme', async () => {
      const { service, cache, dataService } = await buildService();
      dataService.getArticleByGamme.mockResolvedValueOnce({
        article: null,
        gammeData: null,
      });

      const result = await service.getR3GuidePayload('inconnu');

      expect(result).toBeNull();
      expect(await cache.get('r3-guide:v2:inconnu')).toBeNull();
    });
  });

  describe('LCP payload cap (PR LCP-R3-PR1)', () => {
    it('passes limit=24 to relationService.getCompatibleVehicles (anti-régression payload cap)', async () => {
      const { service, relationService } = await buildService();

      await service.getR3GuidePayload(PG_ALIAS);

      // Régression : remettre 1000 (ou tout autre valeur > 24) ferait grossir le
      // payload SSR de ~150 KB → LCP mobile +1-2s sur /blog-pieces-auto/conseils/*.
      expect(relationService.getCompatibleVehicles).toHaveBeenCalledWith(
        expect.any(Number),
        24,
        expect.any(String),
      );
    });
  });

  describe('TTL régression (seconds vs ms)', () => {
    it('respects a short TTL injected via setCacheTtlForTest', async () => {
      const { service, dataService } = await buildService();
      // 100 ms exprimé en secondes (0.1) — couvre le piège v4 (s) vs v5 (ms).
      // Si l'unité interne dérive vers ms, la 2e expiration ne se produira pas
      // dans les 200 ms et le test échouera.
      service.setCacheTtlForTest(0.1);

      await service.getR3GuidePayload(PG_ALIAS); // miss → compute #1
      expect(dataService.getArticleByGamme).toHaveBeenCalledTimes(1);

      await service.getR3GuidePayload(PG_ALIAS); // hit
      expect(dataService.getArticleByGamme).toHaveBeenCalledTimes(1);

      await sleep(150); // wait past TTL

      await service.getR3GuidePayload(PG_ALIAS); // expired → compute #2
      expect(dataService.getArticleByGamme).toHaveBeenCalledTimes(2);
    });
  });

  describe('single-flight (anti-stampede)', () => {
    it('coalesces 20 concurrent misses into a single computeLegacyPayload call', async () => {
      const { service, dataService } = await buildService();

      // Force computeLegacyPayload to take ~50 ms so concurrents land on inflight.
      let resolveCompute: (value: unknown) => void = () => undefined;
      const computePromise = new Promise((resolve) => {
        resolveCompute = resolve;
      });
      dataService.getArticleByGamme.mockImplementationOnce(async () => {
        await computePromise;
        return { article: articleStub, gammeData: gammeDataStub };
      });

      const concurrent = Array.from({ length: 20 }, () =>
        service.getR3GuidePayload(PG_ALIAS),
      );

      // Let microtasks queue, then release the compute.
      await sleep(10);
      resolveCompute(undefined);

      const results = await Promise.all(concurrent);

      expect(results).toHaveLength(20);
      expect(results.every((r) => r === results[0])).toBe(true);
      expect(dataService.getArticleByGamme).toHaveBeenCalledTimes(1);
    });

    it('clears inflight entry on error so subsequent calls retry', async () => {
      const { service, dataService } = await buildService();
      dataService.getArticleByGamme
        .mockRejectedValueOnce(new Error('transient supabase'))
        .mockResolvedValueOnce({
          article: articleStub,
          gammeData: gammeDataStub,
        });

      await expect(service.getR3GuidePayload(PG_ALIAS)).rejects.toThrow(
        'transient supabase',
      );

      // After a rejection, the inflight Map must be cleaned. Next call must
      // hit the dataService a second time, not stay stuck on the failed Promise.
      const recovered = await service.getR3GuidePayload(PG_ALIAS);
      expect(recovered).not.toBeNull();
      expect(dataService.getArticleByGamme).toHaveBeenCalledTimes(2);
    });
  });

  describe('invalidation events', () => {
    it('onArticleChanged deletes the cached key so next call recomputes', async () => {
      const { service, dataService } = await buildService();

      await service.getR3GuidePayload(PG_ALIAS); // populate cache
      expect(dataService.getArticleByGamme).toHaveBeenCalledTimes(1);

      await service.onArticleChanged({ pg_alias: PG_ALIAS });

      await service.getR3GuidePayload(PG_ALIAS); // must recompute
      expect(dataService.getArticleByGamme).toHaveBeenCalledTimes(2);
    });

    it('onArticleChanged skips invalidation and warns when payload omits pg_alias', async () => {
      const { service, cache } = await buildService();
      const delSpy = jest.spyOn(cache, 'del');
      const warnSpy = jest
        .spyOn(service['logger'], 'warn')
        .mockImplementation(() => undefined);

      await service.onArticleChanged(undefined);
      await service.onArticleChanged({});

      expect(delSpy).not.toHaveBeenCalled();
      // Both bad payloads must be flagged so an operator can spot a broken
      // emitter contract (silent invalidation = stale cache up to TTL).
      expect(warnSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('cache write resilience (best-effort)', () => {
    it('returns the computed payload even when cacheService.set throws', async () => {
      const { service, cache, dataService } = await buildService();

      // Simule un Redis blip pendant le SET (ECONNRESET, OOM, WRONGTYPE…).
      // Le compute Supabase a réussi : 9 round-trips OK, on ne doit pas
      // dégrader N coalesced callers en 500 alors que la donnée est en main.
      jest
        .spyOn(cache, 'set')
        .mockRejectedValueOnce(new Error('redis ECONNRESET'));

      const result = await service.getR3GuidePayload(PG_ALIAS);

      expect(result).not.toBeNull();
      expect(dataService.getArticleByGamme).toHaveBeenCalledTimes(1);
    });

    it('next call after a set failure recomputes (cache stayed empty)', async () => {
      const { service, cache, dataService } = await buildService();
      jest.spyOn(cache, 'set').mockRejectedValueOnce(new Error('redis blip'));

      await service.getR3GuidePayload(PG_ALIAS); // miss + set fails
      await service.getR3GuidePayload(PG_ALIAS); // cache empty → recompute

      expect(dataService.getArticleByGamme).toHaveBeenCalledTimes(2);
    });
  });
});

describe('R3GuideService — canary projection (P2-R3-D, dark)', () => {
  const TARGETED_DECISION = {
    entityKey: `gamme:${PG_ALIAS}`,
    projectionRole: 'R3_CONSEILS' as const,
    projectionStatus: 'READY_FOR_RENDER' as const,
    servedBodySource: 'legacy' as const,
    fallbackReason: null,
    mappedCount: 7,
    invalidCount: 0,
    slots: {},
  };

  it('hors canary : aucune décision projetée, aucun appel à decide(), payload legacy intact', async () => {
    const { service, projectionDecision } = await buildService();

    const payload = await service.getR3GuidePayload(PG_ALIAS);

    expect(projectionDecision.isTargeted).toHaveBeenCalledWith(PG_ALIAS);
    expect(projectionDecision.decide).not.toHaveBeenCalled();
    expect(payload?.projectionMeta).toBeUndefined();
  });

  it('hors canary : le cache Redis legacy sert toujours le 2e appel (chemin inchangé)', async () => {
    const { service, dataService } = await buildService();

    await service.getR3GuidePayload(PG_ALIAS);
    await service.getR3GuidePayload(PG_ALIAS);

    expect(dataService.getArticleByGamme).toHaveBeenCalledTimes(1);
  });

  it('canary ciblée : bypass total du cache — jamais de lecture ni écriture Redis', async () => {
    const { service, cache, projectionDecision } = await buildService();
    projectionDecision.isTargeted.mockReturnValue(true);
    projectionDecision.decide.mockResolvedValue(TARGETED_DECISION);
    const getSpy = jest.spyOn(cache, 'get');
    const setSpy = jest.spyOn(cache, 'set');

    await service.getR3GuidePayload(PG_ALIAS);
    await service.getR3GuidePayload(PG_ALIAS);

    expect(getSpy).not.toHaveBeenCalled();
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('canary ciblée : aucune clé legacy ne peut retenir un payload ciblé (recompute à chaque appel)', async () => {
    const { service, dataService, projectionDecision } = await buildService();
    projectionDecision.isTargeted.mockReturnValue(true);
    projectionDecision.decide.mockResolvedValue(TARGETED_DECISION);

    await service.getR3GuidePayload(PG_ALIAS);
    await service.getR3GuidePayload(PG_ALIAS);

    expect(dataService.getArticleByGamme).toHaveBeenCalledTimes(2);
  });

  it('canary ciblée : attache projectionMeta (signal de ciblage) sans toucher le HEAD', async () => {
    const { service, projectionDecision } = await buildService();
    projectionDecision.isTargeted.mockReturnValue(true);
    projectionDecision.decide.mockResolvedValue(TARGETED_DECISION);

    const payload = await service.getR3GuidePayload(PG_ALIAS);

    expect(payload?.projectionMeta).toEqual({
      projectionStatus: 'READY_FOR_RENDER',
      // Prête à être rendue, mais le BODY servi reste legacy : D n'a pas de renderer.
      servedBodySource: 'legacy',
      fallbackReason: null,
      mappedCount: 7,
      invalidCount: 0,
    });
    // HEAD (autorité SEO) strictement inchangé par la canary.
    expect(payload?.page.sourceType).toBe('article');
    expect(payload?.page.metaTitle).toBe(articleStub.title);
  });

  it('canary ciblée + repli : projectionMeta expose la cause, BODY legacy servi', async () => {
    const { service, projectionDecision } = await buildService();
    projectionDecision.isTargeted.mockReturnValue(true);
    projectionDecision.decide.mockResolvedValue({
      ...TARGETED_DECISION,
      projectionStatus: 'FALLBACK',
      fallbackReason: 'PROJECTION_ABSENT',
      mappedCount: 0,
      slots: null,
    });

    const payload = await service.getR3GuidePayload(PG_ALIAS);

    expect(payload?.projectionMeta?.projectionStatus).toBe('FALLBACK');
    expect(payload?.projectionMeta?.servedBodySource).toBe('legacy');
    expect(payload?.projectionMeta?.fallbackReason).toBe('PROJECTION_ABSENT');

    // BODY legacy COMPLET : hors projectionMeta, le payload est identique à celui servi
    // hors canary. Aucune fusion partielle possible.
    const legacy = await (
      await buildService()
    ).service.getR3GuidePayload(PG_ALIAS);
    const { projectionMeta: _meta, ...targetedBody } = payload!;
    expect(targetedBody).toEqual(legacy);
  });

  it('canary ciblée : un article introuvable reste 404 (null), sans appeler decide()', async () => {
    const { service, dataService, projectionDecision } = await buildService();
    projectionDecision.isTargeted.mockReturnValue(true);
    dataService.getArticleByGamme.mockResolvedValueOnce({
      article: null,
      gammeData: null,
    });

    const payload = await service.getR3GuidePayload(PG_ALIAS);

    expect(payload).toBeNull();
    expect(projectionDecision.decide).not.toHaveBeenCalled();
  });
});
