import { IntentClassifierService } from './intent-classifier.service';
import type { EvidencePack } from '../types/evidence-pack.schema';

type Inner = EvidencePack['evidence_pack'];

const mkPack = (overrides: Partial<Inner> = {}): Inner => ({
  diagnostic_confidence: 70,
  factual_inputs_confirmed: ['Système: freinage'],
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
  risk_level: 'moderate',
  ...overrides,
});

describe('IntentClassifier V1A.0', () => {
  const svc = new IntentClassifierService();

  test('safety_rail: vehicle absent triggers safety + education', () => {
    const result = svc.classify(mkPack(), false);
    expect(result.safety_rail).toBe(true);
    expect(result.value).toBe('education');
    expect(result.reason_codes).toContain('DR_SAFETY_VEHICLE_CONTEXT_MISSING');
  });

  test('safety_rail: low diagnostic_confidence triggers safety', () => {
    const result = svc.classify(mkPack({ diagnostic_confidence: 20 }), true);
    expect(result.safety_rail).toBe(true);
    expect(result.reason_codes).toContain(
      'DR_SAFETY_HYPOTHESIS_CONFIDENCE_INSUFFICIENT',
    );
  });

  test('urgence: risk_level critical → DR_INTENT_SAFETY_URGENCY_CRITICAL', () => {
    const result = svc.classify(mkPack({ risk_level: 'critical' }), true);
    expect(result.value).toBe('urgence');
    expect(result.safety_rail).toBe(false);
    expect(result.confidence).toBe(1.0);
    expect(result.reason_codes).toEqual(['DR_INTENT_SAFETY_URGENCY_CRITICAL']);
  });

  test('urgence: risk_level high → DR_INTENT_SAFETY_URGENCY_IMMINENT', () => {
    const result = svc.classify(mkPack({ risk_level: 'high' }), true);
    expect(result.value).toBe('urgence');
    expect(result.confidence).toBeCloseTo(0.85, 2);
    expect(result.reason_codes).toEqual(['DR_INTENT_SAFETY_URGENCY_IMMINENT']);
  });

  test('garage: multi-system + catalog closed', () => {
    const result = svc.classify(
      mkPack({
        system_suspects: ['plaquette-de-frein', 'disque-de-frein', 'etrier'],
        catalog_guard: {
          ready_for_catalog: false,
          confidence_before_purchase: 'low',
          allowed_output_mode: 'none',
          reason: 'multi-system',
        },
      }),
      true,
    );
    expect(result.value).toBe('garage');
    expect(result.reason_codes).toContain('DR_INTENT_REPAIR_DIFFICULTY_HIGH');
  });

  test('maintenance: maintenance_links present', () => {
    const result = svc.classify(
      mkPack({
        maintenance_links: ['Vidange à 120 000 km'],
      }),
      true,
    );
    expect(result.value).toBe('maintenance');
    expect(result.reason_codes).toContain('DR_INTENT_MAINTENANCE_FLAG_TRUE');
  });

  test('commerce: catalog ready + suggested_gammes + vehicle + medium confidence', () => {
    const result = svc.classify(mkPack(), true);
    expect(result.value).toBe('commerce');
    expect(result.confidence).toBe(0.7);
    expect(result.confidence_bucket).toBe('strong');
    expect(result.reason_codes).toContain('DR_INTENT_HIGH_CONFIDENCE_COMMERCE');
  });

  test('commerce: high confidence → very_strong bucket', () => {
    const result = svc.classify(
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
    expect(result.value).toBe('commerce');
    expect(result.confidence).toBe(0.9);
    expect(result.confidence_bucket).toBe('very_strong');
  });

  test('education: fallback when no other rule matches', () => {
    const result = svc.classify(
      mkPack({
        catalog_guard: {
          ready_for_catalog: false,
          confidence_before_purchase: 'low',
          allowed_output_mode: 'catalog_family_only',
          reason: 'low conf',
        },
        maintenance_links: [],
        risk_level: 'moderate',
        diagnostic_confidence: 55,
      }),
      true,
    );
    expect(result.value).toBe('education');
    expect(result.safety_rail).toBe(false);
    expect(result.reason_codes).toContain(
      'DR_INTENT_HYPOTHESIS_CONFIDENCE_LOW',
    );
  });

  test('confidence is always policy-bound [0,1]', () => {
    const result = svc.classify(mkPack(), true);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
