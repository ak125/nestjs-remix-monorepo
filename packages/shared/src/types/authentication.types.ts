export interface Authentication {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthenticationCreateRequest {
  name: string;
  description?: string;
  status?: 'active' | 'inactive' | 'pending';
}

export interface AuthenticationUpdateRequest extends Partial<AuthenticationCreateRequest> {
  id: string;
}

export interface AuthenticationResponse {
  data: Authentication;
  message: string;
  success: boolean;
}

export interface AuthenticationListResponse {
  data: Authentication[];
  total: number;
  page: number;
  limit: number;
  message: string;
  success: boolean;
}

export type AuthenticationStatus = 'active' | 'inactive' | 'pending';

export enum AuthenticationStatusEnum {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
}
