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
exports.TopBrandSchema = exports.MineCodeSearchSchema = exports.MotorCodeSearchSchema = exports.VehicleFullDetailsSchema = exports.VehicleMotorFuelSchema = exports.VehicleMineCodeSchema = exports.VehicleMotorCodeSchema = exports.validateVehicleFilters = exports.validateVehicleType = exports.validateVehicleModel = exports.validateVehicleBrand = exports.TypeSelectorPropsSchema = exports.ModelSelectorPropsSchema = exports.BrandSelectorPropsSchema = exports.BaseSelectorPropsSchema = exports.VehicleInfoSchema = exports.VehicleDataSchema = exports.CacheConfigSchema = exports.LoadingStateSchema = exports.VehicleSelectionEventSchema = exports.VehicleResponseSchema = exports.VehicleFiltersSchema = exports.VehicleTypeSchema = exports.VehicleModelSchema = exports.VehicleBrandSchema = void 0;
exports.formatProductionDate = formatProductionDate;
exports.formatProductionDateDetailed = formatProductionDateDetailed;
exports.formatPower = formatPower;
exports.literToCm3 = literToCm3;
exports.formatCylinder = formatCylinder;
exports.formatCodes = formatCodes;
exports.generateVehicleUrl = generateVehicleUrl;
exports.generateProductVehicleUrl = generateProductVehicleUrl;
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
// ====================================
// 🔧 TYPES CODES MOTEUR & TYPES MINES
// ====================================
/**
 * Schema pour les codes moteur (ex: K9K 752, M9R, CAGA)
 * Table: auto_type_motor_code
 */
exports.VehicleMotorCodeSchema = zod_1.z.object({
    tmc_type_id: zod_1.z.number().int().positive(),
    tmc_code: zod_1.z.string().min(1),
    tmc_display: zod_1.z.number().int().min(0).max(1).optional().default(1),
});
/**
 * Schema pour les types mines / CNIT (carte grise)
 * Table: auto_type_number_code
 */
exports.VehicleMineCodeSchema = zod_1.z.object({
    tnc_type_id: zod_1.z.number().int().positive(),
    tnc_code: zod_1.z.string().nullable().optional(), // Type mine (ex: 335AHR)
    tnc_cnit: zod_1.z.string().nullable().optional(), // Code CNIT
});
/**
 * Schema pour le carburant moteur
 * Table: auto_type_motor_fuel
 */
exports.VehicleMotorFuelSchema = zod_1.z.object({
    tmf_id: zod_1.z.number().int().positive(),
    tmf_motor: zod_1.z.string().optional(),
    tmf_engine: zod_1.z.string().optional(),
    tmf_fuel: zod_1.z.string().optional(),
    tmf_display: zod_1.z.number().int().min(0).max(1).optional().default(1),
    tmf_sort: zod_1.z.number().int().optional(),
});
// ====================================
// 🚗 TYPES VÉHICULE COMPLET (FULL DETAILS)
// ====================================
/**
 * Schema pour un véhicule avec TOUTES ses données
 * Équivalent du PHP avec marque + modèle + type + codes moteur + types mines
 */
exports.VehicleFullDetailsSchema = zod_1.z.object({
    // === MARQUE (Constructeur) ===
    marque_id: zod_1.z.number().int().positive(),
    marque_name: zod_1.z.string(),
    marque_name_meta: zod_1.z.string().optional(),
    marque_name_meta_title: zod_1.z.string().optional(),
    marque_alias: zod_1.z.string(),
    marque_logo: zod_1.z.string().optional(),
    marque_relfollow: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).optional(),
    marque_top: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).optional(),
    // === MODELE ===
    modele_id: zod_1.z.number().int().positive(),
    modele_name: zod_1.z.string(),
    modele_name_meta: zod_1.z.string().optional(),
    modele_alias: zod_1.z.string(),
    modele_pic: zod_1.z.string().optional(),
    modele_ful_name: zod_1.z.string().optional(),
    modele_body: zod_1.z.string().optional(),
    modele_relfollow: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).optional(),
    modele_year_from: zod_1.z.string().optional(),
    modele_year_to: zod_1.z.string().nullable().optional(),
    // === TYPE (Motorisation) ===
    type_id: zod_1.z.number().int().positive(),
    type_name: zod_1.z.string(),
    type_name_meta: zod_1.z.string().optional(),
    type_alias: zod_1.z.string(),
    // Puissance
    type_power_ps: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).optional(), // Chevaux
    type_power_kw: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).optional(), // Kilowatts
    // Caractéristiques techniques
    type_fuel: zod_1.z.string().optional(), // Diesel, Essence, Hybride...
    type_body: zod_1.z.string().optional(), // Berline, Break, SUV...
    type_engine: zod_1.z.string().optional(), // Code moteur principal
    type_liter: zod_1.z.string().optional(), // Cylindrée en litres (ex: "1.5")
    // Dates de production
    type_month_from: zod_1.z.string().optional(),
    type_year_from: zod_1.z.string().optional(),
    type_month_to: zod_1.z.string().nullable().optional(),
    type_year_to: zod_1.z.string().nullable().optional(),
    // SEO
    type_relfollow: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).optional(),
    type_display: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).optional(),
    // === CODES MOTEUR (multiples) ===
    motor_codes: zod_1.z.array(zod_1.z.string()).optional(),
    motor_codes_formatted: zod_1.z.string().optional(), // "K9K 752, K9K 764"
    // === TYPES MINES (multiples) ===
    mine_codes: zod_1.z.array(zod_1.z.string()).optional(),
    mine_codes_formatted: zod_1.z.string().optional(), // "335AHR, 335AHS"
    cnit_codes: zod_1.z.array(zod_1.z.string()).optional(),
    cnit_codes_formatted: zod_1.z.string().optional(),
    // === DONNÉES FORMATÉES ===
    production_date_formatted: zod_1.z.string().optional(), // "de 2005 à 2012" ou "depuis 2020"
    power_formatted: zod_1.z.string().optional(), // "75 ch / 55 kW"
    cylinder_cm3: zod_1.z.number().optional(), // Cylindrée en cm³ (calculée)
    // === URLS ===
    vehicle_url: zod_1.z.string().optional(),
    image_url: zod_1.z.string().optional(),
    logo_url: zod_1.z.string().optional(),
});
// ====================================
// 🛠️ HELPERS DE FORMATAGE
// ====================================
/**
 * Formate les dates de production comme dans le PHP
 * @example
 * formatProductionDate("06", "2005", "12", "2012") => "de 2005 à 2012"
 * formatProductionDate("06", "2020", null, null) => "depuis 06/2020"
 */
