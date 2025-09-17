/**
 * 🛡️ SCHÉMAS DE VALIDATION ZOD POUR VÉHICULES
 * 
 * Validation robuste des données véhicules avec Zod
 * Assure la qualité et la sécurité des données
 * 
 * @version 1.0.0
 * @since 2025-09-17
 */

import { z } from 'zod';

// ====================================
// 🏭 SCHÉMAS DE BASE VÉHICULES
// ====================================

/**
 * Schéma Zod pour VehicleBrand
 */
export const VehicleBrandSchema = z.object({
  marque_id: z.number().int().positive('ID marque doit être un entier positif'),
  marque_name: z.string().min(1, 'Le nom de la marque est requis').max(100, 'Nom trop long'),
  marque_alias: z.string().max(100, 'Alias trop long').optional(),
  marque_logo: z.string().max(200, 'Nom du fichier logo trop long').optional(), // Changé: accepte les noms de fichiers
  marque_country: z.string().max(50, 'Pays trop long').optional(),
  marque_display: z.number().int().min(0).max(1).optional(),
  products_count: z.number().int().min(0, 'Nombre de produits doit être positif').optional(),
  is_featured: z.boolean().optional()
});

/**
 * Schéma Zod pour VehicleModel
 */
export const VehicleModelSchema = z.object({
  modele_id: z.number().int().positive('ID modèle doit être un entier positif'),
  modele_name: z.string().min(1, 'Le nom du modèle est requis').max(100, 'Nom trop long'),
  modele_alias: z.string().max(100, 'Alias trop long').optional(),
  modele_ful_name: z.string().max(200, 'Nom complet trop long').optional(),
  modele_marque_id: z.number().int().positive('ID marque doit être un entier positif'),
  modele_year_from: z.number().int().min(1900, 'Année trop ancienne').max(2050, 'Année trop future').optional(),
  modele_year_to: z.number().int().min(1900, 'Année trop ancienne').max(2050, 'Année trop future').optional(),
  auto_marque: VehicleBrandSchema.optional()
});

/**
 * Schéma Zod pour VehicleType
 */
export const VehicleTypeSchema = z.object({
  type_id: z.number().int().positive('ID type doit être un entier positif'),
  type_name: z.string().min(1, 'Le nom du type est requis').max(200, 'Nom trop long'),
  type_alias: z.string().max(100, 'Alias trop long').optional(),
  type_engine_code: z.string().max(50, 'Code moteur trop long').optional(),
  type_fuel: z.string().max(50, 'Type carburant trop long').optional(),
  type_power: z.string().max(50, 'Puissance trop longue').optional(),
  type_power_ps: z.number().int().min(0, 'Puissance PS doit être positive').optional(),
  type_power_kw: z.number().int().min(0, 'Puissance kW doit être positive').optional(),
  type_liter: z.string().max(20, 'Cylindrée trop longue').optional(),
  type_year_from: z.string().max(10, 'Année début trop longue').optional(),
  type_year_to: z.union([z.string().max(10, 'Année fin trop longue'), z.null()]).optional(),
  type_engine: z.string().max(100, 'Moteur trop long').optional(),
  type_engine_description: z.string().max(500, 'Description moteur trop longue').optional(),
  type_slug: z.string().max(200, 'Slug trop long').optional(),
  modele_id: z.number().int().positive('ID modèle doit être un entier positif'),
  year_from: z.number().int().min(1900, 'Année trop ancienne').max(2050, 'Année trop future').optional(),
  year_to: z.number().int().min(1900, 'Année trop ancienne').max(2050, 'Année trop future').optional(),
  auto_modele: VehicleModelSchema.optional()
});

// ====================================
// 🔍 SCHÉMAS POUR LES FORMULAIRES
// ====================================

/**
 * Schéma pour la sélection de véhicule
 */
export const VehicleSelectionSchema = z.object({
  brandId: z.number().int().positive('ID marque invalide').optional(),
  year: z.number().int().min(1900, 'Année trop ancienne').max(2050, 'Année trop future').optional(),
  modelId: z.number().int().positive('ID modèle invalide').optional(),
  typeId: z.number().int().positive('ID type invalide').optional(),
  typeSlug: z.string().min(1, 'Slug type requis').optional()
}).refine(
  (data) => {
    // Si un modèle est sélectionné, il faut aussi une marque
    if (data.modelId && !data.brandId) return false;
    // Si un type est sélectionné, il faut aussi un modèle
    if ((data.typeId || data.typeSlug) && !data.modelId) return false;
    return true;
  },
  {
    message: "Sélection de véhicule incohérente : vérifiez l'ordre marque → modèle → type"
  }
);

