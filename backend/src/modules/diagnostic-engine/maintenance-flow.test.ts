import { DiagnosticEngineOrchestrator } from './diagnostic-engine.orchestrator';
import { DiagnosticEngineDataService } from './diagnostic-engine.data-service';
import { DiagnosticEngineController } from './diagnostic-engine.controller';
import { MaintenanceIntelligenceEngine } from './engines/maintenance-intelligence.engine';
import { EvidencePackSchema } from './types/evidence-pack.schema';

const operation = (slug: string) => ({
  id: 1,
  slug,
  label: slug,
  description: null,
  interval_km_min: 10000,
  interval_km_max: 20000,
  interval_months_min: 12,
  interval_months_max: 24,
  severity_if_overdue: 'moderate',
  normal_wear_km_min: null,
  normal_wear_km_max: null,
  related_gamme_slug: null,
  related_pg_id: null,
});
const request = {
  intent_type: 'maintenance_check',
  vehicle_context: { mileage_km: 30000 },
  usage_context: {
    maintenance_records: [
      {
        operation_slug: 'oil',
        last_service_km: 29000,
        last_service_date: '2026-08-01',
      },
      { operation_slug: 'fluid' },
    ],
  },
};
function fixture() {
  const data = {
    getMaintenanceOperations: jest
      .fn()
      .mockResolvedValue([operation('oil'), operation('fluid')]),
    saveSession: jest.fn(),
  };
  const signal = { interpret: jest.fn() };
  const score = { score: jest.fn() };
  const risk = { assess: jest.fn() };
  const catalog = { evaluate: jest.fn() };
  const rag = { enrich: jest.fn() };
  const shadow = { shadowCompare: jest.fn() };
  const engine = new DiagnosticEngineOrchestrator(
    data as never,
    signal as never,
    score as never,
    risk as never,
    catalog as never,
    new MaintenanceIntelligenceEngine(data as never),
    rag as never,
    shadow as never,
  );
  return { engine, data, signal, score, risk, catalog, rag, shadow };
}
describe('maintenance analysis without a symptom', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-27T12:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());
  test.each(['maintenance_check', 'revision_check', 'preventive_check'])(
    'accepts %s and assesses only operation histories',
    async (intent_type) => {
      const f = fixture();
      const result = await f.engine.analyze({ ...request, intent_type });
      expect(result.success).toBe(true);
      const pack = result.data!.evidence.evidence_pack;
      expect(EvidencePackSchema.safeParse(result.data!.evidence).success).toBe(
        true,
      );
      expect(pack).toMatchObject({
        analysis_kind: 'maintenance',
        candidate_hypotheses: [],
        risk_flags: [],
        catalog_guard: { allowed_output_mode: 'none', suggested_gammes: [] },
      });
      expect(pack.risk_level).toBeUndefined();
      expect(pack.diagnostic_confidence).toBeUndefined();
      expect(pack.maintenance_recommendations).toMatchObject([
        {
          operation_slug: 'oil',
          overdue_status: 'ok',
          relevance: 'selected',
          applicability: 'unverified',
          interval_source: '__diag_maintenance_operation',
          next_at_date: '2027-08-01 - 2028-08-01 (estimation)',
        },
        { operation_slug: 'fluid', overdue_status: 'unknown' },
      ]);
      expect(result.data!.session_id).toBeNull();
      for (const mock of [
        f.signal.interpret,
        f.score.score,
        f.risk.assess,
        f.catalog.evaluate,
        f.rag.enrich,
        f.shadow.shadowCompare,
        f.data.saveSession,
      ])
        expect(mock).not.toHaveBeenCalled();
    },
  );
  test.each([
    { usage_context: { maintenance_records: [] } },
    { usage_context: undefined },
    {
      signal_input: {
        signal_mode: 'symptom_slugs',
        primary_signal: 'brake-failure',
      },
    },
    { system_scope: 'freinage' },
    {
      usage_context: {
        maintenance_records: [
          { operation_slug: 'oil' },
          { operation_slug: 'oil' },
        ],
      },
    },
    {
      usage_context: {
        maintenance_records: [
          { operation_slug: 'oil', last_service_km: 30001 },
        ],
      },
    },
    {
      usage_context: {
        maintenance_records: [
          { operation_slug: 'oil', last_service_date: '2026-02-30' },
        ],
      },
    },
    {
      usage_context: {
        maintenance_records: [
          { operation_slug: 'oil', last_service_date: '2026-09-28' },
        ],
      },
    },
  ])(
    'rejects incomplete, mixed, or inconsistent input %j',
    async (override) => {
      const f = fixture();
      expect(
        (await f.engine.analyze({ ...request, ...override })).success,
      ).toBe(false);
      expect(f.data.getMaintenanceOperations).not.toHaveBeenCalled();
    },
  );
  test.each(['missing', 'unavailable', 'invalid interval'])(
    'does not report success for %s source',
    async (problem) => {
      const f = fixture();
      if (problem === 'missing')
        f.data.getMaintenanceOperations.mockResolvedValue([operation('oil')]);
      if (problem === 'unavailable')
        f.data.getMaintenanceOperations.mockRejectedValue(new Error('offline'));
      if (problem === 'invalid interval')
        f.data.getMaintenanceOperations.mockResolvedValue([
          { ...operation('oil'), interval_km_max: -1 },
          operation('fluid'),
        ]);
      const result = await f.engine.analyze(request);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/indisponible|opération/i);
    },
  );
  test('a date-only history computes a time deadline while missing km stays unknown', async () => {
    const f = fixture();
    const result = await f.engine.analyze({
      ...request,
      usage_context: {
        maintenance_records: [
          { operation_slug: 'oil', last_service_date: '2024-09-27' },
        ],
      },
    });
    expect(result.success).toBe(true);
    expect(
      result.data!.evidence.evidence_pack.maintenance_recommendations,
    ).toMatchObject([
      {
        operation_slug: 'oil',
        overdue_status: 'overdue',
        next_at_km: 'historique de cette opération inconnu',
        next_at_date: '2025-09-27 - 2026-09-27 (estimation)',
      },
    ]);
  });
  test('the data boundary propagates a database error', async () => {
    const data = Object.create(
      DiagnosticEngineDataService.prototype,
    ) as DiagnosticEngineDataService;
    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'offline' } }),
    };
    Object.assign(data, { supabase: { from: () => query } });
    await expect(data.getMaintenanceOperations()).rejects.toThrow();
  });
  test('the controller skips the reactive intent pipeline even when enabled', async () => {
    const controller = Object.create(
      DiagnosticEngineController.prototype,
    ) as DiagnosticEngineController;
    const compute = jest.fn();
    const previous = process.env.DIAGNOSTIC_PIPELINE_V1_ENABLED;
    process.env.DIAGNOSTIC_PIPELINE_V1_ENABLED = 'true';
    Object.assign(controller, {
      logger: { log: jest.fn() },
      orchestrator: fixture().engine,
      persistVehicleContextIfPresent: jest.fn(),
      computeIntentLayer: compute,
    });
    try {
      const result = await controller.analyze(request, {} as never);
      expect(result.success).toBe(true);
      expect(compute).not.toHaveBeenCalled();
    } finally {
      if (previous === undefined)
        delete process.env.DIAGNOSTIC_PIPELINE_V1_ENABLED;
      else process.env.DIAGNOSTIC_PIPELINE_V1_ENABLED = previous;
    }
  });
});

