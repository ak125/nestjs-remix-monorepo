// 📁 backend/src/modules/catalog/interfaces/catalog-family.interface.ts
// 🏷️ Interface pour la table catalog_family

export interface CatalogFamily {
  mf_id: string;
  mf_name: string;
  mf_name_meta: string;
  mf_name_system: string;
  mf_description: string;
  mf_pic: string;
  mf_display: string;
  mf_sort: string;
}

export interface CatalogFamilyWithGammes extends CatalogFamily {
  gammes: any[]; // Les gammes associées à cette famille
  gammes_count: number;
}