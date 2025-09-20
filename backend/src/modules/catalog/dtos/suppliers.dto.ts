export interface SupplierDto {
  pm_id: number;
  pm_alias: string;
  pm_name: string;
  pm_description?: string;
  pm_logo?: string;
  pm_website?: string;
  pm_top: number; // 1 pour les équipementiers mis en avant
}

export interface SuppliersResponseDto {
  suppliers: SupplierDto[];
  total: number;
  message: string;
}