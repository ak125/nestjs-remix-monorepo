export interface Auth {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthCreateRequest {
  name: string;
  description?: string;
  status?: 'active' | 'inactive' | 'pending';
}

export interface AuthUpdateRequest extends Partial<AuthCreateRequest> {
  id: string;
}

export interface AuthResponse {
  data: Auth;
  message: string;
  success: boolean;
}

export interface AuthListResponse {
  data: Auth[];
  total: number;
  page: number;
  limit: number;
  message: string;
  success: boolean;
}

export type AuthStatus = 'active' | 'inactive' | 'pending';

export enum AuthStatusEnum {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
}
