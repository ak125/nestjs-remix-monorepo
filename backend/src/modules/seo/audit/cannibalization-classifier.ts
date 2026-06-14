/**
 * GSC Cannibalization Classifier (fonction pure).
 *
 * Pour une page "perdante" d'un cluster de cannibalisation (plusieurs pages du site
 * se disputant la même requête Google), recommande une action + un niveau de confiance.
 *
 * Source du signal = GSC réel (`__seo_gsc_daily`), pas de similarité de contenu floue.
 * AUCUNE action appliquée : produit des recommandations `proposed` pour révision humaine.
 *
 * Actions V1 (merge/fusion EXCLU — trop dangereux : URL/routing/redirects) :
 *   keep · differentiate · canonical_candidate · noindex_candidate
 */

export type CannibalAction =
  | "keep"
  | "differentiate"
  | "canonical_candidate"
  | "noindex_candidate";

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export interface ClusterContext {
  /** nb de pages distinctes se disputant la requête */
  competingPages: number;
  /** meilleure position du cluster (la page winner) */
  winnerPosition: number;
  /** clics totaux du cluster (28j) */
  clusterClicks: number;
}

export interface LoserPageInput {
  /** position moyenne de CETTE page sur la requête (28j) */
  position: number;
  /** impressions de cette page sur la requête (28j) */
  impressions: number;
  /** clics de cette page sur la requête (28j) */
  clicks: number;
  /** cette page est-elle le winner du cluster (meilleure position) ? */
  isWinner: boolean;
}

export interface ClassificationResult {
  action: CannibalAction;
  confidence_level: ConfidenceLevel;
  reason: string;
}

/** Écart de position au-delà duquel un loser est clairement distancé par le winner. */
const POSITION_GAP_CLEAR = 10;
/** Position au-delà de laquelle une page n'a quasi aucune chance de trafic (page 4+). */
const POSITION_DEEP = 40;

export function classifyCannibalizedPage(
  page: LoserPageInput,
  cluster: ClusterContext,
): ClassificationResult {
  // Le winner du cluster : on le garde, c'est lui qui doit ranker.
  if (page.isWinner) {
    return {
      action: "keep",
      confidence_level: "HIGH",
      reason: `Winner du cluster (position ${page.position.toFixed(1)}) — page de référence à conserver.`,
    };
  }

  const positionGap = page.position - cluster.winnerPosition;

  // Loser profond + 0 clic + winner clairement devant → candidat canonical vers winner.
  if (
    page.clicks === 0 &&
    positionGap >= POSITION_GAP_CLEAR &&
    page.position >= POSITION_DEEP
  ) {
    return {
      action: "canonical_candidate",
      confidence_level: "HIGH",
      reason: `Loser profond (pos ${page.position.toFixed(1)} vs winner ${cluster.winnerPosition.toFixed(1)}, écart ${positionGap.toFixed(1)}), 0 clic — canonical vers winner consolide le signal.`,
    };
  }

  // Loser sans aucune impression utile + distancé → candidat noindex (manuel).
  if (page.clicks === 0 && page.impressions <= 1 && positionGap >= POSITION_GAP_CLEAR) {
    return {
      action: "noindex_candidate",
      confidence_level: "MEDIUM",
      reason: `Quasi invisible (impr ${page.impressions}, 0 clic, distancée) — candidate noindex à valider.`,
    };
  }

  // Loser proche du winner OU avec ses propres clics → la page a une valeur, la différencier.
  if (page.clicks > 0 || positionGap < POSITION_GAP_CLEAR) {
    return {
      action: "differentiate",
      confidence_level: page.clicks > 0 ? "LOW" : "MEDIUM",
      reason: `Page avec valeur propre (clics ${page.clicks}, écart pos ${positionGap.toFixed(1)}) — différencier le contenu plutôt que canonical/noindex.`,
    };
  }

  // Signaux contradictoires → garder + LOW confidence (révision humaine requise).
  return {
    action: "keep",
    confidence_level: "LOW",
    reason: `Signaux contradictoires (pos ${page.position.toFixed(1)}, impr ${page.impressions}, clics ${page.clicks}) — garder en l'état, investiguer manuellement.`,
  };
}
