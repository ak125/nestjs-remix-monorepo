/**
 * Rapport départemental (Vue 5) — fonction pure buildDepartmentReports.
 *
 * Garanties :
 *   1. un KPI sans producteur ou illisible n'a jamais de valeur ni de score ;
 *   2. l'évolution suit le sens d'amélioration déclaré, INCONNUE sans fenêtre précédente ;
 *   3. la décision machine est REUSE ou IMPROVE, jamais CREATE ni PAUSE ;
 *   4. « feu vert owner » est celui de l'action qui a produit le trou, jamais déduit.
 */
import { CcDepartmentReportSchema } from '@repo/registry';
import { buildDepartmentReports } from '../../src/modules/admin/services/command-center-action-rules/department-report.rules';
import type { OwnerActionV2 } from '../../src/modules/admin/services/command-center-action-rules/score-action';
import type { LiveKpiMeasure } from '../../src/modules/admin/services/command-center-action-rules/live-kpi';

const AS_OF = '2026-10-05T10:00:00.000Z';

function dept(
  id: string,
  priority: string | null,
  kpi: string | null = `${id}_kpi`,
) {
  return { id, label: id.toUpperCase(), priority, kpi_primary: kpi };
}

function action(
  id: string,
  department: string,
  over: Partial<OwnerActionV2> = {},
): OwnerActionV2 {
  return {
    id,
    title: `titre ${id}`,
    department,
    source: 'governance',
    action_type: 'certification',
    impact: 6,
    urgency: 6,
    data_confidence: 90,
    effort: 4,
    risk: 2,
    score: 15,
    reason: `raison ${id}`,
    evidence: [`preuve ${id}`],
    next_step: `étape ${id}`,
    details: null,
    owner_go_required: false,
    ...over,
  };
}

function measure(
  id: string,
  value: number | null,
  status: LiveKpiMeasure['kpi']['status'],
  previous_value: number | null = null,
): LiveKpiMeasure {
  return {
    kpi: {
      id,
      label: `libellé ${id}`,
      value,
      unit: value == null ? undefined : '/5',
      status,
      source: 'db',
      certified: value != null,
    },
    window_days: 30,
    previous_value,
    better: 'higher',
  };
}

function one(
  d: ReturnType<typeof dept>,
  actions: OwnerActionV2[] = [],
  measures: LiveKpiMeasure[] = [],
) {
  const [r] = buildDepartmentReports({
    departments: [d],
    actions,
    measures,
    as_of: AS_OF,
  });
  return r;
}

