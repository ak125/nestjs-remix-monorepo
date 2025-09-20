/**
 * 🛡️ SCHÉMAS DE VALIDATION ZOD POUR LES CATÉGORIES
 *
 * Définit les schémas de validation pour les endpoints de catégories
 */

import { z } from 'zod';

// ========================================
// 📥 SCHÉMAS D'ENTRÉE (Paramètres)
// ========================================

/**
 * Validation du slug de catégorie
 */
export const CategorySlugSchema = z
  .string()
  .min(2, 'Le slug doit contenir au moins 2 caractères')
  .max(100, 'Le slug ne peut pas dépasser 100 caractères')
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Le slug doit être en minuscules, avec des tirets pour séparer les mots'
  );

// ========================================
// 📤 SCHÉMAS DE SORTIE (Réponses API)
// ========================================

/**
 * Schéma pour une catégorie de base
 */
export const CategoryInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  image: z.string().url().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  productsCount: z.number().int().min(0).optional(),
});

/**
 * Schéma pour un breadcrumb
 */
export const CategoryBreadcrumbSchema = z.object({
  name: z.string(),
  url: z.string(),
});

/**
 * Schéma pour le sélecteur de véhicule
 */
export const CategoryVehicleSelectorSchema = z.object({
  brands: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      logo: z.string().url().optional(),
    })
  ),
  searchByTypemine: z.boolean(),
});

/**
 * Schéma pour un échantillon de produit
 */
export const CategoryProductSampleSchema = z.object({
  id: z.string(),
  reference: z.string(),
  name: z.string(),
  brand: z.string().optional(),
  price: z.number().min(0).optional(),
  image: z.string().url().optional(),
  hasImage: z.boolean(),
});

/**
 * Schéma pour une catégorie liée
 */
export const CategoryRelatedSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().optional(),
  productsCount: z.number().int().min(0).optional(),
  image: z.string().url().optional(),
});

/**
 * Schéma pour les informations techniques
 */
export const CategoryTechnicalInfoSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  order: z.number().int(),
  isMainInfo: z.boolean(),
});

/**
 * Schéma pour les statistiques
 */
export const CategoryStatsSchema = z.object({
  totalProducts: z.number().int().min(0),
  totalBrands: z.number().int().min(0),
  averagePrice: z.number().min(0).optional(),
});

/**
 * Schéma complet pour les données de page catégorie
 */
export const CategoryPageDataSchema = z.object({
  category: CategoryInfoSchema,
  breadcrumbs: z.array(CategoryBreadcrumbSchema),
  vehicleSelector: CategoryVehicleSelectorSchema,
  productsSample: z.array(CategoryProductSampleSchema),
  relatedCategories: z.array(CategoryRelatedSchema),
  technicalInfo: z.array(CategoryTechnicalInfoSchema),
  stats: CategoryStatsSchema,
});

/**
 * Schéma de réponse API complète
 */
export const CategoryApiResponseSchema = z.object({
  success: z.boolean(),
  data: CategoryPageDataSchema,
  message: z.string(),
  meta: z.object({
    timestamp: z.string(),
    slug: z.string(),
    categoryId: z.string(),
    productsCount: z.number().int().min(0),
  }),
});

// ========================================
// 🎯 TYPES TYPESCRIPT INFÉRÉS
// ========================================

export type CategorySlug = z.infer<typeof CategorySlugSchema>;
export type CategoryInfo = z.infer<typeof CategoryInfoSchema>;
export type CategoryPageData = z.infer<typeof CategoryPageDataSchema>;
export type CategoryApiResponse = z.infer<typeof CategoryApiResponseSchema>;