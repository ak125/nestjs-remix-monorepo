import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateProductDto as ZodCreateProductDto } from '../schemas/product.schemas';

/**
 * DTO pour créer un produit - basé sur Zod avec documentation Swagger
 * Utilise les types générés automatiquement par Zod pour la validation
 */
export class CreateProductDto implements ZodCreateProductDto {
  @ApiProperty({
    description: 'Nom du produit',
    example: 'Plaquettes de frein avant',
    maxLength: 255,
  })
  name!: string;

  @ApiProperty({
    description:
      'Référence SKU unique (lettres majuscules, chiffres, tirets et underscores uniquement)',
    example: 'PLQ-FRONT-001',
    maxLength: 100,
    pattern: '^[A-Z0-9-_]+$',
  })
  sku!: string;

  @ApiPropertyOptional({
    description: 'Description détaillée du produit',
    example: 'Plaquettes de frein haute performance pour berlines',
    maxLength: 2000,
  })
  description?: string;

  @ApiProperty({
    description: 'ID de la gamme de produits',
    example: 1,
    minimum: 1,
    type: 'integer',
  })
  range_id!: number;

  @ApiProperty({
    description: 'ID de la marque',
    example: 1,
    minimum: 1,
    type: 'integer',
  })
  brand_id!: number;

  @ApiPropertyOptional({
    description: 'Prix de base du produit en euros',
    example: 29.99,
    minimum: 0,
    maximum: 999999.99,
  })
  base_price?: number;

  @ApiPropertyOptional({
    description: 'Quantité en stock',
    example: 50,
    minimum: 0,
    maximum: 999999,
    type: 'integer',
  })
  stock_quantity?: number;

  @ApiPropertyOptional({
    description: 'Stock minimum requis',
    example: 10,
    minimum: 0,
    maximum: 9999,
    type: 'integer',
  })
  min_stock?: number;

  @ApiPropertyOptional({
    description: 'Code-barres du produit (8 à 13 chiffres)',
    example: '3123456789012',
    pattern: '^[0-9]{8,13}$',
  })
  barcode?: string;

  @ApiPropertyOptional({
    description: 'Poids du produit',
    example: '0.5kg',
    maxLength: 50,
  })
  weight?: string;

  @ApiPropertyOptional({
    description: 'Dimensions du produit',
    example: '10x5x2cm',
    maxLength: 100,
  })
  dimensions?: string;

  @ApiPropertyOptional({
    description: 'Produit actif ou non',
    example: true,
    default: true,
  })
  is_active: boolean = true;

  @ApiPropertyOptional({
    description: 'Référence fournisseur',
    example: 'SUPPLIER-REF-001',
    maxLength: 100,
  })
  supplier_reference?: string;

  @ApiPropertyOptional({
    description: 'Spécifications techniques',
    example: 'Compatible avec véhicules essence et diesel',
    maxLength: 5000,
  })
  technical_specs?: string;

  @ApiPropertyOptional({
    description: "Notes d'installation",
    example: 'Nécessite un outillage spécialisé',
    maxLength: 2000,
  })
  installation_notes?: string;
}
