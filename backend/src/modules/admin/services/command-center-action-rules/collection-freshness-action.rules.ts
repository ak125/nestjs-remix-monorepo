/**
 * Fraîcheur des collectes Search Console et GA4 (mandat AT, point 3) — Data.
 *
 * Fonction pure : le service d'actions lit le dernier jour collecté de chaque
 * source et un recoupement sur les derniers jours communs, puis les passe ici.
 *
 *   - Retard d'une source = jours entiers écoulés depuis la FIN de son dernier
 *     jour collecté. La collecte quotidienne (seo-monitor / daily-fetch) lit
 *     J-3 : en régime normal le retard vaut 2 après le passage, 3 juste avant.
 *     Au-delà de FRESHNESS_ALERT_DAYS (3) ⇒ action de réparation. Aucune ligne
 *     ⇒ action de certification (fraîcheur inconnue, jamais « à jour »).
 *   - Search Console : seuls les jours confirmés (`commit_version` posé en
 *     dernier par l'ingesteur) comptent.
 *   - GA4 en recoupement seulement : sessions du canal « organic search »
 *     comparées aux clics Search Console sur les mêmes jours ; un écart relatif
 *     de plus de CROSSCHECK_MAX_GAP (20 %) est signalé, sans rien corriger.
 *
 * Aucune action quand tout est frais et l'écart dans le seuil : la fraîcheur
 * figure alors dans la preuve de chaque action émise ici.
 */
import { CONFIDENCE_BY_CERT, type RawAction } from './score-action';

export const FRESHNESS_ALERT_DAYS = 3;
export const CROSSCHECK_MAX_GAP = 0.2;
const DAY_MS = 86_400_000;

export type CollectionSource = 'gsc' | 'ga4';

const LABEL: Record<CollectionSource, string> = {
  gsc: 'Search Console',
  ga4: 'GA4',
};

export interface CollectionCrossCheck {
  /** Jours communs retenus (dates YYYY-MM-DD). */
  days: string[];
  gscClicks: number;
  ga4OrganicSessions: number;
}

export interface CollectionFreshnessInput {
  now: Date;
  /** Dernier jour collecté (YYYY-MM-DD), null si aucune ligne. */
  lastDate: Record<CollectionSource, string | null>;
  crossCheck: CollectionCrossCheck | null;
}

/** Jours entiers depuis la fin du dernier jour collecté ; null si date absente/invalide. */
export function collectionLagDays(
  lastDate: string | null,
  now: Date,
): number | null {
  if (!lastDate) return null;
  const start = Date.parse(`${lastDate}T00:00:00Z`);
  if (!Number.isFinite(start)) return null;
  return Math.max(0, Math.floor((now.getTime() - (start + DAY_MS)) / DAY_MS));
}

/** Écart relatif |GA4 − GSC| / GSC ; null si GSC vaut 0 (non calculable). */
export function crossCheckGap(c: CollectionCrossCheck): number | null {
  if (c.gscClicks <= 0) return null;
  return Math.abs(c.ga4OrganicSessions - c.gscClicks) / c.gscClicks;
}

function freshnessLine(
  source: CollectionSource,
  lastDate: string | null,
  now: Date,
): string {
  const lag = collectionLagDays(lastDate, now);
  return lag === null
    ? `${LABEL[source]} : aucun jour collecté lisible`
    : `${LABEL[source]} : dernier jour ${lastDate}, retard ${lag} j (alerte au-delà de ${FRESHNESS_ALERT_DAYS} j)`;
}

function crossCheckLine(c: CollectionCrossCheck | null): string {
  if (!c || c.days.length === 0)
    return 'Recoupement GA4 / Search Console : aucun jour commun';
  const gap = crossCheckGap(c);
  const window = `${c.days[0]} → ${c.days[c.days.length - 1]} (${c.days.length} j)`;
  return `Recoupement ${window} : GA4 ${c.ga4OrganicSessions} sessions « organic search » / Search Console ${c.gscClicks} clics — écart ${
    gap === null ? 'non calculable' : `${Math.round(gap * 100)} %`
  } (seuil ${Math.round(CROSSCHECK_MAX_GAP * 100)} %)`;
}

