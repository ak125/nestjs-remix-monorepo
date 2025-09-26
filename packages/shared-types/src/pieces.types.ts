/**
 * 🔧 TYPES PIÈCES UNIFIÉS
 * 
 * Types partagés pour les pièces automobiles entre backend et frontend
 * Basés sur l'analyse des services existants et de la logique PHP
 * 
 * @version 2.0.0
 * @package @monorepo/shared-types
 */

import { z } from 'zod';

// ====================================
// 🔧 CRITÈRES TECHNIQUES
// ====================================

/**
 * Schema pour les critères techniques des pièces
 */
export const TechnicalCriteriaSchema = z.object({
  criteria: z.string(),
  value: z.string(),
  unit: z.string().optional(),
  level: z.number().int().min(1).default(1),
});

export type TechnicalCriteria = z.infer<typeof TechnicalCriteriaSchema>;

// ====================================
// 🔧 TYPES DE BASE PIÈCES
// ====================================

/**
 * Schema pour les marques d'équipementiers (pieces_marques)
 */
export const PieceMarqueSchema = z.object({
  pm_id: z.number().int().positive(),
  pm_name: z.string().min(1),
  pm_logo: z.string().optional(),
  pm_alias: z.string().optional(),
  pm_oes: z.string().optional(), // 'O', '1', 'A'
  pm_nb_stars: z.number().int().min(0).max(6).optional(),
  pm_quality: z.string().optional(),
  pm_preview: z.string().optional(),
  pm_website: z.string().url().optional(),
  pm_display: z.number().int().min(0).max(1).default(1),
  pm_sort: z.number().int().optional(),
  pm_top: z.number().int().min(0).max(1).optional(),
});

export type PieceMarque = z.infer<typeof PieceMarqueSchema>;

/**
 * Schema pour les prix des pièces (pieces_price)
 */
export const PiecePriceSchema = z.object({
  pri_piece_id: z.union([z.string(), z.number().int().positive()]),
  pri_vente_ttc: z.string().optional(), // Stocké en string dans BDD
  pri_consigne_ttc: z.string().optional(),
  pri_dispo: z.string().optional(), // '1' = disponible
  pri_type: z.string().optional(), // Priorité du prix
});

export type PiecePrice = z.infer<typeof PiecePriceSchema>;

/**
 * Schema pour les images des pièces (pieces_media_img)
 */
export const PieceImageSchema = z.object({
  pmi_piece_id: z.number().int().positive(),
  pmi_folder: z.string(),
  pmi_name: z.string(),
  pmi_display: z.number().int().min(0).max(1).default(1),
});

export type PieceImage = z.infer<typeof PieceImageSchema>;

/**
 * Schema pour les filtres latéraux (pieces_side_filtre)
 */
export const PieceSideFilterSchema = z.object({
  psf_id: z.number().int().positive(),
  psf_side: z.string(),
});

export type PieceSideFilter = z.infer<typeof PieceSideFilterSchema>;

/**
 * Schema pour les gammes de pièces (pieces_gamme)
 */
export const PieceGammeSchema = z.object({
  pg_id: z.number().int().positive(),
  pg_name: z.string().min(1),
  pg_alias: z.string(),
  pg_name_url: z.string().optional(),
  pg_name_meta: z.string().optional(),
  pg_pic: z.string().optional(),
  pg_img: z.string().optional(),
  pg_display: z.number().int().min(0).max(1).default(1),
  pg_level: z.number().int().optional(),
  pg_top: z.number().int().min(0).max(1).optional(),
  pg_parent: z.number().int().optional(),
  pg_sort: z.number().int().optional(),
});

export type PieceGamme = z.infer<typeof PieceGammeSchema>;

/**
 * Schema principal pour une pièce unifiée
 * Combine les données de plusieurs tables selon la logique PHP
 */
