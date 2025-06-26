import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { EcommerceStatus } from '../types/ecommerce.types';

export class EcommerceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['active', 'inactive', 'pending'])
  @IsOptional()
  status?: EcommerceStatus;
}

export class CreateEcommerceDto extends EcommerceDto {}

export class UpdateEcommerceDto {
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
  status?: EcommerceStatus;
}
