import { Logger } from '@nestjs/common';
import {
  DiagnosticEngineDataService,
  type DiagSymptomCauseLink,
  type DiagSafetyRule,
} from './diagnostic-engine.data-service';
import { DiagnosticEngineOrchestrator } from './diagnostic-engine.orchestrator';
import { HypothesisScoringEngine } from './engines/hypothesis-scoring.engine';
import { CatalogOrientationEngine } from './engines/catalog-orientation.engine';
import {
  RiskSafetyEngine,
  type RiskAssessment,
} from './engines/risk-safety.engine';
import {
  AnalyzeDiagnosticInputSchema,
  type VehicleContextInput,
} from './types/diagnostic-input.schema';
import { ActionRecommenderService } from './services/action-recommender.service';
import { CAUSE_GAMME_MAP } from './constants/gamme-map.constants';
import type { EvidencePack } from './types/evidence-pack.schema';

const vehicle = { brand: 'Test', model: 'Test', mileage_km: 100000 };
const input = {
  intent_type: 'diagnostic_symptom',
  system_scope: 'freinage',
  vehicle_context: vehicle,
  signal_input: { signal_mode: 'symptom_slugs', primary_signal: 'noise' },
};
const link = (score = 90, id = 1): DiagSymptomCauseLink => ({
  id,
  symptom_id: id,
  cause_id: 1,
  relative_score: score,
  evidence_for: [`e${id}`],
  evidence_against: [],
  requires_verification: false,
  active: true,
  cause: {
    id: 1,
    slug: 'brake_pads_worn',
    label: 'Test',
    system_id: 1,
    cause_type: 'wear_related',
    description: null,
    verification_method: null,
    urgency: 'basse',
    active: true,
  },
});
const rule: DiagSafetyRule = {
  id: 1,
  system_id: 1,
  rule_slug: 'brake_long_trip_warning',
  condition_description: 'Contrôle',
  risk_flag: 'test',
  urgency: 'moyenne',
  blocks_catalog: true,
  active: true,
};
const baselineRisk: RiskAssessment = {
  risk_level: 'moderate',
  risk_flags: [],
  requires_immediate_action: false,
  blocks_catalog: false,
  active_rules: [],
};

function orchestrator() {
  const data = {
    getScoredCausesForSymptoms: jest.fn().mockResolvedValue([link()]),
    getSafetyRules: jest.fn().mockResolvedValue([rule]),
    getCostRanges: jest.fn().mockResolvedValue(new Map()),
    saveSession: jest.fn().mockResolvedValue(null),
    getActiveSystems: jest.fn().mockResolvedValue([]),
  };
  const signal = {
    interpret: jest.fn().mockResolvedValue({
      system_confirmed: true,
      system_slug: 'freinage',
      system_label: 'Freinage',
      resolved_symptom_slugs: ['noise'],
      symptom_labels: { noise: 'Bruit' },
      unresolved_signals: [],
      signal_quality: 'high',
    }),
  };
  const maintenance = {
    assess: jest.fn().mockResolvedValue({
      recommendations: [],
      maintenance_links: [],
      overdue_count: 0,
    }),
  };
  const shadow = { shadowCompare: jest.fn() };
  const engine = new DiagnosticEngineOrchestrator(
    data as unknown as DiagnosticEngineDataService,
    signal as never,
    new HypothesisScoringEngine(),
    new RiskSafetyEngine(),
    new CatalogOrientationEngine(),
    maintenance as never,
    shadow as never,
  );
  return { engine, data, signal, maintenance };
}

