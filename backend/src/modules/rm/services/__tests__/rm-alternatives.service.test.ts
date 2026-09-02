// backend/src/modules/rm/services/__tests__/rm-alternatives.service.test.ts

// SupabaseBaseService check les env vars dans son constructor. En test on
// court-circuite avec un stub minimal (canon, cf. rm-builder-seo-shadow.test.ts).
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY || 'test-service-key';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { RmAlternativesService } from '../rm-alternatives.service';
import type { CacheService } from '@cache/cache.service';
import { CACHE_STRATEGIES } from '../../../../config/cache-ttl.config';

/**
 * Pattern test : instanciation directe + mock `callRpc` (méthode héritée).
 * Service refactor canon : 1 appel RPC `get_soft_404_alternatives`, le
 * ranking vit dans Postgres SECURITY DEFINER (bypass RLS, ADR-076).
 *
 * Contrat de cache (A2, 2026-09-02) :
 *   - clé `alt:{type_id}:{pg_id}:v4` — SANS `limit` (cardinalité = type×pg)
 *   - la RPC est toujours appelée au `limit` canonique maximal (24) ; la
 *     réponse est tranchée côté application au `limit` demandé
 *   - le cache stocke le payload RPC brut ; etag recalculé sur la tranche
 *   - TTL succès = CACHE_STRATEGIES.RM.ALTERNATIVES (24 h), erreur = 30 s
 */
const KEY = 'alt:11836:3859:v4';
const CANONICAL_LIMIT = 24;

const vehicle = (id: number) => ({
  type_id: String(id),
  type_name: `type ${id}`,
  modele_id: 1,
  marque_id: 1,
  tier: 1,
});
const gamme = (id: number) => ({
  pg_id: id,
  pg_name: `gamme ${id}`,
  piece_count: 1,
  tier: 1,
});
const model = (id: number) => ({ modele_id: id, modele_name: `m${id}` });

// Payload "plein" tel que la RPC le rend au limit canonique : 6 véhicules,
// 8 gammes, 4 modèles (bornes internes LEAST(6,p_limit) / LEAST(8,p_limit) / 4).
const fullPayload = {
  alternativeVehicles: [1, 2, 3, 4, 5, 6].map(vehicle),
  alternativeGammes: [1, 2, 3, 4, 5, 6, 7, 8].map(gamme),
  relatedModels: [1, 2, 3, 4].map(model),
};

