/**
 * Rapport départemental (Vue 5 de audit/automecanik-departments-map.md) calculé à
 * la demande — fonction pure, aucune lecture : elle recompose ce que le Command
 * Center sait déjà (carte opérationnelle, file d'actions, indicateurs mesurés).
 *
 * Règles d'honnêteté :
 *   - un KPI sans producteur est « SANS_PRODUCTEUR », jamais un chiffre supposé ;
 *   - l'évolution n'existe que si la fenêtre précédente a été relue en base ;
 *   - la décision machine est REUSE ou IMPROVE uniquement : CREATE exige un trou
 *     prouvé (Vue 4) et PAUSE une décision owner — le schéma les garde pour les
 *     rapports écrits par un humain ;
 *   - « feu vert owner » vient de la règle qui a émis l'action, jamais déduit ;
 *   - la cause probable vient de l'action ouverte ou d'un constat lu en base
 *     (`observed_cause`, ex. motifs saisis à l'annulation), jamais devinée.
 */
import type { CcDepartmentReport } from '@repo/registry';
import type { KpiReadFailure, LiveKpiMeasure } from './live-kpi';
import type { OwnerActionV2 } from './score-action';

interface ReportDeptView {
  id: string;
  label: string;
  priority: string | null;
  kpi_primary: string | null;
  operating_mode?: 'human' | 'software' | 'hybrid';
}

type Score = CcDepartmentReport['score'];
type Risk = CcDepartmentReport['risk'];

const OPERATING_MAP = '.spec/00-canon/ai-registry/agent-operating-map.yaml';
const MAX_EVIDENCE = 5;
const NO_SAMPLE = 'Aucune session exploitable sur la période.';

/** Texte prédéfini : aucun message brut de base de données ne part au digest. */
const READ_FAILURE: Record<KpiReadFailure, { cause: string; next: string }> = {
  read_failed: {
    cause: 'Lecture de la source en échec.',
    next: 'Consulter les journaux du backend ([command-center-kpi]) et rétablir la lecture.',
  },
  access_denied: {
    cause: 'Accès refusé à la source.',
    next: 'Vérifier les droits de lecture prévus pour le rôle utilisé, sans élargissement automatique.',
  },
  incomplete: {
    cause:
      'Lecture incomplète : toutes les lignes attendues n’ont pas été reçues.',
    next: 'Vérifier la complétude de la lecture avant tout calcul ; conserver le plafond actuel.',
  },
  completeness_unverified: {
    cause:
      'Complétude de la lecture non vérifiable : total absent ou incohérent.',
    next: 'Vérifier le comptage exact et sa cohérence avec les lignes reçues avant tout calcul.',
  },
};

const SCORE_BY_STATUS: Record<LiveKpiMeasure['kpi']['status'], Score> = {
  OK: 'FORT',
  WARNING: 'MOYEN',
  CRITICAL: 'CRITIQUE',
  UNKNOWN: 'NON_MESURE',
};

/** Le plus préoccupant d'abord, à priorité égale. */
const SCORE_RANK: Record<Score, number> = {
  CRITIQUE: 0,
  FAIBLE: 1,
  MOYEN: 2,
  NON_MESURE: 3,
  FORT: 4,
};

const PRIORITY_RANK: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

/** Risque d'agir de l'action (0..10) → terciles du rapport. */
function toRisk(actionRisk: number): Risk {
  if (actionRisk <= 3) return 'FAIBLE';
  if (actionRisk <= 6) return 'MOYEN';
  return 'HAUT';
}

function toPriority(p: string | null): CcDepartmentReport['priority'] {
  return p === 'P0' || p === 'P1' || p === 'P2' || p === 'P3' ? p : null;
}

function evolutionOf(m: LiveKpiMeasure): CcDepartmentReport['evolution'] {
  const { value } = m.kpi;
  if (value == null || m.previous_value == null || m.sample_size === 0)
    return 'INCONNUE';
  if (value === m.previous_value) return 'STABLE';
  const rose = value > m.previous_value;
  return rose === (m.better === 'higher') ? 'MIEUX' : 'PIRE';
}

