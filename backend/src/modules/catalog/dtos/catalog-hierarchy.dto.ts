export interface FamilyWithGammesDto {
  mf_id: number;
  mf_name: string;
  mf_description?: string;
  mf_pic?: string;
  mf_sort: number;
  gammes: GammeDto[];
  stats: {
    total_gammes: number;
    total_products: number;
  };
}

export interface GammeDto {
  pg_id: number;
  pg_name: string;
  pg_alias: string;
  pg_description?: string;
  pg_img?: string;
  pg_sort: number;
  product_count?: number;
}

export interface CatalogHierarchyResponseDto {
  families: FamilyWithGammesDto[];
  total_families: number;
  total_gammes: number;
  total_products: number;
  message: string;
}