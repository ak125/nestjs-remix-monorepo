import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { StockStatus } from '../types/stock.types';

export class StockDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['active', 'inactive', 'pending'])
  @IsOptional()
  status?: StockStatus;
}

export class CreateStockDto extends StockDto {}

export class UpdateStockDto {
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
  status?: StockStatus;
}
