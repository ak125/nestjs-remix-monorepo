import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ErrorsStatus } from '../types/errors.types';

export class ErrorsDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['active', 'inactive', 'pending'])
  @IsOptional()
  status?: ErrorsStatus;
}

export class CreateErrorsDto extends ErrorsDto {}

export class UpdateErrorsDto {
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
  status?: ErrorsStatus;
}
