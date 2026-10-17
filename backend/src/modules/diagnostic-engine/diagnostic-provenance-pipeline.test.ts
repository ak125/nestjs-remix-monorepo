import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FeatureFlagsService } from '../../config/feature-flags.service';
import type {
  DiagLinkProvenance,
  DiagMergedCauseLink,
  DiagSafetyRule,
  DiagnosticEngineDataService,
} from './diagnostic-engine.data-service';
import { DiagnosticEngineOrchestrator } from './diagnostic-engine.orchestrator';
import { HypothesisScoringEngine } from './engines/hypothesis-scoring.engine';
import { RiskSafetyEngine } from './engines/risk-safety.engine';
import { CatalogOrientationEngine } from './engines/catalog-orientation.engine';
import { DiagnosticProvenanceService } from './services/diagnostic-provenance.service';
import {
  EvidencePackSchema,
  type EvidencePack,
} from './types/evidence-pack.schema';

const EXPOSE = 'DIAGNOSTIC_PROVENANCE_EXPOSE_ENABLED';
const PRIMARY = 'DIAGNOSTIC_PROVENANCE_PRIMARY_ENABLED';

const input = {
  intent_type: 'diagnostic_symptom',
  system_scope: 'electricite',
  vehicle_context: { brand: 'Test', model: 'Test', mileage_km: 120000 },
  signal_input: {
    signal_mode: 'symptom_slugs',
    primary_signal: 'batterie-temoin-allume',
  },
};

function cause(
  slug: string,
  causeId: number,
  contributions: Array<[linkId: number, symptomSlug: string, score: number]>,
  symptomCount = contributions.length,
): DiagMergedCauseLink {
  const scores = contributions.map(([, , score]) => score);
  return {
    id: contributions[0][0],
    symptom_id: 1,
    cause_id: causeId,
    relative_score: Math.round(
      scores.reduce((a, b) => a + b, 0) / symptomCount,
    ),
    evidence_for: ['Symptôme déclaré'],
    evidence_against: [],
    requires_verification: true,
    active: true,
    cause: {
      id: causeId,
      slug,
      system_id: 1,
      label: slug,
      cause_type: 'component_fault',
      description: null,
      verification_method: null,
      urgency: 'moyenne',
      active: true,
    },
    contributions: contributions.map(
      ([link_id, symptom_slug, relative_score]) => ({
        link_id,
        symptom_slug,
        relative_score,
      }),
    ),
    symptom_count: symptomCount,
  };
}

// Both symptoms are selected; the battery explains only one, which halves its
// mean. The alternator leads the reference ranking (90 > 25); only the battery
// link has a diagnostic_safe WIKI relation, so PRIMARY puts the battery first.
const LINKS = [
  cause('alternator_failing', 1, [
    [11, 'batterie-temoin-allume', 90],
    [12, 'demarrage-difficile', 90],
  ]),
  cause('battery_dead', 2, [[21, 'demarrage-difficile', 50]], 2),
];
const ROWS: DiagLinkProvenance[] = [
  {
    link_id: 11,
    wiki_path: 'gammes/alternateur.md',
    gamme_slug: 'alternateur',
    relation_to_part: 'direct_cause',
    diagnostic_safe: false,
  },
  {
    link_id: 21,
    wiki_path: 'gammes/batterie.md',
    gamme_slug: 'batterie',
    relation_to_part: 'direct_cause',
    diagnostic_safe: true,
  },
];
// Under PRIMARY each contribution weighs 100 when its link is diagnostic_safe,
// else 0, over the 2 selected symptoms: 50 for the battery → signal_match 15,
// 0 for the alternator, on top of the 36 points the other five sub-scores give
// both (10 + 7 + 7 + 5 + 7). The reference gives 63 (alternator) and 44.
const PRIMARY_TOP_SCORE = 51;
const PRIMARY_SECOND_SCORE = 36;
// diagnostic_confidence = top score × 1 (high signal quality) × (0.7 + 0.3 × 4
// confirmed facts / 5): 51 × 0.94 → 48, where the reference gives 63 × 0.94 → 59.
const PRIMARY_CONFIDENCE = 48;
// Both rankings have a dominant hypothesis (lead ≥ 15): the guard stays medium,
// but the families follow the new order, and the alternator's family loses its
// medium level (a family is medium from a score of 60).
const REFERENCE_GAMMES = [
  ['alternateur', 'medium'],
  ['batterie', 'low'],
];
const PRIMARY_GAMMES = [
  ['batterie', 'low'],
  ['alternateur', 'low'],
];
const CATALOG_GUARD = {
  ready_for_catalog: true,
  confidence_before_purchase: 'medium',
  allowed_output_mode: 'catalog_family_with_caution',
};

