/**
 * Schémas Zod pour le module Suppliers
 * Aligné sur l'architecture des autres modules (orders, messages, etc.)
 */

import { z } from 'zod';

// Schéma principal pour un fournisseur
export const SupplierSchema = z.object({
  id: z.number().optional(),
  code: z.string().min(1, 'Le code fournisseur est requis'),
  name: z.string().min(1, 'Le nom du fournisseur est requis'),
  companyName: z.string().optional(),
  siret: z.string().optional(),
  vatNumber: z.string().optional(),
  address1: z.string().optional(),
  address2: z.string().optional(),
  zipCode: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  fax: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  contactPerson: z.string().optional(),
  paymentTerms: z.string().optional(),
  deliveryTerms: z.string().optional(),
  minimumOrderAmount: z.number().optional(),
  isActive: z.boolean().default(true),
  notes: z.string().optional(),
});

// Schéma pour créer un fournisseur
export const CreateSupplierSchema = SupplierSchema.omit({ id: true });

// Schéma pour mettre à jour un fournisseur
export const UpdateSupplierSchema = SupplierSchema.partial().omit({ id: true });

// Schéma pour les filtres de recherche
export const SupplierFiltersSchema = z.object({
  search: z.string().optional(),
  isActive: z.boolean().optional(),
  country: z.string().optional(),
  hasEmail: z.boolean().optional(),
  hasWebsite: z.boolean().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
});

// Types TypeScript dérivés des schémas
export type Supplier = z.infer<typeof SupplierSchema>;
export type CreateSupplierDto = z.infer<typeof CreateSupplierSchema>;
export type UpdateSupplierDto = z.infer<typeof UpdateSupplierSchema>;
export type SupplierFilters = z.infer<typeof SupplierFiltersSchema>;

// Fonctions de validation
export const validateCreateSupplier = (data: unknown) =>
  CreateSupplierSchema.parse(data);
export const validateUpdateSupplier = (data: unknown) =>
  UpdateSupplierSchema.parse(data);
export const validateSupplierFilters = (data: unknown) =>
  SupplierFiltersSchema.parse(data);
