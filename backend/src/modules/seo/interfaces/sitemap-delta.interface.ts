/**
 * 🔄 INTERFACES SITEMAP DELTA (DIFF JOURNALIER)
 * Système de détection de changements et génération de sitemaps incrémentiaux
 */

/**
 * Hash de contenu d'une URL pour détecter les changements
 */
export interface UrlContentHash {
  /** URL canonique */
  url: string;

  /** Hash SHA1 du contenu (canonique + price + stock + metadata) */
  hash: string;

  /** Date de dernière modification */
  lastModified: Date;

  /** Type de changement détecté */
  changeType?: UrlChangeType;

  /** Anciennes valeurs (pour debug) */
  previousHash?: string;
}

/**
 * Types de changements détectés
 */
export enum UrlChangeType {
  /** Nouvelle URL (première apparition) */
  NEW = 'new',

  /** Prix modifié */
  PRICE_CHANGED = 'price_changed',

  /** Stock modifié */
  STOCK_CHANGED = 'stock_changed',

  /** Métadonnées modifiées (title, description, etc.) */
  METADATA_CHANGED = 'metadata_changed',

  /** Contenu modifié (autre) */
  CONTENT_CHANGED = 'content_changed',

  /** URL supprimée */
  DELETED = 'deleted',
}

/**
 * Configuration du système de delta
 */
export interface DeltaConfig {
  /** Activer le système de delta */
  enabled: boolean;

  /** Clé Redis pour stocker les hashes actuels */
  redisHashKey: string;

  /** Préfixe pour les sets de delta journaliers */
  redisDeltaPrefix: string;

  /** TTL des deltas en jours (après X jours, le delta est supprimé) */
  deltaRetentionDays: number;

  /** Heure d'émission du sitemap-latest.xml (format 24h: "03:00") */
  emissionTime: string;

  /** Générer automatiquement sitemap-latest.xml */
  autoGenerateLatest: boolean;

  /** Vider le delta après génération du sitemap */
  clearDeltaAfterGeneration: boolean;
}

/**
 * Données hashables d'une URL produit
 */
export interface HashableUrlData {
  /** URL canonique */
  canonical: string;

  /** Prix du produit */
  price?: number;

  /** Stock disponible */
  stock?: number;

  /** Métadonnées importantes */
  metadata?: {
    title?: string;
    description?: string;
    imageUrl?: string;
    brand?: string;
    category?: string;
  };

  /** Timestamp de la donnée */
  timestamp?: number;
}

/**
 * Statistiques du delta journalier
 */
export interface DeltaStats {
  /** Date du delta */
  date: string;

  /** Nombre total d'URLs modifiées */
  totalChanges: number;

  /** Répartition par type de changement */
  changesByType: Record<UrlChangeType, number>;

  /** Taille du sitemap généré (bytes) */
  sitemapSize?: number;

  /** Temps de génération (ms) */
  generationTime?: number;

  /** URLs les plus modifiées (top 10) */
  topChangedUrls?: Array<{
    url: string;
    changeCount: number;
  }>;
}

/**
 * Résultat de comparaison de hash
 */
export interface HashComparisonResult {
  /** Hash a changé ? */
  hasChanged: boolean;

  /** Type de changement */
  changeType?: UrlChangeType;

  /** Ancien hash */
  oldHash?: string;

  /** Nouveau hash */
  newHash: string;

  /** Détails des changements */
  changes?: {
    priceChanged?: boolean;
    stockChanged?: boolean;
    metadataChanged?: boolean;
  };
}
