// backend/src/modules/rm/services/__tests__/rm-alternatives.service.test.ts
import { Test, TestingModule } from '@nestjs/testing';
import { RmAlternativesService } from '../rm-alternatives.service';
// ↑ This import WILL fail in TDD red — the service does not exist yet. That's intentional.

import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { CacheService } from '@cache/cache.service';

describe('RmAlternativesService', () => {
  let service: RmAlternativesService;
  let cacheMock: jest.Mocked<Partial<CacheService>>;
  let supabaseMock: any;

  beforeEach(async () => {
    cacheMock = {
      get: jest.fn(),
      set: jest.fn(),
    };
    const builder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };
    supabaseMock = { from: jest.fn(() => builder), rpc: jest.fn(), __builder: builder };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RmAlternativesService,
        { provide: SupabaseBaseService, useValue: { client: supabaseMock } },
        { provide: CacheService, useValue: cacheMock },
      ],
    }).compile();
    service = module.get<RmAlternativesService>(RmAlternativesService);
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
      expect(cacheMock.get).toHaveBeenCalledWith('alt:11836:3859:v1');
      expect(supabaseMock.from).not.toHaveBeenCalled();
      expect(result).toEqual(cached);
    });

    it('produit un etag sha256-stable et écrit dans le cache (cache miss)', async () => {
      cacheMock.get!.mockResolvedValue(null);
      supabaseMock.__builder.single.mockResolvedValue({ data: null, error: null });
      const r1 = await service.compute(11836, 3859, 12);
      const r2 = await service.compute(11836, 3859, 12);
      expect(r1.etag).toMatch(/^sha256-[0-9a-f]{64}$/);
      expect(r1.etag).toEqual(r2.etag);
      expect(cacheMock.set).toHaveBeenCalled();
    });

    it('attribue tier=1 aux véhicules du même modele_id', async () => {
      const ranking = await (service as any).rankVehicles(
        [
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
            modele_parent: null,
            marque_id: 33,
            marque_name: 'BMW',
            marque_alias: 'bmw',
            power_ps_num: 258,
          },
          {
            type_id: '99999',
            type_name: 'x',
            type_alias: null,
            type_fuel: '',
            type_power_ps: '150',
            type_year_from: '',
            type_year_to: '',
            modele_id: 12345,
            modele_name: 'y',
            modele_alias: 'z',
            modele_parent: null,
            marque_id: 33,
            marque_name: 'BMW',
            marque_alias: 'bmw',
            power_ps_num: 150,
          },
        ],
        {
          target_type_id: 11836,
          target_modele_id: 33053,
          target_modele_parent: null,
          target_marque_id: 33,
          target_power_ps: 218,
        },
      );
      expect(ranking[0].tier).toBe(1);
      expect(ranking[0].type_id).toBe('11838');
    });

    it("filtre les véhicules qui n'ont aucune relation pieces_relation_type (compat-aware)", async () => {
      cacheMock.get!.mockResolvedValue(null);
      supabaseMock.__builder.single.mockResolvedValue({ data: null, error: null });
      await service.compute(11836, 3859, 12);
      const fromCalls = supabaseMock.from.mock.calls.map((c: any[]) => c[0]);
      expect(fromCalls).toEqual(expect.arrayContaining(['pieces_relation_type']));
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
