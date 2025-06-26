import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { AuthenticationStatus } from '../types/authentication.types';

export class AuthenticationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['active', 'inactive', 'pending'])
  @IsOptional()
  status?: AuthenticationStatus;
}

export class CreateAuthenticationDto extends AuthenticationDto {}

export class UpdateAuthenticationDto {
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
  status?: AuthenticationStatus;
}
