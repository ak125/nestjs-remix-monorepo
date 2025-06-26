export interface Catalog {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  updatedAt: Date;
}

export interface CatalogCreateRequest {
  name: string;
  description?: string;
  status?: 'active' | 'inactive' | 'pending';
}

export interface CatalogUpdateRequest extends Partial<CatalogCreateRequest> {
  id: string;
}

export interface CatalogResponse {
  data: Catalog;
  message: string;
  success: boolean;
}

export interface CatalogListResponse {
  data: Catalog[];
  total: number;
  page: number;
  limit: number;
  message: string;
  success: boolean;
}

export type CatalogStatus = 'active' | 'inactive' | 'pending';

export enum CatalogStatusEnum {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
}
