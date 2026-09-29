import { EvidencePackSchema } from './types/evidence-pack.schema';
import { DiagnosticEngineDataService } from './diagnostic-engine.data-service';
import { DiagnosticEngineOrchestrator } from './diagnostic-engine.orchestrator';
import { SignalInterpretationEngine } from './engines/signal-interpretation.engine';
import { HypothesisScoringEngine } from './engines/hypothesis-scoring.engine';
import { RiskSafetyEngine } from './engines/risk-safety.engine';
import { CatalogOrientationEngine } from './engines/catalog-orientation.engine';

const system = {
  id: 1,
  slug: 'freinage',
  label: 'Freinage',
  description: null,
  display_order: 1,
  active: true,
};
const symptom = {
  id: 1,
  system_id: 1,
  slug: 'noise',
  label: 'Bruit',
  description: null,
  signal_mode: 'symptom_slugs',
  urgency: 'haute',
  active: true,
};
const cause = {
  id: 1,
  system_id: 1,
  slug: 'brake_pads_worn',
  label: 'Plaquettes',
  description: null,
  cause_type: 'wear_related',
  verification_method: null,
  urgency: 'haute',
  active: true,
  plausible_km_min: 20000,
  plausible_km_max: 80000,
  plausible_age_min: 2,
  plausible_age_max: 8,
  workshop_priority: 'diy',
};
const link = {
  id: 1,
  symptom_id: 1,
  cause_id: 1,
  relative_score: 70,
  evidence_for: ['Bruit compatible'],
  evidence_against: [],
  requires_verification: true,
  active: true,
};
const rule = {
  id: 1,
  system_id: 1,
  rule_slug: 'brake_metal_on_metal',
  condition_description: 'Freinage dégradé',
  risk_flag: 'Sécurité',
  urgency: 'haute',
  blocks_catalog: true,
  active: true,
};
const input = {
  intent_type: 'diagnostic_symptom',
  system_scope: 'freinage',
  vehicle_context: { brand: 'Test', model: 'Test', mileage_km: 50000 },
  signal_input: { signal_mode: 'symptom_slugs', primary_signal: 'noise' },
};

type Reply = {
  data: unknown;
  error: null | { message: string; code?: string };
};
type Tables = Record<string, Reply>;
function fixture() {
  const tables: Tables = {
    __seo_gamme_purchase_guide: { data: [], error: null },
    __diag_system: { data: [structuredClone(system)], error: null },
    __diag_symptom: { data: [structuredClone(symptom)], error: null },
    __diag_cause: { data: [structuredClone(cause)], error: null },
    __diag_symptom_cause_link: { data: [structuredClone(link)], error: null },
    __diag_safety_rule: { data: [structuredClone(rule)], error: null },
    // The family suggested for `cause` has its own catalogue page.
    pieces_gamme: { data: [{ pg_id: '402' }], error: null },
  };
  const service = Object.create(
    DiagnosticEngineDataService.prototype,
  ) as DiagnosticEngineDataService;
  // Only the external PostgREST boundary is simulated. Ignore filters deliberately:
  // a wrong-system row must be rejected even when the request included the filter.
  const writes: unknown[] = [];
  const queries: Array<{ table: string; filters: unknown[][] }> = [];
  Object.assign(service, {
    logger: { error: jest.fn(), warn: jest.fn() },
    supabase: {
      from: (table: string) => {
        if (!tables[table]) throw new Error(`Unexpected table: ${table}`);
        const trace = { table, filters: [] as unknown[][] };
        queries.push(trace);
        let single = false;
        const query = {
          insert: (row: unknown) => {
            writes.push(structuredClone(row));
            return query;
          },
          select: () => query,
          eq: (...args: unknown[]) => {
            trace.filters.push(args);
            return query;
          },
          in: (...args: unknown[]) => {
            trace.filters.push(args);
            return query;
          },
          order: () => query,
          single: () => {
            single = true;
            return query;
          },
          then: (
            resolve: (value: Reply) => unknown,
            reject?: (reason: unknown) => unknown,
          ) => {
            const reply = tables[table];
            const rows =
              typeof reply.data === 'function'
                ? reply.data(trace.filters)
                : reply.data;
            const data =
              single && Array.isArray(rows)
                ? (rows.find(
                    (row) =>
                      row.slug ===
                      trace.filters.find((filter) => filter[0] === 'slug')?.[1],
                  ) ??
                  rows[0] ??
                  null)
                : rows;
            return Promise.resolve({ ...reply, data }).then(resolve, reject);
          },
        };
        return query;
      },
    },
  });
  return { service, tables, queries, writes };
}