describe('buildDepartmentReports — Vue 5', () => {
  it('chaque rapport respecte le contrat @repo/registry', () => {
    const reports = buildDepartmentReports({
      departments: [
        dept('sales', 'P0'),
        dept('seo', 'P1'),
        dept('x', null, null),
      ],
      actions: [action('repair:sales', 'sales')],
      measures: [measure('sales_kpi', 2, 'WARNING', 1)],
      as_of: AS_OF,
    });
    for (const r of reports)
      expect(CcDepartmentReportSchema.parse(r)).toEqual(r);
  });

  it('KPI sans producteur → SANS_PRODUCTEUR, NON_MESURE, aucun chiffre', () => {
    const r = one(dept('seo', 'P1'));
    expect(r).toMatchObject({
      kpi: {
        id: 'seo_kpi',
        measure: 'SANS_PRODUCTEUR',
        value: null,
        previous_value: null,
      },
      score: 'NON_MESURE',
      evolution: 'INCONNUE',
      period: { as_of: AS_OF, window_days: null },
      decision: 'IMPROVE',
      owner_go_required: false,
    });
    expect(r.gap).toContain('aucun producteur');
    expect(r.evidence).toEqual([
      '.spec/00-canon/ai-registry/agent-operating-map.yaml#seo',
    ]);
  });

  it('KPI illisible → ILLISIBLE, NON_MESURE, cause = lecture en échec', () => {
    const r = one(
      dept('sales', 'P0'),
      [],
      [measure('sales_kpi', null, 'UNKNOWN', 3)],
    );
    expect(r.kpi).toMatchObject({
      measure: 'ILLISIBLE',
      value: null,
      previous_value: null,
    });
    expect(r.score).toBe('NON_MESURE');
    expect(r.gap).toContain('illisible');
    expect(r.probable_cause).toContain('[command-center-kpi]');
  });

  it.each([
    ['OK', 'FORT'],
    ['WARNING', 'MOYEN'],
    ['CRITICAL', 'CRITIQUE'],
  ] as const)('statut %s → score %s', (status, score) => {
    expect(
      one(dept('sales', 'P0'), [], [measure('sales_kpi', 1, status)]).score,
    ).toBe(score);
  });

  it.each([
    [3, 1, 'MIEUX'],
    [1, 3, 'PIRE'],
    [2, 2, 'STABLE'],
    [2, null, 'INCONNUE'],
  ] as const)('valeur %s contre %s → %s', (value, previous, evolution) => {
    expect(
      one(
        dept('sales', 'P0'),
        [],
        [measure('sales_kpi', value, 'OK', previous)],
      ).evolution,
    ).toBe(evolution);
  });

  it('sens « lower » : une baisse est un progrès', () => {
    const m = { ...measure('sales_kpi', 1, 'OK', 3), better: 'lower' as const };
    expect(one(dept('sales', 'P0'), [], [m]).evolution).toBe('MIEUX');
  });

  it('action ouverte → IMPROVE, trou/cause/étape = action la mieux classée, feu vert repris', () => {
    const r = one(dept('pricing', 'P0'), [
      action('pricing:sell-at-loss', 'pricing', {
        risk: 5,
        owner_go_required: true,
      }),
      action('pricing:wire-margin-thresholds', 'pricing'),
      action('repair:other', 'other'),
    ]);
    expect(r).toMatchObject({
      decision: 'IMPROVE',
      gap: 'titre pricing:sell-at-loss',
      probable_cause: 'raison pricing:sell-at-loss',
      next_evidence: 'étape pricing:sell-at-loss',
      risk: 'MOYEN',
      owner_go_required: true,
      open_action_ids: [
        'pricing:sell-at-loss',
        'pricing:wire-margin-thresholds',
      ],
    });
    expect(r.evidence).toEqual(['preuve pricing:sell-at-loss']);
  });

  it.each([
    [0, 'FAIBLE'],
    [3, 'FAIBLE'],
    [4, 'MOYEN'],
    [6, 'MOYEN'],
    [7, 'HAUT'],
  ] as const)('risque d’action %s → %s', (risk, expected) => {
    expect(one(dept('a', 'P1'), [action('x', 'a', { risk })]).risk).toBe(
      expected,
    );
  });

  it('KPI mesuré + action : la mesure figure en tête des preuves, sans doublon, 5 max', () => {
    const r = one(
      dept('sales', 'P0'),
      [
        action('repair:sales', 'sales', {
          evidence: ['a', 'a', 'b', 'c', 'd', 'e', 'f'],
        }),
      ],
      [measure('sales_kpi', 0, 'CRITICAL', 1)],
    );
    expect(r.evidence).toEqual([
      'sales_kpi = 0/5 (base, 30 j)',
      'a',
      'b',
      'c',
      'd',
    ]);
    expect(r.period.window_days).toBe(30);
  });

  it('KPI mesuré fort, aucune action → REUSE', () => {
    const r = one(dept('sales', 'P0'), [], [measure('sales_kpi', 4, 'OK', 4)]);
    expect(r).toMatchObject({
      decision: 'REUSE',
      gap: null,
      owner_go_required: false,
    });
  });

  it('KPI mesuré faible, aucune action → IMPROVE, cause non inventée', () => {
    const r = one(
      dept('sales', 'P0'),
      [],
      [measure('sales_kpi', 0, 'CRITICAL')],
    );
    expect(r.decision).toBe('IMPROVE');
    expect(r.gap).toBe('KPI « libellé sales_kpi » à 0/5.');
    expect(r.probable_cause).toBeNull();
  });

  it('aucun KPI primaire déclaré → IMPROVE, la carte est à compléter par l’owner', () => {
    const r = one(dept('x', 'P2', null));
    expect(r.kpi).toMatchObject({ id: null, measure: 'SANS_PRODUCTEUR' });
    expect(r.owner_go_required).toBe(true);
  });

  it('jamais CREATE ni PAUSE', () => {
    const reports = buildDepartmentReports({
      departments: [dept('a', 'P0'), dept('b', 'P1', null), dept('c', 'P2')],
      actions: [action('x', 'a')],
      measures: [measure('c_kpi', 5, 'OK', 5)],
      as_of: AS_OF,
    });
    expect(reports.map((r) => r.decision).sort()).toEqual([
      'IMPROVE',
      'IMPROVE',
      'REUSE',
    ]);
  });

  it('tri : priorité, puis score le plus préoccupant, puis id ; sans priorité en dernier', () => {
    const reports = buildDepartmentReports({
      departments: [
        dept('z', null),
        dept('b', 'P1'),
        dept('ok', 'P0'),
        dept('crit', 'P0'),
        dept('a', 'P1'),
      ],
      actions: [],
      measures: [
        measure('ok_kpi', 3, 'OK'),
        measure('crit_kpi', 0, 'CRITICAL'),
      ],
      as_of: AS_OF,
    });
    expect(reports.map((r) => r.department)).toEqual([
      'crit',
      'ok',
      'a',
      'b',
      'z',
    ]);
  });
});
