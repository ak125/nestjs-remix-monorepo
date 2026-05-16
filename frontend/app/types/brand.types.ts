/**
 * 🏭 TYPES CONSTRUCTEURS - Convention Supabase (minuscules)
 *
 * Types TypeScript pour les pages constructeurs, basés sur la migration PHP
 * Respecte la structure de la base de données avec noms en minuscules
 *
 * @version 1.0.0
 * @since 2025-09-22
 */

// ====================================
// 🏭 TYPES DE BASE MARQUES
// ====================================

/**
 * Interface pour les données marque (basée sur auto_marque)
 * Conserve les noms de colonnes en minuscules pour Supabase
 */
export interface BrandData {
  marque_id: number;
  marque_alias: string;
  marque_name: string;
  marque_name_meta: string;
  marque_name_meta_title: string;
  marque_name_url?: string;
  marque_logo?: string;
  marque_wall?: string;
  marque_relfollow: number; // 1 = indexé, 0 = noindex
  marque_sitemap?: number; // 1 = dans sitemap (optionnel car pas toujours retourné)
  marque_display: number; // 1 = affiché, 0 = masqué
  marque_sort?: number;
  marque_top?: number; // 1 = marque populaire
  marque_activ?: string; // '1' = active (pour compatibilité legacy)
  marque_country?: string; // Pays d'origine (France, Allemagne, etc.)
}

/**
 * Interface pour les données SEO marque (basée sur __seo_marque)
 */
export interface SeoMarqueData {
  sm_id?: number;
  sm_marque_id: number;
  sm_title?: string;
  sm_descrip?: string;
  sm_keywords?: string;
  sm_h1?: string;
  sm_content?: string;
  sm_created_at?: string;
  sm_updated_at?: string;
}

/**
 * Interface pour le contenu blog marque (basée sur __blog_seo_marque)
 */
export interface BlogMarqueData {
  bsm_id?: number;
  bsm_marque_id: number;
  bsm_title?: string;
  bsm_descrip?: string;
  bsm_keywords?: string;
  bsm_h1?: string;
  bsm_content?: string;
  bsm_created_at?: string;
  bsm_updated_at?: string;
}

// ====================================
// 🚗 TYPES VÉHICULES POPULAIRES
// ====================================

/**
 * Interface pour les véhicules populaires (basée sur __cross_gamme_car_new + jointures)
 * Reproduit exactement la requête PHP avec CGC_LEVEL = 2
 */
export interface PopularVehicle {
  // Données du type
  cgc_type_id: number;
  type_alias: string;
  type_name: string;
  type_name_meta: string;
  type_power_ps: number;
  type_month_from: number;
  type_year_from: number;
  type_month_to?: number;
  type_year_to?: number;
  type_fuel?: string;

  // Données du modèle
  modele_id: number;
  modele_alias: string;
  modele_name: string;
  modele_name_meta: string;
  modele_pic?: string;

  // Données de la marque (répétées pour chaque véhicule)
  marque_id: number;
  marque_alias: string;
  marque_name: string;
  marque_name_meta: string;
  marque_name_meta_title: string;

  // Données calculées
  formatted_date_range?: string;
  vehicle_url?: string;
  image_url?: string;
  seo_title?: string;
  seo_description?: string;

  // SEO enrichi depuis __seo_type_switch
  seo_switch_content?: string;
  seo_benefit?: string;
  seo_year_range?: string;
}

// ====================================
// 🔧 TYPES PIÈCES POPULAIRES
// ====================================

/**
 * Interface pour les pièces populaires (basée sur __cross_gamme_car_new + pieces_gamme)
 * Reproduit exactement la requête PHP avec CGC_LEVEL = 1
 */
export interface PopularPart {
  // Données de la gamme de pièces
  cgc_pg_id: number;
  pg_alias: string;
  pg_name: string;
  pg_name_meta: string;
  pg_pic?: string;
  pg_img?: string;

  // Données du type de véhicule associé
  cgc_type_id: number;
  type_alias: string;
  type_name: string;
  type_power_ps: number;
  type_month_from: number;
  type_year_from: number;
  type_month_to?: number;
  type_year_to?: number;

  // Données du modèle
  modele_id: number;
  modele_alias: string;
  modele_name: string;
  modele_name_meta: string;

  // Données de la marque
  marque_id: number;
  marque_alias: string;
  marque_name: string;
  marque_name_meta: string;
  marque_name_meta_title: string;