function pipeline(service: DiagnosticEngineDataService) {
  const saved = jest.spyOn(service, 'saveSession').mockResolvedValue(null);
  const enriched = jest.fn().mockResolvedValue({
    recommendations: [],
    maintenance_links: [],
    overdue_count: 0,
  });
  const engine = new DiagnosticEngineOrchestrator(
    service,
    new SignalInterpretationEngine(service),
    new HypothesisScoringEngine(),
    new RiskSafetyEngine(),
    new CatalogOrientationEngine(),
    { assess: enriched } as never,
    { shadowCompare: jest.fn() } as never,
  );
  return { engine, saved, enriched };
}

describe('diagnostic reference responses are checked before safety evaluation', () => {
  test('valid reference data still produces a critical alert and preserves metadata', async () => {
    const f = fixture();
    const causes = await f.service.getScoredCausesForSymptom('noise');
    expect(causes[0].cause).toMatchObject({
      plausible_km_min: 20000,
      workshop_priority: 'diy',
      description: null,
    });
    const result = await pipeline(f.service).engine.analyze(input);
    expect(result.success).toBe(true);
    expect(result.data?.evidence.evidence_pack).toMatchObject({
      risk_level: 'critical',
      catalog_guard: { ready_for_catalog: false, allowed_output_mode: 'none' },
    });
    expect(result.data?.evidence.evidence_pack.safety_alert).toMatch(
      /Freinage/,
    );
    expect(f.queries).toContainEqual({
      table: '__diag_cause',
      filters: [
        ['id', [1]],
        ['system_id', 1],
        ['active', true],
      ],
    });
  });

  test.each([
    ['__diag_safety_rule', { ...rule, urgency: null }],
    ['__diag_safety_rule', { ...rule, urgency: 'inconnue' }],
    ['__diag_safety_rule', { ...rule, blocks_catalog: null }],
    ['__diag_safety_rule', { ...rule, blocks_catalog: 'false' }],
    ['__diag_safety_rule', { ...rule, system_id: 2 }],
    ['__diag_safety_rule', { ...rule, active: false }],
    ['__diag_safety_rule', { ...rule, risk_flag: '  ' }],
    ['__diag_cause', { ...cause, urgency: 'inconnue' }],
    ['__diag_cause', { ...cause, urgency: null }],
    ['__diag_cause', { ...cause, active: false }],
    ['__diag_cause', { ...cause, system_id: 2 }],
    ['__diag_cause', { ...cause, id: 9 }],
    ['__diag_cause', { ...cause, label: '' }],
    ['__diag_cause', { ...cause, plausible_km_min: -1 }],
    [
      '__diag_cause',
      { ...cause, plausible_km_min: 90000, plausible_km_max: 1000 },
    ],
    ['__diag_symptom', { ...symptom, system_id: 2 }],
    ['__diag_symptom', { ...symptom, urgency: 'inconnue' }],
    ['__diag_symptom', { ...symptom, active: false }],
    ['__diag_system', { ...system, id: null }],
    ['__diag_system', { ...system, slug: 'moteur' }],
    ['__diag_system', { ...system, active: false }],
    ['__diag_symptom_cause_link', { ...link, relative_score: null }],
    ['__diag_symptom_cause_link', { ...link, relative_score: 101 }],
    ['__diag_symptom_cause_link', { ...link, relative_score: '70' }],
    ['__diag_symptom_cause_link', { ...link, relative_score: NaN }],
    ['__diag_symptom_cause_link', { ...link, evidence_for: 'text' }],
    ['__diag_symptom_cause_link', { ...link, evidence_against: [null] }],
    ['__diag_symptom_cause_link', { ...link, requires_verification: null }],
    ['__diag_symptom_cause_link', { ...link, symptom_id: 2 }],
  ])(
    'rejects invalid %s reference row %# without producing a result',
    async (table, row) => {
      const f = fixture();
      f.tables[table as string].data = [row];
      const p = pipeline(f.service);
      const result = await p.engine.analyze(input);
      expect(result).toMatchObject({
        success: false,
        error: expect.stringMatching(/indisponible/i),
      });
      expect(result.data).toBeUndefined();
      expect(p.saved).not.toHaveBeenCalled();
      expect(p.enriched).not.toHaveBeenCalled();
    },
  );

  test.each([
    '__diag_system',
    '__diag_symptom',
    '__diag_symptom_cause_link',
    '__diag_cause',
    '__diag_safety_rule',
  ])(
    '%s null is unavailable, not an empty or missing successful read',
    async (table) => {
      const f = fixture();
      f.tables[table].data = null;
      const result = await pipeline(f.service).engine.analyze(input);
      expect(result).toMatchObject({
        success: false,
        error: expect.stringMatching(/indisponible/i),
      });
    },
  );

  test.each([
    ['__diag_symptom', symptom],
    ['__diag_symptom_cause_link', link],
    ['__diag_cause', cause],
    ['__diag_safety_rule', rule],
  ])(
    'rejects duplicate identities in %s rather than double-counting',
    async (table, row) => {
      const f = fixture();
      f.tables[table as string].data = [row, row];
      const result = await pipeline(f.service).engine.analyze(input);
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
    },
  );

  test.each([
    'maintenance_related',
    'wear_related',
    'component_fault',
    'contextual_factor',
    'wear',
    'mechanical',
    'hydraulic',
    'electrical',
    'corrosion',
    'blockage',
    'leak',
  ])(
    'preserves category %s in a schema-valid saved and returned dossier',
    async (category) => {
      const f = fixture();
      f.tables.__diag_cause.data = [{ ...cause, cause_type: category }];
      const p = pipeline(f.service);
      const result = await p.engine.analyze(input);
      expect(result.success).toBe(true);
      expect(EvidencePackSchema.safeParse(result.data?.evidence).success).toBe(
        true,
      );
      const hypothesis =
        result.data?.evidence.evidence_pack.candidate_hypotheses[0];
      expect(hypothesis).toMatchObject({
        cause_type: category,
        relative_score: 75,
        urgency_timeline: 'Sous 48h — contrôle professionnel urgent',
        scoring_breakdown: expect.objectContaining({ signal_match: 21 }),
      });
      expect(p.saved).toHaveBeenCalledTimes(1);
      const persisted = p.saved.mock.calls[0][0].result;
      expect(EvidencePackSchema.safeParse(persisted).success).toBe(true);
      expect(persisted).toBe(result.data?.evidence);
    },
  );

  test.each(['unclassified', 'WEAR', '', '  ', null, 42])(
    'rejects an unsupported cause category %p before risk and persistence',
    async (category) => {
      const f = fixture();
      f.tables.__diag_cause.data = [{ ...cause, cause_type: category }];
      const p = pipeline(f.service);
      const result = await p.engine.analyze(input);
      expect(result).toMatchObject({
        success: false,
        error: expect.stringMatching(/indisponible/i),
      });
      expect(result.data).toBeUndefined();
      expect(p.saved).not.toHaveBeenCalled();
      expect(p.enriched).not.toHaveBeenCalled();
    },
  );

  test.each(['unclassified', 'WEAR', '', '  '])(
    'does not bypass the cause contract on direct scoring with %p',
    (category) => {
      expect(() =>
        new HypothesisScoringEngine().score(
          [{ ...link, cause: { ...cause, cause_type: category } }],
          undefined,
          undefined,
        ),
      ).toThrow();
    },
  );
  test('accepts genuine empty lists and score zero without inventing contributions', async () => {
    const f = fixture();
    f.tables.__diag_symptom_cause_link.data = [{ ...link, relative_score: 0 }];
    expect(
      (await f.service.getScoredCausesForSymptom('noise'))[0].relative_score,
    ).toBe(0);
    f.tables.__diag_symptom_cause_link.data = [];
    expect(await f.service.getScoredCausesForSymptom('noise')).toEqual([]);
    f.tables.__diag_safety_rule.data = [];
    expect(await f.service.getSafetyRules('freinage')).toEqual([]);
  });
  test('system catalog database failure cannot be reported as an empty success', async () => {
    const f = fixture();
    f.tables.__diag_system = { data: null, error: { message: 'offline' } };
    await expect(f.service.getActiveSystems()).rejects.toThrow();
  });
  test('system catalog rejects repeated slugs and malformed bodies', async () => {
    const f = fixture();
    for (const data of [null, {}, [system, { ...system, id: 2 }]]) {
      f.tables.__diag_system.data = data;
      await expect(f.service.getActiveSystems()).rejects.toThrow();
    }
  });
  test('an absent single row with the existing not-found error remains absent', async () => {
    const f = fixture();
    f.tables.__diag_system = {
      data: null,
      error: { code: 'PGRST116', message: 'No rows' },
    };
    expect(await f.service.getSystemBySlug('absent')).toBeNull();
  });
  test('failure loading alternatives for an unknown system stays in the unavailable API contract', async () => {
    const f = fixture();
    jest.spyOn(f.service, 'getSystemBySlug').mockResolvedValue(null);
    f.tables.__diag_system = { data: null, error: { message: 'offline' } };
    const result = await pipeline(f.service).engine.analyze(input);
    expect(result).toMatchObject({
      success: false,
      error: expect.stringMatching(/indisponible/i),
    });
  });
});

