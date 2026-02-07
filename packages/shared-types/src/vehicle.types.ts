/**
 * 🚗 TYPES VÉHICULES UNIFIÉS
 * 
 * Types partagés entre backend (NestJS) et frontend (Remix)
 * Basés sur l'analyse des types existants et consolidés
 * 
 * @version 2.0.0
 * @package @monorepo/shared-types
 */

import { z } from 'zod';
import type { PaginationOptions, ApiResponse } from './api.types';
import { PaginationOptionsSchema, ApiResponseSchema } from './api.types';

/**

// ====================================
// 🏭 TYPES DE BASE VÉHICULES 
// ====================================

/**
 * Schema Zod pour validation VehicleBrand
 */
export const VehicleBrandSchema = z.object({
  marque_id: z.number().int().positive(),
  marque_name: z.string().min(1),
  marque_alias: z.string().optional(),
  marque_name_meta: z.string().optional(),
  marque_name_meta_title: z.string().optional(),
  marque_logo: z.string().optional(),
  marque_wall: z.string().optional(),
  marque_country: z.string().optional(),
  marque_display: z.number().int().min(0).max(1).default(1),
  marque_sort: z.number().int().optional(),
  marque_top: z.number().int().min(0).max(1).optional(),
  marque_relfollow: z.number().int().min(0).max(1).default(1),
  marque_sitemap: z.number().int().min(0).max(1).default(1),
  products_count: z.number().int().optional(),
  is_featured: z.boolean().optional(),
});

/**
 * Interface TypeScript pour VehicleBrand (générée depuis Zod)
 */
export type VehicleBrand = z.infer<typeof VehicleBrandSchema>;

/**
 * Schema Zod pour validation VehicleModel
 */
export const VehicleModelSchema = z.object({
  modele_id: z.number().int().positive(),
  modele_name: z.string().min(1),
  modele_alias: z.string().optional(),
  modele_name_meta: z.string().optional(),
  modele_ful_name: z.string().optional(),
  modele_marque_id: z.number().int().positive(),
  modele_pic: z.string().optional(),
  modele_year_from: z.number().int().optional(),
  modele_year_to: z.number().int().optional(),
  modele_display: z.number().int().min(0).max(1).default(1),
  modele_sort: z.number().int().optional(),
  // Relation avec la marque (optionnelle pour éviter les références circulaires)
  auto_marque: VehicleBrandSchema.optional(),
});

/**
 * Interface TypeScript pour VehicleModel
 */
export type VehicleModel = z.infer<typeof VehicleModelSchema>;

/**
 * Schema Zod pour validation VehicleType
 */
export const VehicleTypeSchema = z.object({
  type_id: z.number().int().positive(),
  type_name: z.string().min(1),
  type_alias: z.string().optional(),
  type_name_meta: z.string().optional(),
  type_engine_code: z.string().optional(),
  type_fuel: z.string().optional(),
  type_power: z.string().optional(),
  type_power_ps: z.number().int().optional(),
  type_power_kw: z.number().int().optional(),
  type_liter: z.string().optional(),
  type_year_from: z.string().optional(),
  type_year_to: z.string().nullable().optional(),
  type_month_from: z.number().int().min(1).max(12).optional(),
  type_month_to: z.number().int().min(1).max(12).optional(),
  type_engine: z.string().optional(),
  type_engine_description: z.string().optional(),
  type_slug: z.string().optional(),
  type_display: z.number().int().min(0).max(1).default(1),
  type_sort: z.number().int().optional(),
  modele_id: z.number().int().positive(),
  // Relations (optionnelles)
  auto_modele: VehicleModelSchema.optional(),
  // Compatibilité avec anciens types
  year_from: z.number().int().optional(),
  year_to: z.number().int().optional(),
});

/**
 * Interface TypeScript pour VehicleType
 */
export type VehicleType = z.infer<typeof VehicleTypeSchema>;

// ====================================
// 🎯 TYPES DE RECHERCHE ET FILTRAGE
// ====================================

/**
 * Schema pour les filtres de recherche véhicules
 */
