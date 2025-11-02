/**
 * Interfaces pour l'hygiène et la validation des sitemaps
 */

/**
 * Critères d'inclusion d'une URL dans le sitemap
 */
export interface UrlInclusionCriteria {
  /** HTTP Status Code (doit être 200) */
  statusCode: number;

  /** Est-ce que la page est indexable (pas de noindex) */
  isIndexable: boolean;

  /** Est-ce l'URL canonique (pas une variante) */
  isCanonical: boolean;

  /** La page a-t-elle un contenu suffisant */
  hasSufficientContent: boolean;

  /** La page est-elle en stock ou pertinente */
  isAvailable: boolean;

  /** La page a-t-elle des liens internes forts */
  hasStrongInternalLinks?: boolean;
}

/**
 * Critères d'exclusion d'une URL
 */
export interface UrlExclusionPatterns {
  /** Redirections temporaires (3xx) */
  isTemporaryRedirect: boolean;

  /** Erreurs client (4xx) */
  isClientError: boolean;

  /** Erreurs serveur (5xx) */
  isServerError: boolean;

  /** Contient des paramètres UTM */
  hasUtmParameters: boolean;

  /** Contient des paramètres de session */
  hasSessionParameters: boolean;

  /** Est une facette/filtre */
  isFacetedUrl: boolean;

  /** Est une variante filtrée */
  isFilteredVariant: boolean;

  /** A un tag noindex */
  hasNoindexTag: boolean;
}

/**
 * Statut de disponibilité d'un produit
 */
export enum ProductAvailability {
  /** Produit en stock et disponible */
  IN_STOCK = 'in_stock',

  /** Produit temporairement en rupture (revient souvent) */
  OUT_OF_STOCK_TEMPORARY = 'out_of_stock_temporary',

  /** Produit obsolète (ne reviendra pas) */
  OUT_OF_STOCK_OBSOLETE = 'out_of_stock_obsolete',

  /** Produit pérenne (même hors stock, page informative) */
  PERENNIAL = 'perennial',
}

/**
 * Métadonnées de modification d'une page
 */
export interface PageModificationMetadata {
  /** Date de dernière modification du contenu */
  contentLastModified?: Date;

  /** Date de dernière modification du stock */
  stockLastModified?: Date;

  /** Date de dernière modification des prix */
  priceLastModified?: Date;

  /** Date de dernière modification des fiches techniques */
  technicalSheetLastModified?: Date;

  /** Date de dernière modification du bloc SEO */
  seoBlockLastModified?: Date;

  /** Date de création de la page */
  createdAt?: Date;
}

/**
 * Configuration de normalisation d'URL
 */
export interface UrlNormalizationConfig {
  /** Normaliser le trailing slash */
  normalizeTrailingSlash: boolean;

  /** Convertir en minuscules */
  toLowerCase: boolean;

  /** Supprimer www */
  removeWww: boolean;

  /** Supprimer les paramètres spécifiés */
  removeParameters: string[];

  /** Trier les paramètres de query string */
  sortQueryParameters: boolean;
}

/**
 * Règles de validation d'URL pour sitemap
 */
export interface SitemapUrlValidationRules {
  /** Critères d'inclusion */
  inclusion: UrlInclusionCriteria;

  /** Patterns d'exclusion */
  exclusion: UrlExclusionPatterns;

  /** Configuration de normalisation */
  normalization: UrlNormalizationConfig;

  /** Métadonnées de modification */
  modification?: PageModificationMetadata;

  /** Disponibilité du produit (si applicable) */
  productAvailability?: ProductAvailability;
}

/**
 * Résultat de validation d'une URL
 */
export interface UrlValidationResult {
  /** L'URL est-elle valide pour le sitemap */
  isValid: boolean;

  /** L'URL normalisée */
  normalizedUrl: string;

  /** Raisons d'exclusion (si invalide) */
  exclusionReasons: string[];

  /** Date de dernière modification réelle */
  lastModified: Date;

  /** Score de pertinence (0-100) */
  relevanceScore?: number;
}

/**
 * Paramètres à supprimer systématiquement
 */
export const EXCLUDED_PARAMETERS = [
  // UTM tracking
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',

  // Session & Analytics
  'sessionid',
  'sid',
  'jsessionid',
  'phpsessid',
  'aspsessionid',
  'fbclid',
  'gclid',
  'msclkid',

  // Filtres temporaires
  'sort',
  'order',
  'filter',
  'facet',
  'ref',
  'from',
  'source',

  // Pagination (si gérée par des pages dédiées)
  'page',
  'p',
  'offset',
  'limit',
];

/**
 * Patterns d'URL à exclure
 */
export const EXCLUDED_URL_PATTERNS = [
  // URLs de recherche
  /\/search\?/i,
  /\/recherche\?/i,

  // URLs de filtres
  /\/filter\//i,
  /\/facet\//i,

  // URLs de session
  /\/session\//i,
  /\/login/i,
  /\/logout/i,
  /\/account\//i,

  // URLs admin
  /\/admin\//i,
  /\/wp-admin\//i,

  // URLs temporaires
  /\/temp\//i,
  /\/tmp\//i,
  /\/draft\//i,

  // URLs de test
  /\/test\//i,
  /\/dev\//i,
  /\/staging\//i,
];

/**
 * Seuils de contenu
 */
export const CONTENT_THRESHOLDS = {
  /** Nombre minimum de mots */
  MIN_WORDS: 50,

  /** Nombre minimum de caractères */
  MIN_CHARACTERS: 200,

  /** Nombre minimum de liens internes */
  MIN_INTERNAL_LINKS: 2,

  /** Ratio minimum texte/HTML */
  MIN_TEXT_HTML_RATIO: 0.1,
};
