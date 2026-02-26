/**
 * 🚗 TYPES VÉHICULES CENTRALISÉS
 *
 * Fichier central pour tous les types liés aux véhicules
 * Unifie les interfaces dispersées dans le projet
 *
 * @version 1.0.0
 * @since 2025-09-13
 */

// ====================================
// 🏭 TYPES DE BASE VÉHICULES
// ====================================

/**
 * Interface pour les marques de véhicules
 * Basée sur la table auto_marque
 */
export interface VehicleBrand {
  marque_id: number;
  marque_name: string;
  marque_alias?: string;
  marque_logo?: string;
  marque_country?: string;
  marque_display?: number;
  products_count?: number;
  is_featured?: boolean;
}

/**
 * Interface pour les modèles de véhicules
 * Basée sur la table auto_modele
 */
export interface VehicleModel {
  modele_id: number;
  modele_name: string;
  modele_alias?: string;
  modele_ful_name?: string;
  modele_marque_id: number; // Correspond à la clé étrangère en BDD
  modele_year_from?: number;
  modele_year_to?: number;
  // Relation avec la marque
  auto_marque?: VehicleBrand;
}

/**
 * Interface pour les types/motorisations de véhicules
 * Basée sur la table auto_type
 */
export interface VehicleType {
  type_id: number;
  type_name: string;
  type_alias?: string;
  type_engine_code?: string;
  type_fuel?: string;
  type_power?: string; // Compatibilité avec VehicleSelector existant
  type_power_ps?: number;
  type_power_kw?: number;
  type_liter?: string;
  type_year_from?: string;
  type_year_to?: string | null;
  type_engine?: string; // Compatibilité avec VehicleSelector existant
  type_engine_description?: string;
  type_slug?: string; // Compatibilité avec VehicleSelector existant
  type_body?: string;
  modele_id: number; // Clé étrangère vers auto_modele
  year_from?: number; // Compatibilité
  year_to?: number; // Compatibilité
  // Relations
  auto_modele?: VehicleModel;
}

// ====================================
// 🔍 TYPES DE RECHERCHE ET FILTRAGE
// ====================================

/**
 * Options de pagination pour les requêtes
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  search?: string;
}

/**
 * Filtres pour la recherche de véhicules
 */
export interface VehicleFilters extends PaginationOptions {
  brandId?: number;
  modelId?: number;
  typeId?: number;
  year?: number;
  yearFrom?: number;
  yearTo?: number;
  fuel?: string;
  powerMin?: number;
  powerMax?: number;
}

/**
 * Réponse générique pour les requêtes véhicules
 */
export interface VehicleResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ====================================
// 🎯 TYPES POUR LES SÉLECTEURS
// ====================================

/**
 * Propriétés communes pour tous les sélecteurs
 */
export interface BaseSelectorProps {
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  allowClear?: boolean;
  autoFocus?: boolean;
}

/**
 * Props pour le sélecteur de marques
 */
export interface BrandSelectorProps extends BaseSelectorProps {
  onValueChange?: (brandId: string, brand?: VehicleBrand) => void;
  showFeaturedFirst?: boolean;
  showLogos?: boolean;
}

/**
 * Props pour le sélecteur de modèles
 */
export interface ModelSelectorProps extends BaseSelectorProps {
  onValueChange?: (modelId: string, model?: VehicleModel) => void;
  brandId?: number;
  searchPlaceholder?: string;
  autoLoadOnMount?: boolean;
}

/**
 * Props pour le sélecteur de types
 */
export interface TypeSelectorProps extends BaseSelectorProps {
  onValueChange?: (typeId: string, type?: VehicleType) => void;
  modelId?: number;
  brandId?: number;
  searchPlaceholder?: string;
  autoLoadOnMount?: boolean;
  showEngineDetails?: boolean;
  showPowerDetails?: boolean;
  onlyActive?: boolean;
  showDetails?: boolean;
}

/**
 * Props pour le sélecteur d'années
 */
