import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';
import { SearchProductSchema } from '../../products/schemas/product.schemas';

export class AdminProductFiltersDto {
  @ApiPropertyOptional({ description: 'Terme de recherche' })
  search?: string;

  @ApiPropertyOptional({ description: 'ID de la gamme' })
  rangeId?: number;

  @ApiPropertyOptional({ description: 'ID de la marque' })
  brandId?: number;

  @ApiPropertyOptional({ description: 'Prix minimum' })
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Prix maximum' })
  maxPrice?: number;

  @ApiPropertyOptional({ description: 'Page', default: 0 })
  page?: number;

  @ApiPropertyOptional({ description: 'Limite par page', default: 50 })
  limit?: number;

  @ApiPropertyOptional({
    description: 'Champ de tri',
    enum: ['name', 'sku', 'price', 'stock_quantity', 'created_at', 'updated_at'],
    default: 'name',
  })
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Ordre de tri',
    enum: ['asc', 'desc'],
    default: 'asc',
  })
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({ description: 'Filtrer par statut actif' })
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Filtrer par produits en stock' })
  inStock?: boolean;

  @ApiPropertyOptional({ description: 'Filtrer par produits en stock faible' })
  lowStock?: boolean;

  @ApiPropertyOptional({ description: 'Produits avec image' })
  hasImage?: boolean;

  @ApiPropertyOptional({ description: 'Produits avec description' })
  hasDescription?: boolean;

  @ApiPropertyOptional({ description: 'Date de dernière modification (ISO)' })
  lastModified?: string;

  @ApiPropertyOptional({ description: 'Créé par (user ID)' })
  createdBy?: string;

  @ApiPropertyOptional({ description: 'Modifié par (user ID)' })
  modifiedBy?: string;

  @ApiPropertyOptional({ description: 'Produits avec prix manquant' })
  missingPrice?: boolean;

  @ApiPropertyOptional({ description: 'Produits avec référence manquante' })
  missingReference?: boolean;

  @ApiPropertyOptional({ description: 'Produits archivés' })
  archived?: boolean;
}

export class AdminBulkOperationsDto {
  @ApiProperty({
    description: "Type d'opération",
    enum: [
      'activate',
      'deactivate',
      'delete',
      'archive',
      'unarchive',
      'update_stock',
      'update_price',
      'export',
      'duplicate',
    ],
  })
  operation: string;

  @ApiProperty({
    description: 'IDs des produits concernés',
    type: [String],
  })
  productIds: string[];

  @ApiPropertyOptional({
    description: "Paramètres spécifiques à l'opération",
  })
  parameters?: {
    quantity?: number;
    stockReason?: string;
    newPrice?: number;
    priceReason?: string;
    format?: 'csv' | 'excel' | 'json';
    reason?: string;
    [key: string]: any;
  };

  @ApiPropertyOptional({ description: 'Notes administratives' })
  adminNotes?: string;
}

export const AdminProductFiltersSchema = SearchProductSchema.extend({
  hasImage: z.boolean().optional(),
  hasDescription: z.boolean().optional(),
  lastModified: z.string().optional(),
  createdBy: z.string().optional(),
  modifiedBy: z.string().optional(),
  missingPrice: z.boolean().optional(),
  missingReference: z.boolean().optional(),
  archived: z.boolean().optional(),
});

export const AdminBulkOperationsSchema = z.object({
  operation: z.enum([
    'activate',
    'deactivate',
    'delete',
    'archive',
    'unarchive',
    'update_stock',
    'update_price',
    'export',
    'duplicate',
  ]),
  productIds: z
    .array(z.string())
    .min(1, 'Au moins un produit doit être sélectionné'),
  parameters: z
    .object({
      quantity: z.number().optional(),
      stockReason: z.string().optional(),
      newPrice: z.number().min(0).optional(),
      priceReason: z.string().optional(),
      format: z.enum(['csv', 'excel', 'json']).optional(),
      reason: z.string().optional(),
    })
    .optional(),
  adminNotes: z.string().optional(),
});

export type AdminProductFiltersType = z.infer<typeof AdminProductFiltersSchema>;
export type AdminBulkOperationsType = z.infer<typeof AdminBulkOperationsSchema>;