export const VehicleFiltersSchema = PaginationOptionsSchema.extend({
  brandId: z.number().int().positive().optional(),
  modelId: z.number().int().positive().optional(),
  typeId: z.number().int().positive().optional(),
  year: z.number().int().min(1900).max(2030).optional(),
  yearFrom: z.number().int().min(1900).max(2030).optional(),
  yearTo: z.number().int().min(1900).max(2030).optional(),
  fuel: z.string().optional(),
  powerMin: z.number().int().positive().optional(),
  powerMax: z.number().int().positive().optional(),
});

export type VehicleFilters = z.infer<typeof VehicleFiltersSchema>;

/**
 * Schema pour les réponses véhicules
 */
export const VehicleResponseSchema = <T extends z.ZodType>(itemSchema: T) => 
  z.object({
    data: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  });

/**
 * Type générique pour les réponses véhicules
 */
export type VehicleResponse<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
};

// ====================================
// 📊 TYPES POUR LES ÉVÉNEMENTS
// ====================================

/**
 * Schema pour les événements de sélection
 */
export const VehicleSelectionEventSchema = z.object({
  brand: VehicleBrandSchema.optional(),
  model: VehicleModelSchema.optional(),
  type: VehicleTypeSchema.optional(),
  year: z.number().int().min(1900).max(2030).optional(),
  isComplete: z.boolean(),
  timestamp: z.number().int().positive().default(() => Date.now()),
  source: z.enum(['user', 'api', 'cache', 'reset']).default('user'),
});

export type VehicleSelectionEvent = z.infer<typeof VehicleSelectionEventSchema>;

// ====================================
// 🛠️ TYPES UTILITAIRES
// ====================================

/**
 * Schema pour l'état de chargement
 */
export const LoadingStateSchema = z.object({
  isLoading: z.boolean().default(false),
  error: z.string().optional(),
  lastUpdate: z.number().int().positive().optional(),
});

export type LoadingState = z.infer<typeof LoadingStateSchema>;

/**
 * Schema pour la configuration de cache
 */
export const CacheConfigSchema = z.object({
  ttl: z.number().int().positive().default(300), // 5 minutes par défaut
  maxSize: z.number().int().positive().default(1000),
  keyPrefix: z.string().default('vehicle'),
});

export type CacheConfig = z.infer<typeof CacheConfigSchema>;

// ====================================
// 🎨 TYPES COMPOSITES 
// ====================================

/**
 * Schema pour les données complètes d'un véhicule
 */
export const VehicleDataSchema = z.object({
  // Données principales
  brand: z.string(),
  model: z.string(),
  type: z.string(),
  year: z.number().int().min(1900).max(2030).optional(),
  engine: z.string().optional(),
  fuel: z.string().optional(),
  power: z.string().optional(),
  description: z.string().optional(),
  
  // URLs et images
  imageUrl: z.string().url().optional(),
  slug: z.string().optional(),
  
  // Statistiques
  partsCount: z.number().int().nonnegative().optional(),
  
  // IDs pour les relations
  brandId: z.number().int().positive().optional(),
  modelId: z.number().int().positive().optional(),
  typeId: z.number().int().positive().optional(),
  
  // Métadonnées
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type VehicleData = z.infer<typeof VehicleDataSchema>;

/**
 * Schema pour les informations enrichies d'un véhicule
 */
export const VehicleInfoSchema = VehicleDataSchema.extend({
  // Relations complètes
  vehicleBrand: VehicleBrandSchema.optional(),
  vehicleModel: VehicleModelSchema.optional(),
  vehicleType: VehicleTypeSchema.optional(),
  
  // Statistiques détaillées
  stats: z.object({
    viewCount: z.number().int().nonnegative().optional(),
    partsCount: z.number().int().nonnegative().optional(),
    popularParts: z.array(z.string()).optional(),
    lastUpdated: z.string().datetime().optional(),
  }).optional(),
  
  // SEO
  seo: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    canonicalUrl: z.string().url().optional(),
  }).optional(),
});

export type VehicleInfo = z.infer<typeof VehicleInfoSchema>;

// ====================================
// 📋 TYPES SPÉCIALISÉS POUR LES COMPOSANTS
// ====================================