export const UnifiedPieceSchema = z.object({
  // ====================================
  // 🆔 IDENTIFIANTS
  // ====================================
  id: z.number().int().positive(),
  reference: z.string(),
  reference_clean: z.string().optional(),

  // ====================================
  // 🏷️ NOMS ET DESCRIPTIONS
  // ====================================
  nom: z.string(),
  nom_complet: z.string(),
  piece_name: z.string(),
  piece_name_side: z.string().optional(),
  piece_name_comp: z.string().optional(),
  description: z.string().optional(),

  // ====================================
  // 🏭 MARQUE ET ÉQUIPEMENTIER
  // ====================================
  marque: z.string(),
  marque_id: z.number().int().positive().optional(),
  marque_logo: z.string().optional(),
  marque_alias: z.string().optional(),

  // ====================================
  // 💰 PRIX ET QUANTITÉS
  // ====================================
  prix_unitaire: z.number().nonnegative(),
  prix_ttc: z.number().nonnegative(),
  prix_consigne: z.number().nonnegative(),
  prix_total: z.number().nonnegative(),
  quantite_vente: z.number().positive().default(1),

  // ====================================
  // ⭐ QUALITÉ ET PERFORMANCES
  // ====================================
  qualite: z.enum(['OES', 'AFTERMARKET', 'Echange Standard']),
  nb_stars: z.number().int().min(0).max(6).default(3),
  pm_oes: z.string().optional(),

  // ====================================
  // 🖼️ IMAGES ET MÉDIA
  // ====================================
  image: z.string(),
  image_alt: z.string().optional(),
  image_title: z.string().optional(),

  // ====================================
  // 🏷️ FILTRES ET CATÉGORIES
  // ====================================
  filtre_gamme: z.string().optional(),
  filtre_side: z.string().optional(),
  filtre_id: z.number().int().optional(),
  psf_id: z.number().int().optional(),

  // ====================================
  // 🔧 CARACTÉRISTIQUES TECHNIQUES
  // ====================================
  has_image: z.boolean().default(false),
  has_oem: z.boolean().default(false),
  has_price: z.boolean().default(false),
  has_consigne: z.boolean().default(false),

  // ====================================
  // 🔬 CRITÈRES TECHNIQUES
  // ====================================
  criterias_techniques: z.array(TechnicalCriteriaSchema).default([]),

  // ====================================
  // 🌐 URL ET NAVIGATION
  // ====================================
  url: z.string().url().optional(),

  // ====================================
  // 🐛 MÉTADONNÉES ET DEBUG
  // ====================================
  _metadata: z.object({
    has_price_data: z.boolean(),
    has_image_data: z.boolean(),
    criterias_count: z.number().int().nonnegative(),
    relation_ids: z.object({
      pm_id: z.number().int().optional(),
      psf_id: z.number().int().optional(),
    }).optional(),
  }).optional(),
});

export type UnifiedPiece = z.infer<typeof UnifiedPieceSchema>;

// ====================================
// 📦 GROUPEMENT PAR BLOCS
// ====================================

/**
 * Schema pour les blocs de pièces (groupement par filtre)
 */
export const PieceBlockSchema = z.object({
  filtre_gamme: z.string(),
  filtre_side: z.string(),
  key: z.string(),
  pieces: z.array(UnifiedPieceSchema),
  count: z.number().int().nonnegative(),
  minPrice: z.number().nonnegative().nullable(),
  maxPrice: z.number().nonnegative().nullable(),
});

export type PieceBlock = z.infer<typeof PieceBlockSchema>;

// ====================================
// ⚙️ OPTIONS ET FILTRES
// ====================================

/**
 * Schema pour les options de récupération des pièces
 */
export const GetPiecesOptionsSchema = z.object({
  maxPieces: z.number().int().positive().default(150),
  maxRelations: z.number().int().positive().optional(),
  bypassCache: z.boolean().default(false),
  cacheDuration: z.number().int().positive().default(300), // 5 minutes
  includeTechnicalCriteria: z.boolean().default(false),
  includeImages: z.boolean().default(true),
  sortBy: z.enum(['name', 'price', 'brand', 'quality']).default('name'),
  filters: z.object({
    brands: z.array(z.string()).optional(),
    priceRange: z.object({
      min: z.number().nonnegative(),
      max: z.number().nonnegative(),
    }).optional(),
    quality: z.array(z.string()).optional(),
  }).optional(),
});

export type GetPiecesOptions = z.infer<typeof GetPiecesOptionsSchema>;

// ====================================
// 📋 RÉPONSES API UNIFIÉES
// ====================================

/**
 * Schema pour la réponse de catalogue unifiée
 */
export const UnifiedCatalogResponseSchema = z.object({
  pieces: z.array(UnifiedPieceSchema),
  blocs: z.array(PieceBlockSchema),
  pieces_grouped_by_filter: z.array(PieceBlockSchema), // Alias compatibilité
  count: z.number().int().nonnegative(),
  blocs_count: z.number().int().nonnegative(),
  minPrice: z.number().nonnegative().nullable(),
  maxPrice: z.number().nonnegative().nullable(),
  averagePrice: z.number().nonnegative().nullable(),
  relations_found: z.number().int().nonnegative(),
  duration: z.string(),
  success: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
  optimization: z.string(),
  features: z.array(z.string()),
  metadata: z.object({
    requestId: z.string(),
    typeId: z.number().int().positive(),
    pgId: z.number().int().positive(),
    version: z.string(),
    timestamp: z.string().datetime(),
    config: z.any(),
    error: z.object({
      message: z.string(),
      stack: z.string().optional(),
    }).optional(),
  }),
});

