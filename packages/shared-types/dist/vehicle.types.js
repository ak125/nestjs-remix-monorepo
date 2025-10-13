"use strict";
/**
 * 🚗 TYPES VÉHICULES UNIFIÉS
 *
 * Types partagés entre backend (NestJS) et frontend (Remix)
 * Basés sur l'analyse des types existants et consolidés
 *
 * @version 2.0.0
 * @package @monorepo/shared-types
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateVehicleFilters = exports.validateVehicleType = exports.validateVehicleModel = exports.validateVehicleBrand = exports.TypeSelectorPropsSchema = exports.ModelSelectorPropsSchema = exports.BrandSelectorPropsSchema = exports.BaseSelectorPropsSchema = exports.VehicleInfoSchema = exports.VehicleDataSchema = exports.CacheConfigSchema = exports.LoadingStateSchema = exports.VehicleSelectionEventSchema = exports.VehicleResponseSchema = exports.VehicleFiltersSchema = exports.VehicleTypeSchema = exports.VehicleModelSchema = exports.VehicleBrandSchema = void 0;
const zod_1 = require("zod");
const api_types_1 = require("./api.types");
/**

// ====================================
// 🏭 TYPES DE BASE VÉHICULES
// ====================================

/**
 * Schema Zod pour validation VehicleBrand
 */
exports.VehicleBrandSchema = zod_1.z.object({
    marque_id: zod_1.z.number().int().positive(),
    marque_name: zod_1.z.string().min(1),
    marque_alias: zod_1.z.string().optional(),
    marque_name_meta: zod_1.z.string().optional(),
    marque_name_meta_title: zod_1.z.string().optional(),
    marque_logo: zod_1.z.string().optional(),
    marque_wall: zod_1.z.string().optional(),
    marque_country: zod_1.z.string().optional(),
    marque_display: zod_1.z.number().int().min(0).max(1).default(1),
    marque_sort: zod_1.z.number().int().optional(),
    marque_top: zod_1.z.number().int().min(0).max(1).optional(),
    marque_relfollow: zod_1.z.number().int().min(0).max(1).default(1),
    marque_sitemap: zod_1.z.number().int().min(0).max(1).default(1),
    products_count: zod_1.z.number().int().optional(),
    is_featured: zod_1.z.boolean().optional(),
});
/**
 * Schema Zod pour validation VehicleModel
 */
exports.VehicleModelSchema = zod_1.z.object({
    modele_id: zod_1.z.number().int().positive(),
    modele_name: zod_1.z.string().min(1),
    modele_alias: zod_1.z.string().optional(),
    modele_name_meta: zod_1.z.string().optional(),
    modele_ful_name: zod_1.z.string().optional(),
    modele_marque_id: zod_1.z.number().int().positive(),
    modele_pic: zod_1.z.string().optional(),
    modele_year_from: zod_1.z.number().int().optional(),
    modele_year_to: zod_1.z.number().int().optional(),
    modele_display: zod_1.z.number().int().min(0).max(1).default(1),
    modele_sort: zod_1.z.number().int().optional(),
    // Relation avec la marque (optionnelle pour éviter les références circulaires)
    auto_marque: exports.VehicleBrandSchema.optional(),
});
/**
 * Schema Zod pour validation VehicleType
 */
exports.VehicleTypeSchema = zod_1.z.object({
    type_id: zod_1.z.number().int().positive(),
    type_name: zod_1.z.string().min(1),
    type_alias: zod_1.z.string().optional(),
    type_name_meta: zod_1.z.string().optional(),
    type_engine_code: zod_1.z.string().optional(),
    type_fuel: zod_1.z.string().optional(),
    type_power: zod_1.z.string().optional(),
    type_power_ps: zod_1.z.number().int().optional(),
    type_power_kw: zod_1.z.number().int().optional(),
    type_liter: zod_1.z.string().optional(),
    type_year_from: zod_1.z.string().optional(),
    type_year_to: zod_1.z.string().nullable().optional(),
    type_month_from: zod_1.z.number().int().min(1).max(12).optional(),
    type_month_to: zod_1.z.number().int().min(1).max(12).optional(),
    type_engine: zod_1.z.string().optional(),
    type_engine_description: zod_1.z.string().optional(),
    type_slug: zod_1.z.string().optional(),
    type_display: zod_1.z.number().int().min(0).max(1).default(1),
    type_sort: zod_1.z.number().int().optional(),
    modele_id: zod_1.z.number().int().positive(),
    // Relations (optionnelles)
    auto_modele: exports.VehicleModelSchema.optional(),
    // Compatibilité avec anciens types
    year_from: zod_1.z.number().int().optional(),
    year_to: zod_1.z.number().int().optional(),
});
// ====================================
// 🎯 TYPES DE RECHERCHE ET FILTRAGE
// ====================================
/**
 * Schema pour les filtres de recherche véhicules
 */
