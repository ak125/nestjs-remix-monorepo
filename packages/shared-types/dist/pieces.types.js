"use strict";
/**
 * 🔧 TYPES PIÈCES UNIFIÉS
 *
 * Types partagés pour les pièces automobiles entre backend et frontend
 * Basés sur l'analyse des services existants et de la logique PHP
 *
 * @version 2.0.0
 * @package @monorepo/shared-types
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PieceCardPropsSchema = exports.PieceGridPropsSchema = exports.validatePieceSearchFilters = exports.validateUnifiedCatalogResponse = exports.validateGetPiecesOptions = exports.validateUnifiedPiece = exports.CatalogStatsSchema = exports.PieceSearchFiltersSchema = exports.UnifiedCatalogResponseSchema = exports.GetPiecesOptionsSchema = exports.PieceBlockSchema = exports.UnifiedPieceSchema = exports.PieceGammeSchema = exports.PieceSideFilterSchema = exports.PieceImageSchema = exports.PiecePriceSchema = exports.PieceMarqueSchema = exports.TechnicalCriteriaSchema = void 0;
const zod_1 = require("zod");
// ====================================
// 🔧 CRITÈRES TECHNIQUES
// ====================================
/**
 * Schema pour les critères techniques des pièces
 */
exports.TechnicalCriteriaSchema = zod_1.z.object({
    criteria: zod_1.z.string(),
    value: zod_1.z.string(),
    unit: zod_1.z.string().optional(),
    level: zod_1.z.number().int().min(1).default(1),
});
// ====================================
// 🔧 TYPES DE BASE PIÈCES
// ====================================
/**
 * Schema pour les marques d'équipementiers (pieces_marques)
 */
exports.PieceMarqueSchema = zod_1.z.object({
    pm_id: zod_1.z.number().int().positive(),
    pm_name: zod_1.z.string().min(1),
    pm_logo: zod_1.z.string().optional(),
    pm_alias: zod_1.z.string().optional(),
    pm_oes: zod_1.z.string().optional(), // 'O', '1', 'A'
    pm_nb_stars: zod_1.z.number().int().min(0).max(6).optional(),
    pm_quality: zod_1.z.string().optional(),
    pm_preview: zod_1.z.string().optional(),
    pm_website: zod_1.z.string().url().optional(),
    pm_display: zod_1.z.number().int().min(0).max(1).default(1),
    pm_sort: zod_1.z.number().int().optional(),
    pm_top: zod_1.z.number().int().min(0).max(1).optional(),
});
/**
 * Schema pour les prix des pièces (pieces_price)
 */
exports.PiecePriceSchema = zod_1.z.object({
    pri_piece_id: zod_1.z.union([zod_1.z.string(), zod_1.z.number().int().positive()]),
    pri_vente_ttc: zod_1.z.string().optional(), // Stocké en string dans BDD
    pri_consigne_ttc: zod_1.z.string().optional(),
    pri_dispo: zod_1.z.string().optional(), // '1' = disponible
    pri_type: zod_1.z.string().optional(), // Priorité du prix
});
/**
 * Schema pour les images des pièces (pieces_media_img)
 */
exports.PieceImageSchema = zod_1.z.object({
    pmi_piece_id: zod_1.z.number().int().positive(),
    pmi_folder: zod_1.z.string(),
    pmi_name: zod_1.z.string(),
    pmi_display: zod_1.z.number().int().min(0).max(1).default(1),
});
/**
 * Schema pour les filtres latéraux (pieces_side_filtre)
 */
exports.PieceSideFilterSchema = zod_1.z.object({
    psf_id: zod_1.z.number().int().positive(),
    psf_side: zod_1.z.string(),
});
/**
 * Schema pour les gammes de pièces (pieces_gamme)
 */
