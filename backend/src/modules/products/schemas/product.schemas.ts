import { z } from 'zod';

/**
 * Schéma Zod pour la création d'un produit automobile
 */
export const CreateProductSchema = z
  .object({
    // Informations de base (obligatoires)
    name: z
      .string()
      .min(1, 'Le nom du produit est requis')
      .max(255, 'Le nom ne peut pas dépasser 255 caractères')
      .trim(),
    sku: z
      .string()
      .min(1, 'Le SKU est requis')
      .max(100, 'Le SKU ne peut pas dépasser 100 caractères')
      .regex(
        /^[A-Z0-9-_]+$/,
        'Le SKU ne peut contenir que des lettres majuscules, chiffres, tirets et underscores',
      )
      .trim(),

    // Informations optionnelles
    description: z
      .string()
      .max(2000, 'La description ne peut pas dépasser 2000 caractères')
      .optional(),

    // Relations (obligatoires)
    range_id: z
      .number()
      .int("L'ID de gamme doit être un entier")
      .positive("L'ID de gamme doit être un entier positif"),
    brand_id: z
      .number()
      .int("L'ID de marque doit être un entier")
      .positive("L'ID de marque doit être un entier positif"),

    // Informations financières
    base_price: z
      .number()
      .positive('Le prix de base doit être positif')
      .max(999999.99, 'Le prix ne peut pas dépasser 999999.99')
      .optional(),

    // Gestion des stocks
    stock_quantity: z
      .number()
      .int('La quantité en stock doit être un entier')
      .min(0, 'La quantité en stock ne peut pas être négative')
      .max(999999, 'La quantité en stock ne peut pas dépasser 999999')
      .optional(),
    min_stock: z
      .number()
      .int('Le stock minimum doit être un entier')
      .min(0, 'Le stock minimum ne peut pas être négatif')
      .max(9999, 'Le stock minimum ne peut pas dépasser 9999')
      .optional(),

    // Informations produit
    barcode: z
      .string()
      .regex(
        /^[0-9]{8,13}$/,
        'Le code-barres doit contenir entre 8 et 13 chiffres',
      )
      .optional(),
    weight: z
      .string()
      .max(50, 'Le poids ne peut pas dépasser 50 caractères')
      .optional(),
    dimensions: z
      .string()
      .max(100, 'Les dimensions ne peuvent pas dépasser 100 caractères')
      .optional(),

    // Statut
    is_active: z.boolean().default(true),

    // Références fournisseur
    supplier_reference: z
      .string()
      .max(100, 'La référence fournisseur ne peut pas dépasser 100 caractères')
      .optional(),

    // Spécifications techniques
    technical_specs: z
      .string()
      .max(
        5000,
        'Les spécifications techniques ne peuvent pas dépasser 5000 caractères',
      )
      .optional(),
    installation_notes: z
      .string()
      .max(
        2000,
        "Les notes d'installation ne peuvent pas dépasser 2000 caractères",
      )
      .optional(),
  })
  .refine(
    (data) => {
      // Validation croisée : si min_stock est défini, stock_quantity doit l'être aussi
      if (data.min_stock !== undefined && data.stock_quantity === undefined) {
        return false;
      }
      return true;
    },
    {
      message:
        'Si le stock minimum est défini, la quantité en stock doit aussi être définie',
      path: ['stock_quantity'],
    },
  )
  .refine(
    (data) => {
      // Validation croisée : min_stock ne peut pas être supérieur à stock_quantity
      if (data.min_stock !== undefined && data.stock_quantity !== undefined) {
        return data.min_stock <= data.stock_quantity;
      }
      return true;
    },
    {
      message: 'Le stock minimum ne peut pas être supérieur au stock actuel',
      path: ['min_stock'],
    },
  );

/**
 * Schéma Zod pour la mise à jour d'un produit
 */
export const UpdateProductSchema = CreateProductSchema.partial();

/**
 * Schéma Zod amélioré pour la recherche de produits
 */