exports.VehicleFiltersSchema = api_types_1.PaginationOptionsSchema.extend({
    brandId: zod_1.z.number().int().positive().optional(),
    modelId: zod_1.z.number().int().positive().optional(),
    typeId: zod_1.z.number().int().positive().optional(),
    year: zod_1.z.number().int().min(1900).max(2030).optional(),
    yearFrom: zod_1.z.number().int().min(1900).max(2030).optional(),
    yearTo: zod_1.z.number().int().min(1900).max(2030).optional(),
    fuel: zod_1.z.string().optional(),
    powerMin: zod_1.z.number().int().positive().optional(),
    powerMax: zod_1.z.number().int().positive().optional(),
});
/**
 * Schema pour les réponses véhicules
 */
const VehicleResponseSchema = (itemSchema) => zod_1.z.object({
    data: zod_1.z.array(itemSchema),
    total: zod_1.z.number().int().nonnegative(),
    page: zod_1.z.number().int().positive(),
    limit: zod_1.z.number().int().positive(),
    hasNext: zod_1.z.boolean(),
    hasPrev: zod_1.z.boolean(),
});
exports.VehicleResponseSchema = VehicleResponseSchema;
// ====================================
// 📊 TYPES POUR LES ÉVÉNEMENTS
// ====================================
/**
 * Schema pour les événements de sélection
 */
exports.VehicleSelectionEventSchema = zod_1.z.object({
    brand: exports.VehicleBrandSchema.optional(),
    model: exports.VehicleModelSchema.optional(),
    type: exports.VehicleTypeSchema.optional(),
    year: zod_1.z.number().int().min(1900).max(2030).optional(),
    isComplete: zod_1.z.boolean(),
    timestamp: zod_1.z.number().int().positive().default(() => Date.now()),
    source: zod_1.z.enum(['user', 'api', 'cache', 'reset']).default('user'),
});
// ====================================
// 🛠️ TYPES UTILITAIRES
// ====================================
/**
 * Schema pour l'état de chargement
 */
exports.LoadingStateSchema = zod_1.z.object({
    isLoading: zod_1.z.boolean().default(false),
    error: zod_1.z.string().optional(),
    lastUpdate: zod_1.z.number().int().positive().optional(),
});
/**
 * Schema pour la configuration de cache
 */
exports.CacheConfigSchema = zod_1.z.object({
    ttl: zod_1.z.number().int().positive().default(300), // 5 minutes par défaut
    maxSize: zod_1.z.number().int().positive().default(1000),
    keyPrefix: zod_1.z.string().default('vehicle'),
});
// ====================================
// 🎨 TYPES COMPOSITES 
// ====================================
/**
 * Schema pour les données complètes d'un véhicule
 */
exports.VehicleDataSchema = zod_1.z.object({
    // Données principales
    brand: zod_1.z.string(),
    model: zod_1.z.string(),
    type: zod_1.z.string(),
    year: zod_1.z.number().int().min(1900).max(2030).optional(),
    engine: zod_1.z.string().optional(),
    fuel: zod_1.z.string().optional(),
    power: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    // URLs et images
    imageUrl: zod_1.z.string().url().optional(),
    slug: zod_1.z.string().optional(),
    // Statistiques
    partsCount: zod_1.z.number().int().nonnegative().optional(),
    // IDs pour les relations
    brandId: zod_1.z.number().int().positive().optional(),
    modelId: zod_1.z.number().int().positive().optional(),
    typeId: zod_1.z.number().int().positive().optional(),
    // Métadonnées
    createdAt: zod_1.z.string().datetime().optional(),
    updatedAt: zod_1.z.string().datetime().optional(),
});
/**
 * Schema pour les informations enrichies d'un véhicule
 */
