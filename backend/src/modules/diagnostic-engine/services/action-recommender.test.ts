import { ActionRecommenderService } from './action-recommender.service';
import type { IntentResult } from './intent-classifier.service';
import type { EvidencePack } from '../types/evidence-pack.schema';

type Inner = EvidencePack['evidence_pack'];

const mkPack = (overrides: Partial<Inner> = {}): Inner => ({
  diagnostic_confidence: 70,
  factual_inputs_confirmed: [],
  factual_inputs_missing: [],
  system_suspects: ['plaquette-de-frein'],
  candidate_hypotheses: [],
  maintenance_links: [],
  risk_flags: [],
  signal_quality: 'high',
  catalog_guard: {
    ready_for_catalog: true,
    confidence_before_purchase: 'medium',
    allowed_output_mode: 'catalog_family_with_caution',
    reason: 'ok',
    suggested_gammes: [
      {
        gamme_slug: 'plaquette-de-frein',
        gamme_label: 'Plaquette de frein',
        pg_id: 402,
        confidence: 'medium',
      },
    ],
  },
  allowed_claims: [],
  forbidden_claims_runtime: [],
  ui_block_inputs: {},
  ...overrides,
});

const mkIntent = (overrides: Partial<IntentResult> = {}): IntentResult => ({
  value: 'commerce',
  confidence: 0.7,
  confidence_bucket: 'strong',
  reason_codes: ['DR_INTENT_HIGH_CONFIDENCE_COMMERCE'],
  safety_rail: false,
  ...overrides,
});

describe('ActionRecommender V1A.0', () => {
  const svc = new ActionRecommenderService();

  test('priorities strict ascending 1..N', () => {
    const result = svc.recommend(mkIntent(), mkPack(), true);
    result.forEach((action, idx) => {
      expect(action.priority).toBe(idx + 1);
    });
  });

  test('commerce sequence: piece > entretien_pack > devis > guide', () => {
    const result = svc.recommend(mkIntent(), mkPack(), true);
    expect(result.map((a) => a.type)).toEqual([
      'piece',
      'entretien_pack',
      'devis',
      'guide',
    ]);
  });

  test('urgence sequence: appel > human_resolution > garage > devis', () => {
    const result = svc.recommend(
      mkIntent({
        value: 'urgence',
        confidence: 1.0,
        confidence_bucket: 'very_strong',
        reason_codes: ['DR_INTENT_SAFETY_URGENCY_CRITICAL'],
      }),
      mkPack(),
      true,
    );
    expect(result.map((a) => a.type)).toEqual([
      'appel',
      'human_resolution',
      'garage',
      'devis',
    ]);
  });

  test('safety_rail override: human_resolution > assistant_diagnostic > appel > faq', () => {
    const result = svc.recommend(
      mkIntent({
        value: 'education',
        confidence: 0.4,
        confidence_bucket: 'ambiguous',
        reason_codes: ['DR_SAFETY_VEHICLE_CONTEXT_MISSING'],
        safety_rail: true,
      }),
      mkPack(),
      false,
    );
    expect(result.map((a) => a.type)).toEqual([
      'human_resolution',
      'assistant_diagnostic',
      'appel',
      'faq',
    ]);
  });

  test('override: vehicle absent demotes piece after assistant_diagnostic', () => {
    const result = svc.recommend(
      mkIntent({ value: 'commerce' }),
      mkPack(),
      false,
    );
    const pieceIdx = result.findIndex((a) => a.type === 'piece');
    const assistantIdx = result.findIndex(
      (a) => a.type === 'assistant_diagnostic',
    );
    expect(assistantIdx).toBeGreaterThanOrEqual(0);
    expect(pieceIdx).toBeGreaterThan(assistantIdx);
  });

  test("override: catalog allowed_output_mode 'none' drops piece entirely", () => {
    const result = svc.recommend(
      mkIntent({ value: 'commerce' }),
      mkPack({
        catalog_guard: {
          ready_for_catalog: false,
          confidence_before_purchase: 'low',
          allowed_output_mode: 'none',
          reason: 'closed',
        },
      }),
      true,
    );
    expect(result.find((a) => a.type === 'piece')).toBeUndefined();
  });

  test('piece target uses gamme_slug + pg_id from DB (no hardcoded slug)', () => {
    const result = svc.recommend(mkIntent(), mkPack(), true);
    const piece = result.find((a) => a.type === 'piece');
    expect(piece?.target).toBe('/pieces/plaquette-de-frein/402');
  });

  test('piece confidence reflects catalog_guard.confidence_before_purchase', () => {
    const high = svc.recommend(
      mkIntent(),
      mkPack({
        catalog_guard: {
          ready_for_catalog: true,
          confidence_before_purchase: 'high',
          allowed_output_mode: 'catalog_family_with_caution',
          reason: 'ok',
          suggested_gammes: [
            {
              gamme_slug: 'plaquette-de-frein',
              gamme_label: 'Plaquette de frein',
              pg_id: 402,
              confidence: 'high',
            },
          ],
        },
      }),
      true,
    );
    expect(high.find((a) => a.type === 'piece')?.confidence).toBe(0.9);
  });

  test('target_role tags piece=R2, appel=human, guide=R3', () => {
    const result = svc.recommend(
      mkIntent({ value: 'urgence' }),
      mkPack(),
      true,
    );
    const appel = result.find((a) => a.type === 'appel');
    expect(appel?.target_role).toBe('human');

    const commerce = svc.recommend(mkIntent(), mkPack(), true);
    expect(commerce.find((a) => a.type === 'piece')?.target_role).toBe('R2');
    expect(commerce.find((a) => a.type === 'guide')?.target_role).toBe('R3');
  });

  test('rationale_codes top action inherits intent reason_codes', () => {
    const intent = mkIntent({
      reason_codes: ['DR_INTENT_HIGH_CONFIDENCE_COMMERCE'],
    });
    const result = svc.recommend(intent, mkPack(), true);
    expect(result[0].rationale_codes).toContain(
      'DR_INTENT_HIGH_CONFIDENCE_COMMERCE',
    );
  });
});
