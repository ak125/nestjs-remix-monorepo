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

/**
 * Pattern test : instanciation directe + mock `callRpc` (méthode héritée).
 * Service refactor canon : 1 appel RPC `get_soft_404_alternatives`, le
 * ranking vit dans Postgres SECURITY DEFINER (bypass RLS, ADR-076).
 */
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

  describe('compute()', () => {
    it('retourne le payload depuis le cache si présent (cache hit)', async () => {
      const cached = {
        success: true as const,
        version: 'v2' as const,
        etag: 'sha256-cached',
        alternativeVehicles: [],
        alternativeGammes: [],
        relatedModels: [],
      };
      cacheMock.get!.mockResolvedValue(JSON.stringify(cached));

      const result = await service.compute(11836, 3859, 12);

      expect(cacheMock.get).toHaveBeenCalledWith('alt:11836:3859:v3');
      expect(callRpcMock).not.toHaveBeenCalled();
      expect(result).toEqual(cached);
    });

    it('appelle la RPC get_soft_404_alternatives en cache miss avec params nommés', async () => {
      cacheMock.get!.mockResolvedValue(null);
      callRpcMock.mockResolvedValue({
        data: {
          alternativeVehicles: [],
          alternativeGammes: [],
          relatedModels: [],
        },
        error: null,
      });

      await service.compute(11836, 3859, 12);

      expect(callRpcMock).toHaveBeenCalledWith(
        'get_soft_404_alternatives',
        { p_type_id: 11836, p_pg_id: 3859, p_limit: 12 },
        { source: 'api' },
      );
    });

    it('produit un etag sha256-stable et écrit dans le cache (cache miss)', async () => {
      cacheMock.get!.mockResolvedValue(null);
      callRpcMock.mockResolvedValue({
        data: {
          alternativeVehicles: [],
          alternativeGammes: [],
          relatedModels: [],
        },
        error: null,
      });

      const r1 = await service.compute(11836, 3859, 12);
      const r2 = await service.compute(11836, 3859, 12);

      expect(r1.etag).toMatch(/^sha256-[0-9a-f]{64}$/);
      expect(r1.etag).toEqual(r2.etag);
      expect(cacheMock.set).toHaveBeenCalled();
    });

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
      // Error path uses CACHE_TTL_ERROR_SECONDS=30, not 300, so a transient
      // failure does not poison the cache for 5 min (regression 2026-05-19).
      expect(cacheMock.set).toHaveBeenCalledWith(
        'alt:11836:3859:v3',
        expect.any(String),
        30,
      );
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
