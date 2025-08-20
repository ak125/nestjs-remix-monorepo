import { z } from 'zod';

/**
 * Schéma Zod pour la création d'un produit automobile
 */
export const CreateProductSchema = z.object({
  name: z.string().min(1, 'Le nom du produit est requis'),
  sku: z.string().min(1, 'Le SKU est requis'),
  description: z.string().optional(),
  range_id: z.number().int().positive('L\'ID de gamme doit être un entier positif'),
  brand_id: z.number().int().positive('L\'ID de marque doit être un entier positif'),
  base_price: z.number().positive().optional(),
  stock_quantity: z.number().int().min(0).optional(),
  min_stock: z.number().int().min(0).optional(),
  barcode: z.string().optional(),
  weight: z.string().optional(),
  dimensions: z.string().optional(),
  is_active: z.boolean().default(true),
  supplier_reference: z.string().optional(),
  technical_specs: z.string().optional(),
  installation_notes: z.string().optional(),
});

/**
 * Schéma Zod pour la mise à jour d'un produit
 */
export const UpdateProductSchema = CreateProductSchema.partial();

/**
 * Schéma Zod pour la recherche de produits
 */
export const SearchProductSchema = z.object({
  search: z.string().optional(),
  rangeId: z.number().int().positive().optional(),
  brandId: z.number().int().positive().optional(),
  minPrice: z.number().positive().optional(),
  maxPrice: z.number().positive().optional(),
  page: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(100).default(50),
  isActive: z.boolean().default(true),
});

/**
 * Schéma Zod pour la mise à jour du stock
 */
export const UpdateStockSchema = z.object({
  quantity: z.number().int().min(0, 'La quantité doit être positive ou nulle'),
});

/**
 * Types TypeScript dérivés des schémas Zod
 */
export type CreateProductDto = z.infer<typeof CreateProductSchema>;
export type UpdateProductDto = z.infer<typeof UpdateProductSchema>;
export type SearchProductDto = z.infer<typeof SearchProductSchema>;
export type UpdateStockDto = z.infer<typeof UpdateStockSchema>;
