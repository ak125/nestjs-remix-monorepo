// SupabaseBaseService lit ces variables dans son constructeur ; en test, un stub
// minimal suffit (même canon que rm-soft404-tracker.service.test.ts).
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY || 'test-service-key';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { SupabaseRpcError } from '@security/rpc-gate/rpc-gate.errors';
import type { RpcGateService } from '@security/rpc-gate/rpc-gate.service';
import type { VehicleCacheService } from '../core/vehicle-cache.service';
import { VehicleBrandsService } from './vehicle-brands.service';
import { VehicleModelsService } from './vehicle-models.service';

/** Cache transparent : exécute la lecture, comme un cache vide. */
const passThroughCache = () =>
  ({
    getOrSet: jest.fn((_type: unknown, _key: string, factory: () => unknown) =>
      factory(),
    ),
  }) as unknown as VehicleCacheService;

const noGate = undefined as unknown as RpcGateService;

/** Requête PostgREST factice : enregistre les appels du `refine`. */
function recordRefine(refine: (query: unknown) => unknown): string[] {
  const calls: string[] = [];
  const query: Record<string, (...args: unknown[]) => unknown> = {};
  for (const method of [
    'select',
    'in',
    'eq',
    'or',
    'range',
    'order',
    'limit',
  ]) {
    query[method] = (...args: unknown[]) => {
      calls.push(`${method}(${JSON.stringify(args).slice(1, -1)})`);
      return query;
    };
  }
  refine(query);
  return calls;
}

describe('VehicleModelsService.getModelsByBrand — page au-delà du total', () => {
  const rangeNotSatisfiable = new SupabaseRpcError({
    code: 'PGRST103',
    message: 'Requested range not satisfiable',
    details: 'An offset of 400 was requested, but there are only 188 rows.',
  });

  let service: VehicleModelsService;
  let callRpc: jest.Mock;

  /** Étapes 1 et 2 de la lecture : deux modèles, une motorisation chacun. */
  const mockBrandWithTwoModels = () =>
    callRpc
      .mockResolvedValueOnce({
        data: [{ modele_id: 140001 }, { modele_id: 140002 }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          { type_id: 1, type_modele_id: '140001', type_fuel: 'Diesel' },
          { type_id: 2, type_modele_id: '140002', type_fuel: 'Essence' },
        ],
        error: null,
      });

  beforeEach(() => {
    service = new VehicleModelsService(passThroughCache(), noGate);
    callRpc = jest.fn();
    (service as unknown as { callRpc: jest.Mock }).callRpc = callRpc;
  });

  it('rend une page vide et le vrai total au lieu de lever (500)', async () => {
    mockBrandWithTwoModels()
      .mockResolvedValueOnce({ data: null, error: rangeNotSatisfiable })
      .mockResolvedValueOnce({
        data: [{ modele_id: 140001, modele_name: 'CLIO' }],
        error: null,
        count: 188,
      });

    const result = await service.getModelsByBrand(140, {
      page: 2,
      limit: 200,
      search: 'clio',
    });

    expect(result).toEqual({
      success: true,
      data: [],
      total: 188,
      page: 2,
      limit: 200,
    });

    // La relecture du total est la requête de la page refusée, plage exceptée.
    const filters = [
      'in("modele_id",[140001,140002])',
      'eq("modele_display",1)',
      'or("modele_alias.ilike.%clio%,modele_name.ilike.%clio%")',
    ];
    expect(recordRefine(callRpc.mock.calls[2][3].refine)).toEqual([
      'select("*")',
      ...filters,
      'limit(200)',
      'range(400,599)',
      'order("modele_name")',
    ]);
    expect(recordRefine(callRpc.mock.calls[3][3].refine)).toEqual([
      'select("*")',
      ...filters,
      'limit(1)',
      'range(0,0)',
      'order("modele_name")',
    ]);
    expect(callRpc.mock.calls[3][3]).toMatchObject({
      get: true,
      count: 'exact',
    });
  });

  it('lève toute autre erreur de lecture de la page', async () => {
    const raw = { code: '57014', message: 'canceling statement' };
    mockBrandWithTwoModels().mockResolvedValueOnce({
      data: null,
      error: new SupabaseRpcError(raw),
    });

    await expect(service.getModelsByBrand(140, { page: 0 })).rejects.toBe(raw);
    expect(callRpc).toHaveBeenCalledTimes(3);
  });

  it('lève si la relecture du total échoue : pas de total inventé', async () => {
    const raw = { code: '57014', message: 'canceling statement' };
    mockBrandWithTwoModels()
      .mockResolvedValueOnce({ data: null, error: rangeNotSatisfiable })
      .mockResolvedValueOnce({ data: null, error: new SupabaseRpcError(raw) });

    await expect(service.getModelsByBrand(140, { page: 9 })).rejects.toBe(raw);
  });

  it('rend la page demandée quand elle existe, sans relecture', async () => {
    mockBrandWithTwoModels().mockResolvedValueOnce({
      data: [{ modele_id: 140001, modele_name: 'CLIO' }],
      error: null,
      count: 2,
    });

    const result = await service.getModelsByBrand(140, { page: 0, limit: 1 });

    expect(result.total).toBe(2);
    expect(result.data).toEqual([
      {
        modele_id: 140001,
        modele_name: 'CLIO',
        motorisationsCount: 1,
        modele_fuel_types: ['Diesel'],
      },
    ]);
    expect(callRpc).toHaveBeenCalledTimes(3);
  });
});

