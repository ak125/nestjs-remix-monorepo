/**
 * Rapport départemental (Vue 5) — fonction pure buildDepartmentReports.
 *
 * Garanties :
 *   1. un KPI sans producteur ou illisible n'a jamais de valeur ni de score ;
 *   2. l'évolution suit le sens d'amélioration déclaré, INCONNUE sans fenêtre précédente ;
 *   3. la décision machine est REUSE ou IMPROVE, jamais CREATE ni PAUSE ;
 *   4. « feu vert owner » est celui de l'action qui a produit le trou, jamais déduit ;
 *   5. la cause probable vient de l'action ou d'un constat lu en base, jamais devinée.
 */
import { CcDepartmentReportSchema } from '@repo/registry';
import { buildDepartmentReports } from '../../src/modules/admin/services/command-center-action-rules/department-report.rules';
import {
  toDiagnosticToProductKpi,
  toPagesGeneratingAtcKpi,
} from '../../src/modules/admin/services/command-center-action-rules/department-kpi.rules';
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
  it('sans session exploitable : zéro lisible, score neutre, comparaison inconnue', () => {
    const r = one(
      dept('diagnostic', 'P1', 'diagnostic_to_product'),
      [],
      [
        {
          kpi: toDiagnosticToProductKpi({ sessions: 0, reachedProduct: 0 }, 30),
          sample_size: 0,
          window_days: 30,
          previous_value: 2,
          better: 'higher',
        },
      ],
    );
    expect(r).toMatchObject({
      kpi: { measure: 'MESURE', value: 0, unit: '/0', previous_value: 2 },
      score: 'NON_MESURE',
      evolution: 'INCONNUE',
      decision: 'IMPROVE',
      owner_go_required: false,
      probable_cause: null,
    });
    expect(r.gap).toMatch(/aucune session exploitable/i);
    expect(r.next_evidence).toMatch(/collecte/);
    expect(r.next_evidence).toMatch(/session/);
    expect(r.evidence.join(' ')).toMatch(/aucune session exploitable/i);
    expect(CcDepartmentReportSchema.parse(r)).toEqual(r);
  });

  it.each([false, true])(
    'sans session, une action ouverte garde ses droits (%s) et sa priorité',
    (owner) => {
      const r = one(
        dept('diagnostic', 'P1', 'diagnostic_to_product'),
        [action('repair', 'diagnostic', { owner_go_required: owner })],
        [
          {
            kpi: toDiagnosticToProductKpi(
              { sessions: 0, reachedProduct: 0 },
              30,
            ),
            sample_size: 0,
            window_days: 30,
            previous_value: 0,
            better: 'higher',
          },
        ],
      );
      expect(r).toMatchObject({
        score: 'NON_MESURE',
        evolution: 'INCONNUE',
        gap: 'titre repair',
        next_evidence: 'étape repair',
        owner_go_required: owner,
      });
      expect(r.evidence.join(' ')).toMatch(/aucune session exploitable/i);
    },
  );

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

  it.each([
    toPagesGeneratingAtcKpi(48, 30),
    toDiagnosticToProductKpi({ sessions: 5000, reachedProduct: 1 }, 30),
  ])('$id sans cible : mesure conservée, performance non évaluée', (kpi) => {
    const m: LiveKpiMeasure = {
      kpi,
      window_days: 30,
      previous_value: 0,
      better: 'higher',
    };
    const r = one(dept('measured', 'P1', kpi.id), [], [m]);
    expect(r).toMatchObject({
      kpi: { measure: 'MESURE', value: kpi.value, previous_value: 0 },
      score: 'NON_MESURE',
      decision: 'IMPROVE',
      owner_go_required: true,
      evolution: 'MIEUX',
      probable_cause: null,
    });
    expect(r.gap).toMatch(/performance non évaluée/i);
    expect(r.next_evidence).toMatch(/cible|critère/);
    expect(r.next_evidence).toMatch(/owner/);
    expect(CcDepartmentReportSchema.parse(r)).toEqual(r);
  });

  it('une action ouverte conserve sa priorité sur la qualification de la mesure', () => {
    const r = one(
      dept('seo', 'P1'),
      [action('repair', 'seo')],
      [measure('seo_kpi', 48, 'UNKNOWN')],
    );
    expect(r).toMatchObject({
      score: 'NON_MESURE',
      decision: 'IMPROVE',
      gap: 'titre repair',
      next_evidence: 'étape repair',
      owner_go_required: false,
    });
  });

  it.each([
    toPagesGeneratingAtcKpi(0, 30),
    toDiagnosticToProductKpi({ sessions: 5, reachedProduct: 0 }, 30),
  ])('$id : zéro reste une mesure avec son alerte existante', (kpi) => {
    const r = one(
      dept('zero', 'P1', kpi.id),
      [],
      [
        {
          kpi,
          window_days: 30,
          previous_value: null,
          better: 'higher',
        },
      ],
    );
    expect(r).toMatchObject({
      kpi: { value: 0, measure: 'MESURE' },
      score: 'CRITIQUE',
      decision: 'IMPROVE',
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

  const CONSTAT = 'Annulations après paiement — motif saisi : « pas dispo » ×2';
  const observed = (m: LiveKpiMeasure): LiveKpiMeasure => ({
    ...m,
    observed_cause: CONSTAT,
  });

  it('constat lu en base : suit la mesure, donc parmi les trois preuves affichées', () => {
    const r = one(
      dept('sales', 'P0'),
      [action('repair:sales', 'sales', { evidence: ['a', 'b'] })],
      [observed(measure('sales_kpi', 0, 'CRITICAL', 2))],
    );
    expect(r.evidence).toEqual([
      'sales_kpi = 0/5 (base, 30 j)',
      CONSTAT,
      'a',
      'b',
    ]);
    // l'action ouverte garde la main sur trou / cause / étape
    expect(r.probable_cause).toBe('raison repair:sales');
    expect(CcDepartmentReportSchema.parse(r)).toEqual(r);
  });

  it('KPI mesuré faible, aucune action, constat → cause probable = constat', () => {
    const r = one(
      dept('sales', 'P0'),
      [],
      [observed(measure('sales_kpi', 0, 'CRITICAL'))],
    );
    expect(r.probable_cause).toBe(CONSTAT);
    expect(r.evidence).toEqual(['sales_kpi = 0/5 (base, 30 j)', CONSTAT]);
  });

  it('KPI illisible : un constat éventuel n’est pas repris', () => {
    const r = one(
      dept('sales', 'P0'),
      [],
      [observed(measure('sales_kpi', null, 'UNKNOWN'))],
    );
    expect(r.evidence).not.toContain(CONSTAT);
    expect(r.probable_cause).not.toBe(CONSTAT);
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

describe('human responsibilities', () => {
  const human = {
    ...dept('legal', null, null),
    operating_mode: 'human' as const,
  };
  it('requests qualification of procedure and activity without inventing a KPI', () => {
    const r = one(human);
    expect(r.score).toBe('NON_MESURE');
    expect(r.kpi.measure).toBe('SANS_PRODUCTEUR');
    expect(r.kpi.value).toBeNull();
    expect(r.evolution).toBe('INCONNUE');
    expect(r.probable_cause).toBeNull();
    expect(r.owner_go_required).toBe(true);
    expect(r.decision).toBe('IMPROVE');
    expect(r.next_evidence).toMatch(/responsable, la procédure/);
    expect(r.next_evidence).not.toMatch(/KPI|producteur/);
  });
  it('existing action keeps its next step and owner decision', () => {
    const a = action('open', 'legal');
    const r = one(human, [a]);
    expect(r.next_evidence).toBe(a.next_step);
    expect(r.owner_go_required).toBe(a.owner_go_required);
  });
  it('declared KPI retains its measurement and evolution', () => {
    const r = one(
      { ...human, kpi_primary: 'legal_kpi' },
      [],
      [measure('legal_kpi', 4, 'OK', 3)],
    );
    expect(r.kpi.measure).toBe('MESURE');
    expect(r.evolution).toBe('MIEUX');
    expect(r.score).toBe('FORT');
  });
});

describe('R8 — priorité des actions', () => {
  it.each([false, true])(
    'conserve action et droit owner=%s avec une cause visible',
    (owner) => {
      const a = action('open', 'seo', {
        owner_go_required: owner,
        evidence: ['a', 'b', 'c'],
      });
      const r = one(
        dept('seo', 'P1', 'pages_generating_atc'),
        [a],
        [
          {
            ...measure('pages_generating_atc', null, 'UNKNOWN'),
            read_failure: 'incomplete',
          },
        ],
      );
      expect(r).toMatchObject({
        gap: a.title,
        probable_cause: a.reason,
        next_evidence: a.next_step,
        owner_go_required: owner,
      });
      expect(r.evidence.slice(0, 3).join(' ')).toMatch(/lecture incomplète/i);
      expect(r.evidence.slice(0, 3).join(' ')).toMatch(/complétude/i);
    },
  );
});
