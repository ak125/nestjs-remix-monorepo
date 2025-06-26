import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ConfigStatus } from '../types/config.types';

export class ConfigDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['active', 'inactive', 'pending'])
  @IsOptional()
  status?: ConfigStatus;
}

export class CreateConfigDto extends ConfigDto {}

export class UpdateConfigDto {
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
  status?: ConfigStatus;
}
