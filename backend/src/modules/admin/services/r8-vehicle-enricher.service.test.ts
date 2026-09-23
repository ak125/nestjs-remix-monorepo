/**
 * Tests — R8 vehicle enricher: reading the REAL `get_vehicle_page_data_cached`
 * payload shape (parts families + engine / CNIT codes).
 *
 * The fixture below is a REDUCED copy of the real cached payload of type 19053
 * (Renault Clio III 1.5 dCi 106 ch), read-only extract of
 * `__vehicle_page_cache.payload` on 2026-09-23:
 *   - kept: every top-level key the enricher reads, the vehicle identity fields,
 *     the first 3 of 19 families with their first 2 gammes (`gammes_count` set
 *     to the reduced list length; real values 4 / 11 / 10 — on the whole cache
 *     `gammes_count === gammes.length` for 412 696 / 412 696 family rows),
 *     the first 3 of 6 popular_parts, the first 4 of 48 CNIT codes;
 *   - `motor_codes` is `[]` in the cache (frozen since 2026-04-25, all 28 505
 *     rows), while `build_vehicle_page_payload` (STABLE) recomputes
 *     `["K9K 764","K9K 774"]` for this type — both variants are tested.
 * No personal data: catalogue identifiers only.
 */

import { R8VehicleEnricherService } from './r8-vehicle-enricher.service';
import {
  extractCatalogFamiliesFromRpc,
  extractGammeSourceFromRpc,
  extractVehicleCodesFromRpc,
} from './r8-owned-editorial.composer';

const CACHED_PAYLOAD_19053 = {
  success: true,
  type_id: 19053,
  vehicle: {
    marque_name: 'RENAULT',
    marque_alias: 'renault',
    modele_id: 140004,
    modele_name: 'CLIO III',
    modele_alias: 'clio-iii',
    type_name: '1.5 dCi',
    type_fuel: 'Diesel',
    type_engine: 'Diesel',
    type_power_ps: '106',
    type_year_from: '2005',
    type_year_to: '2014',
  },
  catalog: {
    total_families: 19,
    total_gammes: 116,
    families: [
      {
        mf_id: '1',
        mf_name: 'Système de filtration',
        gammes_count: 2,
        gammes: [
          { pg_id: 7, pg_alias: 'filtre-a-huile', pg_name: 'Filtre à huile' },
          { pg_id: 8, pg_alias: 'filtre-a-air', pg_name: 'Filtre à air' },
        ],
      },
      {
        mf_id: '2',
        mf_name: 'Système de freinage',
        gammes_count: 2,
        gammes: [
          {
            pg_id: 402,
            pg_alias: 'plaquette-de-frein',
            pg_name: 'Plaquette de frein',
          },
          {
            pg_id: 82,
            pg_alias: 'disque-de-frein',
            pg_name: 'Disque de frein',
          },
        ],
      },
      {
        mf_id: '3',
        mf_name: 'Courroie, galet, poulie et chaîne',
        gammes_count: 2,
        gammes: [
          {
            pg_id: 10,
            pg_alias: 'courroie-d-accessoire',
            pg_name: "Courroie d'accessoire",
          },
          {
            pg_id: 310,
            pg_alias: 'galet-tendeur-de-courroie-d-accessoire',
            pg_name: "Galet tendeur de courroie d'accessoire",
          },
        ],
      },
    ],
  },
  popular_parts: [
    {
      pg_id: 3213,
      pg_alias: 'poulie-vilebrequin',
      pg_name: 'Poulie vilebrequin',
    },
    {
      pg_id: 402,
      pg_alias: 'plaquette-de-frein',
      pg_name: 'Plaquette de frein',
    },
    {
      pg_id: 424,
      pg_alias: 'filtre-d-habitacle',
      pg_name: "Filtre d'habitacle",
    },
  ],
  motor_codes: [] as string[],
  cnit_codes: ['3333161', '3333AAL', '3333AKL', 'BR1H06'],
  mine_codes: ['D', 'F'],
};

/** Same payload once the cache is rebuilt (builder output for motor_codes). */
const REBUILT_PAYLOAD_19053 = {
  ...CACHED_PAYLOAD_19053,
  motor_codes: ['K9K 764', 'K9K 774'],
};

const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o)) as T;

// ── Pure payload readers (single source of truth for the shape) ────────────

