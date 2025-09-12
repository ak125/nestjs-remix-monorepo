export interface VehicleBrand {
  id: number;
  code: string;
  name: string;
  alias?: string;
  country?: string;
  isActive: boolean;
  isFavorite?: boolean;
  displayOrder?: number;
}

export interface VehicleModel {
  id: number;
  name: string;
  fullName?: string;
  alias?: string;
  brandId: number;
  isActive: boolean;
}

export interface VehicleType {
  id: number;
  name: string;
  modelId: number;
  brandId: number;
  fuel?: string;
  power?: string;
  powerKw?: string;
  engine?: string;
  engineCode?: string;
  yearFrom?: number;
  yearTo?: number;
  monthFrom?: number;
  monthTo?: number;
  mineType?: string;
  isActive: boolean;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  search?: string;
  onlyFavorites?: boolean;
  onlyActive?: boolean;
}

export interface VehicleResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  limit: number;
  message?: string;
}