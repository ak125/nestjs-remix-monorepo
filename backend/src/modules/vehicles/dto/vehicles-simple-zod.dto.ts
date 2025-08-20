import { z } from 'zod';

/**
 * Schémas Zod simplifiés pour les véhicules
 */

// Schema pour les requêtes de marques
export const BrandQuerySchema = z
  .object({
    search: z.string().optional(),
    limit: z.string().optional(),
    page: z.string().optional(),
  })
  .transform((data) => ({
    search: data.search,
    limit: data.limit ? Math.min(parseInt(data.limit) || 50, 200) : 50,
    page: data.page ? Math.max(parseInt(data.page) || 0, 0) : 0,
    display: 1, // Toujours afficher les marques actives
  }));

// Schema pour les requêtes de modèles
export const ModelQuerySchema = z
  .object({
    search: z.string().optional(),
    limit: z.string().optional(),
    page: z.string().optional(),
  })
  .transform((data) => ({
    search: data.search,
    limit: data.limit ? Math.min(parseInt(data.limit) || 50, 200) : 50,
    page: data.page ? Math.max(parseInt(data.page) || 0, 0) : 0,
  }));

// Schema pour les requêtes de types
export const TypeQuerySchema = z
  .object({
    search: z.string().optional(),
    limit: z.string().optional(),
    page: z.string().optional(),
    fuelType: z.string().optional(),
  })
  .transform((data) => ({
    search: data.search,
    limit: data.limit ? Math.min(parseInt(data.limit) || 50, 200) : 50,
    page: data.page ? Math.max(parseInt(data.page) || 0, 0) : 0,
    fuelType: data.fuelType,
  }));

// Types TypeScript inférés
export type BrandQueryDto = z.infer<typeof BrandQuerySchema>;
export type ModelQueryDto = z.infer<typeof ModelQuerySchema>;
export type TypeQueryDto = z.infer<typeof TypeQuerySchema>;