describe('critical urgency survives the reference-to-result path', () => {
  function nonCriticalFixture() {
    const f = fixture();
    f.tables.__diag_symptom.data = [{ ...symptom, urgency: 'basse' }];
    f.tables.__diag_cause.data = [{ ...cause, urgency: 'basse' }];
    f.tables.__diag_safety_rule.data = [
      {
        ...rule,
        rule_slug: 'brake_long_trip_warning',
        urgency: 'moyenne',
        blocks_catalog: false,
      },
    ];
    return f;
  }
  test.each(['__diag_cause', '__diag_symptom', '__diag_safety_rule'])(
    'an explicit critical %s produces immediate safety with a closed catalog',
    async (table) => {
      const f = nonCriticalFixture();
      const rows = f.tables[table].data as Array<Record<string, unknown>>;
      rows[0].urgency = 'critique';
      const result = await pipeline(f.service).engine.analyze(input);
      expect(result.success).toBe(true);
      const pack = result.data?.evidence.evidence_pack;
      expect(pack).toMatchObject({
        risk_level: 'critical',
        catalog_guard: {
          ready_for_catalog: false,
          allowed_output_mode: 'none',
          suggested_gammes: [],
        },
      });
      expect(pack?.safety_alert).toMatch(/ne pas rouler/i);
      expect(pack?.risk_flags.length).toBeGreaterThan(0);
      if (table === '__diag_cause') {
        expect(pack?.candidate_hypotheses[0].urgency).toBe('critique');
      }
    },
  );
  test('a critical secondary symptom reaches safety even with noncritical causes', async () => {
    const f = nonCriticalFixture();
    f.tables.__diag_symptom.data = [
      { ...symptom, urgency: 'basse' },
      {
        ...symptom,
        id: 2,
        slug: 'oil',
        label: 'Voyant huile',
        urgency: 'critique',
      },
    ];
    f.tables.__diag_symptom_cause_link.data = (filters: unknown[][]) =>
      [link, { ...link, id: 2, symptom_id: 2 }].filter(
        (row) =>
          row.symptom_id ===
          filters.find((filter) => filter[0] === 'symptom_id')?.[1],
      );
    const result = await pipeline(f.service).engine.analyze({
      ...input,
      signal_input: { ...input.signal_input, secondary_signals: ['oil'] },
    });
    expect(result.success).toBe(true);
    expect(result.data?.evidence.evidence_pack.risk_level).toBe('critical');
    expect(result.data?.evidence.evidence_pack.safety_alert).toMatch(
      /Voyant huile/,
    );
  });
  test('a critical symptom in the catalog does not escalate an unselected symptom', async () => {
    const f = nonCriticalFixture();
    f.tables.__diag_symptom.data = [
      { ...symptom, urgency: 'basse' },
      {
        ...symptom,
        id: 2,
        slug: 'oil',
        label: 'Voyant huile',
        urgency: 'critique',
      },
    ];
    const result = await pipeline(f.service).engine.analyze(input);
    expect(result.success).toBe(true);
    expect(result.data?.evidence.evidence_pack.risk_level).toBe('moderate');
    expect(result.data?.evidence.evidence_pack.safety_alert).toBeUndefined();
  });
  test('a low-ranked critical hypothesis cannot be downgraded by its score', () => {
    const scored = new HypothesisScoringEngine().score(
      [{ ...link, cause: { ...cause, urgency: 'critique' } }],
      undefined,
      undefined,
    )[0];
    const assessment = new RiskSafetyEngine().assess(
      [
        {
          ...scored,
          hypothesis_id: 'ordinary',
          urgency: 'basse',
          total_score: 95,
        },
        { ...scored, total_score: 0 },
      ],
      [],
      ['noise'],
    );
    expect(assessment).toMatchObject({
      risk_level: 'critical',
      requires_immediate_action: true,
      blocks_catalog: true,
    });
    expect(assessment.safety_alert).toMatch(/ne pas rouler/i);
    expect(assessment.risk_flags.join(' ')).toMatch(/Plaquettes/);
  });
  test.each(['inconnue', '', null])(
    'a direct scorer call refuses invalid urgency %p',
    (urgency) => {
      expect(() =>
        new HypothesisScoringEngine().score(
          [{ ...link, cause: { ...cause, urgency: urgency as string } }],
          undefined,
          undefined,
        ),
      ).toThrow();
    },
  );
  test.each(['basse', 'moyenne', 'haute', 'critique'])(
    'preserves %s without changing the scoring weights',
    (urgency) => {
      const scored = new HypothesisScoringEngine().score(
        [{ ...link, cause: { ...cause, urgency } }],
        undefined,
        undefined,
      )[0];
      expect(scored.urgency).toBe(urgency);
      expect(scored.total_score).toBe(57);
    },
  );
});

