/**
 * GSC Coverage — fonction PURE (no I/O), testable avec fixtures.
 *
 * Invariant de couverture DOUBLE, apparié au grain (cf. plan PR1) :
 *   - global : Σ(pages) vs property_total (date seule)
 *   - segment : page (country,device) vs total (country,device) correspondant
 *
 * RAPPEL : `Σpages < property_total` est NORMAL (l'anonymisation `page` côté GSC
 * retire des lignes). Donc le ratio < 1 n'est PAS un bug. Un `coverage_gap` est
 * signalé seulement quand le ratio passe SOUS un plancher gouverné (proxy V1 ;
 * la détection relative-à-baseline est en PR4). On ne compare JAMAIS un grain
 * page à un total d'un autre grain (sinon faux gap).
 *
 * Pas de magic constant : le plancher est un paramètre gouverné, injecté
 * (env `SEO_GSC_COVERAGE_MIN_RATIO`), avec défaut documenté ci-dessous.
 */

/** Plancher par défaut du ratio de couverture global (Σpages.impr / total.impr). */
export const DEFAULT_GSC_COVERAGE_MIN_RATIO = 0.3;

export type GscCoverageStatus = 'ok' | 'coverage_gap' | 'insufficient_data';

export interface GscDailyMetricLike {
  clicks: number;
  impressions: number;
}

export interface GscCoverageResult {
  date: string;
  /** Σ(pages.impressions) / property_total.impressions — null si total = 0. */
  pagesVsPropertyImpr: number | null;
  /** Σ(pages.clicks) / property_total.clicks — null si total = 0. */
  pagesVsPropertyClicks: number | null;
  status: GscCoverageStatus;
  /** Plancher appliqué (traçabilité — jamais une constante muette). */
  minRatio: number;
}

function ratio(part: number, whole: number): number | null {
  if (!Number.isFinite(whole) || whole <= 0) return null;
  return part / whole;
}

/**
 * Couverture GLOBALE : agrège les lignes pages et compare au property_total.
 * @param propertyTotal total global du jour (grain `date` seul)
 * @param pagesRows lignes du grain `pages` du même jour
 * @param minRatio plancher gouverné (défaut DEFAULT_GSC_COVERAGE_MIN_RATIO)
 */
export function computeGlobalCoverage(
  date: string,
  propertyTotal: GscDailyMetricLike | null,
  pagesRows: GscDailyMetricLike[],
  minRatio: number = DEFAULT_GSC_COVERAGE_MIN_RATIO,
): GscCoverageResult {
  // Pas de total fiable ⇒ on ne peut RIEN affirmer (jamais « 0 opportunité »).
  if (!propertyTotal || propertyTotal.impressions <= 0) {
    return {
      date,
      pagesVsPropertyImpr: null,
      pagesVsPropertyClicks: null,
      status: 'insufficient_data',
      minRatio,
    };
  }

  const sumImpr = pagesRows.reduce((s, r) => s + (r.impressions || 0), 0);
  const sumClicks = pagesRows.reduce((s, r) => s + (r.clicks || 0), 0);

  const imprRatio = ratio(sumImpr, propertyTotal.impressions);
  const clickRatio = ratio(sumClicks, propertyTotal.clicks);

  // Le grain page est vide alors que le total existe = détail insuffisant.
  if (sumImpr === 0) {
    return {
      date,
      pagesVsPropertyImpr: imprRatio,
      pagesVsPropertyClicks: clickRatio,
      status: 'coverage_gap',
      minRatio,
    };
  }

  const status: GscCoverageStatus =
    imprRatio !== null && imprRatio < minRatio ? 'coverage_gap' : 'ok';

  return {
    date,
    pagesVsPropertyImpr: imprRatio,
    pagesVsPropertyClicks: clickRatio,
    status,
    minRatio,
  };
}
