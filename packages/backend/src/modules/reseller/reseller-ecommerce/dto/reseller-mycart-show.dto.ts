/**
 * MCP GENERATED DTO - RESELLER PROTECTED
 * Généré automatiquement par MCP Context-7
 * Module: reseller-ecommerce
 * Sécurité: Validation revendeurs
 * Source: massdoc/mycart.php
 */
import { IsString, IsNumber, IsOptional, IsUUID, Min, Max } from 'class-validator';

export class ResellerMycartShowDto {
  @IsUUID()
  resellerId: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(9999)
  quantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  resellerPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @IsOptional()
  @IsString()
  action?: 'show' | 'add' | 'remove' | 'update' | 'validate';

  @IsOptional()
  @IsString()
  territory?: string;

  @IsOptional()
  module?: string;

  @IsOptional()
  params?: Record<string, any>;
}
