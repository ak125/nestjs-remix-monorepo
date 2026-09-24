/**
 * Tests — R8 vehicle enricher: the S_TECH_SPECS block carries NO RAG content.
 *
 * Invariant 4 (CLAUDE.md, ADR-031 / ADR-046): RAG is a chatbot-only consumer
 * layer with zero content-write authority. The enricher used to copy the
 * model-level `specs_techniques` frontmatter of the vehicle RAG file into the
 * served S_TECH_SPECS block. That table comes from ONE unverified web sheet of
 * ONE variant, shared by every type of the model: on `__seo_r8_pages` it shows a
 * 1 461 cm3 diesel sheet on type 11056 (1.2 16V petrol) and a 5-speed gearbox
 * on type 19053 (1.5 dCi 106 ch).
 *
 * Fixtures (read-only extracts, 2026-09-24):
 *  - CLIO_III_RAG_SPECS = `specs_techniques` of
 *    `rag/knowledge/vehicles/renault-clio-iii.md` (RAG repo checkout, main);
 *  - TYPE_19053 / TYPE_11056 = `auto_type` identity, in the shape
 *    `fetchVehicleData` normalises it to;
 *  - STORED_PLAN_19053 = block ids / weights / risks / types of
 *    `__seo_r8_pages.rendered_json.blocks` for `r8_vehicle_19053`
 *    (stored diversity_score 58.38, semantic_similarity_score 80.00;
 *    `r8_vehicle_11056` carries the same plan).
 * No personal data: catalogue identifiers only.
 */

import { R8VehicleEnricherService } from './r8-vehicle-enricher.service';

const CLIO_III_RAG_SPECS = {
  longueur: '4,02 m',
  largeur: '2,02 m',
  hauteur: '1,49 m',
  empattement: '2,57 m',
  poids: '1 090 kg',
  coffre: '288 l / 1 038 l',
  reservoir: '55 l',
  vitesse_max: '176 km/h',
  zero_a_cent: '12,70 sec',
  conso_mixte: '3,70 l / 100 km',
  co2: '98 g/km',
  couple: '200 Nm à 1 900 trs/min',
  cylindree: '1 461 cm3',
  boite: 'Mécanique à 5 rapports',
  transmission: 'Traction',
  pneus: '185/60/15',
  diam_braquage: '11 m',
  norme_euro: 'EU4',
  source_url:
    'https://www.caradisiac.com/fiches-techniques/modele--renault-clio-3/2009/',
};

const TYPE_19053 = {
  type_id: 19053,
  brand_name: 'RENAULT',
  brand_alias: 'renault',
  model_name: 'CLIO III',
  model_alias: 'clio-iii',
  model_id: 140004,
  type_name: '1.5 dCi',
  power_ps: '106',
  fuel: 'Diesel',
  year_from: '2005',
  year_to: '2014',
  liter: '150',
};

const TYPE_11056 = {
  ...TYPE_19053,
  type_id: 11056,
  type_name: '1.2 16V (Phase 2)',
  power_ps: '103',
  fuel: 'Essence',
  year_from: '2010',
  year_to: '2014',
  liter: '120',
};

/** Every value of the RAG sheet: none may reach the served block. */
const RAG_ONLY_VALUES = Object.entries(CLIO_III_RAG_SPECS)
  .filter(([k]) => k !== 'source_url')
  .map(([, value]) => value);

type Block = {
  id: string;
  type: string;
  title: string;
  renderedText: string;
  specificityWeight: number;
  boilerplateRisk: number;
  semanticPayload: string[];
};

type Metrics = { diversityScore: number };

type EnricherInternals = {
  logger: { log: jest.Mock; warn: jest.Mock; error: jest.Mock };
  composeBlocks: (...args: unknown[]) => Block[];
  computeMetrics: (
    blocks: Block[],
    neighbors: unknown[],
    families: unknown[],
  ) => Metrics;
  gate: (metrics: Metrics, blocks: Block[]) => { decision: string };
};

/** Object.create bypasses the SupabaseBaseService ctor (env), as in r8-parent-enrichment.test.ts. */
function makeEnricher(): EnricherInternals {
  const svc = Object.create(
    R8VehicleEnricherService.prototype,
  ) as EnricherInternals;
  svc.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  return svc;
}

/** composeBlocks with no families / neighbours / gamme RAG: only the vehicle and its RAG file vary. */
function composeFor(
  vehicle: Record<string, unknown>,
  vehicleRag: Record<string, unknown>,
): Map<string, Block> {
  const blocks = makeEnricher().composeBlocks(
    vehicle,
    [],
    [],
    vehicleRag,
    [],
    [],
    false,
    [],
    `r8_vehicle_${String(vehicle.type_id)}`,
  );
  return new Map(blocks.map((b) => [b.id, b]));
}

const techSpecsOf = (
  vehicle: Record<string, unknown>,
  vehicleRag: Record<string, unknown>,
): Block | undefined => composeFor(vehicle, vehicleRag).get('S_TECH_SPECS');

