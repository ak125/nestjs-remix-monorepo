export interface Cart {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  updatedAt: Date;
}

export interface CartCreateRequest {
  name: string;
  description?: string;
  status?: 'active' | 'inactive' | 'pending';
}

export interface CartUpdateRequest extends Partial<CartCreateRequest> {
  id: string;
}

export interface CartResponse {
  data: Cart;
  message: string;
  success: boolean;
}

export interface CartListResponse {
  data: Cart[];
  total: number;
  page: number;
  limit: number;
  message: string;
  success: boolean;
}

export type CartStatus = 'active' | 'inactive' | 'pending';

export enum CartStatusEnum {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
}
