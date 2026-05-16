/**
 * 🔗 Canonical URL Utilities
 *
 * Utilitaires pour générer des URLs canoniques conformes aux bonnes pratiques SEO.
 * Gère les facettes, la pagination, et les paramètres de tracking.
 */

export interface CanonicalUrlOptions {
  /** URL de base sans paramètres */
  baseUrl: string;
  /** Paramètres de recherche/filtres */
  params?: Record<string, string | string[] | number | boolean>;
  /** Numéro de page */
  page?: number;
  /** Inclure le domaine complet */
  includeHost?: boolean;
  /** Domaine (par défaut: www.automecanik.com) */
  host?: string;
  /** Protocole (par défaut: https) */
  protocol?: "http" | "https";
}

interface FacetRule {
  /** Nom du paramètre */
  key: string;
  /** Est-ce un paramètre indexable ? */
  indexable: boolean;
  /** Ordre de tri (plus petit = prioritaire) */
  priority?: number;
}

/**
 * Liste des facettes autorisées pour l'indexation
 * Max 2-3 facettes pour éviter le contenu dupliqué
 */
const INDEXABLE_FACETS: FacetRule[] = [
  { key: "marque", indexable: true, priority: 1 },
  { key: "brand", indexable: true, priority: 1 },
  { key: "modele", indexable: true, priority: 2 },
  { key: "model", indexable: true, priority: 2 },
  { key: "motorisation", indexable: true, priority: 3 },
  { key: "type", indexable: true, priority: 3 },
  { key: "prix_min", indexable: false, priority: 10 },
  { key: "prix_max", indexable: false, priority: 11 },
  { key: "stock", indexable: false, priority: 12 },
  { key: "promo", indexable: false, priority: 13 },
  { key: "sort", indexable: false, priority: 20 },
  { key: "order", indexable: false, priority: 21 },
];

/**
 * Paramètres de tracking à supprimer des URLs canoniques
 */
const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "msclkid",
  "ref",
  "referrer",
  "_ga",
  "mc_cid",
  "mc_eid",
];

/**
 * 🔗 Construit une URL canonique
 *
 * Applique les règles SEO:
 * - Supprime les paramètres de tracking
 * - Limite les facettes indexables (max 2-3)
 * - Trie les paramètres alphabétiquement
 * - Normalise le format
 *
 * @example
 * buildCanonicalUrl({
 *   baseUrl: '/pieces/plaquette-de-frein-402',
 *   params: { marque: 'renault', utm_source: 'google' },
 *   includeHost: true
 * })
 * // => "https://www.automecanik.com/pieces/plaquette-de-frein-402?marque=renault"
 */
export function buildCanonicalUrl(options: CanonicalUrlOptions): string {
  const {
    baseUrl,
    params = {},
    page,
    includeHost = false,
    host = "www.automecanik.com",
    protocol = "https",
  } = options;

  // 1. Nettoyer l'URL de base (supprimer trailing slash, params existants)
  let cleanBaseUrl = baseUrl.replace(/\/$/, "").split("?")[0];

  // 2. Filtrer et trier les paramètres
  const filteredParams = filterCanonicalParams(params);
  const sortedParams = sortParams(filteredParams);

  // 3. Construire la query string
  const queryParts: string[] = [];

  // Ajouter les paramètres triés
  Object.entries(sortedParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      // Tableau: marque[]=renault&marque[]=peugeot
      value.forEach((v) =>
        queryParts.push(
          `${encodeURIComponent(key)}[]=${encodeURIComponent(v)}`,
        ),
      );
    } else if (value !== null && value !== undefined && value !== "") {
      queryParts.push(
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
      );
    }
  });

  // Ajouter la pagination (sauf page 1)
  if (page && page > 1) {
    queryParts.push(`page=${page}`);
  }

  // 4. Assembler l'URL
  const queryString = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
  const canonicalUrl = `${cleanBaseUrl}${queryString}`;

  // 5. Ajouter le domaine si nécessaire
  if (includeHost) {
    return `${protocol}://${host}${canonicalUrl}`;
  }

  return canonicalUrl;
}

/**
 * 🔍 Filtre les paramètres pour l'URL canonique
 *
 * - Supprime les paramètres de tracking
 * - Garde seulement les facettes indexables (max 3)
 * - Supprime les valeurs vides
 */
function filterCanonicalParams(
  params: Record<string, any>,
): Record<string, any> {
  const filtered: Record<string, any> = {};
  let indexableFacetCount = 0;

  // Trier les clés par priorité
  const sortedKeys = Object.keys(params).sort((a, b) => {
    const ruleA = INDEXABLE_FACETS.find((r) => r.key === a);
    const ruleB = INDEXABLE_FACETS.find((r) => r.key === b);
    return (ruleA?.priority || 99) - (ruleB?.priority || 99);
  });

  sortedKeys.forEach((key) => {
    const value = params[key];

    // Ignorer les paramètres de tracking
    if (TRACKING_PARAMS.includes(key)) {
      return;
    }

    // Ignorer les valeurs vides
    if (value === null || value === undefined || value === "") {
      return;
    }

    // Vérifier si c'est une facette indexable
    const facetRule = INDEXABLE_FACETS.find((r) => r.key === key);

    if (facetRule?.indexable) {
      // Limiter à 3 facettes indexables max
      if (indexableFacetCount < 3) {
        filtered[key] = value;
        indexableFacetCount++;
      }
    } else if (!facetRule) {
      // Paramètre non défini dans les règles : l'inclure (ex: recherche custom)
      filtered[key] = value;
    }
    // Sinon: facette non-indexable, on l'ignore
  });

  return filtered;
}

/**
 * 📊 Trie les paramètres alphabétiquement
 */
function sortParams(params: Record<string, any>): Record<string, any> {
  const sorted: Record<string, any> = {};
  Object.keys(params)
    .sort()
    .forEach((key) => {
      sorted[key] = params[key];
    });
  return sorted;
}