describe('R8VehicleEnricherService.composeBlocks — S_TECH_SPECS without RAG', () => {
  it('19053: keeps only the DB motorisation line, never the RAG table', () => {
    const block = techSpecsOf(TYPE_19053, {
      specs_techniques: CLIO_III_RAG_SPECS,
    });
    expect(block).toBeDefined();
    expect(block!.renderedText).toBe(
      '**Motorisation** : 1.5 dCi 106 ch (Diesel)',
    );
    expect(block!.renderedText).not.toContain('|');
    for (const value of RAG_ONLY_VALUES) {
      expect(block!.renderedText).not.toContain(value);
    }
  });

  it('11056 (1.2 petrol): no diesel 1 461 cm3 sheet inherited from the model file', () => {
    const block = techSpecsOf(TYPE_11056, {
      specs_techniques: CLIO_III_RAG_SPECS,
    });
    expect(block!.renderedText).toBe(
      '**Motorisation** : 1.2 16V (Phase 2) 103 ch (Essence)',
    );
    expect(block!.renderedText).not.toContain('1 461 cm3');
    expect(block!.renderedText).not.toContain('98 g/km');
  });

  it('is identical with and without the RAG specs (RAG has zero influence)', () => {
    for (const vehicle of [TYPE_19053, TYPE_11056]) {
      const withRag = techSpecsOf(vehicle, {
        specs_techniques: CLIO_III_RAG_SPECS,
      });
      const withoutRag = techSpecsOf(vehicle, {});
      expect(withRag).toEqual(withoutRag);
    }
  });

  it('weight 0.9 and a semantic payload made of DB facts only', () => {
    const block = techSpecsOf(TYPE_19053, {
      specs_techniques: CLIO_III_RAG_SPECS,
    });
    expect(block!.specificityWeight).toBe(0.9);
    expect(block!.boilerplateRisk).toBe(0.05);
    expect(block!.semanticPayload).toEqual(['1.5 dCi', 'Diesel', '106ch']);
  });

  it('emits no S_TECH_SPECS when the type has no name, even if the RAG file has specs', () => {
    const blocks = composeFor(
      { ...TYPE_19053, type_name: '' },
      { specs_techniques: CLIO_III_RAG_SPECS },
    );
    expect(blocks.has('S_TECH_SPECS')).toBe(false);
    for (const block of blocks.values()) {
      expect(block.renderedText).not.toContain('1 461 cm3');
    }
  });
});

describe('R8VehicleEnricherService.computeMetrics — effect on the stored 19053 plan', () => {
  const STORED_PLAN_19053: Array<
    Pick<Block, 'id' | 'type' | 'specificityWeight' | 'boilerplateRisk'>
  > = [
    {
      id: 'S_IDENTITY',
      type: 'vehicle_identity',
      specificityWeight: 0.7,
      boilerplateRisk: 0.2,
    },
    {
      id: 'S_COMPAT_SCOPE',
      type: 'compatibility_scope',
      specificityWeight: 0.5,
      boilerplateRisk: 0.4,
    },
    {
      id: 'S_TECH_SPECS',
      type: 'technical_specs',
      specificityWeight: 0.95,
      boilerplateRisk: 0.05,
    },
    {
      id: 'S_VARIANT_DIFFERENCE',
      type: 'variant_difference',
      specificityWeight: 0.8,
      boilerplateRisk: 0.15,
    },
    {
      id: 'S_SELECTION_GUIDE',
      type: 'selection_help',
      specificityWeight: 0.85,
      boilerplateRisk: 0.1,
    },
    {
      id: 'S_ENTRETIEN_CONTEXT',
      type: 'maintenance_context',
      specificityWeight: 0.85,
      boilerplateRisk: 0.1,
    },
    {
      id: 'S_TRUST',
      type: 'trust_and_support',
      specificityWeight: 0.3,
      boilerplateRisk: 0.8,
    },
  ];

  const toBlocks = (techSpecsWeight?: number): Block[] =>
    STORED_PLAN_19053.map((b) => ({
      ...b,
      title: b.id,
      renderedText: '',
      semanticPayload: [],
      specificityWeight:
        b.id === 'S_TECH_SPECS' && techSpecsWeight !== undefined
          ? techSpecsWeight
          : b.specificityWeight,
    }));

  it('reproduces the stored diversity score 58.38 (no neighbours, 0 families)', () => {
    const metrics = makeEnricher().computeMetrics(toBlocks(), [], []);
    expect(metrics.diversityScore).toBeCloseTo(58.38, 2);
  });

  it('with the S_TECH_SPECS weight now composed for 19053: 58.38 → 58.23, still REVIEW_REQUIRED', () => {
    const svc = makeEnricher();
    const composedWeight = techSpecsOf(TYPE_19053, {
      specs_techniques: CLIO_III_RAG_SPECS,
    })!.specificityWeight;
    const blocks = toBlocks(composedWeight);
    const metrics = svc.computeMetrics(blocks, [], []);
    expect(metrics.diversityScore).toBeCloseTo(58.23, 2);
    expect(svc.gate(metrics, blocks).decision).toBe('REVIEW_REQUIRED');
  });
});
