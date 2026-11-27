/**
 * Mandat GE, F02 — every action the diagnostic proposes leads to a page
 * served 200 that does what its label says.
 *
 * SERVED lists the destinations observed 200 on DEV (localhost:3000,
 * SHA servi 7905d7c7b, 2026-11-27T22:19Z, preuve
 * /home/deploy/mandats/GE/preuves/65-f02-dev-targets.txt). The former
 * targets /devis, /garages-proches, /conseil, /conseil/<slug>, /entretien,
 * /faq and /devis-humain answered 404 there.
 */

import { DiagnosticEngineController } from './diagnostic-engine.controller';
import { DiagnosticResolutionPipelineService } from './services/diagnostic-resolution-pipeline.service';
import { IntentClassifierService } from './services/intent-classifier.service';
import { ActionRecommenderService } from './services/action-recommender.service';
import { HumanEscalationBuilderService } from './services/human-escalation-builder.service';
import { InvariantAsserterService } from './services/invariant-asserter.service';
import type { IntentResult } from './services/intent-classifier.service';
import type { EvidencePack } from './types/evidence-pack.schema';
import { DiagnosticIntentEnum } from './types/diagnostic-intent';

type Inner = EvidencePack['evidence_pack'];

const SERVED = new Set([
  '/contact',
  '/diagnostic-auto',
  '/blog-pieces-auto/conseils',
  '/#catalogue',
]);
/** buildGammeUrl output, e.g. /pieces/filtre-a-huile-7.html (200 on DEV). */
const GAMME_URL = /^\/pieces\/[a-z0-9-]+-\d+\.html$/;
const isServed = (target: string) =>
  SERVED.has(target) || GAMME_URL.test(target);

const pack = (mode: 'catalog_family_with_caution' | 'none'): Inner =>
  ({
    analysis_kind: 'symptom',
    diagnostic_confidence: 70,
    factual_inputs_confirmed: [],
    factual_inputs_missing: [],
    system_suspects: ['plaquette-de-frein'],
    candidate_hypotheses: [],
    maintenance_links: [],
    risk_flags: [],
    signal_quality: 'high',
    catalog_guard: {
      ready_for_catalog: mode !== 'none',
      confidence_before_purchase: 'medium',
      allowed_output_mode: mode,
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
    ui_block_inputs: {},
  }) as unknown as Inner;

const intent = (
  value: IntentResult['value'],
  safety_rail: boolean,
): IntentResult => ({
  value,
  confidence: 0.7,
  confidence_bucket: 'strong',
  reason_codes: safety_rail
    ? ['DR_SAFETY_VEHICLE_CONTEXT_MISSING']
    : ['DR_INTENT_HIGH_CONFIDENCE_COMMERCE'],
  safety_rail,
});

describe('recommended actions lead to served pages (mandat GE, F02)', () => {
  const recommender = new ActionRecommenderService();
  const escalation = new HumanEscalationBuilderService();
  const cases = DiagnosticIntentEnum.options.flatMap((value) =>
    [false, true].flatMap((safety) =>
      [false, true].flatMap((vehicle) =>
        (['catalog_family_with_caution', 'none'] as const).map(
          (mode) => [value, safety, vehicle, mode] as const,
        ),
      ),
    ),
  );

  test.each(cases)(
    'intent %s, safety_rail %s, vehicle %s, catalogue %s',
    (value, safety, vehicle, mode) => {
      const actions = recommender.recommend(
        intent(value, safety),
        pack(mode),
        vehicle,
      );
      expect(actions.length).toBeGreaterThan(0);
      expect(actions.filter((a) => !isServed(a.target))).toEqual([]);
    },
  );

  test.each(DiagnosticIntentEnum.options)(
    'human escalation for intent %s leads to a served page',
    (value) => {
      expect(isServed(escalation.build(intent(value, false)).target)).toBe(
        true,
      );
      expect(isServed(escalation.build(intent(value, true)).target)).toBe(true);
    },
  );
});

describe('analyze response and DIAGNOSTIC_PIPELINE_V1_ENABLED (tests only)', () => {
  function controller(enabled: boolean) {
    const emitter = {
      emitResolution: jest.fn().mockResolvedValue(undefined),
      emitActionClicked: jest.fn().mockResolvedValue(undefined),
    };
    const pipeline = new DiagnosticResolutionPipelineService(
      new IntentClassifierService(),
      new ActionRecommenderService(),
      new HumanEscalationBuilderService(),
      new InvariantAsserterService(),
      emitter as never,
    );
    const orchestrator = {
      analyze: jest.fn().mockResolvedValue({
        success: true,
        data: {
          session_id: null,
          evidence: { evidence_pack: pack('catalog_family_with_caution') },
        },
      }),
    };
    const vehicleContext = {
      get: jest.fn().mockReturnValue(null),
      persist: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn(),
    };
    return new DiagnosticEngineController(
      orchestrator as never,
      {} as never,
      {} as never,
      {} as never,
      vehicleContext as never,
      pipeline,
      emitter as never,
      { diagnosticPipelineV1Enabled: enabled } as never,
    );
  }

  const body = {
    vehicle_context: { brand: 'RENAULT', model: 'CLIO III' },
    signal_input: { primary_signal: 'bruit_freinage' },
  };

  test('flag on: every action and the escalation lead to served pages', async () => {
    const res = (await controller(true).analyze(body, {
      req: {},
    } as never)) as Record<string, unknown>;
    const actions = res.recommended_actions as Array<{ target: string }>;
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.filter((a) => !isServed(a.target))).toEqual([]);
    expect(isServed((res.human_escalation as { target: string }).target)).toBe(
      true,
    );
  });

  test('flag off (default): no action and no escalation in the response', async () => {
    const res = (await controller(false).analyze(body, {
      req: {},
    } as never)) as Record<string, unknown>;
    expect(res.success).toBe(true);
    expect(res).not.toHaveProperty('recommended_actions');
    expect(res).not.toHaveProperty('human_escalation');
    expect(res).not.toHaveProperty('intent');
  });
});
