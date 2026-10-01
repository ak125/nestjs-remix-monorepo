import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DiagnosticEngineController } from './diagnostic-engine.controller';
import { hasVehicleContext, resolveHandoffTarget } from './handoff-target';
import { DiagnosticResolutionPipelineService } from './services/diagnostic-resolution-pipeline.service';
import { IntentClassifierService } from './services/intent-classifier.service';
import { ActionRecommenderService } from './services/action-recommender.service';
import { HumanEscalationBuilderService } from './services/human-escalation-builder.service';
import { InvariantAsserterService } from './services/invariant-asserter.service';

const id = '12345678-1234-4123-8123-123456789abc';

// Critical risk with a vehicle → urgence: escalation carries the override
// code, the human_resolution action does not (same type/role, other codes).
function session(extra: Record<string, unknown> = {}) {
  return {
    id,
    intent_type: 'diagnostic',
    system_scope: 'freinage',
    vehicle_context: { type_id: 12345 },
    signal_input: {},
    created_at: '2026-09-20T12:30:00+00:00',
    result: {
      evidence_pack: {
        diagnostic_confidence: 70,
        factual_inputs_confirmed: ['Freinage'],
        factual_inputs_missing: [],
        system_suspects: ['plaquette-de-frein'],
        candidate_hypotheses: [],
        maintenance_links: [],
        risk_flags: ['Arrêt'],
        risk_level: 'critical',
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
      },
    },
    ...extra,
  };
}

function fixture(stored: unknown = session(), enabled = true) {
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
  const dataService = { getSession: jest.fn().mockResolvedValue(stored) };
  const controller = new DiagnosticEngineController(
    {} as never,
    dataService as never,
    {} as never,
    {} as never,
    {} as never,
    pipeline,
    emitter as never,
    { diagnosticPipelineV1Enabled: enabled } as never,
  );
  return { controller, pipeline, emitter, dataService };
}

const escalationClick = { surface: 'human_escalation', session_id: id };
const actionClick = (priority: number, action_type: string, role: string) => ({
  surface: 'recommended_action',
  session_id: id,
  priority,
  action_type,
  target_role: role,
});

describe('handoff events are derived from the stored session', () => {
  test('escalation click reports the resolution of the session, not client values', async () => {
    const f = fixture();
    await expect(
      f.controller.handoff({
        ...escalationClick,
        intent: 'commerce',
        confidence: 0.1,
      }),
    ).resolves.toEqual({ success: true });
    const [response, clicked, vehicle] = f.emitter.emitActionClicked.mock
      .calls[0] as [
      { session_id: string; intent: { value: string; confidence: number } },
      { action_type: string; target_role: string; reason_codes: string[] },
      boolean,
    ];
    expect(response.session_id).toBe(id);
    expect(response.intent).toMatchObject({ value: 'urgence', confidence: 1 });
    expect(clicked).toEqual({
      action_type: 'human_resolution',
      target_role: 'human',
      reason_codes: [
        'DR_OVERRIDE_URGENCY_PROMOTE_HUMAN',
        'DR_HANDOFF_TO_HUMAN',
      ],
    });
    expect(vehicle).toBe(true);
  });

  test('action click carries the codes of that action only', async () => {
    const f = fixture();
    await f.controller.handoff(actionClick(2, 'human_resolution', 'human'));
    expect(f.emitter.emitActionClicked.mock.calls[0][1]).toEqual({
      action_type: 'human_resolution',
      target_role: 'human',
      reason_codes: ['DR_HANDOFF_TO_HUMAN'],
    });
  });

  test('vehicle presence and safety rail follow the stored session', async () => {
    const f = fixture(session({ vehicle_context: { unknown_key: 'x' } }));
    await f.controller.handoff(escalationClick);
    const [response, , vehicle] = f.emitter.emitActionClicked.mock.calls[0];
    expect(vehicle).toBe(false);
    expect(response.intent.safety_rail).toBe(true);
    expect(response.intent.reason_codes).toContain(
      'DR_SAFETY_VEHICLE_CONTEXT_MISSING',
    );
  });

  test('re-deriving the resolution emits no resolution event', async () => {
    const f = fixture();
    await f.controller.handoff(escalationClick);
    expect(f.emitter.emitResolution).not.toHaveBeenCalled();
    expect(f.emitter.emitActionClicked).toHaveBeenCalledTimes(1);
  });
});

describe('handoff rejects what the session never displayed', () => {
  test.each([
    ['unknown priority', actionClick(9, 'appel', 'human')],
    ['type mismatch', actionClick(1, 'human_resolution', 'human')],
    ['role mismatch', actionClick(1, 'appel', 'garage')],
  ])('%s → 409 without event', async (_label, body) => {
    const f = fixture();
    await expect(f.controller.handoff(body)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(f.emitter.emitActionClicked).not.toHaveBeenCalled();
  });

  test.each([
    ['maintenance analysis', { analysis_kind: 'maintenance' }],
    ['unreadable result', { risk_flags: null }],
  ])('%s → 409 without event', async (_label, override) => {
    const stored = session();
    const f = fixture({
      ...stored,
      result: {
        evidence_pack: { ...stored.result.evidence_pack, ...override },
      },
    });
    await expect(f.controller.handoff(escalationClick)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(f.emitter.emitActionClicked).not.toHaveBeenCalled();
  });

  test('unknown session → 404', async () => {
    const f = fixture(null);
    await expect(f.controller.handoff(escalationClick)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  test.each([
    {},
    { surface: 'human_escalation', session_id: 'not-a-uuid' },
    { surface: 'recommended_action', session_id: id, priority: 1 },
    { surface: 'other', session_id: id },
  ])('invalid input %j → 400 before any lookup', async (body) => {
    const f = fixture();
    await expect(f.controller.handoff(body)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(f.dataService.getSession).not.toHaveBeenCalled();
  });

  test('flag OFF → 404 before any lookup', async () => {
    const f = fixture(session(), false);
    await expect(f.controller.handoff(escalationClick)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(f.dataService.getSession).not.toHaveBeenCalled();
  });
});

describe('handoff helpers', () => {
  const { pipeline } = fixture();
  const response = pipeline.compose({
    sessionId: id,
    pack: session().result.evidence_pack as never,
    vehicleContextPresent: true,
  });

  test('escalation unavailable → null', () => {
    expect(
      resolveHandoffTarget(
        {
          ...response,
          human_escalation: { ...response.human_escalation, available: false },
        },
        { surface: 'human_escalation', session_id: id },
      ),
    ).toBeNull();
  });

  test('resolve emits, compose does not', async () => {
    const f = fixture();
    const input = {
      sessionId: id,
      pack: session().result.evidence_pack as never,
      vehicleContextPresent: true,
    };
    f.pipeline.compose(input);
    expect(f.emitter.emitResolution).not.toHaveBeenCalled();
    await f.pipeline.resolve(input);
    expect(f.emitter.emitResolution).toHaveBeenCalledTimes(1);
  });

  test.each([
    [undefined, false],
    [{}, false],
    [{ unknown_key: 'x' }, false],
    [{ brand: '' }, false],
    [{ type_id: 1 }, true],
    [{ brand: 'Renault' }, true],
    [{ year: 1900 }, false],
  ])('hasVehicleContext(%j) → %s', (value, expected) => {
    expect(hasVehicleContext(value)).toBe(expected);
  });
});
