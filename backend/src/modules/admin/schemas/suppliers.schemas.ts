/**
 * 📋 SCHÉMAS FOURNISSEURS - Migration vers NestJS-Remix
 * 
 * Gestion complète des fournisseurs AutoParts
 * Tables: ___xtr_supplier, am_2022_suppliers, ___xtr_supplier_link_pm
 */

import { z } from 'zod';

// ===== SCHÉMAS FOURNISSEURS =====

export const SupplierSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  code: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  website: z.string().url().optional(),
  isActive: z.boolean().default(true),
  rating: z.number().min(1).max(5).optional(),
  paymentTerms: z.string().optional(),
  deliveryTime: z.number().int().min(0).optional(), // jours
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateSupplierSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().default('France'),
  website: z.string().url().optional(),
  paymentTerms: z.string().optional(),
  deliveryTime: z.number().int().min(0).optional(),
  rating: z.number().min(1).max(5).optional(),
});

export const UpdateSupplierSchema = CreateSupplierSchema.partial().extend({
  id: z.string(),
});

export const SupplierQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  country: z.string().optional(),
  isActive: z.boolean().optional(),
  rating: z.number().min(1).max(5).optional(),
  sortBy: z.enum(['name', 'rating', 'createdAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

// ===== SCHÉMAS RELATIONS FOURNISSEUR-PRODUIT =====

export const SupplierProductLinkSchema = z.object({
  id: z.string(),
  supplierId: z.string(),
  productId: z.string(),
  supplierReference: z.string().optional(),
  cost: z.number().min(0).optional(),
  minimumQuantity: z.number().int().min(1).default(1),
  deliveryTime: z.number().int().min(0).optional(),
  isPreferred: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateSupplierProductLinkSchema = z.object({
  supplierId: z.string(),
  productId: z.string(),
  supplierReference: z.string().optional(),
  cost: z.number().min(0).optional(),
  minimumQuantity: z.number().int().min(1).default(1),
  deliveryTime: z.number().int().min(0).optional(),
  isPreferred: z.boolean().default(false),
});

// ===== SCHÉMAS COMMANDES FOURNISSEURS =====

export const SupplierOrderSchema = z.object({
  id: z.string(),
  supplierId: z.string(),
  orderNumber: z.string(),
  status: z.enum(['DRAFT', 'SENT', 'CONFIRMED', 'RECEIVED', 'CANCELLED']),
  orderDate: z.date(),
  expectedDeliveryDate: z.date().optional(),
  actualDeliveryDate: z.date().optional(),
  totalAmount: z.number().min(0),
  notes: z.string().optional(),
  createdBy: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateSupplierOrderSchema = z.object({
  supplierId: z.string(),
  orderNumber: z.string(),
  expectedDeliveryDate: z.date().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().min(1),
    unitCost: z.number().min(0),
  })).min(1),
});

// ===== TYPES TYPESCRIPT =====

export type Supplier = z.infer<typeof SupplierSchema>;
export type CreateSupplier = z.infer<typeof CreateSupplierSchema>;
export type UpdateSupplier = z.infer<typeof UpdateSupplierSchema>;
export type SupplierQuery = z.infer<typeof SupplierQuerySchema>;

export type SupplierProductLink = z.infer<typeof SupplierProductLinkSchema>;
export type CreateSupplierProductLink = z.infer<typeof CreateSupplierProductLinkSchema>;

export type SupplierOrder = z.infer<typeof SupplierOrderSchema>;
export type CreateSupplierOrder = z.infer<typeof CreateSupplierOrderSchema>;

// ===== SCHÉMAS DE STATISTIQUES FOURNISSEURS =====

export const SupplierStatsSchema = z.object({
  totalSuppliers: z.number().int().min(0),
  activeSuppliers: z.number().int().min(0),
  totalOrders: z.number().int().min(0),
  pendingOrders: z.number().int().min(0),
  totalSpent: z.number().min(0),
  averageDeliveryTime: z.number().min(0),
  topSuppliers: z.array(z.object({
    id: z.string(),
    name: z.string(),
    orderCount: z.number().int().min(0),
    totalSpent: z.number().min(0),
    rating: z.number().min(1).max(5).optional(),
  })).max(10),
});

export type SupplierStats = z.infer<typeof SupplierStatsSchema>;