describe('unused maintenance context remains explicit', () => {
  test('discloses immobilization and repair text without changing operation deadlines', async () => {
    const base = await fixture().engine.analyze(request);
    const result = await fixture().engine.analyze({
      ...request,
      usage_context: {
        ...request.usage_context,
        immobilized_days: 10,
        recent_repairs: ['Freins remplacés'],
      },
    });
    expect(result.success).toBe(true);
    const pack = result.data!.evidence.evidence_pack;
    expect(pack.factual_inputs_missing).toEqual(
      expect.arrayContaining([
        'Durée d’immobilisation non prise en compte dans cette analyse.',
        'Réparations récentes non prises en compte : elles ne prouvent ni la résolution du symptôme ni l’entretien des opérations concernées.',
      ]),
    );
    expect(pack.maintenance_recommendations).toEqual(
      base.data!.evidence.evidence_pack.maintenance_recommendations,
    );
    expect(pack.catalog_guard.allowed_output_mode).toBe('none');
  });
  test('discloses global service history that no operation deadline uses', async () => {
    const base = await fixture().engine.analyze(request);
    expect(
      base.data!.evidence.evidence_pack.factual_inputs_missing.join(' '),
    ).not.toMatch(/dernier entretien non pris/);
    const result = await fixture().engine.analyze({
      ...request,
      usage_context: {
        ...request.usage_context,
        last_service_km: 25000,
        last_service_date: '2026-01-15',
      },
    });
    expect(result.success).toBe(true);
    const pack = result.data!.evidence.evidence_pack;
    expect(pack.factual_inputs_missing).toEqual(
      expect.arrayContaining([
        'Kilométrage du dernier entretien non pris en compte : seuls les kilométrages renseignés par opération sont utilisés.',
        'Date du dernier entretien non prise en compte : seules les dates renseignées par opération sont utilisées.',
      ]),
    );
    expect(pack.maintenance_recommendations).toEqual(
      base.data!.evidence.evidence_pack.maintenance_recommendations,
    );
  });
  test('rejects negative immobilization before reading maintenance operations', async () => {
    const f = fixture();
    const result = await f.engine.analyze({
      ...request,
      usage_context: { ...request.usage_context, immobilized_days: -1 },
    });
    expect(result.success).toBe(false);
    expect(f.data.getMaintenanceOperations).not.toHaveBeenCalled();
  });
});
