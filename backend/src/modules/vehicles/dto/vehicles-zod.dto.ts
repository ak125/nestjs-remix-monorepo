import { z } from 'zod';

/**
 * 🚗 Schémas Zod pour les véhicules automobiles
 */

/**
 * Schéma pour la recherche de véhicules par code/alias
 */
export const VehicleSearchSchema = z.object({
  brandCode: z.string().min(1, 'Le code marque est requis').optional(),
  modelCode: z.string().min(1, 'Le code modèle est requis').optional(),
  typeCode: z.string().min(1, 'Le code type est requis').optional(),
  year: z
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear() + 5)
    .optional(),
  engineCode: z.string().min(1, 'Le code moteur doit être valide').optional(),
  fuelType: z
    .enum([
      'Essence',
      'Diesel',
      'Électrique',
      'Hybride',
      'GPL',
      'GNV',
      'Essence-Électrique',
      "Extension d'aut",
    ])
    .optional(),
});

/**
 * Schéma pour les filtres généraux de véhicules
 */
export const VehicleFilterSchema = z.object({
  search: z
    .string()
    .min(1, 'Le terme de recherche doit contenir au moins 1 caractère')
    .optional(),
  brandId: z
    .number()
    .int()
    .positive("L'ID marque doit être positif")
    .optional(),
  modelId: z
    .number()
    .int()
    .positive("L'ID modèle doit être positif")
    .optional(),
  typeId: z.string().min(1, "L'ID type doit être valide").optional(),
  onlyActive: z.boolean().default(true),
  limit: z.number().int().min(1).max(200).default(50),
  page: z.number().int().min(0).default(0),
});

/**
 * Schéma pour les requêtes de marques
 */
export const BrandQuerySchema = z
  .object({
    search: z.string().optional(),
    limit: z.string().regex(/^\d+$/, 'Limit doit être un nombre').optional(),
    page: z.string().regex(/^\d+$/, 'Page doit être un nombre').optional(),
    display: z.enum(['0', '1', '3']).optional(),
  })
  .transform((data) => ({
    search: data.search,
    limit: data.limit ? parseInt(data.limit) : 50,
    page: data.page ? parseInt(data.page) : 0,
    display: data.display ? parseInt(data.display) : 1,
  }));

/**
 * Schéma pour les requêtes de modèles (simplifié)
 */
export const ModelQuerySchema = z
  .object({
    search: z.string().optional(),
    limit: z.string().regex(/^\d+$/, 'Limit doit être un nombre').optional(),
    page: z.string().regex(/^\d+$/, 'Page doit être un nombre').optional(),
  })
  .transform((data) => ({
    search: data.search,
    limit: data.limit ? parseInt(data.limit) : 50,
    page: data.page ? parseInt(data.page) : 0,
  }));

/**
 * Schéma pour les requêtes de types
 */
export const TypeQuerySchema = z
  .object({
    search: z.string().optional(),
    limit: z.string().regex(/^\d+$/, 'Limit doit être un nombre').optional(),
    page: z.string().regex(/^\d+$/, 'Page doit être un nombre').optional(),
    fuelType: z
      .enum([
        'Essence',
        'Diesel',
        'Électrique',
        'Hybride',
        'GPL',
        'GNV',
        'Essence-Électrique',
      ])
      .optional(),
    minPower: z
      .string()
      .regex(/^\d+$/, 'Puissance doit être un nombre')
      .optional(),
    maxPower: z
      .string()
      .regex(/^\d+$/, 'Puissance doit être un nombre')
      .optional(),
  })
  .transform((data) => ({
    search: data.search,
    limit: data.limit ? parseInt(data.limit) : 50,
    page: data.page ? parseInt(data.page) : 0,
    fuelType: data.fuelType,
    minPower: data.minPower ? parseInt(data.minPower) : undefined,
    maxPower: data.maxPower ? parseInt(data.maxPower) : undefined,
  }));

/**
 * Schéma pour la recherche avancée de véhicules
 */
export const AdvancedVehicleSearchSchema = z
  .object({
    // Recherche textuelle
    search: z
      .string()
      .min(1, 'Le terme de recherche doit contenir au moins 1 caractère')
      .optional(),

    // Filtres hiérarchiques
    brandId: z.number().int().positive().optional(),
    modelId: z.number().int().positive().optional(),
    typeId: z.string().min(1).optional(),

    // Filtres techniques
    fuelType: z
      .enum([
        'Essence',
        'Diesel',
        'Électrique',
        'Hybride',
        'GPL',
        'GNV',
        'Essence-Électrique',
        "Extension d'aut",
      ])
      .optional(),
    minPowerPs: z.number().int().min(0).max(2000).optional(),
    maxPowerPs: z.number().int().min(0).max(2000).optional(),
    minPowerKw: z.number().int().min(0).max(1500).optional(),
    maxPowerKw: z.number().int().min(0).max(1500).optional(),
    engineCode: z.string().min(1).optional(),

    // Filtres temporels
    yearFrom: z
      .number()
      .int()
      .min(1900)
      .max(new Date().getFullYear())
      .optional(),
    yearTo: z
      .number()
      .int()
      .min(1900)
      .max(new Date().getFullYear() + 5)
      .optional(),
    onlyActive: z.boolean().default(true),

    // Pagination
    limit: z.number().int().min(1).max(500).default(50),
    offset: z.number().int().min(0).default(0),

    // Tri
    sortBy: z.enum(['name', 'year', 'power', 'fuel', 'brand']).default('name'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  })
  .refine(
    (data) => {
      // Validation des plages de puissance
      if (
        data.minPowerPs &&
        data.maxPowerPs &&
        data.minPowerPs > data.maxPowerPs
      ) {
        return false;
      }
      if (
        data.minPowerKw &&
        data.maxPowerKw &&
        data.minPowerKw > data.maxPowerKw
      ) {
        return false;
      }
      // Validation des années
      if (data.yearFrom && data.yearTo && data.yearFrom > data.yearTo) {
        return false;
      }
      return true;
    },
    {
      message: 'Les valeurs min doivent être inférieures aux valeurs max',
    },
  );

/**
 * Types TypeScript inférés des schémas Zod
 */
export type VehicleSearchDto = z.infer<typeof VehicleSearchSchema>;
export type VehicleFilterDto = z.infer<typeof VehicleFilterSchema>;
export type BrandQueryDto = z.infer<typeof BrandQuerySchema>;
export type ModelQueryDto = z.infer<typeof ModelQuerySchema>;
export type TypeQueryDto = z.infer<typeof TypeQuerySchema>;
export type AdvancedVehicleSearchDto = z.infer<
  typeof AdvancedVehicleSearchSchema
>;