export type UnifiedCatalogResponse = z.infer<typeof UnifiedCatalogResponseSchema>;

// ====================================
// 🔍 RECHERCHE ET FILTRAGE
// ====================================

/**
 * Schema pour les filtres de recherche de pièces
 */
export const PieceSearchFiltersSchema = z.object({
  query: z.string().optional(),
  typeId: z.number().int().positive().optional(),
  pgId: z.number().int().positive().optional(),
  marqueId: z.number().int().positive().optional(),
  modeleId: z.number().int().positive().optional(),
  
  // Filtres de prix
  minPrice: z.number().nonnegative().optional(),
  maxPrice: z.number().nonnegative().optional(),
  
  // Filtres de qualité
  qualites: z.array(z.enum(['OES', 'AFTERMARKET', 'Echange Standard'])).optional(),
  
  // Filtres de marque
  marques: z.array(z.string()).optional(),
  
  // Options d'affichage
  includeOutOfStock: z.boolean().default(false),
  sortBy: z.enum(['name', 'price-asc', 'price-desc', 'brand', 'quality']).default('name'),
  
  // Pagination
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export type PieceSearchFilters = z.infer<typeof PieceSearchFiltersSchema>;

// ====================================
// 📊 STATISTIQUES ET MÉTRIQUES
// ====================================

/**
 * Schema pour les statistiques de catalogue
 */
export const CatalogStatsSchema = z.object({
  totalPieces: z.number().int().nonnegative(),
  totalGammes: z.number().int().nonnegative(),
  totalMarques: z.number().int().nonnegative(),
  averagePrice: z.number().nonnegative(),
  priceRange: z.object({
    min: z.number().nonnegative(),
    max: z.number().nonnegative(),
  }),
  topGammes: z.array(z.object({
    pg_id: z.number().int().positive(),
    pg_name: z.string(),
    pieces_count: z.number().int().nonnegative(),
  })).optional(),
  topMarques: z.array(z.object({
    pm_id: z.number().int().positive(),
    pm_name: z.string(),
    pieces_count: z.number().int().nonnegative(),
  })).optional(),
});

export type CatalogStats = z.infer<typeof CatalogStatsSchema>;

// ====================================
// 🧪 FONCTIONS DE VALIDATION
// ====================================

/**
 * Valide une pièce unifiée
 */
export const validateUnifiedPiece = (data: unknown): UnifiedPiece => {
  return UnifiedPieceSchema.parse(data);
};

/**
 * Valide les options de récupération des pièces
 */
export const validateGetPiecesOptions = (data: unknown): GetPiecesOptions => {
  return GetPiecesOptionsSchema.parse(data);
};

/**
 * Valide une réponse de catalogue
 */
export const validateUnifiedCatalogResponse = (data: unknown): UnifiedCatalogResponse => {
  return UnifiedCatalogResponseSchema.parse(data);
};

/**
 * Valide les filtres de recherche
 */
export const validatePieceSearchFilters = (data: unknown): PieceSearchFilters => {
  return PieceSearchFiltersSchema.parse(data);
};

// ====================================
// 🎨 TYPES POUR LES COMPOSANTS UI
// ====================================

/**
 * Schema pour les props de grille de pièces
 */
export const PieceGridPropsSchema = z.object({
  pieces: z.array(UnifiedPieceSchema),
  loading: z.boolean().default(false),
  error: z.string().optional(),
  onPieceClick: z.function().optional(),
  onAddToCart: z.function().optional(),
  showFilters: z.boolean().default(true),
  gridColumns: z.number().int().min(1).max(6).default(4),
  className: z.string().optional(),
});

export type PieceGridProps = z.infer<typeof PieceGridPropsSchema>;

/**
 * Schema pour les props de carte de pièce
 */
export const PieceCardPropsSchema = z.object({
  piece: UnifiedPieceSchema,
  variant: z.enum(['default', 'compact', 'detailed']).default('default'),
  showPrice: z.boolean().default(true),
  showImage: z.boolean().default(true),
  showBrand: z.boolean().default(true),
  showQuickAdd: z.boolean().default(true),
  onClick: z.function().optional(),
  onAddToCart: z.function().optional(),
  className: z.string().optional(),
});

export type PieceCardProps = z.infer<typeof PieceCardPropsSchema>;