describe('complete cause-link coverage', () => {
  test.each(['partial', 'total'] as const)(
    'rejects %s loss of linked causes before returning or saving a diagnosis',
    async (loss) => {
      const f = fixture();
      f.tables.__diag_symptom_cause_link.data = [
        link,
        { ...link, id: 2, cause_id: 2, relative_score: 100 },
      ];
      // The response omits a cause filtered out or otherwise unavailable.
      // A valid surviving cause must not turn this into a complete diagnosis.
      f.tables.__diag_cause.data = loss === 'partial' ? [cause] : [];
      await expect(
        f.service.getScoredCausesForSymptom('noise'),
      ).rejects.toThrow(/coverage/i);
      const p = pipeline(f.service);
      const result = await p.engine.analyze(input);
      expect(result).toMatchObject({
        success: false,
        error: expect.stringMatching(/indisponible/i),
      });
      expect(result.data).toBeUndefined();
      expect(p.saved).not.toHaveBeenCalled();
      expect(p.enriched).not.toHaveBeenCalled();
    },
  );

  test('joins every complete reference by ID even if the response is reordered', async () => {
    const f = fixture();
    const second = { ...cause, id: 2, slug: 'second', urgency: 'critique' };
    const secondLink = { ...link, id: 2, cause_id: 2, relative_score: 0 };
    f.tables.__diag_symptom_cause_link.data = [link, secondLink];
    f.tables.__diag_cause.data = [second, cause];
    expect(await f.service.getScoredCausesForSymptom('noise')).toEqual([
      { ...link, cause },
      { ...secondLink, cause: second },
    ]);
    const result = await pipeline(f.service).engine.analyze(input);
    expect(result.success).toBe(true);
    expect(
      result.data?.evidence.evidence_pack.candidate_hypotheses,
    ).toHaveLength(2);
    expect(result.data?.evidence.evidence_pack.risk_level).toBe('critical');
  });
});

