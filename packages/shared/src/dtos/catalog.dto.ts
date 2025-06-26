import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { CatalogStatus } from '../types/catalog.types';

export class CatalogDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['active', 'inactive', 'pending'])
  @IsOptional()
  status?: CatalogStatus;
}

export class CreateCatalogDto extends CatalogDto {}

export class UpdateCatalogDto {
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
  status?: CatalogStatus;
}
