export interface Users {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  updatedAt: Date;
}

export interface UsersCreateRequest {
  name: string;
  description?: string;
  status?: 'active' | 'inactive' | 'pending';
}

export interface UsersUpdateRequest extends Partial<UsersCreateRequest> {
  id: string;
}

export interface UsersResponse {
  data: Users;
  message: string;
  success: boolean;
}

export interface UsersListResponse {
  data: Users[];
  total: number;
  page: number;
  limit: number;
  message: string;
  success: boolean;
}

export type UsersStatus = 'active' | 'inactive' | 'pending';

export enum UsersStatusEnum {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
}
