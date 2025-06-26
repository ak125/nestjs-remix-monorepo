import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { CartStatus } from '../types/cart.types';

export class CartDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['active', 'inactive', 'pending'])
  @IsOptional()
  status?: CartStatus;
}

export class CreateCartDto extends CartDto {}

export class UpdateCartDto {
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
  status?: CartStatus;
}
