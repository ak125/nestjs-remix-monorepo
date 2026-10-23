/**
 * Ordre des requêtes paginées de `getModelsByBrand` : lots `auto_type` et pages
 * `auto_modele`. Le faux client applique filtres, tri et plage comme PostgREST,
 * et rend les lignes ex æquo (ou non triées) dans un ordre qui change d'une page
 * à l'autre, comme PostgreSQL peut le faire sans ORDER BY total.
 */
import { Logger } from '@nestjs/common';

type Row = Record<string, unknown>;
type Call = [string, unknown[]];

const MODELS: Row[] = [
  { modele_id: 4, modele_name: 'Gamma', modele_display: 1 },
  { modele_id: 3, modele_name: 'Beta', modele_display: 1 },
  { modele_id: 1, modele_name: 'Alpha', modele_display: 1 },
  { modele_id: 2, modele_name: 'Beta', modele_display: 1 },
].map((m) => ({ ...m, modele_marque_id: 7 }));

// 2 500 motorisations en trois lots, réparties par blocs (800, 800, 600, 300)
// pour qu'un recouvrement de lots ne se compense pas d'un modèle à l'autre.
const FUELS = ['Diesel', 'Essence', 'GPL'];
const modelOf = (i: number) => (i < 800 ? 1 : i < 1600 ? 2 : i < 2200 ? 3 : 4);
const TYPES: Row[] = Array.from({ length: 2500 }, (_, i) => ({
  type_id: String(100000 + i),
  type_modele_id: String(modelOf(i)),
  type_year_from: '2000',
  type_year_to: '2020',
  type_fuel: FUELS[i % 3],
}));

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const [x, y] = [String(a), String(b)];
  return x < y ? -1 : x > y ? 1 : 0;
}

function run(table: string, calls: Call[]) {
  let rows = table === 'auto_type' ? TYPES : MODELS;
  const orders: string[] = [];
  let offset = 0;
  let size = Infinity;
  let countExact = false;
  for (const [method, args] of calls) {
    if (method === 'eq') {
      rows = rows.filter(
        (r) => String(r[args[0] as string]) === String(args[1]),
      );
    } else if (method === 'in') {
      const set = new Set((args[1] as unknown[]).map(String));
      rows = rows.filter((r) => set.has(String(r[args[0] as string])));
    } else if (method === 'order') {
      orders.push(args[0] as string);
    } else if (method === 'range') {
      offset = args[0] as number;
      size = (args[1] as number) - offset + 1;
    } else if (method === 'select') {
      countExact = (args[1] as { count?: string })?.count === 'exact';
    }
  }
  // Ordre « physique » différent selon la page demandée.
  const page = Number.isFinite(size) ? Math.floor(offset / size) : 0;
  const scanned = page % 2 === 1 ? [...rows].reverse() : [...rows];
  const sorted = scanned.sort((a, b) => {
    for (const column of orders) {
      const c = compare(a[column], b[column]);
      if (c !== 0) return c;
    }
    return 0;
  });
  const end = Number.isFinite(size) ? offset + size : undefined;
  return {
    data: sorted.slice(offset, end),
    error: null,
    count: countExact ? rows.length : null,
  };
}

const ordersByTable: Record<string, string[][]> = {};
const mockClient = {
  from: jest.fn((table: string) => {
    const calls: Call[] = [];
    const chain: Record<string, unknown> = {};
    for (const method of [
      'select',
      'eq',
      'in',
      'or',
      'limit',
      'range',
      'order',
    ]) {
      chain[method] = (...args: unknown[]) => {
        calls.push([method, args]);
        return chain;
      };
    }
    chain.then = (
      resolve: (v: unknown) => unknown,
      reject: (e: unknown) => unknown,
    ) => {
      (ordersByTable[table] ??= []).push(
        calls.filter(([m]) => m === 'order').map(([, a]) => a[0] as string),
      );
      return Promise.resolve(run(table, calls)).then(resolve, reject);
    };
    return chain;
  }),
};

jest.mock('@repo/database-types', () => ({
  TABLES: { auto_modele: 'auto_modele', auto_type: 'auto_type' },
}));

jest.mock('@database/services/supabase-base.service', () => ({
  SupabaseBaseService: class {
    protected client = mockClient;
    constructor(..._args: unknown[]) {}
  },
}));

import { VehicleModelsService } from './vehicle-models.service';

describe('VehicleModelsService.getModelsByBrand — ordre des lots et des pages', () => {
  let service: VehicleModelsService;

  beforeEach(() => {
    for (const key of Object.keys(ordersByTable)) delete ordersByTable[key];
    for (const level of ['log', 'debug', 'error', 'warn'] as const) {
      jest.spyOn(Logger.prototype, level).mockImplementation(() => undefined);
    }
    const cacheService = {
      getOrSet: jest.fn((_t: unknown, _k: string, fn: () => unknown) => fn()),
    };
    service = new VehicleModelsService(cacheService as never);
  });

  afterEach(() => jest.restoreAllMocks());

  it('lots auto_type en ordre total (modèle, type_id) : chaque motorisation comptée une fois', async () => {
    const result = await service.getModelsByBrand(7, { page: 0, limit: 10 });
    const counts = Object.fromEntries(
      result.data.map((m) => [m.modele_id, m.motorisationsCount]),
    );
    expect(counts).toEqual({ 1: 800, 2: 800, 3: 600, 4: 300 });
    expect(ordersByTable.auto_type).toEqual([
      ['type_modele_id', 'type_id'],
      ['type_modele_id', 'type_id'],
      ['type_modele_id', 'type_id'],
    ]);
  });

  it('pages successives : ni doublon ni omission, tri nom puis modele_id', async () => {
    const seen: unknown[] = [];
    for (let page = 0; page < 3; page += 1) {
      const result = await service.getModelsByBrand(7, { page, limit: 2 });
      expect(result.total).toBe(4);
      seen.push(...result.data.map((m) => m.modele_id));
    }
    expect(seen).toEqual([1, 2, 3, 4]);
    expect(ordersByTable.auto_modele.filter((o) => o.length > 0)).toEqual([
      ['modele_name', 'modele_id'],
      ['modele_name', 'modele_id'],
      ['modele_name', 'modele_id'],
    ]);
  });

  it('types de carburant dans l’ordre des type_id, identiques d’un appel à l’autre', async () => {
    const first = await service.getModelsByBrand(7, { page: 0, limit: 10 });
    const second = await service.getModelsByBrand(7, { page: 0, limit: 10 });
    expect(first).toEqual(second);
    const fuels = Object.fromEntries(
      first.data.map((m) => [m.modele_id, m.modele_fuel_types]),
    );
    expect(fuels).toEqual({
      1: ['Diesel', 'Essence', 'GPL'],
      2: ['GPL', 'Diesel', 'Essence'],
      3: ['Essence', 'GPL', 'Diesel'],
      4: ['Essence', 'GPL', 'Diesel'],
    });
  });
});
