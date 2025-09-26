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

/**
 * @deprecated Utiliser VehicleModel à la place
 */
export type Model = VehicleModel;

/**
 * @deprecated Utiliser VehicleBrand à la place
 */
export interface VehicleBrandComponent extends VehicleBrand {}

/**
 * @deprecated Utiliser VehicleBrand à la place
 */
export interface VehicleBrandAPI extends VehicleBrand {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
  isFavorite: boolean;
  displayOrder: number;
}