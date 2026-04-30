/**
 * Marketing Scoring Config — pondération performance briefs.
 *
 * Justification (ADR-036) : la valeur business d'un appel vs un clic vs un
 * achat n'est pas universelle — chaque shop a son propre arbitrage. On la
 * met donc en CONFIG avec defaults raisonnables surchargeables par ENV.
 *
 * Usage : marketing-lead-agent (Phase 2) calcule un score par brief depuis
 * `__marketing_brief.actual_*` et trie les briefs par ROI mesuré pour
 * arbitrer les priorités hebdo.
 *
 * Defaults raisonnables (à étalonner après J+15 pilote LOCAL) :
 *   - call         = 3   (intention forte, contact direct)
 *   - visit        = 2   (intention moyenne, présence physique)
 *   - quote        = 2   (intention moyenne, demande devis)
 *   - click        = 1   (intention faible, exploration)
 *   - order        = 10  (conversion finale, valeur max)
 *   - revenue_eur  = 0.1 (1 unité de score par 10 €) — ajustable selon AOV
 *   - impression   = 0   (vu mais pas cliqué = pas de valeur ROI)
 *
 * Override via ENV :
 *   MARKETING_SCORING_CALL=5
 *   MARKETING_SCORING_VISIT=3
 *   MARKETING_SCORING_QUOTE=2
 *   MARKETING_SCORING_CLICK=1
 *   MARKETING_SCORING_ORDER=15
 *   MARKETING_SCORING_REVENUE_EUR_PER_UNIT=0.1
 *   MARKETING_SCORING_IMPRESSION=0
 *
 * Pas de constantes magiques en code (anti-pattern écarté ADR-036 §12).
 */

export interface MarketingScoringWeights {
  /** Score par appel téléphone (intention forte). */
  call: number;
  /** Score par visite magasin physique. */
  visit: number;
  /** Score par demande devis. */
  quote: number;
  /** Score par clic (exploration). */
  click: number;
  /** Score par commande (conversion finale). */
  order: number;
  /** Score par tranche de N euros de revenue. Ratio = score / 1 € revenue. */
  revenue_eur_per_unit: number;
  /** Score par impression (default 0 = pas comptabilisé en ROI brut). */
  impression: number;
}

const DEFAULT_WEIGHTS: MarketingScoringWeights = {
  call: 3,
  visit: 2,
  quote: 2,
  click: 1,
  order: 10,
  revenue_eur_per_unit: 0.1,
  impression: 0,
};

/**
 * Lit la config depuis l'env (avec fallback default).
 * Format attendu : ENV var `MARKETING_SCORING_<KEY>` numérique.
 */
export function getMarketingScoringWeights(
  env: NodeJS.ProcessEnv = process.env,
): MarketingScoringWeights {
  const parseFloatOr = (val: string | undefined, fallback: number): number => {
    if (val === undefined || val === '') return fallback;
    const parsed = Number.parseFloat(val);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  return {
    call: parseFloatOr(env.MARKETING_SCORING_CALL, DEFAULT_WEIGHTS.call),
    visit: parseFloatOr(env.MARKETING_SCORING_VISIT, DEFAULT_WEIGHTS.visit),
    quote: parseFloatOr(env.MARKETING_SCORING_QUOTE, DEFAULT_WEIGHTS.quote),
    click: parseFloatOr(env.MARKETING_SCORING_CLICK, DEFAULT_WEIGHTS.click),
    order: parseFloatOr(env.MARKETING_SCORING_ORDER, DEFAULT_WEIGHTS.order),
    revenue_eur_per_unit: parseFloatOr(
      env.MARKETING_SCORING_REVENUE_EUR_PER_UNIT,
      DEFAULT_WEIGHTS.revenue_eur_per_unit,
    ),
    impression: parseFloatOr(
      env.MARKETING_SCORING_IMPRESSION,
      DEFAULT_WEIGHTS.impression,
    ),
  };
}

/**
 * Calcule le score d'un brief à partir de ses métriques mesurées.
 *
 * Formule simple : somme pondérée des metrics. Pas de pénalité, pas de
 * normalisation (gérée downstream par le marketing-lead-agent).
 *
 * @param metrics      les actual_* d'un brief (peut être partiel)
 * @param weights      pondération à appliquer (default = getMarketingScoringWeights())
 * @returns score >= 0
 */
export interface MarketingBriefMetrics {
  actual_impressions?: number;
  actual_clicks?: number;
  actual_calls?: number;
  actual_visits?: number;
  actual_quotes?: number;
  actual_orders?: number;
  actual_revenue_cents?: number;
}

export function computeBriefScore(
  metrics: MarketingBriefMetrics,
  weights: MarketingScoringWeights = getMarketingScoringWeights(),
): number {
  const revenueEur = (metrics.actual_revenue_cents ?? 0) / 100;
  return (
    (metrics.actual_impressions ?? 0) * weights.impression +
    (metrics.actual_clicks ?? 0) * weights.click +
    (metrics.actual_calls ?? 0) * weights.call +
    (metrics.actual_visits ?? 0) * weights.visit +
    (metrics.actual_quotes ?? 0) * weights.quote +
    (metrics.actual_orders ?? 0) * weights.order +
    revenueEur * weights.revenue_eur_per_unit
  );
}

/** Re-export defaults pour usage en test ou audit. */
export const MARKETING_SCORING_DEFAULTS = DEFAULT_WEIGHTS;
