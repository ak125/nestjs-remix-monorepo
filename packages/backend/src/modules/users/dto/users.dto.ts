import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class UsersDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  status?: string;
}
