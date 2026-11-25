/**
 * Sélection R8 commune (hub constructeurs + sitemap-vehicules.xml) et filtre
 * robots de la page servie. Client Supabase factice, aucune I/O réseau.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { invalidateValidTypeIdsCache } from './auto-type-valid-ids.helper';
import {
  collectR8VehicleUrls,
  filterR8ByServedRobots,
  r8RobotsVerdict,
} from './r8-vehicle-selection.helper';

type Result = { data: unknown[] | null; error: { message: string } | null };

/** `pages[table]` = résultats successifs (un par appel `range`/lecture). */
function fakeClient(pages: Record<string, Result[]>) {
  const calls: Record<string, string[]> = {};
  const client = {
    from(table: string) {
      calls[table] = calls[table] ?? [];
      const q: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'gt', 'in', 'range']) {
        q[m] = (...args: unknown[]) => {
          calls[table].push(`${m}:${JSON.stringify(args)}`);
          return q;
        };
      }
      q.then = (resolve: (r: Result) => unknown) =>
        resolve(pages[table]?.shift() ?? { data: [], error: null });
      return q;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const link = (
  typeId: number,
  over: Partial<Record<string, unknown>> = {},
): Record<string, unknown> => ({
  map_marque_alias: 'Renault',
  map_marque_id: 140,
  map_modele_alias: 'Clio III',
  map_modele_id: 140004,
  map_type_alias: '1-5-dci',
  map_type_id: typeId,
  ...over,
});

const BASE = 'https://example.test';

beforeEach(() => invalidateValidTypeIdsCache());

describe('collectR8VehicleUrls', () => {
  it('filtre orphelins, modèle périmé, alias absent, doublon et URL malformée', async () => {
    const { client, calls } = fakeClient({
      auto_type: [
        {
          data: [
            { type_id_i: 1, type_modele_id: '140004' },
            { type_id_i: 2, type_modele_id: '999' }, // rattaché ailleurs
            { type_id_i: 4, type_modele_id: '140004' },
            { type_id_i: 5, type_modele_id: '140004' },
          ],
          error: null,
        },
      ],
      __sitemap_p_link: [
        {
          data: [
            link(1),
            link(1), // doublon
            link(2), // stale_model
            link(3), // orphelin
            link(4, { map_type_alias: null }), // alias absent
            link(5, { map_modele_alias: 'null' }), // segment null-140004
          ],
          error: null,
        },
      ],
    });
    const sel = await collectR8VehicleUrls(client, BASE);
    expect(sel.entries).toEqual([
      {
        url: `${BASE}/constructeurs/renault-140/clio-iii-140004/1-5-dci-1.html`,
        typeId: 1,
      },
    ]);
    expect(sel).toMatchObject({
      uniqueCount: 2,
      skippedOrphans: 1,
      skippedStaleModel: 1,
      skippedMalformed: 1,
      readError: null,
    });
    expect(calls.__sitemap_p_link).toEqual(
      expect.arrayContaining(['gt:["map_has_item",5]', 'range:[0,999]']),
    );
  });

  it('pagine par 1000 tant que la page est pleine', async () => {
    const full = Array.from({ length: 1000 }, (_, i) => link(10000 + i));
    const { client, calls } = fakeClient({
      auto_type: [
        {
          data: [...full, link(20000)].map((l) => ({
            type_id_i: l.map_type_id,
            type_modele_id: '140004',
          })),
          error: null,
        },
      ],
      __sitemap_p_link: [
        { data: full, error: null },
        { data: [link(20000)], error: null },
      ],
    });
    const sel = await collectR8VehicleUrls(client, BASE);
    expect(sel.entries).toHaveLength(1001);
    expect(sel.scannedRows).toBe(2000);
    expect(calls.__sitemap_p_link.filter((c) => c.startsWith('range'))).toEqual(
      ['range:[0,999]', 'range:[1000,1999]'],
    );
  });

  it('erreur __sitemap_p_link : liste partielle et readError (hub inchangé)', async () => {
    const full = Array.from({ length: 1000 }, (_, i) => link(10000 + i));
    const { client } = fakeClient({
      auto_type: [
        {
          data: full.map((l) => ({
            type_id_i: l.map_type_id,
            type_modele_id: '140004',
          })),
          error: null,
        },
      ],
      __sitemap_p_link: [
        { data: full, error: null },
        { data: null, error: { message: 'timeout' } },
      ],
    });
    const sel = await collectR8VehicleUrls(client, BASE);
    expect(sel.entries).toHaveLength(1000);
    expect(sel.readError).toEqual({ offset: 1000, message: 'timeout' });
  });

  it('erreur auto_type : levée, jamais une sélection vide', async () => {
    const { client } = fakeClient({
      auto_type: [{ data: null, error: { message: 'timeout' } }],
    });
    await expect(collectR8VehicleUrls(client, BASE)).rejects.toThrow(
      'auto_type read failed',
    );
  });
});

describe('r8RobotsVerdict — règle robots de la page R8 servie', () => {
  const fresh = (is_indexable: unknown) => ({
    type_id: 1,
    stale: false,
    is_indexable,
  });

  it.each([
    [12345, 'index', fresh(true)],
    [12345, 'not_indexable', fresh(false)],
    [12345, 'not_indexable', fresh(null)],
    [12345, 'stale_cache', { type_id: 1, stale: true, is_indexable: true }],
    [12345, 'no_cache', undefined],
    [59999, 'index', fresh(true)],
    [60000, 'tecdoc_gate', fresh(true)],
    [83456, 'tecdoc_gate', fresh(true)],
    [83457, 'index', fresh(true)],
  ] as const)('type %i ⇒ %s', (typeId, verdict, row) => {
    expect(r8RobotsVerdict(typeId, row)).toBe(verdict);
  });
});

describe('filterR8ByServedRobots', () => {
  const entry = (typeId: number) => ({ url: `${BASE}/r8-${typeId}`, typeId });

  it('garde les seules pages index, compte les écartées, ne lit pas la plage TecDoc', async () => {
    const { client, calls } = fakeClient({
      __vehicle_page_cache: [
        {
          data: [
            { type_id: 1, stale: false, is_indexable: true },
            { type_id: 2, stale: false, is_indexable: false },
            { type_id: 4, stale: true, is_indexable: true },
          ],
          error: null,
        },
      ],
    });
    const { kept, excluded } = await filterR8ByServedRobots(client, [
      entry(1),
      entry(2),
      entry(3),
      entry(4),
      entry(70000),
    ]);
    expect(kept).toEqual([entry(1)]);
    expect(excluded).toEqual({
      tecdoc_gate: 1,
      not_indexable: 1,
      no_cache: 1,
      stale_cache: 1,
    });
    expect(calls.__vehicle_page_cache).toEqual([
      'select:["type_id, stale, is_indexable:payload->seo_validation->is_indexable"]',
      'in:["type_id",[1,2,3,4]]',
    ]);
  });

  it('lit le cache par paquets de 500', async () => {
    const entries = Array.from({ length: 1200 }, (_, i) => entry(i + 1));
    const { client, calls } = fakeClient({});
    await filterR8ByServedRobots(client, entries);
    expect(
      calls.__vehicle_page_cache.filter((c) => c.startsWith('in')),
    ).toHaveLength(3);
  });

  it('erreur de lecture du cache : levée', async () => {
    const { client } = fakeClient({
      __vehicle_page_cache: [{ data: null, error: { message: 'timeout' } }],
    });
    await expect(filterR8ByServedRobots(client, [entry(1)])).rejects.toThrow(
      '__vehicle_page_cache read failed',
    );
  });
});
