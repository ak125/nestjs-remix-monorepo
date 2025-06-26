export interface Blog {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
  updatedAt: Date;
}

export interface BlogCreateRequest {
  name: string;
  description?: string;
  status?: 'active' | 'inactive' | 'pending';
}

export interface BlogUpdateRequest extends Partial<BlogCreateRequest> {
  id: string;
}

export interface BlogResponse {
  data: Blog;
  message: string;
  success: boolean;
}

export interface BlogListResponse {
  data: Blog[];
  total: number;
  page: number;
  limit: number;
  message: string;
  success: boolean;
}

export type BlogStatus = 'active' | 'inactive' | 'pending';

export enum BlogStatusEnum {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
}
