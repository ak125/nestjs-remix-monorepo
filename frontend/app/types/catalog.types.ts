/**
 * Types TypeScript basés sur la structure SQL PHP avec conventions Supabase (minuscules)
 * Correspondance avec les requêtes SQL de index.php
 */

// ==========================================
// TYPES POUR LE CATALOGUE DE FAMILLES
// ==========================================

/**
 * Interface pour les gammes de produits
 * Basée sur la requête SQL PHP :
 * SELECT DISTINCT pg_id, pg_alias, pg_name, pg_name_url, pg_name_meta, pg_pic, pg_img 
 * FROM pieces_gamme JOIN catalog_gamme ON mc_pg_id = pg_id
 * WHERE pg_display = 1 AND pg_level = 1 AND mc_mf_id = $mf_id
 * ORDER BY mc_sort
 */
export interface CatalogGamme {
  pg_id: number;
  pg_alias: string;
  pg_name: string;
  pg_name_url?: string;
  pg_name_meta?: string;
  pg_pic?: string;
  pg_img?: string;
  mc_sort?: number;
}

/**
 * Interface pour les TOP gammes (PG_TOP = 1)
 * Basée sur la requête SQL PHP :
 * SELECT DISTINCT pg_name, pg_alias, pg_id FROM pieces_gamme WHERE pg_top = 1
 */
export interface TopGamme {
  pg_id: string;
  pg_name: string;
  pg_alias: string;
  pg_img?: string;
}

/**
 * Interface pour les équipementiers (PIECES_MARQUE)
 * Basée sur la requête SQL PHP :
 * SELECT DISTINCT pm_name, pm_id FROM pieces_marque
 */
export interface Equipementier {
  pm_id: string;
  pm_name: string;
  pm_logo?: string;
  pm_website?: string;
  pm_description?: string;
}

/**
 * Interface pour les familles de produits
 * Basée sur la requête SQL PHP :
 * SELECT DISTINCT mf_id, IF(mf_name_system IS NULL, mf_name, mf_name_system) AS mf_name, 
 * mf_description, mf_pic FROM pieces_gamme 
 * JOIN catalog_gamme ON mc_pg_id = pg_id
 * JOIN catalog_family ON mf_id = mc_mf_id
 * WHERE pg_display = 1 AND pg_level = 1 AND mf_display = 1
 * ORDER BY mf_sort
 */
export interface CatalogFamily {
  mf_id: number;
  mf_name: string;
  mf_name_system?: string;
  mf_description?: string;
  mf_pic?: string;
  mf_sort?: number;
  mf_display?: number;
  gammes: CatalogGamme[];
}

// ==========================================
// TYPES POUR LES MARQUES AUTOMOBILES
// ==========================================

/**
 * Interface pour les marques automobiles
 * Basée sur la requête SQL PHP :
 * SELECT marque_id, marque_alias, marque_name_meta, marque_logo    
 * FROM auto_marque
 * WHERE marque_display = 1 AND marque_id NOT IN (339,441) 
 * ORDER BY marque_sort
 */
export interface AutoMarque {
  marque_id: number;
  marque_alias: string;
  marque_name: string;
  marque_name_meta: string;
  marque_logo: string;
  marque_sort?: number;
  marque_display?: number;
  marque_top?: number;
}

// ==========================================
// TYPES POUR LES GAMMES TOP
// ==========================================

/**
 * Interface pour les gammes "top" (les plus vendues)
 * Basée sur la requête SQL PHP :
 * SELECT DISTINCT pg_id, pg_alias, pg_name, pg_name_url, pg_name_meta, pg_img, 
 * sg_title, sg_descrip, ba_preview 
 * FROM pieces_gamme 
 * JOIN catalog_gamme ON mc_pg_id = pg_id 
 * JOIN __seo_gamme ON sg_pg_id = pg_id 
 * JOIN __blog_advice ON ba_pg_id = pg_id
 * WHERE pg_display = 1 AND pg_level = 1 AND pg_top = 1
 * ORDER BY mc_mf_id, mc_sort
 */
// Interface TopGamme déjà définie ci-dessus avec pg_id: string

// ==========================================
// TYPES POUR LES ÉQUIPEMENTIERS
// ==========================================

/**
 * Interface pour les marques d'équipementiers
 * Basée sur la requête SQL PHP :
 * SELECT pm_id, pm_name_meta, pm_preview, pm_logo
 * FROM pieces_marque
 * WHERE pm_display = 1 AND pm_top = 1
 * ORDER BY pm_sort
 */
export interface PiecesMarque {
  pm_id: number;
  pm_name: string;
  pm_name_meta: string;
  pm_preview?: string;
  pm_logo?: string;
  pm_sort?: number;
  pm_display?: number;
  pm_top?: number;
}

// ==========================================
// TYPES POUR LES RÉPONSES D'API
// ==========================================

/**
 * Réponse API pour le catalogue de familles
 */
export interface CatalogFamiliesResponse {
  families: CatalogFamily[];
  success: boolean;
  totalFamilies?: number;
}

/**
 * Réponse API pour les marques automobiles
 */
export interface AutoMarquesResponse {
  marques: AutoMarque[];
  success: boolean;
  totalMarques?: number;
}

/**
 * Réponse API pour les gammes top
 */
export interface TopGammesResponse {
  gammes: TopGamme[];
  success: boolean;
  totalGammes?: number;
}

/**
 * Réponse API pour les équipementiers
 */
export interface EquipementiersResponse {
  equipementiers: PiecesMarque[];
  success: boolean;
  totalEquipementiers?: number;
}

// ==========================================
// TYPES POUR LA PAGE D'ACCUEIL COMPLÈTE
// ==========================================

/**
 * Données complètes pour la page d'accueil
 * Correspond à toutes les sections de index.php
 */
export interface HomePageData {
  catalogFamilies: CatalogFamily[];
  autoMarques: AutoMarque[];
  topGammes: TopGamme[];
  equipementiers: PiecesMarque[];
  success: boolean;
}

// ==========================================
// TYPES POUR LE SÉLECTEUR DE VÉHICULE
// ==========================================

/**
 * Interface pour les années de véhicules
 * Utilisée dans le sélecteur PHP : _form.get.car.year.php
 */
export interface VehicleYear {
  year: number;
  display_name?: string;
}

/**
 * Interface pour les modèles de véhicules
 * Utilisée dans le sélecteur PHP : _form.get.car.modele.php
 */
export interface VehicleModel {
  model_id: number;
  model_name: string;
  model_alias?: string;
}

/**
 * Interface pour les types/motorisations de véhicules
 * Utilisée dans le sélecteur PHP : _form.get.car.type.php
 */
export interface VehicleType {
  type_id: number;
  type_name: string;
  type_alias?: string;
  url?: string;
}