describe('diagnostic safety and deterministic scoring regressions', () => {
  test.each([false, true])(
    'an explicit catalogue block wins even when immediate=%s',
    (immediate) => {
      const hypotheses = new HypothesisScoringEngine().score([link()], vehicle);
      hypotheses[0].total_score = 95;
      const result = new CatalogOrientationEngine().evaluate(
        hypotheses,
        {
          ...baselineRisk,
          blocks_catalog: true,
          requires_immediate_action: immediate,
        },
        vehicle,
      );
      expect(result).toMatchObject({
        ready_for_catalog: false,
        allowed_output_mode: 'none',
        suggested_gammes: [],
      });
    },
  );
  test.each(['maintenance', 'commerce', 'reassurance', 'devis'] as const)(
    'blocked catalogue never leaks commerce through %s',
    (value) => {
      const pack = {
        catalog_guard: {
          ready_for_catalog: false,
          allowed_output_mode: 'none',
          confidence_before_purchase: 'low',
          reason: 'Safety',
          suggested_gammes: [],
        },
      } as EvidencePack['evidence_pack'];
      const actions = new ActionRecommenderService().recommend(
        {
          value,
          confidence: 1,
          confidence_bucket: 'very_strong',
          reason_codes: [],
          safety_rail: false,
        },
        pack,
        true,
      );
      expect(
        actions.filter(
          (a) => a.type === 'piece' || a.type === 'entretien_pack',
        ),
      ).toEqual([]);
    },
  );
  test.each<[string, VehicleContextInput | undefined]>([
    ['no vehicle', undefined],
    ['brand and model', { brand: 'Test', model: 'Test' }],
    [
      'a complete form',
      {
        brand: 'Test',
        model: 'Test',
        year: 2015,
        mileage_km: 100000,
        fuel: 'diesel',
      },
    ],
  ])('vehicle and maintenance layers stay neutral with %s', (_, context) => {
    const [scored] = new HypothesisScoringEngine().score([link()], context);
    expect(scored.vehicle_fit_score).toBe(10);
    expect(scored.maintenance_history_score).toBe(7);
  });
  const ranged = (score: number, id: number): DiagSymptomCauseLink => {
    const base = link(score, id);
    return {
      ...base,
      cause_id: id,
      cause: {
        ...base.cause!,
        id,
        slug: `ranged_${id}`,
        ...{
          plausible_km_min: 20000,
          plausible_km_max: 120000,
          plausible_age_min: 2,
          plausible_age_max: 15,
        },
      },
    };
  };
  test.each([15000, 100000, 200000])(
    'a declared mileage range never promotes a cause (%i km)',
    (mileage_km) => {
      const context = { brand: 'Test', model: 'Test', year: 2015, mileage_km };
      const scores = new HypothesisScoringEngine().score(
        [ranged(40, 2), link(60, 1)],
        context,
      );
      expect(scores[0].hypothesis_id).toBe('brake_pads_worn');
      const [withRange, without] = [ranged(60, 2), link(60, 1)].map(
        (l) => new HypothesisScoringEngine().score([l], context)[0],
      );
      expect(withRange.total_score).toBe(without.total_score);
    },
  );
  test('a vehicle clearly below the declared range still lowers the cause', () => {
    const engine = new HypothesisScoringEngine();
    const young = new Date().getFullYear() - 1;
    const [early] = engine.score([ranged(60, 2)], {
      brand: 'Test',
      model: 'Test',
      year: 2015,
      mileage_km: 5000,
    });
    const [recent] = engine.score([ranged(60, 2)], {
      brand: 'Test',
      model: 'Test',
      year: young,
      mileage_km: 100000,
    });
    expect(early).toMatchObject({
      lifecycle_fit_score: 3,
      plausibility_score: 2,
    });
    expect(recent).toMatchObject({
      lifecycle_fit_score: 5,
      plausibility_score: 5,
    });
  });
  test.each([0, 95])(
    'a mapped safety rule follows its linked cause, not its score (%i)',
    (total_score) => {
      const [scored] = new HypothesisScoringEngine().score([link()], vehicle);
      const metal = {
        ...rule,
        rule_slug: 'brake_metal_on_metal',
        urgency: 'haute',
      };
      const assess = (hypothesis_id: string) =>
        new RiskSafetyEngine().assess(
          [{ ...scored, hypothesis_id, urgency: 'haute', total_score }],
          [metal],
          ['noise'],
        );
      expect(assess('brake_pads_worn')).toMatchObject({
        risk_level: 'critical',
        blocks_catalog: true,
        active_rules: [metal],
      });
      expect(assess('brake_disc_warped')).toMatchObject({
        risk_level: 'high',
        blocks_catalog: false,
        active_rules: [],
      });
    },
  );
  const raises = (
    rule_slug: string,
    hypothesisIds: string[],
    symptoms: string[],
  ) => {
    const [scored] = new HypothesisScoringEngine().score([link()], vehicle);
    const safety = { ...rule, rule_slug, urgency: 'haute' };
    const hypotheses = hypothesisIds.map((hypothesis_id) => ({
      ...scored,
      hypothesis_id,
    }));
    return (
      new RiskSafetyEngine().assess(hypotheses, [safety], symptoms).active_rules
        .length > 0
    );
  };
  test('a safety rule follows its own cause, not any cause of its system', () => {
    const signal = ['battery_warning_light'];
    expect(
      raises('alternator_battery_drain', ['alternator_failing'], signal),
    ).toBe(true);
    expect(raises('alternator_battery_drain', ['battery_dead'], signal)).toBe(
      false,
    );
  });
  test('a symptom-triggered safety rule needs the symptom it describes', () => {
    const causes = ['thermostat_stuck_closed'];
    expect(raises('overheat_engine_stop', causes, ['temp_warning_light'])).toBe(
      true,
    );
    expect(raises('overheat_engine_stop', causes, ['engine_slow_warmup'])).toBe(
      false,
    );
  });
  test('a condition no symptom can report is never raised', () => {
    expect(
      raises(
        'starter_smoke_warning',
        ['battery_dead', 'starter_solenoid_worn', 'alternator_failing'],
        ['start_click_no_crank'],
      ),
    ).toBe(false);
  });
  test('a rule without a declared trigger keeps the system fallback and is logged', () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    try {
      expect(raises('undeclared_rule', ['brake_pads_worn'], ['noise'])).toBe(
        true,
      );
      expect(warn).toHaveBeenCalledWith(
        'Safety rule without a declared trigger: undeclared_rule',
      );
    } finally {
      warn.mockRestore();
    }
  });
  test('unique symptom evidence has an arithmetic mean, invariant under permutation and duplicates', async () => {
    const service = Object.create(
      DiagnosticEngineDataService.prototype,
    ) as DiagnosticEngineDataService;
    const values = {
      primary: link(90, 1),
      second: { ...link(50, 2), requires_verification: true },
      third: link(10, 3),
    };
    service.getScoredCausesForSymptom = jest.fn(
      async (slug: keyof typeof values) => [values[slug]],
    );
    const a = await service.getScoredCausesForSymptoms([
      'primary',
      'second',
      'third',
    ]);
    const b = await service.getScoredCausesForSymptoms([
      'primary',
      'third',
      'second',
      'second',
    ]);
    expect(a[0].relative_score).toBe(50);
    expect(b).toEqual(a);
    expect(a[0].requires_verification).toBe(true);
    expect(values.primary.relative_score).toBe(90);
  });
  test('a cause linked to only some selected symptoms is not credited for the others', async () => {
    const service = Object.create(
      DiagnosticEngineDataService.prototype,
    ) as DiagnosticEngineDataService;
    const partial = {
      ...link(90, 3),
      cause_id: 2,
      cause: { ...link().cause!, id: 2, slug: 'partial_cause' },
    };
    const values = { first: [link(60, 1), partial], second: [link(60, 2)] };
    service.getScoredCausesForSymptom = jest.fn(
      async (slug: keyof typeof values) => values[slug],
    );
    const scored = await service.getScoredCausesForSymptoms([
      'first',
      'second',
    ]);
    expect(scored.map((l) => [l.cause_id, l.relative_score])).toEqual([
      [1, 60],
      [2, 45],
    ]);
  });
  test('brake fluid maps to the verified fluid family, not clutch kit', () => {
    expect(CAUSE_GAMME_MAP.brake_fluid_low).toEqual([
      { slug: 'liquide-de-frein', label: 'Liquide de frein', pg_id: 71 },
    ]);
  });
  test.each([{ resolved: [] }, { resolved: ['noise'] }])(
    'unresolved diagnostic coverage is explicit (%j)',
    async ({ resolved }) => {
      const f = orchestrator();
      f.signal.interpret.mockResolvedValue({
        system_confirmed: true,
        resolved_symptom_slugs: resolved,
        unresolved_signals: ['unresolved'],
        signal_quality: 'low',
      });
      const result = await f.engine.analyze(input);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/insuffisant|reconnu/i);
      expect(f.data.saveSession).not.toHaveBeenCalled();
    },
  );
  test('names secondary symptoms by their reference labels', async () => {
    const f = orchestrator();
    f.signal.interpret.mockResolvedValue({
      system_confirmed: true,
      system_slug: 'freinage',
      system_label: 'Freinage',
      resolved_symptom_slugs: ['noise', 'judder'],
      symptom_labels: { noise: 'Bruit', judder: 'Vibrations' },
      unresolved_signals: [],
      signal_quality: 'high',
    });
    const result = await f.engine.analyze({
      ...input,
      signal_input: { ...input.signal_input, secondary_signals: ['judder'] },
    });
    expect(
      result.data?.evidence.evidence_pack.factual_inputs_confirmed,
    ).toEqual(
      expect.arrayContaining([
        'Symptôme principal: Bruit',
        'Symptômes secondaires: Vibrations',
      ]),
    );
  });
  test('no candidate causes cannot produce a reassuring low risk result', async () => {
    const f = orchestrator();
    f.data.getScoredCausesForSymptoms.mockResolvedValue([]);
    const result = await f.engine.analyze(input);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insuffisant/i);
  });
  test('missing safety coverage cannot produce a successful diagnostic', async () => {
    const f = orchestrator();
    f.data.getSafetyRules.mockResolvedValue([]);
    const result = await f.engine.analyze(input);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/sécurité/i);
  });
  test('safety read failure is reported explicitly without continuing', async () => {
    const f = orchestrator();
    f.data.getSafetyRules.mockRejectedValue(new Error('unavailable'));
    const result = await f.engine.analyze(input);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/indisponible/i);
    expect(f.data.saveSession).not.toHaveBeenCalled();
  });
  test.each(['cost', 'maintenance', 'session'])(
    'an optional %s failure preserves known critical safety',
    async (dependency) => {
      const f = orchestrator();
      f.data.getScoredCausesForSymptoms.mockResolvedValue([
        { ...link(), cause: { ...link().cause!, urgency: 'haute' } },
      ]);
      f.data.getSafetyRules.mockResolvedValue([{ ...rule, urgency: 'haute' }]);
      if (dependency === 'cost')
        f.data.getCostRanges.mockRejectedValue(new Error('optional'));
      if (dependency === 'maintenance')
        f.maintenance.assess.mockRejectedValue(new Error('optional'));
      if (dependency === 'session')
        f.data.saveSession.mockRejectedValue(new Error('optional'));
      const result = await f.engine.analyze(input);
      expect(result.success).toBe(true);
      expect(result.data?.evidence.evidence_pack).toMatchObject({
        risk_level: 'critical',
        catalog_guard: { allowed_output_mode: 'none', suggested_gammes: [] },
      });
      expect(result.data?.evidence.evidence_pack.safety_alert).toBeTruthy();
    },
  );
  test('a database safety error is not translated into an empty ruleset', async () => {
    const service = Object.create(
      DiagnosticEngineDataService.prototype,
    ) as DiagnosticEngineDataService;
    service.getSystemBySlug = jest.fn().mockResolvedValue({ id: 1 });
    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest
        .fn()
        .mockResolvedValue({ error: { message: 'offline' }, data: null }),
    };
    Object.assign(service, {
      supabase: { from: () => query },
      logger: { error: jest.fn() },
    });
    await expect(service.getSafetyRules('freinage')).rejects.toThrow();
  });
  test.each(['dtc_code', 'warning_light', 'free_text'])(
    'unsupported signal mode %s is explicit',
    async (signal_mode) => {
      const f = orchestrator();
      const result = await f.engine.analyze({
        ...input,
        signal_input: { ...input.signal_input, signal_mode },
      });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/mode|charge/i);
    },
  );
});

