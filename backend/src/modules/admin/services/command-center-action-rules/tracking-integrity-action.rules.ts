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
} from '../../../analytics/tracking-integrity/tracking-integrity-verdict.schema';
import { CONFIDENCE_BY_CERT, type RawAction } from './score-action';

/** Ce que corrige chaque contrôle en échec, et où regarder ses échantillons. */
const FAILED_CHECK_PLAYBOOK: Record<
  TrackingIntegrityCheck['id'],
  { sampleRef: string; step: string }
> = {
  order_event_key: {
    sampleRef: '__seo_event_log.id',
    step:
      "Faire porter le n° de commande (ord_id) à l'événement « commande passée » envoyé par la page de retour de paiement " +
      '(page adjacente au paiement : accord owner). Ne pas activer FUNNEL_SERVER_EMIT_ENABLED avant : ' +
      "l'émetteur serveur écrit ord_id, chaque vente serait comptée deux fois.",
  },
  order_event_coverage: {
    sampleRef: '___xtr_order.ord_id',
    step:
      "Activer l'émission serveur de « commande passée » (FUNNEL_SERVER_EMIT_ENABLED, décision owner) : " +
      'la page de retour de paiement ne voit pas toutes les commandes payées.',
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
    },
  ];
}
