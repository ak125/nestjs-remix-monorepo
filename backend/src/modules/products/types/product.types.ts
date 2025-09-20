/**
 * DTOs simplifiés pour le module Products
 * Sans dépendances externes pour éviter les erreurs de module
 */

export interface CreateProductDto {
  name: string;
  sku: string;
  description?: string;
  range_id: number;
  brand_id: number;
  base_price?: number;
  stock_quantity?: number;
  min_stock?: number;
  barcode?: string;
  weight?: string;
  dimensions?: string;
  is_active?: boolean;
  supplier_reference?: string;
  technical_specs?: string;
  installation_notes?: string;
}

export interface UpdateProductDto {
  name?: string;
  sku?: string;
  description?: string;
  range_id?: number;
  brand_id?: number;
  base_price?: number;
  stock_quantity?: number;
  min_stock?: number;
  barcode?: string;
  weight?: string;
  dimensions?: string;
  is_active?: boolean;
  supplier_reference?: string;
  technical_specs?: string;
  installation_notes?: string;
}

export interface SearchProductDto {
  search?: string;
  rangeId?: number;
  brandId?: number;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
