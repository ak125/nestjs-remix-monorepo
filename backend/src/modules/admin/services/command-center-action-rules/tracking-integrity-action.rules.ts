/**
 * Consommateur Ventes du verdict `tracking-integrity-verdict.v1` (relais
 * Data → Ventes). Fonction pure : le service d'actions valide le verdict
 * (`safeParse`) puis le passe ici.
 *   CERTIFIED     → aucune action : la mesure des commandes est fiable ;
 *   NOT_CERTIFIED → action de réparation, contrôles en échec en preuve ;
 *   UNKNOWN       → action de certification : rien ne se décide sur une mesure non vérifiée.
 */
import type {
  TrackingIntegrityCheck,
  TrackingIntegrityVerdictV1,
} from '../../../analytics';
import { CONFIDENCE_BY_CERT, type RawAction } from './score-action';

/**
 * Ce que corrige chaque contrôle en échec, où regarder ses échantillons, et si
 * la correction attend l'accord owner (page adjacente au paiement, flag owner).
 */
const FAILED_CHECK_PLAYBOOK: Record<
  TrackingIntegrityCheck['id'],
  { sampleRef: string; step: string; ownerGo: boolean }
> = {
  order_event_key: {
    sampleRef: '__seo_event_log.id',
    ownerGo: true,
    step:
      'Vérifier le correctif ord_id déjà présent dans le code de retour de paiement : confirmer la version servie ' +
      'et contrôler les événements émis après son déploiement, séparément des anomalies historiques. ' +
      'Si le défaut persiste sur cette version, qualifier la correction avec accord owner (page adjacente au paiement). ' +
      'Ne pas activer FUNNEL_SERVER_EMIT_ENABLED avant validation de la clé et de la déduplication client/serveur.',
  },
  order_event_coverage: {
    sampleRef: '___xtr_order.ord_id',
    ownerGo: true,
    step:
      'Vérifier la couverture des commandes payées par les événements récents et l’état effectif de l’émetteur serveur ' +
      '(FUNNEL_SERVER_EMIT_ENABLED). La page de retour de paiement peut manquer des commandes ; ' +
      'si l’émetteur est désactivé et le défaut confirmé, préparer son activation avec accord owner, ' +
      'après validation de la clé ord_id et de la déduplication client/serveur.',
  },
};

export function buildTrackingIntegrityActions(
  verdict: TrackingIntegrityVerdictV1,
): RawAction[] {
  const window = `${verdict.contract} · ${verdict.window.from} → ${verdict.window.to}`;

  if (verdict.status === 'CERTIFIED') return [];

  if (verdict.status === 'UNKNOWN') {
    return [
      {
        id: 'data:tracking-integrity',
        title: 'Fiabilité de la mesure des commandes non vérifiable',
        department: 'data',
        source: 'data',
        action_type: 'certification',
        impact: 7,
        urgency: 6,
        data_confidence: CONFIDENCE_BY_CERT.UNKNOWN,
        effort: 3,
        risk: 1,
        reason: verdict.reason ?? 'Verdict UNKNOWN sans raison',
        evidence: [window],
        next_step:
          'Rendre la mesure vérifiable (lecture des événements et des commandes) avant toute décision commerciale fondée sur le tunnel.',
        owner_go_required: false,
      },
    ];
  }

  const failed = verdict.checks.filter((c) => c.status === 'FAIL');
  return [
    {
      id: 'data:tracking-integrity',
      title: `Mesure des commandes non fiable — ${failed.length} contrôle(s) en échec`,
      department: 'data',
      source: 'data',
      action_type: 'repair',
      impact: 9,
      urgency: 8,
      // défaut mesuré en base, pas supposé
      data_confidence: CONFIDENCE_BY_CERT.CERTIFIED,
      effort: 3,
      risk: 2,
      reason:
        failed.map((c) => c.detail).join(' ; ') +
        " — toute analyse de conversion Ventes serait fausse tant que ce verdict n'est pas CERTIFIED.",
      evidence: [
        window,
        ...failed.flatMap((c) => [
          `${c.id} : ${c.observed}/${c.expected}`,
          ...c.samples.map(
            (s) => `${FAILED_CHECK_PLAYBOOK[c.id].sampleRef}=${s}`,
          ),
        ]),
      ],
      next_step: failed
        .map((c) => FAILED_CHECK_PLAYBOOK[c.id].step)
        .join(' Puis : '),
      owner_go_required: failed.some(
        (c) => FAILED_CHECK_PLAYBOOK[c.id].ownerGo,
      ),
    },
  ];
}
