/**
 * Lectures véhicules de l'API par fonctions SECURITY DEFINER (migration 20261026).
 *
 * Le backend PREPROD tourne en `anon` (ADR-028 option D) et la base a
 * `row_security=off` : un `.from()` sur auto_marque, auto_modele ou auto_type y
 * lève 42501. Les sept lectures de getBrands, getYearsByBrand, getModelsByBrand
 * et getTypesByModel passent donc par `callRpc`.
 *
 * Invariants couverts :
 *   - nom de fonction, arguments et contexte du gate (`source: 'api'`) ;
 *   - GET, `count: 'exact'` seulement là où l'ancienne lecture le demandait ;
 *   - mêmes filtres, tri et pagination qu'avant, hors filtre déjà appliqué par
 *     la fonction (marque, modèle, type_display de getTypesByModel) ;
 *   - erreur PostgREST relevée telle quelle (même valeur qu'un `.from()`), refus
 *     du gate relevé tel quel, aucune requête après un refus ;
 *   - `callRpc` sans options : appel `rpc(nom, params)` inchangé.
 *
 * Constructeur SupabaseBaseService contourné par Object.create ; `supabase.rpc`
 * rend un double qui enregistre la chaîne PostgREST appliquée.
 */

import { RpcBlockedError } from '@security/rpc-gate/rpc-gate.errors';
import { VehicleBrandsService } from '../../src/modules/vehicles/services/data/vehicle-brands.service';
import { VehicleModelsService } from '../../src/modules/vehicles/services/data/vehicle-models.service';
import { VehicleTypesService } from '../../src/modules/vehicles/services/data/vehicle-types.service';

type Step = [string, ...unknown[]];
type RpcResult = { data: unknown; error: unknown; count?: number | null };
type RpcCall = { name: string; args: unknown[]; chain: Step[] };

const API = { source: 'api', role: 'service_role' };

function makeSupabase(results: RpcResult[]) {
  const calls: RpcCall[] = [];
  const rpc = jest.fn((name: string, ...args: unknown[]) => {
    const call: RpcCall = { name, args, chain: [] };
    calls.push(call);
    const result = results[calls.length - 1] ?? { data: [], error: null };
    const builder: Record<string, unknown> = {
      then: (ok: (r: RpcResult) => unknown, ko: (e: unknown) => unknown) =>
        Promise.resolve(result).then(ok, ko),
    };
    for (const m of [
      'select',
      'eq',
      'not',
      'in',
      'or',
      'ilike',
      'limit',
      'range',
      'order',
    ]) {
      builder[m] = (...a: unknown[]) => {
        call.chain.push([m, ...a]);
        return builder;
      };
    }
    return builder;
  });
  return { rpc, calls };
}

function make<T>(
  proto: T,
  results: RpcResult[],
  decision: 'ALLOW' | 'BLOCK' = 'ALLOW',
) {
  const supabase = makeSupabase(results);
  const svc = Object.create(proto as object) as Record<string, unknown>;
  const logger = {
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
  };
  const rpcGate = {
    evaluate: jest.fn(() => ({ decision, reason: 'TEST' })),
    log: jest.fn(),
  };
  svc.logger = logger;
  svc.supabase = supabase;
  svc.rpcGate = rpcGate;
  svc.cacheService = {
    getOrSet: (_t: unknown, _k: string, fn: () => Promise<unknown>) => fn(),
  };
  svc.enrichmentService = {
    enrichVehicles: jest.fn(async (v: unknown[]) => v),
  };
  return { svc: svc as unknown as T, ...supabase, logger, rpcGate };
}

describe('VehicleBrandsService — lectures DEFINER', () => {
  it('getBrands par défaut : marques affichées, page 0, tri par nom', async () => {
    const rows = [{ marque_id: 1, marque_name: 'A' }];
    const { svc, calls, rpcGate } = make(VehicleBrandsService.prototype, [
      { data: rows, error: null },
    ]);
    const res = await svc.getBrands();
    expect(calls).toEqual([
      {
        name: 'get_vehicle_api_brands',
        args: [{}, { get: true }],
        chain: [
          ['select', '*'],
          ['eq', 'marque_display', 1],
          ['limit', 50],
          ['range', 0, 49],
          ['order', 'marque_name', { ascending: true }],
        ],
      },
    ]);
    expect(rpcGate.evaluate).toHaveBeenCalledWith(
      'get_vehicle_api_brands',
      API,
    );
    expect(res).toMatchObject({ data: rows, total: 0, page: 0, limit: 50 });
  });

  it('getBrands toutes, page 1, recherche : mêmes filtres que la lecture directe', async () => {
    const { svc, calls } = make(VehicleBrandsService.prototype, [
      { data: [], error: null },
    ]);
    await svc.getBrands({ includeAll: true, page: 1, limit: 3, search: 'b' });
    expect(calls[0].chain).toEqual([
      ['select', '*'],
      ['limit', 3],
      ['range', 3, 5],
      ['ilike', 'marque_name', '%b%'],
      ['order', 'marque_name', { ascending: true }],
    ]);
  });

  it('getYearsByBrand : modèles de la marque puis années des types affichés', async () => {
    const { svc, calls } = make(VehicleBrandsService.prototype, [
      { data: [{ modele_id: 501 }, { modele_id: 502 }], error: null },
      { data: [{ type_year_from: '2010', type_year_to: '2011' }], error: null },
    ]);
    await svc.getYearsByBrand(5);
    expect(calls).toEqual([
      {
        name: 'get_vehicle_api_brand_models',
        args: [{ p_marque_id: 5 }, { get: true }],
        chain: [['select', 'modele_id']],
      },
      {
        name: 'get_vehicle_api_types_by_models',
        args: [{ p_modele_ids: ['501', '502'] }, { get: true }],
        chain: [
          ['select', 'type_year_from, type_year_to'],
          ['eq', 'type_display', '1'],
          ['not', 'type_year_from', 'is', null],
          ['range', 0, 999],
        ],
      },
    ]);
  });

  it('erreur PostgREST : la valeur relevée et journalisée est celle de PostgREST', async () => {
    const raw = { message: 'boom', code: '42501', details: null, hint: null };
    const { svc, logger } = make(VehicleBrandsService.prototype, [
      { data: null, error: raw },
    ]);
    await expect(svc.getBrands()).rejects.toBe(raw);
    expect(logger.error).toHaveBeenCalledWith('Erreur getBrands:', raw);
  });
});