export const SearchProductSchema = z
  .object({
    // Critères de recherche
    search: z
      .string()
      .max(100, 'Le terme de recherche ne peut pas dépasser 100 caractères')
      .optional(),
    rangeId: z
      .number()
      .int("L'ID de gamme doit être un entier")
      .positive("L'ID de gamme doit être positif")
      .optional(),
    brandId: z
      .number()
      .int("L'ID de marque doit être un entier")
      .positive("L'ID de marque doit être positif")
      .optional(),

    // Filtres de prix
    minPrice: z
      .number()
      .positive('Le prix minimum doit être positif')
      .max(999999.99, 'Le prix minimum ne peut pas dépasser 999999.99')
      .optional(),
    maxPrice: z
      .number()
      .positive('Le prix maximum doit être positif')
      .max(999999.99, 'Le prix maximum ne peut pas dépasser 999999.99')
      .optional(),

    // Pagination
    page: z
      .number()
      .int('La page doit être un entier')
      .min(0, 'La page ne peut pas être négative')
      .max(1000, 'La page ne peut pas dépasser 1000')
      .default(0)
      .optional(),
    limit: z
      .number()
      .int('La limite doit être un entier')
      .min(1, 'La limite doit être au moins 1')
      .max(100, 'La limite ne peut pas dépasser 100')
      .default(50)
      .optional(),

    // Tri
    sortBy: z
      .enum([
        'name',
        'sku',
        'price',
        'stock_quantity',
        'created_at',
        'updated_at',
      ])
      .default('name')
      .optional(),
    sortOrder: z.enum(['asc', 'desc']).default('asc').optional(),

    // Statut
    isActive: z.boolean().default(true).optional(),

    // Stock
    inStock: z.boolean().optional(),
    lowStock: z.boolean().optional(),
  })
  .refine(
    (data) => {
      // Validation croisée : minPrice ne peut pas être supérieur à maxPrice
      if (data.minPrice !== undefined && data.maxPrice !== undefined) {
        return data.minPrice <= data.maxPrice;
      }
      return true;
    },
    {
      message: 'Le prix minimum ne peut pas être supérieur au prix maximum',
      path: ['maxPrice'],
    },
  );

/**
 * Schéma Zod pour la mise à jour du stock
 */
export const UpdateStockSchema = z.object({
  quantity: z
    .number()
    .int('La quantité doit être un entier')
    .min(0, 'La quantité doit être positive ou nulle')
    .max(999999, 'La quantité ne peut pas dépasser 999999'),
  min_stock: z
    .number()
    .int('Le stock minimum doit être un entier')
    .min(0, 'Le stock minimum ne peut pas être négatif')
    .max(9999, 'Le stock minimum ne peut pas dépasser 9999')
    .optional(),
});

/**
 * Schéma Zod pour le filtrage des produits populaires
 */
export const PopularProductsSchema = z.object({
  limit: z
    .number()
    .int('La limite doit être un entier')
    .min(1, 'La limite doit être au moins 1')
    .max(100, 'La limite ne peut pas dépasser 100')
    .default(10)
    .optional(),
  days: z
    .number()
    .int('Le nombre de jours doit être un entier')
    .min(1, 'Le nombre de jours doit être au moins 1')
    .max(365, 'Le nombre de jours ne peut pas dépasser 365')
    .default(30)
    .optional(),
});

/**
 * Types TypeScript dérivés des schémas Zod
 */
export type CreateProductDto = z.infer<typeof CreateProductSchema>;
export type UpdateProductDto = z.infer<typeof UpdateProductSchema>;
export type SearchProductDto = z.infer<typeof SearchProductSchema>;
export type UpdateStockDto = z.infer<typeof UpdateStockSchema>;
export type PopularProductsDto = z.infer<typeof PopularProductsSchema>;

/**
 * Schémas pour les réponses API
 */
