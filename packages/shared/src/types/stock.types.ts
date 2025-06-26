export interface Stock {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  updatedAt: Date;
}

export interface StockCreateRequest {
  name: string;
  description?: string;
  status?: 'active' | 'inactive' | 'pending';
}

export interface StockUpdateRequest extends Partial<StockCreateRequest> {
  id: string;
}

export interface StockResponse {
  data: Stock;
  message: string;
  success: boolean;
}

export interface StockListResponse {
  data: Stock[];
  total: number;
  page: number;
  limit: number;
  message: string;
  success: boolean;
}

export type StockStatus = 'active' | 'inactive' | 'pending';

export enum StockStatusEnum {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
}