exports.PieceGammeSchema = zod_1.z.object({
    pg_id: zod_1.z.number().int().positive(),
    pg_name: zod_1.z.string().min(1),
    pg_alias: zod_1.z.string(),
    pg_name_url: zod_1.z.string().optional(),
    pg_name_meta: zod_1.z.string().optional(),
    pg_pic: zod_1.z.string().optional(),
    pg_img: zod_1.z.string().optional(),
    pg_display: zod_1.z.number().int().min(0).max(1).default(1),
    pg_level: zod_1.z.number().int().optional(),
    pg_top: zod_1.z.number().int().min(0).max(1).optional(),
    pg_parent: zod_1.z.number().int().optional(),
    pg_sort: zod_1.z.number().int().optional(),
});
/**
 * Schema principal pour une pièce unifiée
 * Combine les données de plusieurs tables selon la logique PHP
 */
exports.UnifiedPieceSchema = zod_1.z.object({
    // ====================================
    // 🆔 IDENTIFIANTS
    // ====================================
    id: zod_1.z.number().int().positive(),
    reference: zod_1.z.string(),
    reference_clean: zod_1.z.string().optional(),
    // ====================================
    // 🏷️ NOMS ET DESCRIPTIONS
    // ====================================
    nom: zod_1.z.string(),
    nom_complet: zod_1.z.string(),
    piece_name: zod_1.z.string(),
    piece_name_side: zod_1.z.string().optional(),
    piece_name_comp: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    // ====================================
    // 🏭 MARQUE ET ÉQUIPEMENTIER
    // ====================================
    marque: zod_1.z.string(),
    marque_id: zod_1.z.number().int().positive().optional(),
    marque_logo: zod_1.z.string().optional(),
    marque_alias: zod_1.z.string().optional(),
    // ====================================
    // 💰 PRIX ET QUANTITÉS
    // ====================================
    prix_unitaire: zod_1.z.number().nonnegative(),
    prix_ttc: zod_1.z.number().nonnegative(),
    prix_consigne: zod_1.z.number().nonnegative(),
    prix_total: zod_1.z.number().nonnegative(),
    quantite_vente: zod_1.z.number().positive().default(1),
    // ====================================
    // ⭐ QUALITÉ ET PERFORMANCES
    // ====================================
    qualite: zod_1.z.enum(['OES', 'AFTERMARKET', 'Echange Standard']),
    nb_stars: zod_1.z.number().int().min(0).max(6).default(3),
    pm_oes: zod_1.z.string().optional(),
    // ====================================
    // 🖼️ IMAGES ET MÉDIA
    // ====================================
    image: zod_1.z.string(),
    image_alt: zod_1.z.string().optional(),
    image_title: zod_1.z.string().optional(),
    // ====================================
    // 🏷️ FILTRES ET CATÉGORIES
    // ====================================
    filtre_gamme: zod_1.z.string().optional(),
    filtre_side: zod_1.z.string().optional(),
    filtre_id: zod_1.z.number().int().optional(),
    psf_id: zod_1.z.number().int().optional(),
    // ====================================
    // 🔧 CARACTÉRISTIQUES TECHNIQUES
    // ====================================
    has_image: zod_1.z.boolean().default(false),
    has_oem: zod_1.z.boolean().default(false),
    has_price: zod_1.z.boolean().default(false),
    has_consigne: zod_1.z.boolean().default(false),
    // ====================================
    // 🔬 CRITÈRES TECHNIQUES
    // ====================================
    criterias_techniques: zod_1.z.array(exports.TechnicalCriteriaSchema).default([]),
    // ====================================
    // 🌐 URL ET NAVIGATION
    // ====================================
    url: zod_1.z.string().url().optional(),
    // ====================================
    // 🐛 MÉTADONNÉES ET DEBUG
    // ====================================
    _metadata: zod_1.z.object({
        has_price_data: zod_1.z.boolean(),
        has_image_data: zod_1.z.boolean(),
        criterias_count: zod_1.z.number().int().nonnegative(),
        relation_ids: zod_1.z.object({
            pm_id: zod_1.z.number().int().optional(),
            psf_id: zod_1.z.number().int().optional(),
        }).optional(),
    }).optional(),
});
// ====================================
// 📦 GROUPEMENT PAR BLOCS
// ====================================
/**
 * Schema pour les blocs de pièces (groupement par filtre)
 */