describe('maintenance input integrity', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-26T12:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());
  test.each([-1, 100001, Infinity, NaN])(
    'rejects incoherent service odometer %s',
    (last_service_km) => {
      expect(
        AnalyzeDiagnosticInputSchema.safeParse({
          ...input,
          usage_context: { last_service_km },
        }).success,
      ).toBe(false);
    },
  );
  test.each(['2026-02-30', 'nonsense', '2026-09-27'])(
    'rejects invalid/future service date %s',
    (last_service_date) => {
      expect(
        AnalyzeDiagnosticInputSchema.safeParse({
          ...input,
          usage_context: { last_service_date },
        }).success,
      ).toBe(false);
    },
  );
  test('retains a distinct validated history per operation', () => {
    const records = [
      {
        operation_slug: 'oil',
        last_service_km: 99000,
        last_service_date: '2026-09-01',
      },
    ];
    const result = AnalyzeDiagnosticInputSchema.parse({
      ...input,
      usage_context: { maintenance_records: records },
    });
    expect(result.usage_context).toMatchObject({
      maintenance_records: records,
    });
  });
  test('rejects duplicate operations and future operation odometers', () => {
    const record = { operation_slug: 'oil', last_service_km: 99000 };
    for (const maintenance_records of [
      [record, record],
      [{ ...record, last_service_km: 120000 }],
    ]) {
      expect(
        AnalyzeDiagnosticInputSchema.safeParse({
          ...input,
          usage_context: { maintenance_records },
        }).success,
      ).toBe(false);
    }
  });
});

