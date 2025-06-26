import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { UsersStatus } from '../types/users.types';

export class UsersDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['active', 'inactive', 'pending'])
  @IsOptional()
  status?: UsersStatus;
}

export class CreateUsersDto extends UsersDto {}

export class UpdateUsersDto {
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
  status?: UsersStatus;
}