describe('extractCatalogFamiliesFromRpc', () => {
  it('reads catalog.families of the real payload (non-empty, with gammes)', () => {
    const fams = extractCatalogFamiliesFromRpc(CACHED_PAYLOAD_19053);
    expect(fams).not.toBeNull();
    expect(fams!.map((f) => f.family_name)).toEqual([
      'Système de filtration',
      'Système de freinage',
      'Courroie, galet, poulie et chaîne',
    ]);
    expect(fams!.map((f) => f.gammes_count)).toEqual([2, 2, 2]);
    expect(fams![1].gammes).toHaveLength(2);
    expect(fams![0].mf_id).toBe('1');
  });

  it('returns null when catalog.families is missing, [] when empty', () => {
    expect(extractCatalogFamiliesFromRpc(null)).toBeNull();
    expect(extractCatalogFamiliesFromRpc({ vehicle: {} })).toBeNull();
    expect(extractCatalogFamiliesFromRpc({ catalog: {} })).toBeNull();
    expect(
      extractCatalogFamiliesFromRpc({ catalog: { families: [] } }),
    ).toEqual([]);
  });

  it('ignores the legacy keys that never existed in the payload', () => {
    expect(
      extractCatalogFamiliesFromRpc({
        compatible_families: [{ pg_id: 1 }],
        families: [{ pg_id: 2 }],
      }),
    ).toBeNull();
  });
});

describe('extractVehicleCodesFromRpc', () => {
  it('reads CNIT codes at the payload top level (cached payload)', () => {
    const codes = extractVehicleCodesFromRpc(CACHED_PAYLOAD_19053);
    expect(codes.cnitCodes).toEqual([
      '3333161',
      '3333AAL',
      '3333AKL',
      'BR1H06',
    ]);
    // Present but empty in the frozen cache — distinct from "missing" (null).
    expect(codes.engineCodes).toEqual([]);
  });

  it('reads engine codes from motor_codes once present (rebuilt payload)', () => {
    expect(
      extractVehicleCodesFromRpc(REBUILT_PAYLOAD_19053).engineCodes,
    ).toEqual(['K9K 764', 'K9K 774']);
  });

  it('returns null for missing keys, never reads vehicle.* or mine_codes', () => {
    const codes = extractVehicleCodesFromRpc({
      vehicle: { engine_codes: ['X'], cnit_codes: ['Y'] },
      mine_codes: ['D', 'F'],
    });
    expect(codes).toEqual({ engineCodes: null, cnitCodes: null });
  });

  it('drops blanks, non-strings and duplicates, keeps order', () => {
    expect(
      extractVehicleCodesFromRpc({
        motor_codes: ['K9K 764', ' ', 3, 'K9K 764', ' K9K 774 '],
        cnit_codes: [],
      }),
    ).toEqual({ engineCodes: ['K9K 764', 'K9K 774'], cnitCodes: [] });
  });
});

describe('extractGammeSourceFromRpc on the real payload', () => {
  it('uses popular_parts first', () => {
    expect(
      extractGammeSourceFromRpc(CACHED_PAYLOAD_19053).map((g) => g.pg_id),
    ).toEqual([3213, 402, 424]);
  });

  it('flattens catalog.families gammes when popular_parts is empty', () => {
    const out = extractGammeSourceFromRpc({
      ...CACHED_PAYLOAD_19053,
      popular_parts: [],
    });
    expect(out.map((g) => g.pg_id)).toEqual([7, 8, 402, 82, 10, 310]);
    // Source-order proxy unchanged (1000 - index in the flattened list).
    expect(out[0].product_count).toBe(1000);
    expect(out[5].product_count).toBe(995);
  });
});

// ── Enricher wiring ────────────────────────────────────────────────────────

type EnricherInternals = {
  logger: { log: jest.Mock; warn: jest.Mock; error: jest.Mock };
  callRpc: jest.Mock;
  fetchVehicleData: (typeId: number) => Promise<Record<string, any> | null>;
  composeBlocks: (...args: unknown[]) => Array<{
    id: string;
    renderedText: string;
    semanticPayload: string[];
  }>;
};

/** Object.create bypasses the SupabaseBaseService ctor (env), as in r8-parent-enrichment.test.ts. */
function makeEnricher(payload: unknown): EnricherInternals {
  const svc = Object.create(
    R8VehicleEnricherService.prototype,
  ) as EnricherInternals;
  svc.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  svc.callRpc = jest.fn().mockResolvedValue({ data: payload, error: null });
  return svc;
}

describe('R8VehicleEnricherService.fetchVehicleData — codes', () => {
  it('maps top-level motor_codes / cnit_codes onto vehicle, no warn', async () => {
    const svc = makeEnricher(clone(REBUILT_PAYLOAD_19053));
    const data = await svc.fetchVehicleData(19053);
    expect(data!.vehicle.engine_codes).toEqual(['K9K 764', 'K9K 774']);
    expect(data!.vehicle.cnit_codes).toEqual([
      '3333161',
      '3333AAL',
      '3333AKL',
      'BR1H06',
    ]);
    // mine_codes deliberately not mapped (semantics of ["D","F"] unverified).
    expect(data!.vehicle.mine_codes).toBeUndefined();
    expect(svc.logger.warn).not.toHaveBeenCalled();
  });

  it('warns with typeId when motor_codes / cnit_codes keys are missing', async () => {
    const payload = clone(CACHED_PAYLOAD_19053) as Record<string, unknown>;
    delete payload.motor_codes;
    delete payload.cnit_codes;
    const svc = makeEnricher(payload);
    const data = await svc.fetchVehicleData(19053);
    expect(data!.vehicle.engine_codes).toEqual([]);
    expect(data!.vehicle.cnit_codes).toEqual([]);
    const warned = svc.logger.warn.mock.calls.map((c) => String(c[0]));
    expect(warned).toEqual([
      expect.stringContaining('key=motor_codes typeId=19053'),
      expect.stringContaining('key=cnit_codes typeId=19053'),
    ]);
  });

  it('does not warn when codes are present but empty (frozen cache)', async () => {
    const svc = makeEnricher(clone(CACHED_PAYLOAD_19053));
    const data = await svc.fetchVehicleData(19053);
    expect(data!.vehicle.engine_codes).toEqual([]);
    expect(svc.logger.warn).not.toHaveBeenCalled();
  });
});