describe('VehicleBrandsService.getBrandByAlias — panne ≠ introuvable', () => {
  let service: VehicleBrandsService;
  let cache: VehicleCacheService;
  let callRpc: jest.Mock;

  beforeEach(() => {
    cache = passThroughCache();
    service = new VehicleBrandsService(cache, noGate);
    callRpc = jest.fn();
    (service as unknown as { callRpc: jest.Mock }).callRpc = callRpc;
  });

  it('rend la marque trouvée, lue par la fonction de lecture gouvernée', async () => {
    const brand = { marque_id: 140, marque_alias: 'renault' };
    callRpc.mockResolvedValue({ data: [brand], error: null });

    await expect(service.getBrandByAlias('Renault')).resolves.toBe(brand);

    const [rpcName, params, , read] = callRpc.mock.calls[0];
    expect(rpcName).toBe('get_vehicle_api_brands');
    expect(params).toEqual({});
    expect(read.get).toBe(true);
    expect(recordRefine(read.refine)).toEqual([
      'select("*")',
      'eq("marque_alias","renault")',
      'eq("marque_display",1)',
      'limit(2)',
    ]);
  });

  it('rend null quand aucune marque affichée ne porte cet alias', async () => {
    callRpc.mockResolvedValue({ data: [], error: null });

    await expect(service.getBrandByAlias('inconnue')).resolves.toBeNull();
  });

  it('rend null quand plusieurs marques portent cet alias', async () => {
    callRpc.mockResolvedValue({
      data: [{ marque_id: 1 }, { marque_id: 2 }],
      error: null,
    });

    await expect(service.getBrandByAlias('doublon')).resolves.toBeNull();
  });

  it('lève une erreur de lecture au lieu de la rendre comme une absence', async () => {
    const denied = { code: '42501', message: 'permission denied' };
    callRpc.mockResolvedValue({
      data: null,
      error: new SupabaseRpcError(denied),
    });

    await expect(service.getBrandByAlias('renault')).rejects.toBe(denied);
  });

  it('laisse remonter une exception du client', async () => {
    const down = new Error('fetch failed');
    callRpc.mockRejectedValue(down);

    await expect(service.getBrandByAlias('renault')).rejects.toBe(down);
  });

  it('ne lit pas la base pour un alias vide', async () => {
    await expect(service.getBrandByAlias('  ')).resolves.toBeNull();
    expect(cache.getOrSet).not.toHaveBeenCalled();
    expect(callRpc).not.toHaveBeenCalled();
  });
});