// A non-blocking rule, triggered by a cause present in both rankings: the
// catalogue guard then follows the scores.
const rule: DiagSafetyRule = {
  id: 1,
  system_id: 1,
  rule_slug: 'alternator_battery_drain',
  condition_description: 'Contrôle de charge',
  risk_flag: 'Charge à vérifier',
  urgency: 'moyenne',
  blocks_catalog: false,
  active: true,
};

function setup(
  env: Record<string, string>,
  read: () => Promise<DiagLinkProvenance[]> = async () => ROWS,
) {
  const getLiveLinkProvenance = jest.fn(read);
  const saveSession = jest.fn().mockResolvedValue('session-fixture');
  const data = {
    getScoredCausesForSymptoms: jest
      .fn()
      .mockResolvedValue(structuredClone(LINKS)),
    getSafetyRules: jest.fn().mockResolvedValue([rule]),
    // Every suggested family has its catalogue page.
    getGammeIdsWithCataloguePage: jest.fn(
      async (ids: number[]) => new Set(ids),
    ),
    getLiveLinkProvenance,
    saveSession,
  } as unknown as DiagnosticEngineDataService;
  const signal = {
    interpret: jest.fn().mockResolvedValue({
      system_confirmed: true,
      system_slug: 'electricite',
      system_label: 'Électricité',
      resolved_symptom_slugs: ['batterie-temoin-allume', 'demarrage-difficile'],
      symptom_labels: {
        'batterie-temoin-allume': 'Témoin batterie allumé',
        'demarrage-difficile': 'Démarrage difficile',
      },
      unresolved_signals: [],
      critical_symptom_labels: [],
      signal_quality: 'high',
    }),
  };
  const shadow = { shadowCompare: jest.fn() };
  const flags = new FeatureFlagsService({
    get: (key: string) => env[key],
  } as unknown as ConfigService);
  const engine = new DiagnosticEngineOrchestrator(
    data,
    signal as never,
    new HypothesisScoringEngine(),
    new RiskSafetyEngine(),
    new CatalogOrientationEngine(),
    {
      assess: jest.fn().mockResolvedValue({
        recommendations: [],
        maintenance_links: [],
        overdue_count: 0,
      }),
    } as never,
    shadow as never,
    new DiagnosticProvenanceService(data, flags, new EventEmitter2()),
  );
  return { engine, getLiveLinkProvenance, saveSession, shadow };
}

async function analyze(p: ReturnType<typeof setup>): Promise<EvidencePack> {
  const result = await p.engine.analyze(input);
  expect(result.success).toBe(true);
  const evidence = result.data!.evidence;
  // The pack is persisted as returned, and must re-read through the schema
  // the saved-session endpoint applies.
  expect(EvidencePackSchema.safeParse(evidence).success).toBe(true);
  expect(p.saveSession.mock.calls[0][0].result).toBe(evidence);
  return evidence;
}

/** The pack as it is without the provenance fields. */
function withoutProvenance(evidence: EvidencePack) {
  const { provenance_summary: _summary, ...pack } = structuredClone(
    evidence.evidence_pack,
  );
  const strip = (hypotheses: unknown) =>
    (hypotheses as Array<Record<string, unknown>>).map(
      ({ provenance: _p, ...h }) => h,
    );
  return {
    ...pack,
    candidate_hypotheses: strip(pack.candidate_hypotheses),
    ui_block_inputs: {
      ...pack.ui_block_inputs,
      HypothesisCards: strip(pack.ui_block_inputs.HypothesisCards),
    },
  };
}

const ids = (evidence: EvidencePack) =>
  evidence.evidence_pack.candidate_hypotheses.map((h) => h.hypothesis_id);

