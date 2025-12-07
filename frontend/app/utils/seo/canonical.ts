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
  protocol?: 'http' | 'https';
}

export interface FacetRule {
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
  { key: 'marque', indexable: true, priority: 1 },
  { key: 'brand', indexable: true, priority: 1 },
  { key: 'modele', indexable: true, priority: 2 },
  { key: 'model', indexable: true, priority: 2 },
  { key: 'motorisation', indexable: true, priority: 3 },
  { key: 'type', indexable: true, priority: 3 },
  { key: 'prix_min', indexable: false, priority: 10 },
  { key: 'prix_max', indexable: false, priority: 11 },
  { key: 'stock', indexable: false, priority: 12 },
  { key: 'promo', indexable: false, priority: 13 },
  { key: 'sort', indexable: false, priority: 20 },
  { key: 'order', indexable: false, priority: 21 },
];

/**
 * Paramètres de tracking à supprimer des URLs canoniques
 */
const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'msclkid',
  'ref',
  'referrer',
  '_ga',
  'mc_cid',
  'mc_eid',
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
    host = 'www.automecanik.com',
    protocol = 'https',
  } = options;

  // 1. Nettoyer l'URL de base (supprimer trailing slash, params existants)
  let cleanBaseUrl = baseUrl.replace(/\/$/, '').split('?')[0];

  // 2. Filtrer et trier les paramètres
  const filteredParams = filterCanonicalParams(params);
  const sortedParams = sortParams(filteredParams);

  // 3. Construire la query string
  const queryParts: string[] = [];

  // Ajouter les paramètres triés
  Object.entries(sortedParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      // Tableau: marque[]=renault&marque[]=peugeot
      value.forEach(v => queryParts.push(`${encodeURIComponent(key)}[]=${encodeURIComponent(v)}`));
    } else if (value !== null && value !== undefined && value !== '') {
      queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  });

  // Ajouter la pagination (sauf page 1)
  if (page && page > 1) {
    queryParts.push(`page=${page}`);
  }

  // 4. Assembler l'URL
  const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
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
function filterCanonicalParams(params: Record<string, any>): Record<string, any> {
  const filtered: Record<string, any> = {};
  let indexableFacetCount = 0;

  // Trier les clés par priorité
  const sortedKeys = Object.keys(params).sort((a, b) => {
    const ruleA = INDEXABLE_FACETS.find(r => r.key === a);
    const ruleB = INDEXABLE_FACETS.find(r => r.key === b);
    return (ruleA?.priority || 99) - (ruleB?.priority || 99);
  });

  sortedKeys.forEach(key => {
    const value = params[key];

    // Ignorer les paramètres de tracking
    if (TRACKING_PARAMS.includes(key)) {
      return;
    }

    // Ignorer les valeurs vides
    if (value === null || value === undefined || value === '') {
      return;
    }

    // Vérifier si c'est une facette indexable
    const facetRule = INDEXABLE_FACETS.find(r => r.key === key);

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
    .forEach(key => {
      sorted[key] = params[key];
    });
  return sorted;
}

/**
 * ✅ Vérifie si une combinaison de facettes est indexable
 * 
 * @example
 * isIndexableFacet({ marque: 'renault', modele: 'clio' }) // => true (2 facettes)
 * isIndexableFacet({ prix_min: 10, prix_max: 100 }) // => false (non-indexables)
 * isIndexableFacet({ marque: 'r', modele: 'c', motorisation: 'm', annee: 2020 }) // => false (>3)
 */
export function isIndexableFacet(params: Record<string, any>): boolean {
  let indexableCount = 0;

  Object.keys(params).forEach(key => {
    const facetRule = INDEXABLE_FACETS.find(r => r.key === key);
    if (facetRule?.indexable) {
      indexableCount++;
    }
  });

  // Max 3 facettes indexables
  return indexableCount > 0 && indexableCount <= 3;
}

/**
 * 🔗 Génère les tags rel="prev" et rel="next" pour la pagination
 * 
 * @example
 * generatePaginationTags({
 *   baseUrl: '/pieces/plaquette-de-frein-402',
 *   currentPage: 2,
 *   totalPages: 5,
 *   params: { marque: 'renault' }
 * })
 * // => {
 * //   prev: "/pieces/plaquette-de-frein-402?marque=renault&page=1",
 * //   next: "/pieces/plaquette-de-frein-402?marque=renault&page=3"
 * // }
 */
export interface PaginationTagsOptions {
  baseUrl: string;
  currentPage: number;
  totalPages: number;
  params?: Record<string, any>;
  includeHost?: boolean;
  host?: string;
  protocol?: 'http' | 'https';
}

export interface PaginationTags {
  prev?: string;
  next?: string;
  first?: string;
  last?: string;
}

export function generatePaginationTags(options: PaginationTagsOptions): PaginationTags {
  const { currentPage, totalPages, baseUrl, params, includeHost, host, protocol } = options;

  const tags: PaginationTags = {};

  // Page précédente
  if (currentPage > 1) {
    tags.prev = buildCanonicalUrl({
      baseUrl,
      params,
      page: currentPage - 1,
      includeHost,
      host,
      protocol,
    });
  }

  // Page suivante
  if (currentPage < totalPages) {
    tags.next = buildCanonicalUrl({
      baseUrl,
      params,
      page: currentPage + 1,
      includeHost,
      host,
      protocol,
    });
  }

  // Première page (optionnel)
  if (currentPage > 2) {
    tags.first = buildCanonicalUrl({
      baseUrl,
      params,
      page: 1,
      includeHost,
      host,
      protocol,
    });
  }

  // Dernière page (optionnel)
  if (currentPage < totalPages - 1) {
    tags.last = buildCanonicalUrl({
      baseUrl,
      params,
      page: totalPages,
      includeHost,
      host,
      protocol,
    });
  }

  return tags;
}

/**
 * 🧹 Nettoie une URL en supprimant les paramètres de tracking
 * 
 * Utile pour les analytics ou les comparaisons d'URLs
 */
export function cleanUrl(url: string): string {
  try {
    const urlObj = new URL(url, 'https://www.automecanik.com');
    const params = new URLSearchParams(urlObj.search);

    // Supprimer tous les paramètres de tracking
    TRACKING_PARAMS.forEach(param => {
      params.delete(param);
    });

    const cleanedSearch = params.toString();
    return `${urlObj.pathname}${cleanedSearch ? `?${cleanedSearch}` : ''}`;
  } catch (e) {
    // Si ce n'est pas une URL valide, retourner telle quelle
    return url;
  }
}

/**
 * 🔄 Normalise une URL pour la comparaison
 * 
 * - Trie les paramètres alphabétiquement
 * - Supprime le trailing slash
 * - Lowercase
 */
export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url, 'https://www.automecanik.com');
    const params = new URLSearchParams(urlObj.search);

    // Trier les paramètres
    const sortedParams = new URLSearchParams();
    Array.from(params.keys())
      .sort()
      .forEach(key => {
        const values = params.getAll(key);
        values.forEach(value => sortedParams.append(key, value));
      });

    const pathname = urlObj.pathname.replace(/\/$/, '').toLowerCase();
    const search = sortedParams.toString();

    return `${pathname}${search ? `?${search}` : ''}`;
  } catch (e) {
    return url.toLowerCase().replace(/\/$/, '');
  }
}