exports.PieceBlockSchema = zod_1.z.object({
    filtre_gamme: zod_1.z.string(),
    filtre_side: zod_1.z.string(),
    key: zod_1.z.string(),
    pieces: zod_1.z.array(exports.UnifiedPieceSchema),
    count: zod_1.z.number().int().nonnegative(),
    minPrice: zod_1.z.number().nonnegative().nullable(),
    maxPrice: zod_1.z.number().nonnegative().nullable(),
});
// ====================================
// ⚙️ OPTIONS ET FILTRES
// ====================================
/**
 * Schema pour les options de récupération des pièces
 */
exports.GetPiecesOptionsSchema = zod_1.z.object({
    maxPieces: zod_1.z.number().int().positive().default(150),
    maxRelations: zod_1.z.number().int().positive().optional(),
    bypassCache: zod_1.z.boolean().default(false),
    cacheDuration: zod_1.z.number().int().positive().default(300), // 5 minutes
    includeTechnicalCriteria: zod_1.z.boolean().default(false),
    includeImages: zod_1.z.boolean().default(true),
    sortBy: zod_1.z.enum(['name', 'price', 'brand', 'quality']).default('name'),
    filters: zod_1.z.object({
        brands: zod_1.z.array(zod_1.z.string()).optional(),
        priceRange: zod_1.z.object({
            min: zod_1.z.number().nonnegative(),
            max: zod_1.z.number().nonnegative(),
        }).optional(),
        quality: zod_1.z.array(zod_1.z.string()).optional(),
    }).optional(),
});
// ====================================
// 📋 RÉPONSES API UNIFIÉES
// ====================================
/**
 * Schema pour la réponse de catalogue unifiée
 */
exports.UnifiedCatalogResponseSchema = zod_1.z.object({
    pieces: zod_1.z.array(exports.UnifiedPieceSchema),
    blocs: zod_1.z.array(exports.PieceBlockSchema),
    pieces_grouped_by_filter: zod_1.z.array(exports.PieceBlockSchema), // Alias compatibilité
    count: zod_1.z.number().int().nonnegative(),
    blocs_count: zod_1.z.number().int().nonnegative(),
    minPrice: zod_1.z.number().nonnegative().nullable(),
    maxPrice: zod_1.z.number().nonnegative().nullable(),
    averagePrice: zod_1.z.number().nonnegative().nullable(),
    relations_found: zod_1.z.number().int().nonnegative(),
    duration: zod_1.z.string(),
    success: zod_1.z.boolean(),
    message: zod_1.z.string().optional(),
    error: zod_1.z.string().optional(),
    optimization: zod_1.z.string(),
    features: zod_1.z.array(zod_1.z.string()),
    metadata: zod_1.z.object({
        requestId: zod_1.z.string(),
        typeId: zod_1.z.number().int().positive(),
        pgId: zod_1.z.number().int().positive(),
        version: zod_1.z.string(),
        timestamp: zod_1.z.string().datetime(),
        config: zod_1.z.any(),
        error: zod_1.z.object({
            message: zod_1.z.string(),
            stack: zod_1.z.string().optional(),
        }).optional(),
    }),
});
// ====================================
// 🔍 RECHERCHE ET FILTRAGE
// ====================================
/**
 * Schema pour les filtres de recherche de pièces
 */
exports.PieceSearchFiltersSchema = zod_1.z.object({
    query: zod_1.z.string().optional(),
    typeId: zod_1.z.number().int().positive().optional(),
    pgId: zod_1.z.number().int().positive().optional(),
    marqueId: zod_1.z.number().int().positive().optional(),
    modeleId: zod_1.z.number().int().positive().optional(),
    // Filtres de prix
    minPrice: zod_1.z.number().nonnegative().optional(),
    maxPrice: zod_1.z.number().nonnegative().optional(),
    // Filtres de qualité
    qualites: zod_1.z.array(zod_1.z.enum(['OES', 'AFTERMARKET', 'Echange Standard'])).optional(),
    // Filtres de marque
    marques: zod_1.z.array(zod_1.z.string()).optional(),
    // Options d'affichage
    includeOutOfStock: zod_1.z.boolean().default(false),
    sortBy: zod_1.z.enum(['name', 'price-asc', 'price-desc', 'brand', 'quality']).default('name'),
    // Pagination
    page: zod_1.z.number().int().positive().default(1),
    limit: zod_1.z.number().int().positive().max(100).default(20),
});
// ====================================
// 📊 STATISTIQUES ET MÉTRIQUES
// ====================================
/**
 * Schema pour les statistiques de catalogue
 */
