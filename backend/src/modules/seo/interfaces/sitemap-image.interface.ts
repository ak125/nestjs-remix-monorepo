/**
 * 🖼️ INTERFACES SITEMAP IMAGES
 * Gestion des images dans les sitemaps (boost e-commerce SEO)
 */

/**
 * Image sitemap selon la spec Google
 * @see https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps
 */
export interface SitemapImage {
  /** URL de l'image (obligatoire) */
  loc: string;

  /** Titre/description de l'image (recommandé) */
  title?: string;

  /** Légende de l'image (optionnel) */
  caption?: string;

  /** Localisation géographique de l'image (optionnel) */
  geoLocation?: string;

  /** Licence de l'image (optionnel) */
  license?: string;
}

/**
 * Types d'images pour les produits
 */
export enum ProductImageType {
  /** Image principale (packshot) */
  MAIN = 'main',

  /** Vue de face */
  FRONT = 'front',

  /** Vue de côté */
  SIDE = 'side',

  /** Vue arrière */
  BACK = 'back',

  /** Vue de dessus */
  TOP = 'top',

  /** Vue de détail/zoom */
  DETAIL = 'detail',

  /** Emballage */
  PACKAGING = 'packaging',

  /** Installation */
  INSTALLATION = 'installation',

  /** Schéma technique */
  TECHNICAL = 'technical',

  /** Comparaison */
  COMPARISON = 'comparison',
}

/**
 * Configuration des images pour un type de contenu
 */
export interface ImageSitemapConfig {
  /** Nombre max d'images par URL (Google recommande 1-10) */
  maxImagesPerUrl: number;

  /** Types d'images à inclure */
  allowedImageTypes: ProductImageType[];

  /** Utiliser URLs publiques stables (vs URLs signées temporaires) */
  usePublicUrls: boolean;

  /** CDN de base pour les images */
  cdnBaseUrl?: string;

  /** Générer automatiquement les titres manquants */
  autoGenerateTitles: boolean;

  /** Ajouter watermark/copyright dans caption */
  addWatermarkCaption: boolean;
}

/**
 * Métadonnées d'une image produit
 */
export interface ProductImageMetadata {
  /** ID de l'image */
  id: string;

  /** URL de l'image (publique, stable) */
  url: string;

  /** Type d'image */
  type: ProductImageType;

  /** Nom du produit (pour générer title) */
  productName: string;

  /** Référence du produit */
  productRef?: string;

  /** Description de l'image */
  description?: string;

  /** Ordre d'affichage */
  displayOrder?: number;

  /** Image principale ? */
  isPrimary?: boolean;

  /** Dimensions */
  width?: number;
  height?: number;

  /** Format (webp, jpg, png) */
  format?: string;

  /** Taille en octets */
  size?: number;

  /** Date d'upload */
  uploadedAt?: Date;
}
