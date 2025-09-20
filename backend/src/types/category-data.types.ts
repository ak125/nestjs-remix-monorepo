/**
 * 🗂️ STRUCTURE DES DONNÉES CATÉGORIE
 * 
 * Définit toutes les données à récupérer dynamiquement pour une page de catégorie
 */

import { z } from 'zod';

// 🔧 Schéma pour les informations de base de la catégorie
export const CategoryBaseSchema = z.object({
  id: z.string(),
  name: z.string(), // "Filtre à huile"
  slug: z.string(), // "filtre-a-huile"
  description: z.string(), // Description principale
  shortDescription: z.string().optional(),
  seoTitle: z.string(),
  seoDescription: z.string(),
  image: z.string().url().optional(),
  parentId: z.string().optional(), // Pour les sous-catégories
});

// 🚗 Schéma pour le sélecteur de véhicule
export const VehicleSelectorSchema = z.object({
  brands: z.array(z.object({
    id: z.string(),
    name: z.string(), // "RENAULT", "PEUGEOT"
    logo: z.string().url().optional(),
  })),
  searchByTypemine: z.boolean().default(true),
});

// 📰 Schéma pour l'article/blog associé
export const CategoryArticleSchema = z.object({
  id: z.string(),
  title: z.string(), // "Comment changer un filtre à huile"
  slug: z.string(),
  publishedAt: z.string(), // "07/06/2021"
  content: z.string(), // Contenu HTML de l'article
  excerpt: z.string(), // Extrait pour l'aperçu
  readTime: z.number().optional(), // Temps de lecture en minutes
});

// 🔗 Schéma pour les catégories liées
export const RelatedCategorySchema = z.object({
  id: z.string(),
  name: z.string(), // "Filtre à air", "Filtre à carburant"
  slug: z.string(),
  description: z.string(),
  image: z.string().url().optional(),
  advice: z.string(), // Conseil Automecanik
});

// 🚗 Schéma pour les motorisations populaires
export const PopularMotorizationSchema = z.object({
  id: z.string(),
  brand: z.string(), // "RENAULT"
  model: z.string(), // "CLIO III"
  engine: z.string(), // "1.5 dCi"
  power: z.number(), // 86
  unit: z.string().default('ch'), // "ch"
  pricePrefix: z.string(), // "prix bas", "tarif réduit"
  symptoms: z.array(z.string()), // ["changer si encrassé", "contrôler si témoin allumé"]
  description: z.string(), // Description technique
  productCount: z.number().optional(), // Nombre de produits disponibles
});

// 🏭 Schéma pour les équipementiers
export const EquipmentierSchema = z.object({
  id: z.string(),
  name: z.string(), // "BOSCH", "CHAMPION"
  logo: z.string().url().optional(),
  description: z.string(), // Description des produits de la marque
  qualityLevel: z.enum(['OEM', 'Premium', 'Standard']).optional(),
  technologies: z.array(z.string()).optional(), // Technologies spéciales
});

// 📚 Schéma pour les informations techniques
export const TechnicalInfoSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  order: z.number(), // Pour l'ordre d'affichage
  isMainInfo: z.boolean().default(false), // Information principale
});

// 🎯 Schéma principal pour une page de catégorie complète
export const CategoryPageDataSchema = z.object({
  // Informations de base
  category: CategoryBaseSchema,
  
  // Sélecteur de véhicule
  vehicleSelector: VehicleSelectorSchema,
  
  // Article/blog associé
  article: CategoryArticleSchema.optional(),
  
  // Catégories liées (catalogue)
  relatedCategories: z.array(RelatedCategorySchema),
  
  // Motorisations populaires
  popularMotorizations: z.array(PopularMotorizationSchema),
  
  // Équipementiers
  equipmentiers: z.array(EquipmentierSchema),
  
  // Informations techniques
  technicalInfo: z.array(TechnicalInfoSchema),
  
  // Métadonnées SEO
  seo: z.object({
    canonicalUrl: z.string().url(),
    breadcrumbs: z.array(z.object({
      name: z.string(),
      url: z.string(),
    })),
    alternateUrls: z.array(z.object({
      lang: z.string(),
      url: z.string(),
    })).optional(),
  }),
  
  // Statistiques et métriques
  stats: z.object({
    totalProducts: z.number(),
    totalBrands: z.number(),
    totalVehicles: z.number(),
    avgPrice: z.number().optional(),
    lastUpdated: z.string(),
  }).optional(),
});

// 📊 Types TypeScript dérivés
export type CategoryBaseData = z.infer<typeof CategoryBaseSchema>;
export type VehicleSelectorData = z.infer<typeof VehicleSelectorSchema>;
export type CategoryArticleData = z.infer<typeof CategoryArticleSchema>;
export type RelatedCategoryData = z.infer<typeof RelatedCategorySchema>;
export type PopularMotorizationData = z.infer<typeof PopularMotorizationSchema>;
export type EquipmentierData = z.infer<typeof EquipmentierSchema>;
export type TechnicalInfoData = z.infer<typeof TechnicalInfoSchema>;
export type CategoryPageData = z.infer<typeof CategoryPageDataSchema>;

// 🔍 Schémas pour les requêtes et filtres
export const CategoryQuerySchema = z.object({
  slug: z.string(),
  includeRelated: z.boolean().default(true),
  includeMotorizations: z.boolean().default(true),
  includeEquipmentiers: z.boolean().default(true),
  includeTechnicalInfo: z.boolean().default(true),
  includeStats: z.boolean().default(false),
  limit: z.number().min(1).max(100).default(20), // Pour paginer les motorisations
  offset: z.number().min(0).default(0),
});

export type CategoryQueryParams = z.infer<typeof CategoryQuerySchema>;