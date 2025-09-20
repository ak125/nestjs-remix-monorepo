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
