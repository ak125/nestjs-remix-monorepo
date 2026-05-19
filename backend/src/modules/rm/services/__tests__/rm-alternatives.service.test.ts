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
 * Pattern test : instanciation directe + Object.assign de `this.supabase`
 * (canon repo : 203 services `extends SupabaseBaseService`, cf.
 * rm-builder-seo-shadow.test.ts pour la référence).
 *
 * Le service appelle `get_soft_404_alternatives` (SECURITY DEFINER) — les tests
 * mockent l'appel RPC, pas les requêtes `.from(...)` (qui n'existent plus dans
 * ce service depuis la refonte ADR-soft-404-r2-strategy).
 */
describe('RmAlternativesService', () => {
  let service: RmAlternativesService;
  let cacheMock: jest.Mocked<Partial<CacheService>>;
  let rpcMock: jest.Mock;
  let supabaseMock: any;

  beforeEach(() => {
    cacheMock = {
      get: jest.fn(),
      set: jest.fn(),
    };
    rpcMock = jest.fn();
    supabaseMock = {
      rpc: rpcMock,
    };

    service = new RmAlternativesService(cacheMock as unknown as CacheService);
    // Override le client supabase hérité (protected readonly) en runtime
    (service as any).supabase = supabaseMock;
  });

  describe('compute()', () => {
    it('retourne le payload depuis le cache si présent (cache hit, aucun appel RPC)', async () => {
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
      expect(cacheMock.get).toHaveBeenCalledWith('alt:11836:3859:v2');
      expect(rpcMock).not.toHaveBeenCalled();
      expect(result).toEqual(cached);
    });

    it('appelle get_soft_404_alternatives avec les bons paramètres en cache miss', async () => {
      cacheMock.get!.mockResolvedValue(null);
      rpcMock.mockResolvedValue({
        data: {
          alternativeVehicles: [],
          alternativeGammes: [],
          relatedModels: [],
        },
        error: null,
      });
      await service.compute(11836, 3859, 12);
      expect(rpcMock).toHaveBeenCalledWith('get_soft_404_alternatives', {
        p_type_id: 11836,
        p_pg_id: 3859,
        p_limit: 12,
      });
    });

    it('produit un etag sha256-stable et écrit dans le cache (cache miss)', async () => {
      cacheMock.get!.mockResolvedValue(null);
      rpcMock.mockResolvedValue({
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
      expect(cacheMock.set).toHaveBeenCalledWith(
        'alt:11836:3859:v2',
        expect.any(String),
        300,
      );
    });

    it('coerce les véhicules RPC vers le DTO typé (tier numérique, IDs Number, alias nullable)', async () => {
      cacheMock.get!.mockResolvedValue(null);
      rpcMock.mockResolvedValue({
        data: {
          alternativeVehicles: [
            {
              type_id: '11838',
              type_name: '530 d',
              type_alias: '3-0-530-d',
              type_fuel: 'Diesel',
              type_power_ps: '258',
              type_year_from: '2011',
              type_year_to: '2016',
              modele_id: 33053,
              modele_name: 'Série 5',
              modele_alias: 'serie-5',
              marque_id: 33,
              marque_name: 'BMW',
              marque_alias: 'bmw',
              tier: 1,
            },
            {
              type_id: '99999',
              type_alias: null,
              type_name: 'x',
              modele_id: 12345,
              marque_id: 33,
              tier: 'bogus', // RPC could in theory return invalid — must fall back to tier 3
            },
          ],
          alternativeGammes: [],
          relatedModels: [],
        },
        error: null,
      });
      const result = await service.compute(11836, 3859, 12);
      expect(result.alternativeVehicles).toHaveLength(2);
      expect(result.alternativeVehicles[0].tier).toBe(1);
      expect(result.alternativeVehicles[0].modele_id).toBe(33053);
      expect(result.alternativeVehicles[1].type_alias).toBeNull();
      expect(result.alternativeVehicles[1].tier).toBe(3);
    });

    it('coerce les gammes RPC vers le DTO typé (piece_count Number, pg_pic nullable)', async () => {
      cacheMock.get!.mockResolvedValue(null);
      rpcMock.mockResolvedValue({
        data: {
          alternativeVehicles: [],
          alternativeGammes: [
            {
              pg_id: 4,
              pg_name: 'Alternateur',
              pg_alias: 'alternateur',
              pg_pic: 'alternateur.webp',
              piece_count: 1181,
              tier: 3,
            },
            {
              pg_id: 2,
              pg_name: 'Démarreur',
              pg_alias: 'demarreur',
              pg_pic: null,
              piece_count: 998,
              tier: 3,
            },
          ],
          relatedModels: [],
        },
        error: null,
      });
      const result = await service.compute(11836, 3859, 12);
      expect(result.alternativeGammes).toHaveLength(2);
      expect(result.alternativeGammes[0].piece_count).toBe(1181);
      expect(result.alternativeGammes[1].pg_pic).toBeNull();
    });

    it('propage les erreurs RPC (anti silent-failure)', async () => {
      cacheMock.get!.mockResolvedValue(null);
      rpcMock.mockResolvedValue({
        data: null,
        error: { message: 'connection refused' },
      });
      await expect(service.compute(11836, 3859, 12)).rejects.toThrow(
        /get_soft_404_alternatives failed/,
      );
      expect(cacheMock.set).not.toHaveBeenCalled();
    });

    it('survit à un payload RPC vide (jamais crashe sur null/undefined)', async () => {
      cacheMock.get!.mockResolvedValue(null);
      rpcMock.mockResolvedValue({ data: null, error: null });
      const result = await service.compute(11836, 3859, 12);
      expect(result.alternativeVehicles).toEqual([]);
      expect(result.alternativeGammes).toEqual([]);
      expect(result.relatedModels).toEqual([]);
    });
  });

  describe('output canonical', () => {
    it('produit un JSON canonical (clés triées) avant hashing', async () => {
      const a = (service as any).canonicalize({ b: 1, a: 2 });
      const b = (service as any).canonicalize({ a: 2, b: 1 });
      expect(a).toEqual(b);
    });
  });
});
