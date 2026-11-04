import { SubstitutionService } from './substitution.service';
import { SubstitutionDataResponse } from '../types/substitution.types';

/**
 * PR #4 (audit LCP 2026-07-14 §2A) — projection status-only du moteur de
 * substitution. Le hub gamme SSR ne lit que httpStatus/type et jette `lock` ;
 * `lock.options` (jusqu'à ~5 300 motorisations ≈ 1,1 Mo) n'a aucun consommateur.
 * `checkSubstitution(url, ua, { includeVehicleOptions:false })` doit produire le
 * MÊME résultat, sans peupler `lock.options`.
 *
 * Mode léger servi par get_substitution_status (2026-10-30) : la RPC ne rend que
 * `_meta` et `gamme` de get_substitution_data (STATUS_DATA ci-dessous), les seuls
 * blocs lus pour httpStatus, type et lock.known.
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

// Ce que rend get_substitution_status pour la même gamme : `_meta` + `gamme`.
const STATUS_DATA: SubstitutionDataResponse = {
  _meta: RPC_DATA._meta,
  gamme: RPC_DATA.gamme,
};

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
  (service as unknown as { callRpc: unknown }).callRpc = jest.fn(
    (name: string) =>
      Promise.resolve({
        data: name === 'get_substitution_status' ? STATUS_DATA : RPC_DATA,
        error: null,
      }),
  );

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

  it('mode léger appelle get_substitution_status (gamme seule), mode plein get_substitution_data', async () => {
    const service = makeService();
    const callRpc = (service as unknown as { callRpc: jest.Mock }).callRpc;

    await service.checkSubstitution(URL, '', { includeVehicleOptions: false });
    expect(callRpc).toHaveBeenCalledTimes(1);
    expect(callRpc).toHaveBeenLastCalledWith(
      'get_substitution_status',
      { p_gamme_alias: 'filtre-a-huile', p_gamme_id: 7 },
      { source: 'api' },
    );

    await service.checkSubstitution(URL, '');
    expect(callRpc).toHaveBeenCalledTimes(2);
    expect(callRpc).toHaveBeenLastCalledWith(
      'get_substitution_data',
      {
        p_gamme_alias: 'filtre-a-huile',
        p_gamme_id: 7,
        p_marque_alias: null,
        p_modele_alias: null,
        p_type_alias: null,
      },
      { source: 'api' },
    );
  });

  it('mode léger : gamme trouvée sans produit → 410', async () => {
    const service = makeService();
    (service as unknown as { callRpc: jest.Mock }).callRpc.mockResolvedValue({
      data: {
        _meta: { ...STATUS_DATA._meta, products_count: 0 },
        gamme: STATUS_DATA.gamme,
      },
      error: null,
    });

    const light = await service.checkSubstitution(URL, '', {
      includeVehicleOptions: false,
    });
    expect(light.httpStatus).toBe(410);
    expect(light.type).toBe('gamme_empty');
    expect(light.seo?.h1).toBe('Filtre à huile - Temporairement indisponible');
  });

  it('mode léger : erreur ou exception de la RPC → fail-open 200, jamais 404', async () => {
    const service = makeService();
    const callRpc = (service as unknown as { callRpc: jest.Mock }).callRpc;

    callRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'function get_substitution_status does not exist' },
    });
    const onError = await service.checkSubstitution(URL, '', {
      includeVehicleOptions: false,
    });
    expect(onError.httpStatus).toBe(200);
    expect(onError.type).toBe('none');

    callRpc.mockRejectedValueOnce(new Error('timeout'));
    const onThrow = await service.checkSubstitution(URL, '', {
      includeVehicleOptions: false,
    });
    expect(onThrow.httpStatus).toBe(200);
    expect(onThrow.type).toBe('none');
  });
});
