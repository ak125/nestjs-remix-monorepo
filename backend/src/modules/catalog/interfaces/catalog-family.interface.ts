// 📁 backend/src/modules/catalog/interfaces/catalog-family.interface.ts
// 🏷️ Interface pour la table catalog_family
// Basé sur la structure SQL PHP de index.php

/**
 * Interface pour les gammes de produits (pieces_gamme)
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
  pg_display?: number;
  pg_level?: number;
  pg_top?: number;
  mc_sort?: number;
}

/**
 * Interface pour les familles de produits (catalog_family)
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
  mf_name_meta?: string;
  mf_name_system?: string;
  mf_description?: string;
  mf_pic?: string;
  mf_image?: string; // Alias pour mf_pic
  mf_display?: number;
  mf_sort?: number;
}

/**
 * Interface pour les familles avec leurs gammes associées
 * Correspond exactement à la logique PHP qui fait une boucle sur les familles
 * puis pour chaque famille récupère ses gammes
 */
export interface CatalogFamilyWithGammes extends CatalogFamily {
  gammes: CatalogGamme[];
  gammes_count?: number;
}

/**
 * Réponse API pour le catalogue de familles (comme dans index.php)
 */
export interface CatalogFamiliesResponse {
  families: CatalogFamilyWithGammes[];
  success: boolean;
  totalFamilies?: number;
  message?: string;
}
