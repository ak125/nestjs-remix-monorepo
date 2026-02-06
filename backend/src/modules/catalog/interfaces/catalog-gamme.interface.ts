// 📁 backend/src/modules/catalog/interfaces/catalog-gamme.interface.ts
// 🏷️ Interface pour la table catalog_gamme (junction table)

export interface CatalogGamme {
  mc_id: string;
  mc_mf_id: string; // ID fabricant/marque
  mc_mf_prime: string; // Priorité fabricant
  mc_pg_id: string; // ID gamme produit
  mc_sort: string; // Ordre de tri
  // Champs enrichis après jointure avec pieces_gamme
  pg_id?: string; // ID réel de pieces_gamme (pour les liens)
  pg_name?: string; // Nom de la gamme (ex: "Filtre à huile")
  pg_alias?: string; // Alias pour URL (ex: "filtre-huile")
  pg_image?: string; // Image de la gamme (ex: "filtre-huile.webp")
  manufacturer_name?: string;
}

export interface CatalogGammeWithDetails extends CatalogGamme {
  manufacturer_name?: string;
  product_group_name?: string;
  sort_order?: number;
}
