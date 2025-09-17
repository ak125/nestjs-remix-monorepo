// 📁 backend/src/modules/catalog/dto/catalog.schemas.ts
// 🔧 Schémas Zod pour le module catalogue

import { z } from 'zod';

// ========================================
// 🏗️ SCHEMAS HIÉRARCHIE FAMILLES/GAMMES
// ========================================

export const FamilySchema = z.object({
  mf_id: z.string(),
  mf_name: z.string().min(1, 'Le nom de famille est requis'),
  mf_name_meta: z.string().optional(),
  mf_description: z.string().optional(),
  mf_pic: z.string().optional(),
  mf_display: z.string(),
  mf_sort: z.string(),
});

export const GammeSchema = z.object({
  mc_id: z.string(),
  mc_mf_id: z.string(),
  mc_pg_id: z.string(),
  mc_sort: z.string(),
  pg_name: z.string().optional(),
  pg_image: z.string().optional(),
  manufacturer_name: z.string().optional(),
});

export const FamilyWithGammesSchema = FamilySchema.extend({
  gammes: z.array(GammeSchema),
  gammes_count: z.number().min(0),
});

export const HierarchyStatsSchema = z.object({
  total_families: z.number().min(0),
  total_gammes: z.number().min(0),
  total_manufacturers: z.number().min(0),
  families_with_gammes: z.number().min(0),
});

// ========================================
// 📊 SCHEMAS POUR QUERY PARAMETERS
// ========================================

export const HomepageHierarchyQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(50).default(20).optional(),
  include_stats: z.coerce.boolean().default(true).optional(),
  expand_families: z.coerce.boolean().default(false).optional(),
});

export const SearchCatalogQuerySchema = z.object({
  q: z.string().min(1, 'Le terme de recherche est requis'),
  limit: z.coerce.number().min(1).max(100).default(20).optional(),
  offset: z.coerce.number().min(0).default(0).optional(),
  category_id: z.string().optional(),
  manufacturer_id: z.string().optional(),
});

export const BrandQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50).optional(),
  search: z.string().optional(),
  sort_by: z.enum(['name', 'popularity', 'created_at']).default('name').optional(),
});

// ========================================
// 🎯 SCHEMAS POUR RESPONSES
// ========================================

export const HomepageHierarchyResponseSchema = z.object({
  success: z.boolean(),
  families: z.array(FamilyWithGammesSchema),
  stats: HierarchyStatsSchema,
  display_count: z.number(),
  total_available: z.number(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export const CatalogApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  timestamp: z.string().datetime(),
  count: z.number().optional(),
});

// ========================================
// 🔍 SCHEMAS POUR VEHICLE SELECTOR
// ========================================

export const VehicleBrandSchema = z.object({
  marque_id: z.number(),
  marque_nom: z.string(),
  marque_alias: z.string().optional(),
  marque_logo: z.string().optional(),
  models_count: z.number().optional(),
});

export const VehicleModelSchema = z.object({
  modele_id: z.number(),
  modele_nom: z.string(),
  modele_alias: z.string().optional(),
  marque_id: z.number(),
  types_count: z.number().optional(),
});

export const VehicleTypeSchema = z.object({
  type_id: z.number(),
  type_liter: z.string().optional(),
  type_fuel: z.string().optional(),
  type_alias: z.string().optional(),
  modele_id: z.number(),
  pieces_count: z.number().optional(),
});

// ========================================
// 📋 TYPES TYPESCRIPT INFÉRÉS
// ========================================

export type Family = z.infer<typeof FamilySchema>;
export type Gamme = z.infer<typeof GammeSchema>;
export type FamilyWithGammes = z.infer<typeof FamilyWithGammesSchema>;
export type HierarchyStats = z.infer<typeof HierarchyStatsSchema>;
export type HomepageHierarchyQuery = z.infer<typeof HomepageHierarchyQuerySchema>;
export type SearchCatalogQuery = z.infer<typeof SearchCatalogQuerySchema>;
export type BrandQuery = z.infer<typeof BrandQuerySchema>;
export type HomepageHierarchyResponse = z.infer<typeof HomepageHierarchyResponseSchema>;
export type CatalogApiResponse = z.infer<typeof CatalogApiResponseSchema>;
export type VehicleBrand = z.infer<typeof VehicleBrandSchema>;
export type VehicleModel = z.infer<typeof VehicleModelSchema>;
export type VehicleType = z.infer<typeof VehicleTypeSchema>;

// ========================================
// 🔧 VALIDATION HELPERS
// ========================================

export const validateHomepageQuery = (data: unknown) => 
  HomepageHierarchyQuerySchema.parse(data);

export const validateSearchQuery = (data: unknown) => 
  SearchCatalogQuerySchema.parse(data);

export const validateBrandQuery = (data: unknown) => 
  BrandQuerySchema.parse(data);

// ========================================
// 📊 CONSTANTS
// ========================================

export const CATALOG_LIMITS = {
  MAX_FAMILIES: 50,
  MAX_GAMMES: 100,
  MAX_SEARCH_RESULTS: 100,
  DEFAULT_PAGE_SIZE: 20,
} as const;