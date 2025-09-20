import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  UpdateStockDto as ZodUpdateStockDto,
  VehicleSearchDto as ZodVehicleSearchDto,
  PopularProductsDto as ZodPopularProductsDto,
} from '../schemas/product.schemas';

/**
 * DTO pour mettre à jour le stock d'un produit
 */
export class UpdateStockDto implements ZodUpdateStockDto {
  @ApiProperty({
    description: 'Nouvelle quantité en stock',
    example: 50,
    minimum: 0,
    maximum: 999999,
    type: 'integer',
  })
  quantity!: number;

  @ApiPropertyOptional({
    description: 'Stock minimum requis',
    example: 10,
    minimum: 0,
    maximum: 9999,
    type: 'integer',
  })
  min_stock?: number;
}

/**
 * DTO pour rechercher des produits par véhicule
 */
export class VehicleSearchDto implements ZodVehicleSearchDto {
  @ApiProperty({
    description: 'ID de la marque de véhicule',
    example: 1,
    minimum: 1,
    type: 'integer',
  })
  brandId!: number;

  @ApiPropertyOptional({
    description: 'ID du modèle de véhicule',
    example: 1,
    minimum: 1,
    type: 'integer',
  })
  modelId?: number;

  @ApiPropertyOptional({
    description: 'ID du type de véhicule',
    example: 1,
    minimum: 1,
    type: 'integer',
  })
  typeId?: number;

  @ApiPropertyOptional({
    description: 'Année de début de compatibilité',
    example: 2010,
    minimum: 1900,
  })
  yearFrom?: number;

  @ApiPropertyOptional({
    description: 'Année de fin de compatibilité',
    example: 2020,
    minimum: 1900,
  })
  yearTo?: number;
}

/**
 * DTO pour récupérer les produits populaires
 */
export class PopularProductsDto implements ZodPopularProductsDto {
  @ApiPropertyOptional({
    description: 'Nombre maximum de produits à retourner',
    example: 10,
    minimum: 1,
    maximum: 100,
    type: 'integer',
    default: 10,
  })
  limit?: number;

  @ApiPropertyOptional({
    description: 'Nombre de jours pour calculer la popularité',
    example: 30,
    minimum: 1,
    maximum: 365,
    type: 'integer',
    default: 30,
  })
  days?: number;
}