describe('R8VehicleEnricherService.composeBlocks — real families and codes', () => {
  async function blocksFor(payload: unknown) {
    const svc = makeEnricher(clone(payload));
    const data = await svc.fetchVehicleData(19053);
    const families = extractCatalogFamiliesFromRpc(data)!;
    const blocks = svc.composeBlocks(
      { ...data!.vehicle, type_id: 19053 },
      families,
      [],
      {},
      [],
      [],
      false,
      [],
      'r8_vehicle_19053',
    );
    return new Map(blocks.map((b) => [b.id, b]));
  }

  it('emits S_CATALOG_ACCESS from catalog.families with real gamme counts', async () => {
    const byId = await blocksFor(CACHED_PAYLOAD_19053);
    const cat = byId.get('S_CATALOG_ACCESS');
    expect(cat).toBeDefined();
    expect(cat!.renderedText).toContain(
      '1. **Système de filtration** — 2 gammes',
    );
    expect(cat!.renderedText).not.toContain('undefined');
    expect(cat!.semanticPayload).toEqual([
      'Système de filtration',
      'Système de freinage',
      'Courroie, galet, poulie et chaîne',
    ]);
  });

  it('S_COMPAT_SCOPE lists engine and CNIT codes read at their real location', async () => {
    const byId = await blocksFor(REBUILT_PAYLOAD_19053);
    const compat = byId.get('S_COMPAT_SCOPE')!.renderedText;
    expect(compat).toContain('Codes moteur : K9K 764, K9K 774');
    expect(compat).toContain('Codes CNIT : 3333161, 3333AAL, 3333AKL, BR1H06');
  });
});

// ── enrichSingle: the families it feeds downstream (the "0 familles" site) ──

describe('R8VehicleEnricherService.enrichSingle — families source', () => {
  const STOP = 'STOP_AFTER_COMPOSE';

  /**
   * Runs enrichSingle up to composeBlocks, captures the `families` argument,
   * then aborts (the catch returns `failed`): no neighbour query, no meta pool,
   * no DB write. RAG dir points to a non-existent path.
   */
  async function familiesFedBy(payload: unknown) {
    const svc = makeEnricher(clone(payload)) as EnricherInternals &
      Record<string, unknown>;
    svc.RAG_VEHICLES_DIR = '/nonexistent-r8-enricher-test';
    svc.vehicleRagGenerator = { generateForModel: jest.fn() };
    svc.loadVehicleRag = jest.fn().mockReturnValue({});
    svc.fetchNeighbors = jest.fn().mockResolvedValue([]);
    const compose = jest.fn(() => {
      throw new Error(STOP);
    });
    svc.composeBlocks = compose;
    const result = await (
      svc as unknown as R8VehicleEnricherService
    ).enrichSingle(19053);
    expect(result.warnings).toEqual([STOP]);
    expect(compose).toHaveBeenCalledTimes(1);
    const families = (compose.mock.calls[0] as unknown[])[1] as Array<{
      family_name: string;
      gammes_count: number;
    }>;
    return { svc, families };
  }

  it('feeds catalog.families (not the non-existent compatible_families) to composeBlocks', async () => {
    const { svc, families } = await familiesFedBy(CACHED_PAYLOAD_19053);
    expect(families.map((f) => f.family_name)).toEqual([
      'Système de filtration',
      'Système de freinage',
      'Courroie, galet, poulie et chaîne',
    ]);
    expect(families.every((f) => f.gammes_count === 2)).toBe(true);
    expect(svc.logger.warn).not.toHaveBeenCalled();
  });

  it('warns with typeId when catalog.families is missing (0 families used)', async () => {
    const payload = clone(CACHED_PAYLOAD_19053) as Record<string, unknown>;
    delete payload.catalog;
    const { svc, families } = await familiesFedBy(payload);
    expect(families).toEqual([]);
    const warned = svc.logger.warn.mock.calls.map((c) => String(c[0]));
    expect(warned).toEqual([
      expect.stringContaining('key=catalog.families typeId=19053'),
    ]);
  });
});