/**
 * Schéma pour la recherche MINE
 */
export const MineSearchSchema = z.object({
  mine: z.string()
    .min(6, 'Type MINE trop court (minimum 6 caractères)')
    .max(20, 'Type MINE trop long (maximum 20 caractères)')
    .regex(/^[A-Z0-9]+$/, 'Type MINE doit contenir uniquement des lettres majuscules et des chiffres')
});

/**
 * Schéma pour la recherche libre
 */
export const FreeSearchSchema = z.object({
  query: z.string()
    .min(2, 'Recherche trop courte (minimum 2 caractères)')
    .max(100, 'Recherche trop longue (maximum 100 caractères)')
    .trim()
});

/**
 * Schéma pour la recherche VIN
 */
export const VinSearchSchema = z.object({
  vin: z.string()
    .length(17, 'VIN doit contenir exactement 17 caractères')
    .regex(/^[A-HJ-NPR-Z0-9]{17}$/, 'VIN invalide : caractères autorisés A-H, J-N, P-R, S-Z, 0-9')
});

// ====================================
// 🎯 SCHÉMAS POUR LES RÉPONSES API
// ====================================

/**
 * Schéma pour la réponse générique d'API
 */
export const VehicleResponseSchema = <T extends z.ZodType>(dataSchema: T) => z.object({
  data: z.array(dataSchema),
  total: z.number().int().min(0, 'Total doit être positif'),
  page: z.number().int().min(0, 'Page doit être positive'),
  limit: z.number().int().min(1, 'Limite doit être au moins 1'),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
  success: z.boolean()
});

/**
 * Schéma pour la liste des années
 */
export const YearsListSchema = z.array(
  z.number().int().min(1900, 'Année trop ancienne').max(2050, 'Année trop future')
);

// ====================================
// 🛠️ UTILITAIRES DE VALIDATION
// ====================================

/**
 * Valide et nettoie les données d'une marque
 */
export function validateVehicleBrand(data: unknown) {
  return VehicleBrandSchema.parse(data);
}

/**
 * Valide et nettoie les données d'un modèle
 */
export function validateVehicleModel(data: unknown) {
  return VehicleModelSchema.parse(data);
}

/**
 * Valide et nettoie les données d'un type
 */
export function validateVehicleType(data: unknown) {
  return VehicleTypeSchema.parse(data);
}

/**
 * Valide une sélection de véhicule
 */
export function validateVehicleSelection(data: unknown) {
  return VehicleSelectionSchema.parse(data);
}

/**
 * Valide une recherche MINE
 */
export function validateMineSearch(data: unknown) {
  return MineSearchSchema.parse(data);
}

/**
 * Valide une recherche libre
 */
export function validateFreeSearch(data: unknown) {
  return FreeSearchSchema.parse(data);
}

/**
 * Valide un VIN
 */
export function validateVin(data: unknown) {
  return VinSearchSchema.parse(data);
}

/**
 * Valide une liste d'années
 */
export function validateYearsList(data: unknown) {
  return YearsListSchema.parse(data);
}

/**
 * Valide une réponse API de marques
 */
export function validateBrandsResponse(data: unknown) {
  return VehicleResponseSchema(VehicleBrandSchema).parse(data);
}

/**
 * Valide une réponse API de modèles
 */
export function validateModelsResponse(data: unknown) {
  return VehicleResponseSchema(VehicleModelSchema).parse(data);
}

/**
 * Valide une réponse API de types
 */
export function validateTypesResponse(data: unknown) {
  return VehicleResponseSchema(VehicleTypeSchema).parse(data);
}

// ====================================
// 🎨 TYPES INFÉRÉS
// ====================================

export type ValidatedVehicleBrand = z.infer<typeof VehicleBrandSchema>;
export type ValidatedVehicleModel = z.infer<typeof VehicleModelSchema>;
export type ValidatedVehicleType = z.infer<typeof VehicleTypeSchema>;
export type ValidatedVehicleSelection = z.infer<typeof VehicleSelectionSchema>;
export type ValidatedMineSearch = z.infer<typeof MineSearchSchema>;
export type ValidatedFreeSearch = z.infer<typeof FreeSearchSchema>;
export type ValidatedVinSearch = z.infer<typeof VinSearchSchema>;