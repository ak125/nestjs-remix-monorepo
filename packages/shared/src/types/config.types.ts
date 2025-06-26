export interface Config {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  updatedAt: Date;
}

export interface ConfigCreateRequest {
  name: string;
  description?: string;
  status?: 'active' | 'inactive' | 'pending';
}

export interface ConfigUpdateRequest extends Partial<ConfigCreateRequest> {
  id: string;
}

export interface ConfigResponse {
  data: Config;
  message: string;
  success: boolean;
}

export interface ConfigListResponse {
  data: Config[];
  total: number;
  page: number;
  limit: number;
  message: string;
  success: boolean;
}

export type ConfigStatus = 'active' | 'inactive' | 'pending';

export enum ConfigStatusEnum {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
}