/**
 * Schema pour les props de sélecteur de base
 */
export const BaseSelectorPropsSchema = z.object({
  value: z.string().optional(),
  placeholder: z.string().optional(),
  disabled: z.boolean().default(false),
  className: z.string().optional(),
  allowClear: z.boolean().default(false),
  autoFocus: z.boolean().default(false),
});

export type BaseSelectorProps = z.infer<typeof BaseSelectorPropsSchema>;

/**
 * Schema pour les props de sélecteur de marques
 */
export const BrandSelectorPropsSchema = BaseSelectorPropsSchema.extend({
  showFeaturedFirst: z.boolean().default(true),
  showLogos: z.boolean().default(true),
  showCountries: z.boolean().default(false),
});

export type BrandSelectorProps = z.infer<typeof BrandSelectorPropsSchema>;

/**
 * Schema pour les props de sélecteur de modèles
 */
export const ModelSelectorPropsSchema = BaseSelectorPropsSchema.extend({
  brandId: z.number().int().positive().optional(),
  searchPlaceholder: z.string().default('Rechercher un modèle...'),
  autoLoadOnMount: z.boolean().default(false),
  showYearRange: z.boolean().default(true),
});

export type ModelSelectorProps = z.infer<typeof ModelSelectorPropsSchema>;

/**
 * Schema pour les props de sélecteur de types
 */
export const TypeSelectorPropsSchema = BaseSelectorPropsSchema.extend({
  modelId: z.number().int().positive().optional(),
  brandId: z.number().int().positive().optional(),
  searchPlaceholder: z.string().default('Rechercher une motorisation...'),
  autoLoadOnMount: z.boolean().default(false),
  showEngineDetails: z.boolean().default(true),
  showPowerDetails: z.boolean().default(true),
  onlyActive: z.boolean().default(true),
  showDetails: z.boolean().default(true),
});

export type TypeSelectorProps = z.infer<typeof TypeSelectorPropsSchema>;

// ====================================
// 🧪 FONCTIONS DE VALIDATION
// ====================================

/**
 * Valide les données d'une marque
 */
export const validateVehicleBrand = (data: unknown): VehicleBrand => {
  return VehicleBrandSchema.parse(data);
};

/**
 * Valide les données d'un modèle
 */
export const validateVehicleModel = (data: unknown): VehicleModel => {
  return VehicleModelSchema.parse(data);
};

/**
 * Valide les données d'un type
 */
export const validateVehicleType = (data: unknown): VehicleType => {
  return VehicleTypeSchema.parse(data);
};

/**
 * Valide les filtres de recherche
 */
export const validateVehicleFilters = (data: unknown): VehicleFilters => {
  return VehicleFiltersSchema.parse(data);
};

// ====================================
// 🎭 TYPES DE COMPATIBILITÉ
// ====================================

// ====================================
// 🔧 TYPES CODES MOTEUR & TYPES MINES
// ====================================

/**
 * Schema pour les codes moteur (ex: K9K 752, M9R, CAGA)
 * Table: auto_type_motor_code
 */
export const VehicleMotorCodeSchema = z.object({
  tmc_type_id: z.number().int().positive(),
  tmc_code: z.string().min(1),
  tmc_display: z.number().int().min(0).max(1).optional().default(1),
});

export type VehicleMotorCode = z.infer<typeof VehicleMotorCodeSchema>;

/**
 * Schema pour les types mines / CNIT (carte grise)
 * Table: auto_type_number_code
 */
export const VehicleMineCodeSchema = z.object({
  tnc_type_id: z.number().int().positive(),
  tnc_code: z.string().nullable().optional(), // Type mine (ex: 335AHR)
  tnc_cnit: z.string().nullable().optional(), // Code CNIT
});

export type VehicleMineCode = z.infer<typeof VehicleMineCodeSchema>;

/**
 * Schema pour le carburant moteur
 * Table: auto_type_motor_fuel
 */
export const VehicleMotorFuelSchema = z.object({
  tmf_id: z.number().int().positive(),
  tmf_motor: z.string().optional(),
  tmf_engine: z.string().optional(),
  tmf_fuel: z.string().optional(),
  tmf_display: z.number().int().min(0).max(1).optional().default(1),
  tmf_sort: z.number().int().optional(),
});

