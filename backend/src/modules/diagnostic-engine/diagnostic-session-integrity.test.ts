import { ServiceUnavailableException } from '@nestjs/common';
import { DiagnosticEngineController } from './diagnostic-engine.controller';
import { DiagnosticEngineDataService } from './diagnostic-engine.data-service';

const id = '12345678-1234-4123-8123-123456789abc';
function session() {
  return {
    id,
    system_scope: 'freinage',
    vehicle_context: {},
    signal_input: {},
    created_at: '2026-09-20T12:30:00+00:00',
    result: {
      evidence_pack: {
        factual_inputs_confirmed: ['Freinage'],
        factual_inputs_missing: [],
        system_suspects: [],
        candidate_hypotheses: [],
        maintenance_links: [],
        risk_flags: ['Arrêt'],
        safety_alert: 'Ne pas rouler',
        risk_level: 'critical',
        catalog_guard: {
          ready_for_catalog: false,
          confidence_before_purchase: 'low',
          allowed_output_mode: 'none',
          reason: 'Sécurité',
        },
        allowed_claims: [],
        forbidden_claims_runtime: [],
        ui_block_inputs: {},
        urgency_timeline: { immediate: ['Contrôle'] },
      },
    },
  };
}
function fixture(value: unknown = session()) {
  const service = Object.create(
    DiagnosticEngineDataService.prototype,
  ) as DiagnosticEngineDataService;
  const reply = {
    data: value,
    error: null as null | { code: string; message: string },
  };
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    single: jest.fn(async () => reply),
  };
  Object.assign(service, {
    supabase: { from: jest.fn(() => query) },
    logger: { warn: jest.fn() },
  });
  const controller = new DiagnosticEngineController(
    {} as never,
    service,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, controller, reply, query };
}
describe('saved diagnostic lookup', () => {
  test('returns the stored result unchanged, including safety and extension metadata', async () => {
    const stored = session();
    const f = fixture(stored);
    const output = await f.controller.getSession(id.toUpperCase());
    expect(output).toMatchObject({ success: true, session: stored });
    expect(output.session?.result).toBe(stored.result);
    expect(f.query.eq).toHaveBeenCalledWith('id', id.toUpperCase());
  });
  test('rejects an invalid UUID before the database', async () => {
    const f = fixture();
    expect(await f.controller.getSession('../invalid')).toMatchObject({
      success: false,
    });
    expect(f.query.single).not.toHaveBeenCalled();
  });
  test('reports a missing session', async () => {
    const f = fixture(null);
    f.reply.error = { code: 'PGRST116', message: 'No rows' };
    expect(await f.controller.getSession(id)).toEqual({
      success: false,
      error: 'Session introuvable.',
    });
  });
  test('distinguishes storage failure from a missing session', async () => {
    const f = fixture(null);
    f.reply.error = { code: '08006', message: 'Storage unavailable' };
    await expect(f.controller.getSession(id)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
  test.each([
    null,
    {},
    { evidence_pack: {} },
    { evidence_pack: { ...session().result.evidence_pack, risk_flags: null } },
    {
      evidence_pack: {
        ...session().result.evidence_pack,
        risk_level: 'unknown',
      },
    },
  ])('rejects unreadable stored result %j', async (result) => {
    const f = fixture({ ...session(), result });
    expect(await f.controller.getSession(id)).toEqual({
      success: false,
      error: 'Résultat sauvegardé illisible. Relancez une analyse.',
    });
  });
  test.each([
    { id: '87654321-1234-4123-8123-123456789abc' },
    { created_at: 'invalid' },
    { created_at: null },
  ])('rejects invalid session metadata %j', async (extra) => {
    expect(
      await fixture({ ...session(), ...extra }).controller.getSession(id),
    ).toMatchObject({ success: false });
  });
});
