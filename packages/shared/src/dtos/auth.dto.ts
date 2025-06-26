import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { AuthStatus } from '../types/auth.types';

export class AuthDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['active', 'inactive', 'pending'])
  @IsOptional()
  status?: AuthStatus;
}

export class CreateAuthDto extends AuthDto {}

export class UpdateAuthDto {
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
  status?: AuthStatus;
}
