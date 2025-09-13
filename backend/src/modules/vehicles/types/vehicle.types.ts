// ========================================
// 🚗 VEHICLE TYPES - Types pour Module Véhicules
// ========================================

export interface VehicleBrand {
  id: number;
  code: string;
  name: string;
  alias?: string;
  country?: string;
  isActive: boolean;
  isFavorite?: boolean;
  displayOrder?: number;
}

export interface VehicleModel {
  id: number;
  name: string;
  fullName?: string;
  alias?: string;
  brandId: number;
  isActive: boolean;
}

export interface VehicleType {
  id: number;
  name: string;
  modelId: number;
  brandId: number;
  fuel?: string;
  power?: string;
  powerKw?: string;
  engine?: string;
  engineCode?: string;
  yearFrom?: number;
  yearTo?: number;
  monthFrom?: number;
  monthTo?: number;
  mineType?: string;
  isActive: boolean;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  search?: string;
  onlyFavorites?: boolean;
  onlyActive?: boolean;
}

export interface VehicleResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page?: number;
  limit?: number;
  message?: string;
  error?: string;
}

// Options pour recherche par type
export interface TypeSearchOptions {
  page?: number;
  limit?: number;
  search?: string;
  includeEngine?: boolean;
}

// Options pour recherche mine
export interface MineSearchOptions {
  page?: number;
  limit?: number;
  exactMatch?: boolean;
  sortBy?: string;
}

// Options pour recherche avancée
export interface AdvancedSearchOptions {
  page?: number;
  limit?: number;
  searchIn?: string[];
  query?: string;
}

// Interface pour les informations de moteur enrichies
export interface EngineInfo {
  engine_type?: string;
  engine_code?: string;
  power_cv?: number;
  power_kw?: number;
  displacement?: number;
  fuel_type?: string;
  doors?: number;
  gearbox?: string;
  drive?: string;
  emissions?: string;
  norm?: string;
}

// Interface pour les données de véhicule enrichies
export interface EnrichedVehicleData {
  id: number;
  type_id: number;
  type_engine_code?: string;
  type_engine?: string;
  marque_name?: string;
  modele_name?: string;
  type_mine_code?: string;
  engineInfo?: EngineInfo | null;
  [key: string]: any; // Pour permettre d'autres propriétés
}