function formatProductionDate(monthFrom, yearFrom, monthTo, yearTo) {
    if (!yearFrom)
        return '';
    if (!yearTo) {
        // Véhicule encore en production
        if (monthFrom) {
            return `depuis ${monthFrom}/${yearFrom}`;
        }
        return `depuis ${yearFrom}`;
    }
    // Véhicule arrêté
    return `de ${yearFrom} à ${yearTo}`;
}
/**
 * Formate les dates de production en version détaillée avec mois
 * @example
 * formatProductionDateDetailed("06", "2005", "12", "2012") => "06/2005 → 12/2012"
 */
function formatProductionDateDetailed(monthFrom, yearFrom, monthTo, yearTo) {
    if (!yearFrom)
        return '';
    const dateDebut = monthFrom ? `${monthFrom}/${yearFrom}` : yearFrom;
    if (!yearTo) {
        return `depuis ${dateDebut}`;
    }
    const dateFin = monthTo ? `${monthTo}/${yearTo}` : yearTo;
    return `${dateDebut} → ${dateFin}`;
}
/**
 * Formate la puissance en ch et kW
 * @example
 * formatPower(75, 55) => "75 ch / 55 kW"
 * formatPower(75) => "75 ch / 55 kW" (calcule kW)
 */
function formatPower(powerPs, powerKw) {
    const ps = typeof powerPs === 'string' ? parseInt(powerPs, 10) : powerPs;
    let kw = typeof powerKw === 'string' ? parseInt(powerKw, 10) : powerKw;
    if (!ps && !kw)
        return '';
    // Conversion si kW manquant (1 ch = 0.7355 kW)
    if (ps && !kw) {
        kw = Math.round(ps * 0.7355);
    }
    if (ps && kw) {
        return `${ps} ch / ${kw} kW`;
    }
    if (ps)
        return `${ps} ch`;
    if (kw)
        return `${kw} kW`;
    return '';
}
/**
 * Convertit la cylindrée de litres en cm³
 * @example
 * literToCm3("1.5") => 1500
 * literToCm3("2.0") => 2000
 */
function literToCm3(liter) {
    if (!liter)
        return undefined;
    const liters = parseFloat(liter);
    if (isNaN(liters))
        return undefined;
    return Math.round(liters * 1000);
}
/**
 * Formate la cylindrée avec les deux unités
 * @example
 * formatCylinder("1.5") => "1500 cm³ (1.5 L)"
 */
function formatCylinder(liter) {
    if (!liter)
        return '';
    const cm3 = literToCm3(liter);
    if (!cm3)
        return '';
    return `${cm3} cm³ (${liter} L)`;
}
/**
 * Formate un tableau de codes en chaîne séparée par virgules
 * @example
 * formatCodes(["K9K 752", "K9K 764"]) => "K9K 752, K9K 764"
 */
function formatCodes(codes) {
    if (!codes || codes.length === 0)
        return '';
    return codes.filter(Boolean).join(', ');
}
/**
 * Génère l'URL du véhicule au format Automecanik
 * @example
 * generateVehicleUrl({marque_alias: "renault", marque_id: 5, ...})
 * => "/constructeurs/renault-5/clio-iii-5010/1-5-dci-16789.html"
 */
function generateVehicleUrl(vehicle) {
    return `/constructeurs/${vehicle.marque_alias}-${vehicle.marque_id}/${vehicle.modele_alias}-${vehicle.modele_id}/${vehicle.type_alias}-${vehicle.type_id}.html`;
}
/**
 * Génère l'URL d'une page produit pour un véhicule
 */
function generateProductVehicleUrl(params) {
    return `/pieces/${params.gamme_alias}-${params.gamme_id}/${params.marque_alias}-${params.marque_id}/${params.modele_alias}-${params.modele_id}/${params.type_alias}-${params.type_id}.html`;
}
// ====================================
// 🔍 TYPES RECHERCHE AVANCÉE
// ====================================
/**
 * Schema pour la recherche par code moteur
 */
exports.MotorCodeSearchSchema = zod_1.z.object({
    code: zod_1.z.string().min(2),
    exact: zod_1.z.boolean().default(false),
});
/**
 * Schema pour la recherche par type mine
 */
exports.MineCodeSearchSchema = zod_1.z.object({
    code: zod_1.z.string().min(3),
    includeCnit: zod_1.z.boolean().default(true),
});
/**
 * Schema pour les marques populaires (homepage)
 */
exports.TopBrandSchema = exports.VehicleBrandSchema.extend({
    models_count: zod_1.z.number().int().optional(),
    types_count: zod_1.z.number().int().optional(),
    image_url: zod_1.z.string().optional(),
});
//# sourceMappingURL=vehicle.types.js.map