describe('diagnostic database failure integrity', () => {
  function unavailableData() {
    const service = Object.create(
      DiagnosticEngineDataService.prototype,
    ) as DiagnosticEngineDataService;
    const query: Record<string, jest.Mock> = {};
    for (const method of ['select', 'eq', 'in'])
      query[method] = jest.fn().mockReturnValue(query);
    for (const method of ['single', 'order'])
      query[method] = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'offline', code: 'UNAVAILABLE' },
      });
    Object.assign(service, {
      supabase: { from: () => query },
      logger: { error: jest.fn(), warn: jest.fn() },
    });
    return { service, query };
  }
  test('a failed system read is distinguishable from an unknown system', async () => {
    await expect(
      unavailableData().service.getSystemBySlug('freinage'),
    ).rejects.toThrow();
  });
  test('a failed symptom read cannot silently remove one contribution', async () => {
    await expect(
      unavailableData().service.getSymptomBySlug('noise'),
    ).rejects.toThrow();
  });
  test('a failed symptom-list read is not an empty coverage list', async () => {
    const { service } = unavailableData();
    service.getSystemBySlug = jest.fn().mockResolvedValue({ id: 1 });
    await expect(service.getSymptomsBySystem('freinage')).rejects.toThrow();
  });
  test('a failed cause-link read cannot return an empty successful contribution', async () => {
    const { service } = unavailableData();
    service.getSymptomBySlug = jest
      .fn()
      .mockResolvedValue({ id: 1, system_id: 1 });
    await expect(service.getScoredCausesForSymptom('noise')).rejects.toThrow();
  });
  test('a failed cause read cannot return unjoined links as valid causes', async () => {
    const { service, query } = unavailableData();
    service.getSymptomBySlug = jest
      .fn()
      .mockResolvedValue({ id: 1, system_id: 1 });
    query.order.mockResolvedValue({ data: [link()], error: null });
    // Keep the query chain then resolve the final causes active filter.
    query.in.mockReturnValue({
      eq: () => ({
        eq: async () => ({ data: null, error: { message: 'offline' } }),
      }),
    });
    await expect(service.getScoredCausesForSymptom('noise')).rejects.toThrow();
  });
  test('a symptom without cause coverage cannot disappear from an otherwise successful aggregation', async () => {
    const { service } = unavailableData();
    service.getScoredCausesForSymptom = jest.fn(async (slug: string) =>
      slug === 'covered' ? [link()] : [],
    );
    await expect(
      service.getScoredCausesForSymptoms(['covered', 'uncovered']),
    ).rejects.toThrow(/coverage/);
  });
  test('interpretation read failure returns unavailable instead of escaping the API contract', async () => {
    const f = orchestrator();
    f.signal.interpret.mockRejectedValue(new Error('offline'));
    const result = await f.engine.analyze(input);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/indisponible/i);
    expect(f.data.saveSession).not.toHaveBeenCalled();
  });
});
