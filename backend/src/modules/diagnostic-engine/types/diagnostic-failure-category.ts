/**
 * DiagnosticFailureCategory — Reality Audit V1 (Block A)
 *
 * Catégorisation des modes de défaillance du Diagnostic Engine,
 * utilisée pour annoter le golden dataset post-évaluation humaine.
 *
 * V1B étendra ce type avec `failure_severity_weight` (faux_urgency > faux_gamme).
 *
 * Source de vérité : ADR vault — "Failure Taxonomy & Severity Weighting" (V1B).
 */

export enum DiagnosticFailureCategory {
  /** Mauvaise classification d'intention (commerce vs urgence vs education vs maintenance) */
  FAUX_INTENT = 'FAUX_INTENT',

  /** Urgency level produit incorrect (critique vs haute vs moyenne vs basse) */
  FAUX_URGENCY = 'FAUX_URGENCY',

  /** Gamme/pg_id probable incorrecte (ex: CAUSE_GAMME_MAP mismatch) */
  FAUX_GAMME = 'FAUX_GAMME',

  /** Aucune action recommandée pertinente — moteur produit safety_rail injustifié OR aucune piste actionnable */
  NO_RESOLUTION = 'NO_RESOLUTION',

  /** UX wizard ambigu — observable via re-entry / abandon / questions répétitives */
  USER_CONFUSION = 'USER_CONFUSION',
}

/**
 * V1A : tableau simple ; V1B introduira severity_weight via ADR.
 * Garde annotation = post-hoc humaine sur golden cases.
 */
export const DIAGNOSTIC_FAILURE_CATEGORIES = Object.values(
  DiagnosticFailureCategory,
);