export type VehicleMotorFuel = z.infer<typeof VehicleMotorFuelSchema>;

// ====================================
// 🚗 TYPES VÉHICULE COMPLET (FULL DETAILS)
// ====================================

/**
 * Schema pour un véhicule avec TOUTES ses données
 * Équivalent du PHP avec marque + modèle + type + codes moteur + types mines
 */
export const VehicleFullDetailsSchema = z.object({
  // === MARQUE (Constructeur) ===
  marque_id: z.number().int().positive(),
  marque_name: z.string(),
  marque_name_meta: z.string().optional(),
  marque_name_meta_title: z.string().optional(),
  marque_alias: z.string(),
  marque_logo: z.string().optional(),
  marque_relfollow: z.union([z.number(), z.string()]).optional(),
  marque_top: z.union([z.number(), z.string()]).optional(),

  // === MODELE ===
  modele_id: z.number().int().positive(),
  modele_name: z.string(),
  modele_name_meta: z.string().optional(),
  modele_alias: z.string(),
  modele_pic: z.string().optional(),
  modele_ful_name: z.string().optional(),
  modele_body: z.string().optional(),
  modele_relfollow: z.union([z.number(), z.string()]).optional(),
  modele_year_from: z.string().optional(),
  modele_year_to: z.string().nullable().optional(),

  // === TYPE (Motorisation) ===
  type_id: z.number().int().positive(),
  type_name: z.string(),
  type_name_meta: z.string().optional(),
  type_alias: z.string(),

  // Puissance
  type_power_ps: z.union([z.number(), z.string()]).optional(), // Chevaux
  type_power_kw: z.union([z.number(), z.string()]).optional(), // Kilowatts

  // Caractéristiques techniques
  type_fuel: z.string().optional(),         // Diesel, Essence, Hybride...
  type_body: z.string().optional(),         // Berline, Break, SUV...
  type_engine: z.string().optional(),       // Code moteur principal
  type_liter: z.string().optional(),        // Cylindrée en litres (ex: "1.5")

  // Dates de production
  type_month_from: z.string().optional(),
  type_year_from: z.string().optional(),
  type_month_to: z.string().nullable().optional(),
  type_year_to: z.string().nullable().optional(),

  // SEO
  type_relfollow: z.union([z.number(), z.string()]).optional(),
  type_display: z.union([z.number(), z.string()]).optional(),

  // === CODES MOTEUR (multiples) ===
  motor_codes: z.array(z.string()).optional(),
  motor_codes_formatted: z.string().optional(), // "K9K 752, K9K 764"

  // === TYPES MINES (multiples) ===
  mine_codes: z.array(z.string()).optional(),
  mine_codes_formatted: z.string().optional(), // "335AHR, 335AHS"
  cnit_codes: z.array(z.string()).optional(),
  cnit_codes_formatted: z.string().optional(),

  // === DONNÉES FORMATÉES ===
  production_date_formatted: z.string().optional(), // "de 2005 à 2012" ou "depuis 2020"
  power_formatted: z.string().optional(),           // "75 ch / 55 kW"
  cylinder_cm3: z.number().optional(),              // Cylindrée en cm³ (calculée)

  // === URLS ===
  vehicle_url: z.string().optional(),
  image_url: z.string().optional(),
  logo_url: z.string().optional(),
});

export type VehicleFullDetails = z.infer<typeof VehicleFullDetailsSchema>;

// ====================================
// 🛠️ HELPERS DE FORMATAGE
// ====================================

/**
 * Formate les dates de production comme dans le PHP
 * @example
 * formatProductionDate("06", "2005", "12", "2012") => "de 2005 à 2012"
 * formatProductionDate("06", "2020", null, null) => "depuis 06/2020"
 */
