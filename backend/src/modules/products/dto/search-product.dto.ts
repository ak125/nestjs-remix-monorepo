import { ApiPropertyOptional } from '@nestjs/swagger';
import { SearchProductDto as ZodSearchProductDto } from '../schemas/product.schemas';

/**
 * DTO pour rechercher des produits - basé sur Zod avec documentation Swagger
 */
export class SearchProductDto implements ZodSearchProductDto {
  @ApiPropertyOptional({
    description: 'Terme de recherche (nom, SKU, description)',
    example: 'plaquettes frein',
    maxLength: 100,
  })
  search?: string;

  @ApiPropertyOptional({
    description: 'ID de la gamme pour filtrer',
    example: 1,
    minimum: 1,
    type: 'integer',
  })
  rangeId?: number;

  @ApiPropertyOptional({
    description: 'ID de la marque pour filtrer',
    example: 1,
    minimum: 1,
    type: 'integer',
  })
  brandId?: number;

  @ApiPropertyOptional({
    description: 'Prix minimum',
    example: 10.0,
    minimum: 0,
    maximum: 999999.99,
  })
  minPrice?: number;

  @ApiPropertyOptional({
    description: 'Prix maximum',
    example: 100.0,
    minimum: 0,
    maximum: 999999.99,
  })
  maxPrice?: number;

  @ApiPropertyOptional({
    description: 'Numéro de page (commençant à 0)',
    example: 0,
    minimum: 0,
    maximum: 1000,
    type: 'integer',
    default: 0,
  })
  page: number = 0;

  @ApiPropertyOptional({
    description: "Nombre d'éléments par page",
    example: 24,
    minimum: 1,
    maximum: 100,
    type: 'integer',
    default: 50,
  })
  limit: number = 50;

  @ApiPropertyOptional({
    description: 'Champ de tri',
    example: 'name',
    enum: [
      'name',
      'sku',
      'price',
      'stock_quantity',
      'created_at',
      'updated_at',
    ],
    default: 'name',
  })
  sortBy?:
    | 'name'
    | 'sku'
    | 'price'
    | 'stock_quantity'
    | 'created_at'
    | 'updated_at';

  @ApiPropertyOptional({
    description: 'Ordre de tri',
    example: 'asc',
    enum: ['asc', 'desc'],
    default: 'asc',
  })
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({
    description: 'Filtrer par produits actifs seulement',
    example: true,
    default: true,
  })
  isActive: boolean = true;

  @ApiPropertyOptional({
    description: 'Filtrer par produits en stock uniquement',
    example: true,
  })
  inStock?: boolean;

  @ApiPropertyOptional({
    description: 'Filtrer par produits en stock faible uniquement',
    example: false,
  })
  lowStock?: boolean;
}