describe('diagnostic pipeline with the WIKI provenance', () => {
  test('EXPOSE OFF: the pack is today’s, and nothing is read', async () => {
    const p = setup({ [PRIMARY]: 'true' });
    const evidence = await analyze(p);
    expect(p.getLiveLinkProvenance).not.toHaveBeenCalled();
    expect(evidence.evidence_pack).not.toHaveProperty('provenance_summary');
    expect(
      evidence.evidence_pack.candidate_hypotheses.some(
        (h) => 'provenance' in h,
      ),
    ).toBe(false);
    expect(ids(evidence)).toEqual(['alternator_failing', 'battery_dead']);
  });

  test('EXPOSE: every hypothesis shows its provenance, nothing else moves', async () => {
    const off = await analyze(setup({}));
    const p = setup({ [EXPOSE]: 'true' });
    const evidence = await analyze(p);

    expect(p.getLiveLinkProvenance).toHaveBeenCalledWith([11, 12, 21]);
    expect(withoutProvenance(evidence)).toEqual(withoutProvenance(off));
    expect(evidence.evidence_pack.provenance_summary).toEqual({
      status: 'available',
      counts: { sourced: 1, partial: 1, unsourced: 0 },
    });
    const [alternator, battery] = evidence.evidence_pack.candidate_hypotheses;
    expect(alternator.provenance).toMatchObject({
      state: 'partial',
      links: [
        { link_id: 11, documented: true },
        { link_id: 12, documented: false, wiki_refs: [] },
      ],
    });
    expect(battery.provenance).toEqual({
      state: 'sourced',
      links: [
        {
          link_id: 21,
          symptom_slug: 'demarrage-difficile',
          documented: true,
          wiki_refs: [
            {
              wiki_path: 'gammes/batterie.md',
              gamme_slug: 'batterie',
              relation_to_part: 'direct_cause',
              diagnostic_safe: true,
            },
          ],
        },
      ],
    });
    // The cards the UI reads are the same hypotheses.
    expect(evidence.evidence_pack.ui_block_inputs.HypothesisCards).toEqual(
      evidence.evidence_pack.candidate_hypotheses,
    );
  });

  test('EXPOSE + PRIMARY: the weighted ranking is the output, down to the catalogue', async () => {
    const off = await analyze(setup({}));
    const p = setup({ [EXPOSE]: 'true', [PRIMARY]: 'true' });
    const evidence = await analyze(p);
    const pack = evidence.evidence_pack;

    expect(ids(evidence)).toEqual(['battery_dead', 'alternator_failing']);
    expect(pack.candidate_hypotheses.map((h) => h.relative_score)).toEqual([
      PRIMARY_TOP_SCORE,
      PRIMARY_SECOND_SCORE,
    ]);
    // Everything downstream reads the same, weighted hypotheses.
    const gammes = (e: EvidencePack) =>
      e.evidence_pack.catalog_guard.suggested_gammes.map((g) => [
        g.gamme_slug,
        g.confidence,
      ]);
    expect(off.evidence_pack.catalog_guard).toMatchObject(CATALOG_GUARD);
    expect(gammes(off)).toEqual(REFERENCE_GAMMES);
    expect(pack.catalog_guard).toMatchObject(CATALOG_GUARD);
    expect(gammes(evidence)).toEqual(PRIMARY_GAMMES);
    expect(pack.diagnostic_confidence).toBe(PRIMARY_CONFIDENCE);
    expect(
      p.shadow.shadowCompare.mock.calls[0][0].canonical_hypotheses,
    ).toEqual([
      { cause_id: 'battery_dead', confidence: PRIMARY_TOP_SCORE / 100 },
      {
        cause_id: 'alternator_failing',
        confidence: PRIMARY_SECOND_SCORE / 100,
      },
    ]);
    // The safety assessment reads the set of causes, never their scores.
    expect({
      risk_level: pack.risk_level,
      risk_flags: pack.risk_flags,
      safety_alert: pack.safety_alert,
    }).toEqual({
      risk_level: off.evidence_pack.risk_level,
      risk_flags: off.evidence_pack.risk_flags,
      safety_alert: off.evidence_pack.safety_alert,
    });
    expect(pack.provenance_summary).toEqual({
      status: 'available',
      counts: { sourced: 1, partial: 1, unsourced: 0 },
    });
  });

  test('unreadable provenance: the reference pack, marked unavailable, no state', async () => {
    const off = await analyze(setup({}));
    const p = setup({ [EXPOSE]: 'true', [PRIMARY]: 'true' }, async () => {
      throw new Error('__diag_link_provenance: permission denied');
    });
    const evidence = await analyze(p);

    expect(evidence.evidence_pack.provenance_summary).toEqual({
      status: 'unavailable',
    });
    expect(
      evidence.evidence_pack.candidate_hypotheses.some(
        (h) => 'provenance' in h,
      ),
    ).toBe(false);
    expect(withoutProvenance(evidence)).toEqual(withoutProvenance(off));
  });
});