  // Données calculées/enrichies
  formatted_date_range?: string;
  part_url?: string;
  image_url?: string;
  seo_title?: string;
  seo_description?: string;

  // 🎯 Switches SEO dynamiques multi-alias
  seo_switch_content?: string; // Description formatée complète
  seo_switch_short?: string; // Alias 1 - verbes d'action
  seo_switch_benefit?: string; // Alias 2 - bénéfices/fonctions
  seo_switch_detail?: string; // Alias 11 - détails techniques
  seo_switch_gamme?: string; // Switch gamme car
  seo_description_formatted?: string; // Alias de seo_switch_content
  seo_commercial?: string; // Sous-description commerciale
  seo_switch_alias?: number;
}

// ====================================
// 📊 TYPES SEO ENRICHIS
// ====================================

/**
 * Interface pour les données SEO traitées et enrichies
 * Combine les données brutes avec les variables dynamiques PHP
 */
export interface ProcessedSeoData {
  title: string;
  description: string;
  keywords: string;
  h1: string;
  content: string;
  canonical: string;
  robots: string;
  og_title?: string;
  og_description?: string;
  og_image?: string;
  schema_org?: Record<string, any>;
}

// ====================================
// 🔗 TYPES MAILLAGE INTERNE SEO
// ====================================

/**
 * Interface pour les marques liées/similaires (pour maillage interne)
 */
export interface RelatedBrand {
  marque_id: number;
  marque_name: string;
  marque_alias: string;
  marque_logo: string | null;
  marque_country?: string | null;
  link?: string;
}

/**
 * Interface pour les gammes populaires (pour maillage interne)
 */
export interface PopularGamme {
  pg_id: string;
  pg_name: string;
  pg_alias: string;
  pg_img: string | null;
  link: string;
  anchor: string;
}

/**
 * Interface pour les données SEO traitées et enrichies
 * Combine les données brutes avec les variables dynamiques PHP
 */

/**
 * Interface pour les variables SEO dynamiques (reproduction logique PHP)
 */
export interface SeoVariables {
  marque_name: string;
  marque_name_meta: string;
  marque_name_meta_title: string;
  prix_pas_cher: string; // Variable #PrixPasCher# du PHP
  comp_switch: string; // Variable #CompSwitch# du PHP
  domain: string;
  auto_section: string; // Équivalent $Auto du PHP
}

// ====================================
// 📄 TYPES RÉPONSES API
// ====================================

/**
 * Réponse API pour la page marque constructeur
 */
export interface BrandPageResponse {
  success: boolean;
  data: {
    brand: BrandData;
    seo: ProcessedSeoData;
    popular_vehicles: PopularVehicle[];
    popular_parts: PopularPart[];
    blog_content: {
      h1: string;
      content: string;
    };
    // 🔗 Données de maillage interne SEO
    related_brands?: RelatedBrand[];
    popular_gammes?: PopularGamme[];
    meta: {
      total_vehicles: number;
      total_parts: number;
      total_related_brands?: number;
      total_popular_gammes?: number;
      last_updated: string;
    };
  };
  error?: string;
}

/**
 * Entrée de cache avec métadonnées
 */
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  key: string;
  size: number;
  hits: number;
  source: "api" | "database" | "computed";
}

// ====================================
// 🎭 TYPES LEGACY (COMPATIBILITÉ PHP)
// ====================================

/**
 * Variables globales PHP transposées en TypeScript
 * Pour maintenir la compatibilité avec l'ancienne logique
 */
export interface PhpLegacyVariables {
  domain: string; // $domain
  auto: string; // $Auto
  piece: string; // $Piece
  blog: string; // $blog
  constructeurs: string; // $constructeurs
  pg_id: number; // $pg_id
  is_mac_version: boolean; // $isMacVersion
  hr: string; // $hr (langue)
  prix_pas_cher: string[]; // $PrixPasCher array
  prix_pas_cher_length: number; // $PrixPasCherLength
}

// ====================================
// 🔍 TYPES POUR LA RECHERCHE
// ====================================

/**
 * Paramètres de recherche par type mine (reproduction formulaire PHP)
 */
export interface MineSearchParams {
  mine: string; // Type mine recherché
  ask_2_page: string; // "2" (paramètre fixe PHP)
  pg_mine: number; // ID de page (équivalent $pg_id)
}

/**
 * Résultat de recherche par type mine
 */
export interface MineSearchResult {
  success: boolean;
  vehicles: PopularVehicle[];
  total: number;
  query: string;
  suggestions?: string[];
  error?: string;
}

export {};