exports.VehicleInfoSchema = exports.VehicleDataSchema.extend({
    // Relations complètes
    vehicleBrand: exports.VehicleBrandSchema.optional(),
    vehicleModel: exports.VehicleModelSchema.optional(),
    vehicleType: exports.VehicleTypeSchema.optional(),
    // Statistiques détaillées
    stats: zod_1.z.object({
        viewCount: zod_1.z.number().int().nonnegative().optional(),
        partsCount: zod_1.z.number().int().nonnegative().optional(),
        popularParts: zod_1.z.array(zod_1.z.string()).optional(),
        lastUpdated: zod_1.z.string().datetime().optional(),
    }).optional(),
    // SEO
    seo: zod_1.z.object({
        title: zod_1.z.string().optional(),
        description: zod_1.z.string().optional(),
        keywords: zod_1.z.array(zod_1.z.string()).optional(),
        canonicalUrl: zod_1.z.string().url().optional(),
    }).optional(),
});
// ====================================
// 📋 TYPES SPÉCIALISÉS POUR LES COMPOSANTS
// ====================================
/**
 * Schema pour les props de sélecteur de base
 */
exports.BaseSelectorPropsSchema = zod_1.z.object({
    value: zod_1.z.string().optional(),
    placeholder: zod_1.z.string().optional(),
    disabled: zod_1.z.boolean().default(false),
    className: zod_1.z.string().optional(),
    allowClear: zod_1.z.boolean().default(false),
    autoFocus: zod_1.z.boolean().default(false),
});
/**
 * Schema pour les props de sélecteur de marques
 */
exports.BrandSelectorPropsSchema = exports.BaseSelectorPropsSchema.extend({
    showFeaturedFirst: zod_1.z.boolean().default(true),
    showLogos: zod_1.z.boolean().default(true),
    showCountries: zod_1.z.boolean().default(false),
});
/**
 * Schema pour les props de sélecteur de modèles
 */
exports.ModelSelectorPropsSchema = exports.BaseSelectorPropsSchema.extend({
    brandId: zod_1.z.number().int().positive().optional(),
    searchPlaceholder: zod_1.z.string().default('Rechercher un modèle...'),
    autoLoadOnMount: zod_1.z.boolean().default(false),
    showYearRange: zod_1.z.boolean().default(true),
});
/**
 * Schema pour les props de sélecteur de types
 */
exports.TypeSelectorPropsSchema = exports.BaseSelectorPropsSchema.extend({
    modelId: zod_1.z.number().int().positive().optional(),
    brandId: zod_1.z.number().int().positive().optional(),
    searchPlaceholder: zod_1.z.string().default('Rechercher une motorisation...'),
    autoLoadOnMount: zod_1.z.boolean().default(false),
    showEngineDetails: zod_1.z.boolean().default(true),
    showPowerDetails: zod_1.z.boolean().default(true),
    onlyActive: zod_1.z.boolean().default(true),
    showDetails: zod_1.z.boolean().default(true),
});
// ====================================
// 🧪 FONCTIONS DE VALIDATION
// ====================================
/**
 * Valide les données d'une marque
 */
const validateVehicleBrand = (data) => {
    return exports.VehicleBrandSchema.parse(data);
};
exports.validateVehicleBrand = validateVehicleBrand;
/**
 * Valide les données d'un modèle
 */
const validateVehicleModel = (data) => {
    return exports.VehicleModelSchema.parse(data);
};
exports.validateVehicleModel = validateVehicleModel;
/**
 * Valide les données d'un type
 */
const validateVehicleType = (data) => {
    return exports.VehicleTypeSchema.parse(data);
};
exports.validateVehicleType = validateVehicleType;
/**
 * Valide les filtres de recherche
 */
const validateVehicleFilters = (data) => {
    return exports.VehicleFiltersSchema.parse(data);
};
exports.validateVehicleFilters = validateVehicleFilters;
//# sourceMappingURL=vehicle.types.js.map