exports.CatalogStatsSchema = zod_1.z.object({
    totalPieces: zod_1.z.number().int().nonnegative(),
    totalGammes: zod_1.z.number().int().nonnegative(),
    totalMarques: zod_1.z.number().int().nonnegative(),
    averagePrice: zod_1.z.number().nonnegative(),
    priceRange: zod_1.z.object({
        min: zod_1.z.number().nonnegative(),
        max: zod_1.z.number().nonnegative(),
    }),
    topGammes: zod_1.z.array(zod_1.z.object({
        pg_id: zod_1.z.number().int().positive(),
        pg_name: zod_1.z.string(),
        pieces_count: zod_1.z.number().int().nonnegative(),
    })).optional(),
    topMarques: zod_1.z.array(zod_1.z.object({
        pm_id: zod_1.z.number().int().positive(),
        pm_name: zod_1.z.string(),
        pieces_count: zod_1.z.number().int().nonnegative(),
    })).optional(),
});
// ====================================
// 🧪 FONCTIONS DE VALIDATION
// ====================================
/**
 * Valide une pièce unifiée
 */
const validateUnifiedPiece = (data) => {
    return exports.UnifiedPieceSchema.parse(data);
};
exports.validateUnifiedPiece = validateUnifiedPiece;
/**
 * Valide les options de récupération des pièces
 */
const validateGetPiecesOptions = (data) => {
    return exports.GetPiecesOptionsSchema.parse(data);
};
exports.validateGetPiecesOptions = validateGetPiecesOptions;
/**
 * Valide une réponse de catalogue
 */
const validateUnifiedCatalogResponse = (data) => {
    return exports.UnifiedCatalogResponseSchema.parse(data);
};
exports.validateUnifiedCatalogResponse = validateUnifiedCatalogResponse;
/**
 * Valide les filtres de recherche
 */
const validatePieceSearchFilters = (data) => {
    return exports.PieceSearchFiltersSchema.parse(data);
};
exports.validatePieceSearchFilters = validatePieceSearchFilters;
// ====================================
// 🎨 TYPES POUR LES COMPOSANTS UI
// ====================================
/**
 * Schema pour les props de grille de pièces
 */
exports.PieceGridPropsSchema = zod_1.z.object({
    pieces: zod_1.z.array(exports.UnifiedPieceSchema),
    loading: zod_1.z.boolean().default(false),
    error: zod_1.z.string().optional(),
    onPieceClick: zod_1.z.function().optional(),
    onAddToCart: zod_1.z.function().optional(),
    showFilters: zod_1.z.boolean().default(true),
    gridColumns: zod_1.z.number().int().min(1).max(6).default(4),
    className: zod_1.z.string().optional(),
});
/**
 * Schema pour les props de carte de pièce
 */
exports.PieceCardPropsSchema = zod_1.z.object({
    piece: exports.UnifiedPieceSchema,
    variant: zod_1.z.enum(['default', 'compact', 'detailed']).default('default'),
    showPrice: zod_1.z.boolean().default(true),
    showImage: zod_1.z.boolean().default(true),
    showBrand: zod_1.z.boolean().default(true),
    showQuickAdd: zod_1.z.boolean().default(true),
    onClick: zod_1.z.function().optional(),
    onAddToCart: zod_1.z.function().optional(),
    className: zod_1.z.string().optional(),
});
//# sourceMappingURL=pieces.types.js.map