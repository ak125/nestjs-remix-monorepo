/**
 * GSC Index Sampler — cœurs PURS (no I/O), testables, pour le collecteur
 * d'indexation (`__seo_index_history`).
 *
 * 1) `allocateStratifiedSample` : répartit un budget d'inspections (quota URL
 *    Inspection 2 000/j·site, 600/min·site → on reste TRÈS en-dessous) sur des
 *    strates priorisées, round-robin, dédupliqué. Pilote = échantillon, JAMAIS
 *    un recensement complet (cf. plan PR3).
 * 2) `mapCoverageToIndexStatus` : mappe le `coverageState`/`verdict` de l'API
 *    URL Inspection vers l'enum `__seo_index_history.index_status`.
 *
 * Aucune dépendance externe → testable avec fixtures.
 */

/** Strate de l'échantillon (priorité décroissante par défaut). */
export type IndexStrate =
  | 'r1_hub' // hubs gamme (money pages) — prioritaire
  | 'r2_pages' // produits catalogue
  | 'r8_vehicle' // pages véhicule
  | 'r3_content' // conseils / blog
  | 'random'; // échantillon stable aléatoire (déjà mélangé en amont)

export interface SampledUrl {
  url: string;
  strate: IndexStrate;
}

/** Plancher gouverné par défaut du budget d'inspections par run (pilote). */
export const DEFAULT_INDEX_INSPECT_MAX_PER_RUN = 150;

/**
 * Répartit `budget` URLs sur les pools par strate, en round-robin selon l'ordre
 * `priority` (les strates en tête sont servies en premier à chaque tour).
 * Dédup par URL (une URL n'est inspectée qu'une fois même si dans 2 pools).
 * Déterministe : aucune randomisation ici (le pool `random` est déjà mélangé
 * en amont par l'appelant, pour rester testable).
 */
export function allocateStratifiedSample(
  pools: Partial<Record<IndexStrate, string[]>>,
  budget: number,
  priority: IndexStrate[] = [
    'r1_hub',
    'r2_pages',
    'r8_vehicle',
    'r3_content',
    'random',
  ],
): SampledUrl[] {
  const out: SampledUrl[] = [];
  const seen = new Set<string>();
  if (budget <= 0) return out;

  // curseurs par strate
  const cursors: Partial<Record<IndexStrate, number>> = {};
  for (const s of priority) cursors[s] = 0;

  let progressed = true;
  while (out.length < budget && progressed) {
    progressed = false;
    for (const strate of priority) {
      if (out.length >= budget) break;
      const pool = pools[strate];
      if (!pool) continue;
      let i = cursors[strate] ?? 0;
      // avance jusqu'à une URL non encore prise
      while (i < pool.length && seen.has(pool[i])) i++;
      if (i < pool.length) {
        seen.add(pool[i]);
        out.push({ url: pool[i], strate });
        cursors[strate] = i + 1;
        progressed = true;
      } else {
        cursors[strate] = i; // pool épuisé
      }
    }
  }
  return out;
}

/** Enum miroir de `__seo_index_history.index_status` (cf. observability.ts). */
export type IndexStatus =
  | 'INDEXED'
  | 'NOT_INDEXED'
  | 'BLOCKED_BY_ROBOTS'
  | 'NOT_FOUND'
  | 'REDIRECT'
  | 'SOFT_404'
  | 'DUPLICATE_WITHOUT_CANONICAL'
  | 'UNKNOWN';

export interface IndexInspectionResult {
  /** `verdict` de l'API : 'PASS' | 'PARTIAL' | 'FAIL' | 'NEUTRAL' | 'VERDICT_UNSPECIFIED'. */
  verdict?: string | null;
  /** `coverageState` libellé humain (ex. "Submitted and indexed"). */
  coverageState?: string | null;
}

/**
 * Mappe le résultat URL Inspection → enum `index_status`. Déterministe.
 * `verdict === 'PASS'` ⇒ INDEXED (Google le sert). Sinon on classe par motif
 * sur le `coverageState` (libellés Google stables). Inconnu ⇒ UNKNOWN (jamais
 * un défaut silencieux trompeur).
 */
export function mapCoverageToIndexStatus(r: IndexInspectionResult): {
  status: IndexStatus;
  isIndexed: boolean;
} {
  const verdict = (r.verdict ?? '').toUpperCase();
  if (verdict === 'PASS') return { status: 'INDEXED', isIndexed: true };

  const cov = (r.coverageState ?? '').toLowerCase();
  let status: IndexStatus;
  if (!cov) status = 'UNKNOWN';
  else if (cov.includes('noindex') || cov.includes("excluded by 'noindex'"))
    status = 'NOT_INDEXED';
  else if (cov.includes('redirect')) status = 'REDIRECT';
  else if (cov.includes('soft 404')) status = 'SOFT_404';
  else if (cov.includes('not found') || cov.includes('404'))
    status = 'NOT_FOUND';
  else if (cov.includes('robots.txt') || cov.includes('blocked by robots'))
    status = 'BLOCKED_BY_ROBOTS';
  else if (cov.includes('duplicate')) status = 'DUPLICATE_WITHOUT_CANONICAL';
  else if (cov.includes('unknown to google')) status = 'UNKNOWN';
  // "Crawled - currently not indexed", "Discovered - currently not indexed", etc.
  else if (cov.includes('not indexed')) status = 'NOT_INDEXED';
  else status = 'UNKNOWN';

  return { status, isIndexed: false };
}