export function buildDepartmentReports(input: {
  departments: readonly ReportDeptView[];
  actions: readonly OwnerActionV2[];
  measures: readonly LiveKpiMeasure[];
  as_of: string;
}): CcDepartmentReport[] {
  const measureById = new Map(input.measures.map((m) => [m.kpi.id, m]));

  const reports = input.departments.map((d): CcDepartmentReport => {
    // file d'actions déjà triée par score : la première est la plus utile
    const open = input.actions.filter((a) => a.department === d.id);
    const top = open[0];
    const m = d.kpi_primary ? measureById.get(d.kpi_primary) : undefined;
    const measured = m != null && m.kpi.value != null;
    const noSample = measured && m.sample_size === 0;
    const kpiName = d.kpi_primary ?? 'non déclaré';
    const readFailure =
      !measured && m?.read_failure ? READ_FAILURE[m.read_failure] : undefined;
    const previousFailure = m?.previous_read_failure
      ? READ_FAILURE[m.previous_read_failure]
      : undefined;

    const kpi: CcDepartmentReport['kpi'] = {
      id: d.kpi_primary,
      label: m?.kpi.label ?? null,
      measure: !m ? 'SANS_PRODUCTEUR' : measured ? 'MESURE' : 'ILLISIBLE',
      value: measured ? m.kpi.value : null,
      unit: measured ? (m.kpi.unit ?? null) : null,
      previous_value: measured ? m.previous_value : null,
    };
    const score: Score = measured
      ? SCORE_BY_STATUS[m.kpi.status]
      : 'NON_MESURE';

    // Le constat suit la mesure : l'écran ne montre que les trois premières preuves.
    const evidence = [
      ...(measured
        ? [
            `${m.kpi.id} = ${m.kpi.value}${m.kpi.unit ?? ''} (base, ${m.window_days} j)`,
            ...(noSample ? [NO_SAMPLE] : []),
            ...(m.observed_cause ? [m.observed_cause] : []),
          ]
        : []),
      ...(readFailure
        ? [`Période courante : ${readFailure.cause} ${readFailure.next}`]
        : []),
      ...(previousFailure
        ? [
            `Période précédente : ${previousFailure.cause} ${previousFailure.next}`,
          ]
        : []),
      ...(top?.evidence ?? []),
    ];
    const dedup = [...new Set(evidence)].slice(0, MAX_EVIDENCE);

    const base = {
      department: d.id,
      label: d.label,
      priority: toPriority(d.priority),
      period: {
        as_of: input.as_of,
        window_days: measured ? m.window_days : null,
      },
      kpi,
      score,
      evolution: measured ? evolutionOf(m) : ('INCONNUE' as const),
      evidence: dedup.length ? dedup : [`${OPERATING_MAP}#${d.id}`],
      open_action_ids: open.map((a) => a.id),
    };

    if (top) {
      return {
        ...base,
        gap: top.title,
        probable_cause: top.reason,
        decision: 'IMPROVE',
        risk: toRisk(top.risk),
        owner_go_required: top.owner_go_required,
        next_evidence: top.next_step,
      };
    }
    if (!d.kpi_primary && d.operating_mode === 'human') {
      return {
        ...base,
        gap: "Responsabilité humaine sans KPI déclaré ; procédure et preuve d'activité à qualifier",
        probable_cause: null,
        decision: 'IMPROVE',
        risk: 'FAIBLE',
        owner_go_required: true,
        next_evidence:
          "Renseigner ou vérifier dans la fiche le responsable, la procédure et la preuve d'activité attendue.",
      };
    }
    if (!d.kpi_primary) {
      return {
        ...base,
        gap: 'Aucun KPI primaire déclaré dans la carte opérationnelle.',
        probable_cause: null,
        decision: 'IMPROVE',
        risk: 'FAIBLE',
        // la carte opérationnelle est modifiable par l'owner seul
        owner_go_required: true,
        next_evidence: `Déclarer le KPI primaire de « ${d.label} » dans ${OPERATING_MAP}.`,
      };
    }
    if (!measured) {
      return {
        ...base,
        gap: m
          ? `KPI « ${kpiName} » illisible : ${readFailure?.cause ?? "la source n'a pas répondu."}`
          : `KPI « ${kpiName} » non mesuré : aucun producteur branché.`,
        probable_cause: m
          ? (readFailure?.cause ??
            'Lecture de la source en échec (journaux du backend, préfixe [command-center-kpi]).')
          : null,
        decision: 'IMPROVE',
        risk: 'FAIBLE',
        owner_go_required: false,
        next_evidence: m
          ? (readFailure?.next ?? `Rétablir la lecture de « ${kpiName} ».`)
          : `Brancher un producteur en lecture seule pour « ${kpiName} ».`,
      };
    }
    if (noSample) {
      return {
        ...base,
        gap: NO_SAMPLE,
        probable_cause: null,
        decision: 'IMPROVE',
        risk: 'FAIBLE',
        owner_go_required: false,
        next_evidence:
          'Vérifier la collecte et obtenir une période avec des sessions exploitables.',
      };
    }
    // NON_MESURE porte sur le score : la valeur reste MESURE lorsqu'une lecture
    // existe, mais qu'aucun critère ne permet d'en qualifier la performance.
    if (score === 'NON_MESURE') {
      return {
        ...base,
        gap: `Performance non évaluée pour « ${m.kpi.label} » : critère de réussite non qualifié.`,
        probable_cause: m.observed_cause ?? null,
        decision: 'IMPROVE',
        risk: 'FAIBLE',
        owner_go_required: true,
        next_evidence:
          'Faire définir ou valider une cible ou un critère de réussite par l’owner avant de qualifier la performance.',
      };
    }
    if (score !== 'FORT') {
      return {
        ...base,
        gap: `KPI « ${m.kpi.label} » à ${m.kpi.value}${m.kpi.unit ?? ''}.`,
        // constat lu en base, sinon rien : la cause n'est jamais devinée
        probable_cause: m.observed_cause ?? null,
        decision: 'IMPROVE',
        risk: 'FAIBLE',
        owner_go_required: false,
        next_evidence:
          'Analyser l’écart sur la prochaine fenêtre avant toute action.',
      };
    }
    return {
      ...base,
      gap: null,
      probable_cause: null,
      decision: 'REUSE',
      risk: 'FAIBLE',
      owner_go_required: false,
      next_evidence: 'Même mesure sur la prochaine fenêtre.',
    };
  });

  return reports.sort(
    (x, y) =>
      (PRIORITY_RANK[x.priority ?? ''] ?? 9) -
        (PRIORITY_RANK[y.priority ?? ''] ?? 9) ||
      SCORE_RANK[x.score] - SCORE_RANK[y.score] ||
      (x.department < y.department ? -1 : x.department > y.department ? 1 : 0),
  );
}

export type { ReportDeptView };
