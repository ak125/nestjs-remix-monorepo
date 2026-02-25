/**
 * DTOs pour le module Véhicules
 * Alignés sur l'architecture ProductsModule avec interfaces simples
 */

/**
 * DTO pour la recherche de véhicules par codes/identifiants
 */
export interface VehicleSearchDto {
  brandCode?: string;
  modelCode?: string;
  typeCode?: string;
  year?: number;
  engineCode?: string;
  fuelType?: string;
  mineCode?: string;
  cnitCode?: string;
}

/**
 * DTO pour le filtrage de véhicules avec pagination
 */
export interface VehicleFilterDto {
  search?: string;
  brandId?: number;
  modelId?: number;
  onlyActive?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * DTO pour la pagination standard (aligné sur ProductsModule)
 */
export interface VehiclePaginationDto {
  search?: string;
  brandId?: string;
  modelId?: string;
  typeId?: string;
  year?: number;
  limit?: number;
  page?: number;
}

/**
 * DTO pour la compatibilité pièces-véhicules
 */
export interface VehicleCompatibilityDto {
  pieceId?: number;
  brandId?: number;
  modelId?: number;
  typeId?: number;
  compatibilityType?: 'universal' | 'specific' | 'range';
  notes?: string;
}

/**
 * DTO pour les statistiques véhicules
 */
export interface VehicleStatsResponseDto {
  brands: number;
  models: number;
  types: number;
  lastUpdate?: string;
}

/**
 * DTO de réponse générique pour les véhicules
 */
export interface VehicleResponseDto<T = unknown> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  meta?: Record<string, unknown>;
}

/**
 * Types pour les entités véhicules
 */
export interface BrandEntity {
  marque_id: number;
  marque_name: string;
  marque_code?: string;
  marque_alias: string;
  marque_logo?: string;
  marque_display: number;
  marque_top: number;
}

export interface ModelEntity {
  modele_id: number;
  modele_name: string;
  modele_alias: string;
  modele_marque_id: number;
  modele_year_from: number;
  modele_year_to?: number;
  modele_body?: string;
  modele_display: number;
}

export interface TypeEntity {
  type_id: string;
  type_name: string;
  type_modele_id: string;
  type_marque_id: string;
  type_fuel: string;
  type_power_ps: string;
  type_power_kw: string;
  type_year_from: string;
  type_year_to?: string;
  type_engine?: string;
  type_liter?: string;
  type_body?: string;
}

/**
 * Interface pour les codes mine/CNIT
 */
export interface MineCodeEntity {
  tnc_type_id: string;
  tnc_cnit: string;
  tnc_code: string;
  auto_type?: TypeEntity;
}

/**
 * DTO pour la recherche par codes mine
 */
export interface MineSearchDto {
  mineCode?: string;
  cnitCode?: string;
  modelId?: string;
  brandId?: string;
  limit?: number;
  page?: number;
}
