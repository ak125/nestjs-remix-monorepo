import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ErrorsDto {
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
