// backend/src/modules/rm/services/__tests__/rm-builder-page-v2-cache.test.ts

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY || 'test-service-key';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import {
  RmBuilderService,
  PAGE_V2_CANONICAL_LIMIT,
} from '../rm-builder.service';
import type { CacheService } from '@cache/cache.service';
import { CACHE_STRATEGIES } from '../../../../config/cache-ttl.config';

/**
 * Contrat de cache de `getPageCompleteV2` (A2, 2026-09-02).
 *
 * Défaut corrigé : le cache n'était écrit que si `count > 0`, donc chaque
 * couple gamme×véhicule sans produit (la population soft-404) rejouait la
 * RPC `rm_get_page_complete_v2` (~280 ms) à chaque requête, pour toujours.
 *
 * Nouveau contrat, aligné sur `classifyPageV2Result` × `count` :
 *   - 'ok' et count > 0 → cache, TTL RM.PAGE_V2 (1 h)
 *   - 'ok' et count = 0 → cache, TTL RM.PAGE_V2_EMPTY (15 min) — forme réelle
 *                         d'un couple existant sans produit (RPC success:true)
 *   - 'empty'           → cache, TTL RM.PAGE_V2_EMPTY (15 min)
 *   - 'not_found' → jamais mis en cache
 *   - 'error'     → jamais mis en cache (mettre une erreur RPC en cache
 *                   comme « vide » = incident 2026-05-19)
 *   - limit ≠ canonique (200) → contourne le cache (lecture ET écriture) :
 *     `count`/`filters`/`minPrice` dépendent du limit, on ne tranche pas.
 */
const GENERATION = 7;
// Clé A3 : `{prefix}{keyVersion}:g{génération}:{gamme}:{véhicule}` — la
// génération vient de Redis `cache:gen:catalog` (bump à l'activation pricing).
const KEY = `rm:page-v2:v1:g${GENERATION}:402:100413`;

type CacheMock = { get: jest.Mock; set: jest.Mock; getGeneration: jest.Mock };

function buildService(cache: CacheMock) {
  const dummy = {} as never;
  const service = new RmBuilderService(
    cache as unknown as CacheService,
    dummy, // SeoTemplateService — branche SEO non exercée (pas de seo_raw)
    dummy, // RpcGateService — callRpc est mocké
    dummy, // SeoShadowObservatory
  );
  const callRpc = jest.fn();
  (service as any).callRpc = callRpc;
  return { service, callRpc };
}

const okResult = {
  success: true,
  products: [{ id: 1 }],
  count: 1,
  minPrice: 10,
  grouped_pieces: [],
  vehicleInfo: {},
  gamme: {},
  seo: {},
  oemRefs: [],
  crossSelling: [],
  filters: { brands: [], qualities: [], sides: [], price_range: {} },
  validation: {},
  duration_ms: 0,
};

const emptyResult = { ...okResult, success: false, products: [], count: 0 };