describe('VehicleModelsService — lectures DEFINER', () => {
  it('getModelsByBrand : 3 lectures, comptage exact sur la requête principale', async () => {
    const { svc, calls } = make(VehicleModelsService.prototype, [
      { data: [{ modele_id: 101 }, { modele_id: 102 }], error: null },
      {
        data: [
          {
            type_id: 1,
            type_modele_id: '101',
            type_year_from: '2008',
            type_year_to: '2012',
            type_fuel: 'Diesel',
          },
          {
            type_id: 2,
            type_modele_id: '102',
            type_year_from: '1990',
            type_year_to: '1995',
            type_fuel: 'Essence',
          },
        ],
        error: null,
      },
      { data: [{ modele_id: 101, modele_name: 'X' }], error: null, count: 1 },
    ]);
    const res = await svc.getModelsByBrand(1, { search: 'gi', year: 2010 });
    expect(calls.map((c) => [c.name, c.args])).toEqual([
      ['get_vehicle_api_brand_models', [{ p_marque_id: 1 }, { get: true }]],
      [
        'get_vehicle_api_types_by_models',
        [{ p_modele_ids: ['101', '102'] }, { get: true }],
      ],
      [
        'get_vehicle_api_brand_models',
        [{ p_marque_id: 1 }, { get: true, count: 'exact' }],
      ],
    ]);
    expect(calls[1].chain).toEqual([
      [
        'select',
        'type_id, type_modele_id, type_year_from, type_year_to, type_fuel',
      ],
      ['range', 0, 999],
    ]);
    expect(calls[2].chain).toEqual([
      ['select', '*'],
      ['in', 'modele_id', [101]],
      ['eq', 'modele_display', 1],
      ['or', 'modele_alias.ilike.%gi%,modele_name.ilike.%gi%'],
      ['limit', 50],
      ['range', 0, 49],
      ['order', 'modele_name'],
    ]);
    expect(res).toMatchObject({
      total: 1,
      data: [
        {
          modele_id: 101,
          motorisationsCount: 1,
          modele_fuel_types: ['Diesel'],
        },
      ],
    });
  });

  it('refus du gate : RpcBlockedError relevée telle quelle, aucune requête', async () => {
    const { svc, rpc } = make(VehicleModelsService.prototype, [], 'BLOCK');
    await expect(svc.getModelsByBrand(1)).rejects.toBeInstanceOf(
      RpcBlockedError,
    );
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('VehicleTypesService — lecture DEFINER', () => {
  it('getTypesByModel : modèle et type_display portés par la fonction', async () => {
    const { svc, calls } = make(VehicleTypesService.prototype, [
      { data: [{ type_id: 7 }], error: null },
    ]);
    const res = await svc.getTypesByModel(601, {
      search: '320',
      includeEngine: false,
    });
    expect(calls).toEqual([
      {
        name: 'get_vehicle_api_model_types',
        args: [{ p_modele_id: '601' }, { get: true }],
        chain: [
          ['select', '*'],
          ['limit', 50],
          ['range', 0, 49],
          ['ilike', 'type_name', '%320%'],
          ['order', 'type_name'],
        ],
      },
    ]);
    expect(res).toMatchObject({ data: [{ type_id: 7 }], total: 0 });
  });
});

describe('SupabaseBaseService.callRpc sans options', () => {
  it('appelle rpc(nom, params) avec deux arguments, comme avant', async () => {
    const { svc, rpc } = make(VehicleTypesService.prototype, [
      { data: { ok: true }, error: null },
    ]);
    const callRpc = (
      svc as unknown as {
        callRpc: (n: string, p: Record<string, unknown>) => Promise<RpcResult>;
      }
    ).callRpc.bind(svc);
    const res = await callRpc('une_fonction', { a: 1 });
    expect(rpc.mock.calls).toEqual([['une_fonction', { a: 1 }]]);
    expect(res).toEqual({ data: { ok: true }, error: null, count: undefined });
  });
});
