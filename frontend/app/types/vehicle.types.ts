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
interface VehicleBrand {
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
// 🎯 TYPES POUR LES SÉLECTEURS
// ====================================

/**
 * Propriétés communes pour tous les sélecteurs
 */
interface BaseSelectorProps {
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  allowClear?: boolean;
  autoFocus?: boolean;
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

// ====================================
// 🎨 TYPES COMPOSITES POUR COMPOSANTS
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

// ====================================
// 🔄 TYPES DE COMPATIBILITÉ
// ====================================
