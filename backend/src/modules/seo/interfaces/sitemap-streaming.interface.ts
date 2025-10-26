/**
 * 🗜️ INTERFACES SITEMAP STREAMING (GROS VOLUMES)
 * Génération de sitemaps compressés (.xml.gz) pour millions d'URLs
 */

/**
 * Configuration du streaming de sitemap
 */
export interface StreamingConfig {
  /** Activer la compression GZIP */
  enableGzip: boolean;

  /** Niveau de compression (1-9, 9 = max) */
  compressionLevel: number;

  /** Répertoire de sortie pour les fichiers générés */
  outputDirectory: string;

  /** Taille maximale d'un shard (nombre d'URLs) */
  shardSize: number;

  /** Générer automatiquement l'index après les shards */
  autoGenerateIndex: boolean;

  /** URL publique de base pour les sitemaps */
  publicBaseUrl: string;

  /** Supprimer les anciens fichiers avant génération */
  cleanupBeforeGeneration: boolean;
}

/**
 * Résultat de génération d'un shard
 */
export interface ShardGenerationResult {
  /** Nom du fichier généré */
  filename: string;

  /** Chemin complet du fichier */
  filepath: string;

  /** Nombre d'URLs dans le shard */
  urlCount: number;

  /** Taille du fichier (bytes) */
  fileSize: number;

  /** Taille compressée (bytes) */
  compressedSize?: number;

  /** Ratio de compression (%) */
  compressionRatio?: number;

  /** Temps de génération (ms) */
  generationTime: number;

  /** Hash SHA256 du fichier (pour vérification) */
  fileHash?: string;
}

/**
 * Résultat de génération de l'index
 */
export interface IndexGenerationResult {
  /** Nom du fichier index */
  filename: string;

  /** Chemin complet du fichier */
  filepath: string;

  /** Nombre de shards référencés */
  shardCount: number;

  /** Taille du fichier index (bytes) */
  fileSize: number;

  /** Temps de génération (ms) */
  generationTime: number;

  /** Liste des shards inclus */
  shards: Array<{
    name: string;
    url: string;
    lastmod: string;
  }>;
}

/**
 * Résultat complet de génération
 */
export interface StreamingGenerationResult {
  /** Succès global */
  success: boolean;

  /** Timestamp de début */
  startTime: Date;

  /** Timestamp de fin */
  endTime: Date;

  /** Durée totale (ms) */
  totalDuration: number;

  /** Résultats des shards */
  shards: ShardGenerationResult[];

  /** Résultat de l'index */
  index?: IndexGenerationResult;

  /** Statistiques globales */
  stats: {
    totalUrls: number;
    totalShards: number;
    totalSize: number;
    totalCompressedSize: number;
    averageCompressionRatio: number;
    urlsPerSecond: number;
  };

  /** Erreurs rencontrées */
  errors?: string[];
}

/**
 * Options de génération de sitemap
 */
export interface GenerationOptions {
  /** Type de sitemap à générer */
  sitemapType: 'pages' | 'products' | 'blog' | 'catalog' | 'all';

  /** Forcer la régénération même si fichiers existent */
  forceRegeneration: boolean;

  /** Générer avec hreflang */
  includeHreflang: boolean;

  /** Générer avec images */
  includeImages: boolean;

  /** Limiter le nombre d'URLs (pour tests) */
  maxUrls?: number;

  /** Dry run (ne pas écrire les fichiers) */
  dryRun: boolean;
}

/**
 * Statut de téléchargement d'un fichier
 */
export interface DownloadInfo {
  /** Nom du fichier */
  filename: string;

  /** URL publique de téléchargement */
  publicUrl: string;

  /** Taille du fichier (bytes) */
  size: number;

  /** Date de dernière modification */
  lastModified: Date;

  /** Type MIME */
  mimeType: string;

  /** Nombre d'URLs dans le sitemap */
  urlCount?: number;
}
