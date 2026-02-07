/**
 * DTOs pour la gestion des stocks
 * Compatible avec l'architecture Zod du projet
 */

import { z } from 'zod';
import {
  DomainValidationException,
  ErrorCodes,
} from '../../../common/exceptions';

// =====================================
// SCHEMAS STOCK MANAGEMENT
// =====================================

/**
 * Schema pour les filtres du dashboard stock
 */
export const StockDashboardFiltersSchema = z.object({
  search: z.string().optional(),
  minStock: z.boolean().optional(),
  outOfStock: z.boolean().optional(),
  supplierId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
});

/**
 * Schema pour la mise à jour du stock
 */
export const UpdateStockSchema = z.object({
  quantity: z.number().min(0).optional(),
  minStock: z.number().min(0).optional(),
  maxStock: z.number().min(0).optional(),
  location: z.string().max(255).optional(),
  nextRestockDate: z.date().optional(),
  reason: z.string().min(1, 'Le motif est obligatoire').max(500),
});

/**
 * Schema pour la désactivation de produit
 */
export const DisableProductSchema = z.object({
  reason: z
    .string()
    .min(1, 'Le motif de désactivation est obligatoire')
    .max(500),
});

/**
 * Schema pour la réservation/libération de stock
 */
export const ReserveStockSchema = z.object({
  quantity: z.number().min(1, 'La quantité doit être positive'),
  orderId: z.string().min(1, 'ID commande obligatoire'),
});

/**
 * Schema pour les mouvements de stock
 */
export const StockMovementTypeSchema = z.enum([
  'IN',
  'OUT',
  'ADJUSTMENT',
  'RETURN',
]);

export const CreateStockMovementSchema = z.object({
  productId: z.string().uuid('ID produit invalide'),
  type: StockMovementTypeSchema,
  quantity: z.number().min(1, 'La quantité doit être positive'),
  reason: z.string().min(1, 'Le motif est obligatoire').max(500),
  orderId: z.string().optional(),
  userId: z.string().uuid('ID utilisateur invalide'),
});

/**
 * Schema pour l'ajout de référence produit
 */
export const AddReferenceSchema = z.object({
  reference: z.string().min(1, 'La référence est obligatoire').max(100),
  type: z.enum(['SKU', 'EAN', 'UPC', 'INTERNAL']),
  description: z.string().max(255).optional(),
  isMain: z.boolean().default(false),
});

// =====================================
// TYPES TYPESCRIPT DÉRIVÉS
// =====================================

export type StockDashboardFilters = z.infer<typeof StockDashboardFiltersSchema>;
export type UpdateStockDto = z.infer<typeof UpdateStockSchema>;
export type DisableProductDto = z.infer<typeof DisableProductSchema>;
export type ReserveStockDto = z.infer<typeof ReserveStockSchema>;
export type StockMovementType = z.infer<typeof StockMovementTypeSchema>;
export type CreateStockMovementDto = z.infer<typeof CreateStockMovementSchema>;
export type AddReferenceDto = z.infer<typeof AddReferenceSchema>;

// =====================================
// PIPES DE VALIDATION ZOD
// =====================================

/**
 * Pipe pour valider les données d'entrée avec Zod
 */
export const createZodValidationPipe = (schema: z.ZodSchema) => {
  return {
    transform: (value: any) => {
      try {
        return schema.parse(value);
      } catch (error) {
        if (error instanceof z.ZodError) {
          const errorMessage = error.issues
            .map((err: any) => `${err.path.join('.')}: ${err.message}`)
            .join(', ');
          throw new DomainValidationException({
            code: ErrorCodes.VALIDATION.FAILED,
            message: `Validation error: ${errorMessage}`,
            details: errorMessage,
          });
        }
        throw error;
      }
    },
  };
};
