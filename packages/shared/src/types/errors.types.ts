export interface Errors {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  updatedAt: Date;
}

export interface ErrorsCreateRequest {
  name: string;
  description?: string;
  status?: 'active' | 'inactive' | 'pending';
}

export interface ErrorsUpdateRequest extends Partial<ErrorsCreateRequest> {
  id: string;
}

export interface ErrorsResponse {
  data: Errors;
  message: string;
  success: boolean;
}

export interface ErrorsListResponse {
  data: Errors[];
  total: number;
  page: number;
  limit: number;
  message: string;
  success: boolean;
}

export type ErrorsStatus = 'active' | 'inactive' | 'pending';

export enum ErrorsStatusEnum {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
}