export interface YearSelectorProps extends BaseSelectorProps {
  onValueChange?: (year: number) => void;
  typeId?: number;
  minYear?: number;
  maxYear?: number;
  defaultToCurrent?: boolean;
}

// ====================================
// 📊 TYPES POUR LES STATISTIQUES
// ====================================

/**
 * Statistiques des marques
 */
export interface BrandStats {
  totalBrands: number;
  activeBrands: number;
  featuredBrands: number;
  topBrands: Array<{
    marque_name: string;
    models_count: number;
    types_count: number;
  }>;
}

/**
 * Statistiques des modèles
 */
export interface ModelStats {
  totalModels: number;
  activeModels: number;
  modelsWithTypes: number;
  topModels: Array<{
    modele_name: string;
    marque_name: string;
    types_count: number;
  }>;
}

/**
 * Statistiques des types
 */
export interface TypeStats {
  totalTypes: number;
  activeTypes: number;
  byFuel: Record<string, number>;
  byPowerRange: Record<string, number>;
  yearRange: {
    min: number;
    max: number;
  };
}

// ====================================
// 🎬 TYPES POUR LES ÉVÉNEMENTS
// ====================================

/**
 * Événement de sélection de véhicule complet
 */
export interface VehicleSelectionEvent {
  brand?: VehicleBrand;
  model?: VehicleModel;
  type?: VehicleType;
  year?: number;
  isComplete: boolean;
}

/**
 * Événement de changement dans un sélecteur
 */
export interface SelectorChangeEvent<T> {
  value: string;
  item?: T;
  timestamp: number;
  source: "user" | "api" | "reset";
}

// ====================================
// 🛠️ TYPES UTILITAIRES
// ====================================

/**
 * État de chargement pour les composants
 */
export interface LoadingState {
  isLoading: boolean;
  error?: string;
  lastUpdate?: number;
}

/**
 * Configuration pour le cache
 */
export interface CacheConfig {
  ttl: number; // Time to live en secondes
  maxSize: number;
  keyPrefix?: string;
}

/**
 * Configuration pour la validation
 */
export interface ValidationConfig {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  customValidator?: (value: any) => boolean | string;
}

// ====================================
// 🎨 TYPES POUR L'AFFICHAGE
// ====================================

/**
 * Configuration d'affichage pour les listes
 */
export interface DisplayConfig {
  showSearch?: boolean;
  showCounter?: boolean;
  showIcons?: boolean;
  itemsPerPage?: number;
  sortBy?: "name" | "popularity" | "recent";
  sortOrder?: "asc" | "desc";
}

/**
 * Thème pour les composants
 */
export interface ThemeConfig {
  variant?: "default" | "outlined" | "filled";
  size?: "sm" | "md" | "lg";
  color?: "primary" | "secondary" | "success" | "warning" | "error";
}

// ====================================
// � TYPES COMPOSITES POUR COMPOSANTS
// ====================================

/**
 * Interface composite pour l'affichage complet d'un véhicule
 * Utilisée dans les composants qui ont besoin de toutes les infos
 */
export interface VehicleData {
  brand: string;
  model: string;
  type: string;
  year?: number;
  engine?: string;
  fuel?: string;
  power?: string;
  description?: string;
  imageUrl?: string;
  partsCount?: number;
  // Données additionnelles
  brandId?: number;
  modelId?: number;
  typeId?: number;
  slug?: string;
  // Métadonnées
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Interface pour les données de véhicule enrichies
 * Inclut les relations et statistiques
 */
export interface VehicleInfo extends VehicleData {
  // Relations
  vehicleBrand?: VehicleBrand;
  vehicleModel?: VehicleModel;
  vehicleType?: VehicleType;
  // Statistiques
  stats?: {
    viewCount?: number;
    partsCount?: number;
    popularParts?: string[];
    lastUpdated?: string;
  };
  // SEO
  seo?: {
    title?: string;
    description?: string;
    keywords?: string[];
    canonicalUrl?: string;
  };
}

// ====================================
// �🔄 TYPES DE COMPATIBILITÉ
// ====================================