describe('RmAlternativesService (RPC canon)', () => {
  let service: RmAlternativesService;
  let cacheMock: jest.Mocked<Partial<CacheService>>;
  let callRpcMock: jest.Mock;

  beforeEach(() => {
    cacheMock = {
      get: jest.fn(),
      set: jest.fn(),
    };
    service = new RmAlternativesService(cacheMock as unknown as CacheService);
    callRpcMock = jest.fn();
    // Mock la méthode héritée callRpc
    (service as any).callRpc = callRpcMock;
  });

  describe('compute() — clé et limit canonique', () => {
    it('la clé de cache ne contient pas le limit (cardinalité type×pg)', async () => {
      cacheMock.get!.mockResolvedValue(null);
      callRpcMock.mockResolvedValue({ data: fullPayload, error: null });

      await service.compute(11836, 3859, 3);
      await service.compute(11836, 3859, 12);

      expect(cacheMock.get).toHaveBeenNthCalledWith(1, KEY);
      expect(cacheMock.get).toHaveBeenNthCalledWith(2, KEY);
    });

    it('appelle la RPC au limit canonique (24), quel que soit le limit demandé', async () => {
      cacheMock.get!.mockResolvedValue(null);
      callRpcMock.mockResolvedValue({ data: fullPayload, error: null });

      await service.compute(11836, 3859, 3);

      expect(callRpcMock).toHaveBeenCalledWith(
        'get_soft_404_alternatives',
        { p_type_id: 11836, p_pg_id: 3859, p_limit: CANONICAL_LIMIT },
        { source: 'api' },
      );
    });

    it('écrit le payload RPC brut dans le cache avec le TTL RM.ALTERNATIVES', async () => {
      cacheMock.get!.mockResolvedValue(null);
      callRpcMock.mockResolvedValue({ data: fullPayload, error: null });

      await service.compute(11836, 3859, 12);

      expect(cacheMock.set).toHaveBeenCalledWith(
        KEY,
        JSON.stringify(fullPayload),
        CACHE_STRATEGIES.RM.ALTERNATIVES.ttl,
      );
      expect(CACHE_STRATEGIES.RM.ALTERNATIVES.ttl).toBe(86400);
    });
  });

  describe('compute() — tranche au limit demandé', () => {
    it('tranche vehicles et gammes au limit demandé, relatedModels inchangé', async () => {
      cacheMock.get!.mockResolvedValue(null);
      callRpcMock.mockResolvedValue({ data: fullPayload, error: null });

      const result = await service.compute(11836, 3859, 3);

      expect(result.alternativeVehicles).toHaveLength(3);
      expect(result.alternativeGammes).toHaveLength(3);
      expect(result.relatedModels).toHaveLength(4);
      expect((result.alternativeVehicles[0] as any).type_id).toBe('1');
      expect((result.alternativeVehicles[2] as any).type_id).toBe('3');
    });

    it('un limit ≥ aux bornes internes (6/8) rend le payload complet', async () => {
      cacheMock.get!.mockResolvedValue(null);
      callRpcMock.mockResolvedValue({ data: fullPayload, error: null });

      const result = await service.compute(11836, 3859, 12);

      expect(result.alternativeVehicles).toHaveLength(6);
      expect(result.alternativeGammes).toHaveLength(8);
      expect(result.relatedModels).toHaveLength(4);
    });

    it('sert une tranche correcte depuis une entrée de cache brute (cache hit)', async () => {
      cacheMock.get!.mockResolvedValue(JSON.stringify(fullPayload));

      const result = await service.compute(11836, 3859, 2);

      expect(callRpcMock).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.version).toBe('v2');
      expect(result.alternativeVehicles).toHaveLength(2);
      expect(result.alternativeGammes).toHaveLength(2);
      expect(result.relatedModels).toHaveLength(4);
    });

    it("l'etag est calculé sur la tranche : deux limits ≠ deux etags, même entrée", async () => {
      cacheMock.get!.mockResolvedValue(JSON.stringify(fullPayload));

      const r3 = await service.compute(11836, 3859, 3);
      const r12 = await service.compute(11836, 3859, 12);
      const r12bis = await service.compute(11836, 3859, 12);

      expect(r3.etag).toMatch(/^sha256-[0-9a-f]{64}$/);
      expect(r3.etag).not.toEqual(r12.etag);
      expect(r12.etag).toEqual(r12bis.etag);
    });
  });

  describe('compute() — chemin erreur', () => {
    it('fallback gracieux sur RPC error : payload vide + cache short-TTL (anti-poisoning)', async () => {
      cacheMock.get!.mockResolvedValue(null);
      callRpcMock.mockResolvedValue({
        data: null,
        error: { message: 'permission denied', name: 'SupabaseRpcError' },
      });

      const result = await service.compute(11836, 3859, 12);

      expect(result.version).toBe('v2');
      expect(result.alternativeVehicles).toEqual([]);
      expect(result.alternativeGammes).toEqual([]);
      expect(result.relatedModels).toEqual([]);
      // Error path uses CACHE_TTL_ERROR_SECONDS=30, not the 24 h success TTL,
      // so a transient failure does not poison the cache (regression 2026-05-19).
      expect(cacheMock.set).toHaveBeenCalledWith(KEY, expect.any(String), 30);
    });

    it('auth failure (Invalid API key) is logged at ERROR not WARN', async () => {
      cacheMock.get!.mockResolvedValue(null);
      callRpcMock.mockResolvedValue({
        data: null,
        error: { message: 'Invalid API key', name: 'SupabaseRpcError' },
      });
      const errorSpy = jest
        .spyOn((service as any).logger, 'error')
        .mockImplementation(() => {});
      const warnSpy = jest
        .spyOn((service as any).logger, 'warn')
        .mockImplementation(() => {});

      await service.compute(11836, 3859, 12);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy.mock.calls[0][0]).toMatch(/Invalid API key/);
    });

    it('une entrée de cache illisible est ignorée et recalculée', async () => {
      cacheMock.get!.mockResolvedValue('{not-json');
      callRpcMock.mockResolvedValue({ data: fullPayload, error: null });
      jest.spyOn((service as any).logger, 'warn').mockImplementation(() => {});

      const result = await service.compute(11836, 3859, 12);

      expect(callRpcMock).toHaveBeenCalledTimes(1);
      expect(result.alternativeVehicles).toHaveLength(6);
    });
  });

  describe('compute() — propagation', () => {
    it('propage le payload RPC (vehicles/gammes/relatedModels)', async () => {
      cacheMock.get!.mockResolvedValue(null);
      callRpcMock.mockResolvedValue({
        data: {
          alternativeVehicles: [
            {
              type_id: '11838',
              type_name: '530 d',
              modele_id: 33053,
              marque_id: 33,
              tier: 1,
            },
          ],
          alternativeGammes: [
            {
              pg_id: 3860,
              pg_name: 'Disques arrière',
              piece_count: 42,
              tier: 3,
            },
          ],
          relatedModels: [],
        },
        error: null,
      });

      const result = await service.compute(11836, 3859, 12);

      expect(result.alternativeVehicles).toHaveLength(1);
      expect((result.alternativeVehicles[0] as any).tier).toBe(1);
      expect(result.alternativeGammes).toHaveLength(1);
    });

    it('produit un etag sha256-stable pour une même tranche (cache miss)', async () => {
      cacheMock.get!.mockResolvedValue(null);
      callRpcMock.mockResolvedValue({ data: fullPayload, error: null });

      const r1 = await service.compute(11836, 3859, 12);
      const r2 = await service.compute(11836, 3859, 12);

      expect(r1.etag).toMatch(/^sha256-[0-9a-f]{64}$/);
      expect(r1.etag).toEqual(r2.etag);
    });
  });

  describe('canonicalize()', () => {
    it('produit un JSON canonical (clés triées) avant hashing', () => {
      const a = service.canonicalize({ b: 1, a: 2 });
      const b = service.canonicalize({ a: 2, b: 1 });
      expect(a).toEqual(b);
    });

    it('handles arrays, objects, primitives, null', () => {
      expect(service.canonicalize(null)).toBe('null');
      expect(service.canonicalize(42)).toBe('42');
      expect(service.canonicalize('x')).toBe('"x"');
      expect(service.canonicalize([3, 1, 2])).toBe('[3,1,2]');
      expect(service.canonicalize({ z: 0, a: { b: 1 } })).toBe(
        '{"a":{"b":1},"z":0}',
      );
    });
  });
});