describe('uninterpreted questionnaire answers', () => {
  test.each([
    { answers: { position: 'avant' } },
    { answers: { temperature: '' } },
  ])(
    'discloses supplied answers without changing scores or hiding safety: $answers',
    async ({ answers }) => {
      const baseline = await pipeline(fixture().service).engine.analyze(input);
      const p = pipeline(fixture().service);
      const result = await p.engine.analyze({ ...input, answers });
      expect(result.success).toBe(true);
      const pack = result.data!.evidence.evidence_pack;
      const before = baseline.data!.evidence.evidence_pack;
      expect(pack.factual_inputs_missing).toContain(
        'Réponses complémentaires non interprétées : elles ne modifient ni les hypothèses ni le niveau de risque de cette analyse.',
      );
      expect(pack.candidate_hypotheses).toEqual(before.candidate_hypotheses);
      expect(pack.diagnostic_confidence).toBe(before.diagnostic_confidence);
      expect(pack.risk_level).toBe('critical');
      expect(pack.safety_alert).toBe(before.safety_alert);
      expect(pack.catalog_guard).toEqual(before.catalog_guard);
      expect(pack.factual_inputs_confirmed).toEqual(
        before.factual_inputs_confirmed,
      );
      expect(p.saved.mock.calls[0][0].answers).toEqual(answers);
      expect(p.saved.mock.calls[0][0].result).toBe(result.data!.evidence);
    },
  );

  test.each([{ answers: undefined }, { answers: {} }])(
    'does not claim answers were supplied when answers=$answers',
    async ({ answers }) => {
      const result = await pipeline(fixture().service).engine.analyze({
        ...input,
        answers,
      });
      expect(result.success).toBe(true);
      expect(
        result.data!.evidence.evidence_pack.factual_inputs_missing.join(' '),
      ).not.toMatch(/Réponses complémentaires/);
    },
  );
});

