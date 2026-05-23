import {
  InvariantAsserterService,
  ResolutionInvariantViolationError,
} from './invariant-asserter.service';
import type { AnalyzeResponseV1A0 } from '../types/analyze-response.schema';

const mkResponse = (
  overrides: Partial<AnalyzeResponseV1A0> = {},
): AnalyzeResponseV1A0 => ({
  session_id: 'test-session',
  mode: 'reactive',
  versions: { pipeline_version: 'v1.0.0' },
  intent: {
    value: 'commerce',
    confidence: 0.7,
    confidence_bucket: 'strong',
    reason_codes: ['DR_INTENT_HIGH_CONFIDENCE_COMMERCE'],
    safety_rail: false,
  },
  recommended_actions: [
    {
      type: 'piece',
      priority: 1,
      target: '/pieces/plaquette-de-frein/402',
      label_key: 'diagnostic.action.piece',
      confidence: 0.7,
      rationale_codes: ['DR_INTENT_HIGH_CONFIDENCE_COMMERCE'],
      target_role: 'R2',
    },
    {
      type: 'devis',
      priority: 2,
      target: '/devis',
      label_key: 'diagnostic.action.devis',
      confidence: 0.7,
      rationale_codes: ['DR_HANDOFF_TO_COMMERCE'],
      target_role: 'devis',
    },
  ],
  human_escalation: {
    available: true,
    priority_boost: false,
    target: '/devis-humain',
    reason_codes: ['DR_HANDOFF_TO_HUMAN'],
  },
  ...overrides,
});

describe('InvariantAsserter V1A.0', () => {
  const svc = new InvariantAsserterService();

  test('valid response passes all invariants', () => {
    expect(() => svc.assert(mkResponse(), true)).not.toThrow();
  });

  test('Invariant #1: empty recommended_actions throws', () => {
    expect(() =>
      svc.assert(mkResponse({ recommended_actions: [] }), true),
    ).toThrow(ResolutionInvariantViolationError);
  });

  test('Invariant #1: priorities not strict-ascending throws', () => {
    expect(() =>
      svc.assert(
        mkResponse({
          recommended_actions: [
            {
              type: 'piece',
              priority: 1,
              target: '/p',
              label_key: 'k',
              confidence: 0.7,
              rationale_codes: ['DR_INTENT_HIGH_CONFIDENCE_COMMERCE'],
              target_role: 'R2',
            },
            {
              type: 'devis',
              priority: 3, // skips 2
              target: '/devis',
              label_key: 'k',
              confidence: 0.7,
              rationale_codes: ['DR_HANDOFF_TO_COMMERCE'],
              target_role: 'devis',
            },
          ],
        }),
        true,
      ),
    ).toThrow(/Invariant #1/);
  });

  test('Invariant #2: safety_rail=true requires top action ∈ {appel, assistant_diagnostic, human_resolution}', () => {
    expect(() =>
      svc.assert(
        mkResponse({
          intent: {
            value: 'education',
            confidence: 0.4,
            confidence_bucket: 'ambiguous',
            reason_codes: ['DR_SAFETY_VEHICLE_CONTEXT_MISSING'],
            safety_rail: true,
          },
        }),
        false,
      ),
    ).toThrow(/Invariant #2/);
  });

  test('Invariant #2: safety_rail with valid top action passes', () => {
    expect(() =>
      svc.assert(
        mkResponse({
          intent: {
            value: 'education',
            confidence: 0.4,
            confidence_bucket: 'ambiguous',
            reason_codes: ['DR_SAFETY_VEHICLE_CONTEXT_MISSING'],
            safety_rail: true,
          },
          recommended_actions: [
            {
              type: 'human_resolution',
              priority: 1,
              target: '/devis-humain',
              label_key: 'k',
              confidence: 0.95,
              rationale_codes: ['DR_SAFETY_VEHICLE_CONTEXT_MISSING'],
              target_role: 'human',
            },
            {
              type: 'assistant_diagnostic',
              priority: 2,
              target: '/diagnostic-auto',
              label_key: 'k',
              confidence: 0.95,
              rationale_codes: ['DR_HANDOFF_TO_HUMAN'],
              target_role: 'R3',
            },
          ],
        }),
        false,
      ),
    ).not.toThrow();
  });

  test('Invariant #3: vehicle absent + piece top-2 throws', () => {
    expect(() => svc.assert(mkResponse(), false)).toThrow(/Invariant #3/);
  });

  test('Invariant #4: empty reason_codes throws', () => {
    expect(() =>
      svc.assert(
        mkResponse({
          intent: {
            value: 'commerce',
            confidence: 0.7,
            confidence_bucket: 'strong',
            reason_codes: [],
            safety_rail: false,
          },
        }),
        true,
      ),
    ).toThrow(/Invariant #4/);
  });

  test('Invariant #5: confidence out of [0,1] throws', () => {
    expect(() =>
      svc.assert(
        mkResponse({
          intent: {
            value: 'commerce',
            confidence: 1.5,
            confidence_bucket: 'very_strong',
            reason_codes: ['DR_INTENT_HIGH_CONFIDENCE_COMMERCE'],
            safety_rail: false,
          },
        }),
        true,
      ),
    ).toThrow(/Invariant #5/);
  });

  test('Invariant #5: human_escalation.available=false throws', () => {
    expect(() =>
      svc.assert(
        mkResponse({
          human_escalation: {
            available: false,
            priority_boost: false,
            target: '/devis-humain',
            reason_codes: ['DR_HANDOFF_TO_HUMAN'],
          },
        }),
        true,
      ),
    ).toThrow(/Invariant #5/);
  });
});