export const ProductResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string(),
  description: z.string().nullable(),
  range_id: z.number(),
  brand_id: z.number(),
  base_price: z.number().nullable(),
  stock_quantity: z.number().nullable(),
  min_stock: z.number().nullable(),
  barcode: z.string().nullable(),
  weight: z.string().nullable(),
  dimensions: z.string().nullable(),
  is_active: z.boolean(),
  supplier_reference: z.string().nullable(),
  technical_specs: z.string().nullable(),
  installation_notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const PaginatedProductsResponseSchema = z.object({
  data: z.array(ProductResponseSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

export type ProductResponse = z.infer<typeof ProductResponseSchema>;
export type PaginatedProductsResponse = z.infer<
  typeof PaginatedProductsResponseSchema
>;

// ========== SCHÉMAS COMPATIBILITÉ VÉHICULES ==========

/**
 * Schéma pour la compatibilité véhicule (parité avec AUTO_TYPE, prod_relation_auto)
 */
export const VehicleCompatibilitySchema = z.object({
  product_id: z
    .number()
    .int('ID produit doit être un entier')
    .positive('ID produit doit être positif'),
  brand_id: z
    .number()
    .int('ID marque doit être un entier')
    .positive('ID marque véhicule invalide'),
  model_id: z
    .number()
    .int('ID modèle doit être un entier')
    .positive('ID modèle véhicule invalide'),
  type_id: z
    .number()
    .int('ID type doit être un entier')
    .positive('ID type véhicule invalide')
    .optional(),

  // Informations moteur (AUTO_TYPE_MOTOR_*)
  motor_code: z
    .string()
    .max(50, 'Code moteur trop long')
    .regex(/^[A-Z0-9\-\s]+$/i, 'Format code moteur invalide')
    .optional(),
  fuel_type: z
    .enum(['essence', 'diesel', 'hybride', 'electrique', 'gpl', 'hydrogene'])
    .optional(),
  power_hp: z
    .number()
    .int('Puissance CV doit être un entier')
    .min(0, 'Puissance CV ne peut être négative')
    .max(2000, 'Puissance CV trop élevée')
    .optional(),
  power_kw: z
    .number()
    .int('Puissance kW doit être un entier')
    .min(0, 'Puissance kW ne peut être négative')
    .max(1500, 'Puissance kW trop élevée')
    .optional(),
  engine_volume: z
    .number()
    .min(0.1, 'Cylindrée minimum 0.1L')
    .max(20, 'Cylindrée maximum 20L')
    .optional(),

  // Années de compatibilité
  year_from: z
    .number()
    .int('Année début doit être un entier')
    .min(1900, 'Année début trop ancienne')
    .max(new Date().getFullYear() + 2, 'Année début trop future'),
  year_to: z
    .number()
    .int('Année fin doit être un entier')
    .min(1900, 'Année fin trop ancienne')
    .max(new Date().getFullYear() + 10, 'Année fin trop future')
    .optional(),

  // Position/spécificités
  position: z
    .enum(['avant', 'arriere', 'gauche', 'droite', 'tous'])
    .default('tous'),

  // Notes spécifiques
  compatibility_notes: z
    .string()
    .max(500, 'Notes de compatibilité trop longues')
    .optional(),

  // Métadonnées
  is_confirmed: z.boolean().default(false),
  created_at: z.date().default(() => new Date()),
  updated_at: z.date().default(() => new Date()),
});

/**
 * Recherche de véhicules compatible
 */
export const VehicleSearchSchema = z.object({
  brand_id: z.number().int().positive().optional(),
  model_id: z.number().int().positive().optional(),
  type_id: z.number().int().positive().optional(),
  year: z
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear() + 1)
    .optional(),
  fuel_type: VehicleCompatibilitySchema.shape.fuel_type.optional(),
  power_min: z.number().int().min(0).optional(),
  power_max: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  page: z.number().int().min(1).default(1),
});

// ========== SCHÉMAS RÉFÉRENCES OEM ==========

/**
 * Schéma pour les références OEM (parité avec PIECES_REF_OEM)
 */
export const ProductOEMReferenceSchema = z.object({
  product_id: z
    .number()
    .int('ID produit doit être un entier')
    .positive('ID produit doit être positif'),
  oem_number: z
    .string()
    .min(3, 'Référence OEM trop courte')
    .max(100, 'Référence OEM trop longue')
    .regex(/^[A-Z0-9\-_\/\s\.]+$/i, 'Format référence OEM invalide')
    .transform((val) => val.toUpperCase().trim()),
  manufacturer: z
    .string()
    .min(1, 'Constructeur requis')
    .max(100, 'Nom constructeur trop long'),
  manufacturer_code: z
    .string()
    .max(10, 'Code constructeur trop long')
    .optional(),
  is_primary: z.boolean().default(false),
  is_superseded: z.boolean().default(false),
  superseded_by: z
    .string()
    .max(100, 'Référence de remplacement trop longue')
    .optional(),
  notes: z.string().max(255, 'Notes trop longues').optional(),
  quality: z
    .enum(['origine', 'equivalent', 'aftermarket'])
    .default('equivalent'),
  created_at: z.date().default(() => new Date()),
  updated_at: z.date().default(() => new Date()),
});

/**
 * Recherche par référence OEM
 */
export const OEMSearchSchema = z.object({
  oem_number: z
    .string()
    .min(3, 'Référence OEM trop courte pour la recherche')
    .transform((val) => val.toUpperCase().trim()),
  manufacturer: z.string().optional(),
  exact_match: z.boolean().default(false),
  include_superseded: z.boolean().default(false),
  quality: ProductOEMReferenceSchema.shape.quality.optional(),
  limit: z.number().int().min(1).max(100).default(20),
  page: z.number().int().min(1).default(1),
});

// ========== SCHÉMAS CRITÈRES PRODUITS ==========

/**
 * Schéma pour les critères produits (parité avec PIECES_CRITERIA)
 */
export const ProductCriteriaSchema = z.object({
  product_id: z
    .number()
    .int('ID produit doit être un entier')
    .positive('ID produit doit être positif'),
  criteria_type: z.enum([
    // Dimensions
    'longueur',
    'largeur',
    'hauteur',
    'epaisseur',
    'diametre',
    'diametre_interieur',
    'diametre_exterieur',
    // Caractéristiques physiques
    'poids',
    'volume',
    'couleur',
    'materiau',
    'finition',
    // Positionnement
    'position',
    'cote_montage',
    'sens_montage',
    // Électrique
    'tension',
    'intensite',
    'puissance',
    'resistance',
    // Spécifique automobile
    'nombre_trous',
    'entraxe',
    'pas_de_vis',
    'couple_serrage',
    // Performance
    'temperature_min',
    'temperature_max',
    'pression_max',
    // Compatibilité
    'norme',
    'certification',
    'classe',
  ]),
  criteria_value: z
    .string()
    .min(1, 'Valeur critère requise')
    .max(100, 'Valeur critère trop longue'),
  unit: z
    .string()
    .max(10, 'Unité trop longue')
    .regex(/^[a-zA-Z°%\/²³\s\-]+$/, 'Format unité invalide')
    .optional(), // mm, cm, kg, V, A, W, °C, bar, Nm, etc.
  numeric_value: z.number().optional(), // Valeur numérique pour comparaisons
  tolerance: z.string().max(20, 'Tolérance trop longue').optional(), // ±0.1, +0/-0.05, etc.

  // Métadonnées
  is_searchable: z.boolean().default(true),
  is_filterable: z.boolean().default(true),
  is_comparable: z.boolean().default(false),
  display_order: z.number().int().min(0).default(0),

  created_at: z.date().default(() => new Date()),
  updated_at: z.date().default(() => new Date()),
});

/**
 * Recherche par critères
 */
export const CriteriaSearchSchema = z.object({
  criteria_type: ProductCriteriaSchema.shape.criteria_type.optional(),
  criteria_value: z.string().optional(),
  numeric_min: z.number().optional(),
  numeric_max: z.number().optional(),
  unit: z.string().optional(),
  exact_match: z.boolean().default(false),
  limit: z.number().int().min(1).max(100).default(20),
  page: z.number().int().min(1).default(1),
});

// ========== TYPES AVANCÉS EXPORTS ==========

export type VehicleCompatibilityDto = z.infer<
  typeof VehicleCompatibilitySchema
>;
export type VehicleSearchDto = z.infer<typeof VehicleSearchSchema>;
export type ProductOEMReferenceDto = z.infer<typeof ProductOEMReferenceSchema>;
export type OEMSearchDto = z.infer<typeof OEMSearchSchema>;
export type ProductCriteriaDto = z.infer<typeof ProductCriteriaSchema>;
export type CriteriaSearchDto = z.infer<typeof CriteriaSearchSchema>;