describe('accepted but uninterpreted input is disclosed', () => {
  test.each([
    {
      name: 'signal_context',
      extra: {
        signal_input: {
          ...input.signal_input,
          context: {
            frequency: 'intermittent',
            appears_when: ['freinage'],
            temperature_context: ['cold'],
            since_when: 'weeks',
          },
        },
      },
      message:
        'Contexte du symptôme non interprété : il ne modifie ni les hypothèses ni le niveau de risque.',
    },
    {
      name: 'immobilization',
      extra: { usage_context: { immobilized_days: 30 } },
      message: 'Durée d’immobilisation non prise en compte dans cette analyse.',
    },
    {
      name: 'zero_immobilization',
      extra: { usage_context: { immobilized_days: 0 } },
      message: 'Durée d’immobilisation non prise en compte dans cette analyse.',
    },
    {
      name: 'recent_repairs',
      extra: { usage_context: { recent_repairs: ['Plaquettes remplacées'] } },
      message:
        'Réparations récentes non prises en compte : elles ne prouvent ni la résolution du symptôme ni l’entretien des opérations concernées.',
    },
    {
      name: 'session_id',
      extra: { session_id: '12345678-1234-4123-8123-123456789abc' },
      message: 'Cette analyse ne reprend ni ne met à jour la session fournie.',
    },
  ])(
    'discloses $name without changing mechanical output',
    async ({ extra, message }) => {
      const base = await pipeline(fixture().service).engine.analyze(input);
      const f = pipeline(fixture().service);
      const result = await f.engine.analyze({ ...input, ...extra });
      expect(result.success).toBe(true);
      const pack = result.data!.evidence.evidence_pack;
      expect(pack.factual_inputs_missing).toContain(message);
      const { factual_inputs_missing: _before, ...before } =
        base.data!.evidence.evidence_pack;
      const { factual_inputs_missing: _after, ...after } = pack;
      expect(after).toEqual(before);
      expect(f.saved.mock.calls[0][0].result).toBe(result.data!.evidence);
    },
  );
  test.each([
    {},
    { signal_input: { ...input.signal_input, context: {} } },
    {
      signal_input: {
        ...input.signal_input,
        context: { appears_when: [], temperature_context: [] },
      },
      usage_context: { recent_repairs: [] },
    },
  ])('does not invent missing user context for %j', async (extra) => {
    const result = await pipeline(fixture().service).engine.analyze({
      ...input,
      ...extra,
    });
    expect(
      result.data!.evidence.evidence_pack.factual_inputs_missing.join(' '),
    ).not.toMatch(
      /Contexte du symptôme|Durée d’immobilisation|Réparations récentes|session fournie/,
    );
  });
  test.each([-1, Infinity, -Infinity, NaN])(
    'rejects invalid immobilization %s before reference reads',
    async (immobilized_days) => {
      const f = fixture();
      const result = await pipeline(f.service).engine.analyze({
        ...input,
        usage_context: { immobilized_days },
      });
      expect(result.success).toBe(false);
      expect(f.queries).toHaveLength(0);
    },
  );
  test('accepts a finite partial day without inventing a mechanical effect', async () => {
    const result = await pipeline(fixture().service).engine.analyze({
      ...input,
      usage_context: { immobilized_days: 0.5 },
    });
    expect(result.success).toBe(true);
    expect(
      result.data!.evidence.evidence_pack.factual_inputs_missing,
    ).toContain(
      'Durée d’immobilisation non prise en compte dans cette analyse.',
    );
  });
});

