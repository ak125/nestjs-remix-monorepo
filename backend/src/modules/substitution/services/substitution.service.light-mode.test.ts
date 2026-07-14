import { SubstitutionService } from './substitution.service';
import { SubstitutionDataResponse } from '../types/substitution.types';

/**
 * PR #4 (audit LCP 2026-07-14 §2A) — projection status-only du moteur de
 * substitution. Le hub gamme SSR ne lit que httpStatus/type et jette `lock` ;
 * `lock.options` (jusqu'à ~5 300 motorisations ≈ 1,1 Mo) n'a aucun consommateur.
 * `checkSubstitution(url, ua, { includeVehicleOptions:false })` doit produire le
 * MÊME résultat, sans peupler `lock.options`.
 */

const RPC_DATA: SubstitutionDataResponse = {
  _meta: {
    gamme_found: true,
    resolved_by: 'exact',
    products_count: 5,
    vehicle_found: false,
  },
  gamme: {
    pg_id: 7,
    pg_name: 'Filtre à huile',
    pg_alias: 'filtre-a-huile',
    mf_id: 1,
    mf_name: 'Filtration',
  },
  compatible_motors: [
    {
      type_id: 101,
      type_name: 'Clio III 1.5 dCi',
      type_alias: 'clio-iii-1-5-dci',
      type_fuel: 'Diesel',
      type_power_ps: '90',
      type_year_from: '2005',
      type_year_to: null,
      type_body: 'Berline',
    },
    { type_id: 102, type_name: 'Clio III 1.4', type_alias: 'clio-iii-1-4' },
  ],
} as SubstitutionDataResponse;

function makeService(): SubstitutionService {
  // Bypass du constructeur SupabaseBaseService : on n'a besoin que des collaborateurs
  // touchés par checkSubstitution (intent, logger async, callRpc stubbé).
  const service = Object.create(
    SubstitutionService.prototype,
  ) as SubstitutionService;

  (service as unknown as { intentExtractor: unknown }).intentExtractor = {
    isSuspiciousBot: () => false,
    extractFromPathname: () => ({
      gammeId: 7,
      gammeAlias: 'filtre-a-huile',
      marqueAlias: null,
      modeleAlias: null,
      typeAlias: null,
      typeId: undefined,
    }),
  };
  (service as unknown as { substitutionLogger: unknown }).substitutionLogger = {
    logAsync: jest.fn(),
  };
  (service as unknown as { logger: unknown }).logger = {
    debug: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
  };
  (service as unknown as { callRpc: unknown }).callRpc = jest
    .fn()
    .mockResolvedValue({ data: RPC_DATA, error: null });

  return service;
}

const URL = '/pieces/filtre-a-huile-7.html';

describe('SubstitutionService — projection status-only (includeVehicleOptions)', () => {
  it('mode plein (défaut) : lock.options peuplé avec les motorisations', async () => {
    const service = makeService();
    const r = await service.checkSubstitution(URL, '');

    expect(r.httpStatus).toBe(200);
    expect(r.type).toBe('vehicle_incomplete');
    expect(r.lock?.options).toHaveLength(2);
    expect(r.lock?.options?.[0]).toMatchObject({ id: 101 });
  });

  it('mode léger (includeVehicleOptions:false) : lock.options VIDE, tout le reste identique', async () => {
    const service = makeService();
    const full = await service.checkSubstitution(URL, '');
    const light = await service.checkSubstitution(URL, '', {
      includeVehicleOptions: false,
    });

    // Le cœur du fix : plus de liste lourde.
    expect(light.lock?.options).toEqual([]);

    // httpStatus / type / message / lock.type / lock.known STRICTEMENT préservés.
    expect(light.httpStatus).toBe(full.httpStatus);
    expect(light.type).toBe(full.type);
    expect(light.message).toBe(full.message);
    expect(light.lock?.type).toBe('vehicle');
    expect(light.lock?.known).toEqual(full.lock?.known);
    expect(light.seo).toEqual(full.seo);
  });

  it("mode léger n'altère pas le routing 404 (gamme non trouvée)", async () => {
    const service = makeService();
    (service as unknown as { callRpc: jest.Mock }).callRpc.mockResolvedValue({
      data: {
        _meta: {
          gamme_found: false,
          resolved_by: 'none',
          products_count: 0,
          vehicle_found: false,
        },
      },
      error: null,
    });

    const light = await service.checkSubstitution(URL, '', {
      includeVehicleOptions: false,
    });
    expect(light.httpStatus).toBe(404);
    expect(light.type).toBe('unknown_slug');
  });
});
