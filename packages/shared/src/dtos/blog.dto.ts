import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { BlogStatus } from '../types/blog.types';

export class BlogDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['active', 'inactive', 'pending'])
  @IsOptional()
  status?: BlogStatus;
}

export class CreateBlogDto extends BlogDto {}

export class UpdateBlogDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['active', 'inactive', 'pending'])
  @IsOptional()
  status?: BlogStatus;
}