export function buildCollectionFreshnessActions(
  input: CollectionFreshnessInput,
): RawAction[] {
  const evidence = [
    freshnessLine('gsc', input.lastDate.gsc, input.now),
    freshnessLine('ga4', input.lastDate.ga4, input.now),
    crossCheckLine(input.crossCheck),
  ];
  const actions: RawAction[] = [];

  for (const source of ['gsc', 'ga4'] as const) {
    const lag = collectionLagDays(input.lastDate[source], input.now);
    if (lag !== null && lag <= FRESHNESS_ALERT_DAYS) continue;
    const unknown = lag === null;
    actions.push({
      id: `data:collection-freshness:${source}`,
      title: unknown
        ? `Collecte ${LABEL[source]} : fraîcheur inconnue`
        : `Collecte ${LABEL[source]} en retard — dernier jour ${input.lastDate[source]} (${lag} j)`,
      department: 'data',
      source: 'data',
      action_type: unknown ? 'certification' : 'repair',
      impact: 7,
      urgency: 7,
      data_confidence: unknown
        ? CONFIDENCE_BY_CERT.UNKNOWN
        : CONFIDENCE_BY_CERT.CERTIFIED,
      effort: 3,
      risk: 1,
      reason: unknown
        ? `Aucun jour ${LABEL[source]} lisible : les indicateurs qui en dépendent ne sont pas vérifiables.`
        : `Retard ${LABEL[source]} de ${lag} j, au-delà du seuil de ${FRESHNESS_ALERT_DAYS} j : les décisions SEO lisent une période incomplète.`,
      evidence,
      next_step:
        'Relever les passages ingestion_run_* du job seo-monitor / daily-fetch (GET /api/admin/seo-monitoring/cron/health), ' +
        'corriger la cause dans la collecte existante, puis vérifier le rattrapage des jours manquants.',
      owner_go_required: false,
    });
  }

  const gap = input.crossCheck ? crossCheckGap(input.crossCheck) : null;
  if (gap !== null && gap > CROSSCHECK_MAX_GAP) {
    actions.push({
      id: 'data:collection-crosscheck:ga4-gsc',
      title: `Écart GA4 / Search Console de ${Math.round(gap * 100)} % (seuil ${Math.round(CROSSCHECK_MAX_GAP * 100)} %)`,
      department: 'data',
      source: 'data',
      action_type: 'certification',
      impact: 4,
      urgency: 3,
      // recoupement de deux définitions différentes : écart mesuré, cause non qualifiée
      data_confidence: CONFIDENCE_BY_CERT.PARTIAL,
      effort: 3,
      risk: 1,
      reason:
        'GA4 sert de recoupement seulement ; Search Console reste la référence de la demande organique. ' +
        'Un écart au-delà du seuil signale une collecte ou une définition à qualifier, pas une donnée à corriger.',
      evidence,
      next_step:
        'Qualifier l’écart (canal GA4 « organic search » toutes sources de recherche contre clics Google, consentement, ' +
        'jours partiels) avant toute conclusion ; aucune correction de données.',
      owner_go_required: false,
    });
  }

  return actions;
}

/** Lecture impossible : fraîcheur non vérifiable, jamais « à jour » par défaut. */
export function collectionFreshnessUnavailable(reason: string): RawAction {
  return {
    id: 'data:collection-freshness',
    title: 'Fraîcheur des collectes Search Console / GA4 non vérifiable',
    department: 'data',
    source: 'data',
    action_type: 'certification',
    impact: 6,
    urgency: 6,
    data_confidence: CONFIDENCE_BY_CERT.UNKNOWN,
    effort: 3,
    risk: 1,
    reason,
    evidence: [],
    next_step:
      'Rétablir la lecture de __seo_gsc_daily_property_total et __seo_ga4_daily, puis relire la fraîcheur.',
    owner_go_required: false,
  };
}
