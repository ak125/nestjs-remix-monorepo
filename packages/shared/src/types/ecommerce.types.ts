export interface Ecommerce {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  updatedAt: Date;
}

export interface EcommerceCreateRequest {
  name: string;
  description?: string;
  status?: 'active' | 'inactive' | 'pending';
}

export interface EcommerceUpdateRequest extends Partial<EcommerceCreateRequest> {
  id: string;
}

export interface EcommerceResponse {
  data: Ecommerce;
  message: string;
  success: boolean;
}

export interface EcommerceListResponse {
  data: Ecommerce[];
  total: number;
  page: number;
  limit: number;
  message: string;
  success: boolean;
}

export type EcommerceStatus = 'active' | 'inactive' | 'pending';

export enum EcommerceStatusEnum {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
}