describe('RmBuilderService.getPageCompleteV2 — contrat de cache', () => {
  let cache: CacheMock;

  beforeEach(() => {
    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(),
      getGeneration: jest.fn().mockResolvedValue(GENERATION),
    };
  });

  it('exporte le limit canonique = 200 (défaut du contrôleur et du loader R2)', () => {
    expect(PAGE_V2_CANONICAL_LIMIT).toBe(200);
  });

  it('lit la génération du périmètre catalog et compose la clé versionnée (A3)', async () => {
    const { service, callRpc } = buildService(cache);
    callRpc.mockResolvedValue({ data: okResult, error: null });

    await service.getPageCompleteV2({ gamme_id: 402, vehicle_id: 100413 });

    expect(cache.getGeneration).toHaveBeenCalledWith('catalog');
    expect(cache.get).toHaveBeenCalledWith(KEY);
    expect(cache.set).toHaveBeenCalledWith(
      KEY,
      expect.objectContaining({ count: 1 }),
      CACHE_STRATEGIES.RM.PAGE_V2.ttl,
    );
  });

  it('un bump de génération (7 → 8) change la clé lue et écrite (A3)', async () => {
    const { service, callRpc } = buildService(cache);
    callRpc.mockResolvedValue({ data: okResult, error: null });

    await service.getPageCompleteV2({ gamme_id: 402, vehicle_id: 100413 });
    cache.getGeneration.mockResolvedValue(GENERATION + 1);
    await service.getPageCompleteV2({ gamme_id: 402, vehicle_id: 100413 });

    expect(cache.get).toHaveBeenNthCalledWith(1, 'rm:page-v2:v1:g7:402:100413');
    expect(cache.get).toHaveBeenNthCalledWith(2, 'rm:page-v2:v1:g8:402:100413');
  });

  it('limit non canonique : ni lecture de génération ni accès Redis (A3)', async () => {
    const { service, callRpc } = buildService(cache);
    callRpc.mockResolvedValue({ data: okResult, error: null });

    await service.getPageCompleteV2({
      gamme_id: 402,
      vehicle_id: 100413,
      limit: 50,
    });

    expect(cache.getGeneration).not.toHaveBeenCalled();
    expect(cache.get).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it("met en cache un résultat 'ok' avec le TTL RM.PAGE_V2", async () => {
    const { service, callRpc } = buildService(cache);
    callRpc.mockResolvedValue({ data: okResult, error: null });

    await service.getPageCompleteV2({ gamme_id: 402, vehicle_id: 100413 });

    expect(cache.set).toHaveBeenCalledWith(
      KEY,
      expect.objectContaining({ success: true, count: 1 }),
      CACHE_STRATEGIES.RM.PAGE_V2.ttl,
    );
    expect(CACHE_STRATEGIES.RM.PAGE_V2.ttl).toBe(3600);
  });

  it("met en cache un résultat 'empty' (0 produit) avec le TTL court RM.PAGE_V2_EMPTY", async () => {
    const { service, callRpc } = buildService(cache);
    callRpc.mockResolvedValue({ data: emptyResult, error: null });

    await service.getPageCompleteV2({ gamme_id: 402, vehicle_id: 100413 });

    expect(cache.set).toHaveBeenCalledWith(
      KEY,
      expect.objectContaining({ success: false, count: 0 }),
      CACHE_STRATEGIES.RM.PAGE_V2_EMPTY.ttl,
    );
    expect(CACHE_STRATEGIES.RM.PAGE_V2_EMPTY.ttl).toBe(900);
  });

  it('un couple vide RÉEL (RPC: success true, count 0) prend le TTL court, pas 1 h', async () => {
    // Forme observée sur DEV:3000 pour 3859×11836 (soft-404 fixture #1) :
    // rm_get_page_complete_v2 ne rend `success:false` que sur INVALID_PARAMS /
    // *_NOT_FOUND / INTERNAL_ERROR (toujours avec `error`). Un couple existant
    // sans produit est donc `success:true, count:0` → classifyPageV2Result dit
    // 'ok'. Le TTL doit suivre le COUNT, pas le seul drapeau success.
    const { service, callRpc } = buildService(cache);
    callRpc.mockResolvedValue({
      data: { ...okResult, products: [], count: 0 },
      error: null,
    });

    await service.getPageCompleteV2({ gamme_id: 3859, vehicle_id: 11836 });

    expect(cache.set).toHaveBeenCalledWith(
      'rm:page-v2:v1:g7:3859:11836',
      expect.objectContaining({ success: true, count: 0 }),
      CACHE_STRATEGIES.RM.PAGE_V2_EMPTY.ttl,
    );
  });

  it("ne met JAMAIS en cache un résultat 'error' (échec RPC)", async () => {
    const { service, callRpc } = buildService(cache);
    callRpc.mockResolvedValue({
      data: null,
      error: { message: 'connection reset' },
    });

    const result = await service.getPageCompleteV2({
      gamme_id: 402,
      vehicle_id: 100413,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('RPC_ERROR');
    expect(cache.set).not.toHaveBeenCalled();
  });

  it("ne met JAMAIS en cache un résultat 'not_found' (VEHICLE_NOT_FOUND)", async () => {
    const { service, callRpc } = buildService(cache);
    callRpc.mockResolvedValue({
      data: {
        ...emptyResult,
        error: { code: 'VEHICLE_NOT_FOUND', message: 'nope' },
      },
      error: null,
    });

    await service.getPageCompleteV2({ gamme_id: 402, vehicle_id: 100413 });

    expect(cache.set).not.toHaveBeenCalled();
  });

  it("sert une entrée 'empty' depuis le cache sans rappeler la RPC", async () => {
    cache.get = jest
      .fn()
      .mockResolvedValue({ ...emptyResult, cacheHit: false });
    const { service, callRpc } = buildService(cache);

    const result = await service.getPageCompleteV2({
      gamme_id: 402,
      vehicle_id: 100413,
    });

    expect(callRpc).not.toHaveBeenCalled();
    expect(result.cacheHit).toBe(true);
    expect(result.success).toBe(false);
    expect(result.count).toBe(0);
  });

  it("sert une entrée 'ok' depuis le cache sans rappeler la RPC", async () => {
    cache.get = jest.fn().mockResolvedValue({ ...okResult, cacheHit: false });
    const { service, callRpc } = buildService(cache);

    const result = await service.getPageCompleteV2({
      gamme_id: 402,
      vehicle_id: 100413,
    });

    expect(callRpc).not.toHaveBeenCalled();
    expect(result.cacheHit).toBe(true);
    expect(result.count).toBe(1);
  });

  it('un limit non canonique contourne le cache en lecture ET en écriture', async () => {
    const { service, callRpc } = buildService(cache);
    callRpc.mockResolvedValue({ data: okResult, error: null });

    await service.getPageCompleteV2({
      gamme_id: 402,
      vehicle_id: 100413,
      limit: 50,
    });

    expect(cache.get).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
    expect(callRpc).toHaveBeenCalledWith(
      'rm_get_page_complete_v2',
      { p_gamme_id: 402, p_vehicle_id: 100413, p_limit: 50 },
      { source: 'api' },
    );
  });

  it('le limit canonique explicite (200) utilise le cache comme le défaut', async () => {
    const { service, callRpc } = buildService(cache);
    callRpc.mockResolvedValue({ data: okResult, error: null });

    await service.getPageCompleteV2({
      gamme_id: 402,
      vehicle_id: 100413,
      limit: PAGE_V2_CANONICAL_LIMIT,
    });

    expect(cache.get).toHaveBeenCalledWith(KEY);
    expect(cache.set).toHaveBeenCalledTimes(1);
  });
});
