/**
 * MCP GENERATED DTO
 * Généré automatiquement par MCP Context-7
 * Source: meta.conf.php
 * Module: config
 */

import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MetaConfigDto {
  @ApiProperty({ description: 'Meta title for the page' })
  @IsString()
  @IsNotEmpty()
  meta_title: string;

  @ApiProperty({ description: 'Meta description for SEO' })
  @IsOptional()
  @IsString()
  meta_description?: string;

  @ApiProperty({ description: 'Meta keywords for SEO' })
  @IsOptional()
  @IsString()
  meta_keywords?: string;

  @ApiProperty({ description: 'Meta robots directive' })
  @IsOptional()
  @IsString()
  meta_robots?: string;

  @ApiProperty({ description: 'Canonical URL' })
  @IsOptional()
  @IsString()
  canonical_url?: string;
}