describe('session write acknowledgement reaches the diagnostic result', () => {
  const id = '12345678-1234-4123-8123-123456789abc';
  function saving(reply: Reply) {
    const f = fixture();
    f.tables.__diag_session = reply;
    const p = pipeline(f.service);
    // Exercise the real persistence adapter; only PostgREST is simulated.
    p.saved.mockRestore();
    return { ...f, engine: p.engine };
  }

  test.each([
    null,
    {},
    { id: null },
    { id: '' },
    { id: 'not-a-uuid' },
    { id: 42 },
    { id: [] },
    { id: { value: id } },
  ])('does not publish an unusable resumption id from %p', async (data) => {
    const f = saving({ data, error: null });
    const result = await f.engine.analyze(input);
    expect(result.success).toBe(true);
    expect(result.data?.session_id).toBeNull();
    const evidence = result.data?.evidence.evidence_pack;
    expect(evidence).toMatchObject({
      risk_level: 'critical',
      catalog_guard: { allowed_output_mode: 'none' },
    });
    expect(evidence?.safety_alert).toBeTruthy();
    expect(evidence?.factual_inputs_missing.join(' ')).toMatch(
      /Sauvegarde non confirmée/,
    );
    expect(f.writes).toHaveLength(1);
  });

  test.each([id, id.toUpperCase()])(
    'keeps a confirmed UUID %s and the stored result',
    async (confirmedId) => {
      const f = saving({ data: { id: confirmedId }, error: null });
      const result = await f.engine.analyze(input);
      expect(result.success).toBe(true);
      expect(result.data?.session_id).toBe(confirmedId);
      expect(f.writes).toHaveLength(1);
      expect(f.writes[0]).toMatchObject({ result: result.data?.evidence });
      expect(
        result.data?.evidence.evidence_pack.factual_inputs_missing.join(' '),
      ).not.toMatch(/Sauvegarde non confirmée|Analyse non sauvegardée/);
    },
  );

  test('a storage error takes precedence over a returned id', async () => {
    const f = saving({ data: { id }, error: { message: 'Storage rejected' } });
    const result = await f.engine.analyze(input);
    expect(result.success).toBe(true);
    expect(result.data?.session_id).toBeNull();
    expect(
      result.data?.evidence.evidence_pack.factual_inputs_missing.join(' '),
    ).toMatch(/Sauvegarde non confirmée/);
    expect(f.writes).toHaveLength(1);
  });

  test('a lost acknowledgement preserves safety without claiming absence of a saved row or retrying the insert', async () => {
    let committed: unknown;
    const f = saving({
      data: () => {
        committed = structuredClone(f.writes[0]);
        throw new Error('Acknowledgement lost after insert');
      },
      error: null,
    });
    const result = await f.engine.analyze(input);
    expect(result.success).toBe(true);
    expect(result.data?.session_id).toBeNull();
    expect(committed).toMatchObject({
      result: { evidence_pack: { risk_level: 'critical' } },
    });
    expect(f.writes).toHaveLength(1);
    const evidence = result.data?.evidence.evidence_pack;
    expect(evidence).toMatchObject({
      risk_level: 'critical',
      catalog_guard: { allowed_output_mode: 'none' },
    });
    expect(evidence?.safety_alert).toBeTruthy();
    expect(evidence?.factual_inputs_missing.join(' ')).toMatch(
      /Sauvegarde non confirmée/,
    );
    expect(evidence?.factual_inputs_missing.join(' ')).not.toMatch(
      /Analyse non sauvegardée/,
    );
  });
});

describe('catalogue family pages are read from the gamme level', () => {
  test('only main gammes have their own page', async () => {
    const f = fixture();
    f.tables.pieces_gamme = { data: [{ pg_id: '402' }], error: null };
    await expect(
      f.service.getGammeIdsWithCataloguePage([402, 71]),
    ).resolves.toEqual(new Set([402]));
    expect(f.queries.at(-1)).toEqual({
      table: 'pieces_gamme',
      filters: [
        ['pg_id', [402, 71]],
        ['pg_level', ['1', '2']],
      ],
    });
  });
  test('a failed read is not an empty catalogue', async () => {
    const f = fixture();
    f.tables.pieces_gamme = { data: null, error: { message: 'down' } };
    await expect(f.service.getGammeIdsWithCataloguePage([402])).rejects.toThrow(
      /unavailable/,
    );
  });
});