export function formatProductionDate(
  monthFrom?: string | null,
  yearFrom?: string | null,
  monthTo?: string | null,
  yearTo?: string | null,
): string {
  if (!yearFrom) return '';

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
export function formatProductionDateDetailed(
  monthFrom?: string | null,
  yearFrom?: string | null,
  monthTo?: string | null,
  yearTo?: string | null,
): string {
  if (!yearFrom) return '';

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
export function formatPower(
  powerPs?: number | string | null,
  powerKw?: number | string | null,
): string {
  const ps = typeof powerPs === 'string' ? parseInt(powerPs, 10) : powerPs;
  let kw = typeof powerKw === 'string' ? parseInt(powerKw, 10) : powerKw;

  if (!ps && !kw) return '';

  // Conversion si kW manquant (1 ch = 0.7355 kW)
  if (ps && !kw) {
    kw = Math.round(ps * 0.7355);
  }

  if (ps && kw) {
    return `${ps} ch / ${kw} kW`;
  }

  if (ps) return `${ps} ch`;
  if (kw) return `${kw} kW`;

  return '';
}

/**
 * Convertit la cylindrée de litres en cm³
 * @example
 * literToCm3("1.5") => 1500
 * literToCm3("2.0") => 2000
 */
export function literToCm3(liter?: string | null): number | undefined {
  if (!liter) return undefined;
  const liters = parseFloat(liter);
  if (isNaN(liters)) return undefined;
  return Math.round(liters * 1000);
}

/**
 * Formate la cylindrée avec les deux unités
 * @example
 * formatCylinder("1.5") => "1500 cm³ (1.5 L)"
 */
export function formatCylinder(liter?: string | null): string {
  if (!liter) return '';
  const cm3 = literToCm3(liter);
  if (!cm3) return '';
  return `${cm3} cm³ (${liter} L)`;
}

/**
 * Formate un tableau de codes en chaîne séparée par virgules
 * @example
 * formatCodes(["K9K 752", "K9K 764"]) => "K9K 752, K9K 764"
 */
export function formatCodes(codes?: string[] | null): string {
  if (!codes || codes.length === 0) return '';
  return codes.filter(Boolean).join(', ');
}

/**
 * Génère l'URL du véhicule au format Automecanik
 * @example
 * generateVehicleUrl({marque_alias: "renault", marque_id: 5, ...})
 * => "/constructeurs/renault-5/clio-iii-5010/1-5-dci-16789.html"
 */
export function generateVehicleUrl(vehicle: {
  marque_alias: string;
  marque_id: number;
  modele_alias: string;
  modele_id: number;
  type_alias: string;
  type_id: number;
}): string {
  return `/constructeurs/${vehicle.marque_alias}-${vehicle.marque_id}/${vehicle.modele_alias}-${vehicle.modele_id}/${vehicle.type_alias}-${vehicle.type_id}.html`;
}

/**
 * Génère l'URL d'une page produit pour un véhicule
 */
export function generateProductVehicleUrl(params: {
  gamme_alias: string;
  gamme_id: number;
  marque_alias: string;
  marque_id: number;
  modele_alias: string;
  modele_id: number;
  type_alias: string;
  type_id: number;
}): string {
  return `/pieces/${params.gamme_alias}-${params.gamme_id}/${params.marque_alias}-${params.marque_id}/${params.modele_alias}-${params.modele_id}/${params.type_alias}-${params.type_id}.html`;
}

// ====================================
// 🔍 TYPES RECHERCHE AVANCÉE
// ====================================

/**
 * Schema pour la recherche par code moteur
 */
export const MotorCodeSearchSchema = z.object({
  code: z.string().min(2),
  exact: z.boolean().default(false),
});

export type MotorCodeSearch = z.infer<typeof MotorCodeSearchSchema>;

/**
 * Schema pour la recherche par type mine
 */
export const MineCodeSearchSchema = z.object({
  code: z.string().min(3),
  includeCnit: z.boolean().default(true),
});

export type MineCodeSearch = z.infer<typeof MineCodeSearchSchema>;

/**
 * Schema pour les marques populaires (homepage)
 */
export const TopBrandSchema = VehicleBrandSchema.extend({
  models_count: z.number().int().optional(),
  types_count: z.number().int().optional(),
  image_url: z.string().optional(),
});

export type TopBrand = z.infer<typeof TopBrandSchema>;