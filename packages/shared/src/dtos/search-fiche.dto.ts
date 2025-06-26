/**
 * MCP GENERATED DTO
 * Généré automatiquement par MCP Context-7
 * Source: search.fiche.php
 * Module: catalog
 */

import { IsString, IsOptional, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SearchFicheDto {
  @ApiProperty({ description: 'Primary identifier', required: false })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ description: 'Module name', required: false })
  @IsOptional()
  @IsString()
  module?: string = 'catalog';

  @ApiProperty({ description: 'Form data', required: false })
  @IsOptional()
  @IsArray()
  data?: any[];

  @ApiProperty({ description: 'Additional parameters', required: false })
  @IsOptional()
  params?: Record<string, any>;
}
