/**
 * 📋 SCHÉMAS ZOD ADMIN - NestJS-Remix Monorepo
 *
 * Validation pour toutes les opérations admin
 * Compatible avec l'architecture Zod existante
 */

import { z } from 'zod';

// ===== SCHÉMAS STAFF (Migration core/_staff/) =====

export const StaffUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(['ADMIN', 'MANAGER', 'STAFF']),
  level: z.number().int().min(0).max(9),
  isActive: z.boolean(),
  departmentId: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastLoginAt: z.date().optional(),
});

export const CreateStaffUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(['ADMIN', 'MANAGER', 'STAFF']),
  level: z.number().int().min(0).max(9),
  departmentId: z.string().optional(),
  notes: z.string().optional(),
});

export const UpdateStaffUserSchema = CreateStaffUserSchema.partial().extend({
  id: z.string().uuid(),
});

export const StaffQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'STAFF']).optional(),
  isActive: z.boolean().optional(),
  department: z.string().optional(),
});

// ===== SCHÉMAS STOCK (Migration core/_commercial/stock.*) =====

export const StockItemSchema = z.object({
  id: z.string(),
  productId: z.string(),
  reference: z.string(),
  quantity: z.number().int().min(0),
  reservedQuantity: z.number().int().min(0).default(0),
  minThreshold: z.number().int().min(0).default(5),
  maxThreshold: z.number().int().min(0).optional(),
  location: z.string().optional(),
  cost: z.number().min(0).optional(),
  lastUpdated: z.date(),
  updatedBy: z.string().uuid(),
});

export const UpdateStockSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().min(0),
  reason: z.string().min(1),
  notes: z.string().optional(),
});

export const StockMovementSchema = z.object({
  id: z.string().uuid(),
  productId: z.string(),
  type: z.enum(['IN', 'OUT', 'ADJUST', 'TRANSFER']),
  quantity: z.number().int(),
  previousQuantity: z.number().int().min(0),
  newQuantity: z.number().int().min(0),
  reason: z.string(),
  reference: z.string().optional(),
  userId: z.string().uuid(),
  createdAt: z.date(),
});

export const StockQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(50),
  search: z.string().optional(),
  lowStock: z.boolean().optional(),
  category: z.string().optional(),
  location: z.string().optional(),
});

// ===== SCHÉMAS CONFIGURATION ADMIN =====

export const AdminConfigSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  type: z.enum(['STRING', 'NUMBER', 'BOOLEAN', 'JSON']),
  description: z.string().optional(),
  category: z.string().optional(),
  isSystem: z.boolean().default(false),
  updatedBy: z.string().uuid(),
  updatedAt: z.date(),
});

export const UpdateConfigSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  description: z.string().optional(),
});

// ===== SCHÉMAS LOGS ADMIN =====

export const AdminLogSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  action: z.string(),
  resource: z.string(),
  resourceId: z.string().optional(),
  details: z.record(z.string(), z.any()).optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  createdAt: z.date(),
});

export const CreateLogSchema = z.object({
  action: z.string().min(1),
  resource: z.string().min(1),
  resourceId: z.string().optional(),
  details: z.record(z.string(), z.any()).optional(),
});

// ===== SCHÉMAS DASHBOARD =====

export const DashboardStatsSchema = z.object({
  totalUsers: z.number().int().min(0),
  activeUsers: z.number().int().min(0),
  totalOrders: z.number().int().min(0),
  totalRevenue: z.number().min(0),
  lowStockItems: z.number().int().min(0),
  pendingOrders: z.number().int().min(0),
  recentActivity: z.array(AdminLogSchema).max(10),
});

// ===== TYPES TYPESCRIPT =====

export type StaffUser = z.infer<typeof StaffUserSchema>;
export type CreateStaffUser = z.infer<typeof CreateStaffUserSchema>;
export type UpdateStaffUser = z.infer<typeof UpdateStaffUserSchema>;
export type StaffQuery = z.infer<typeof StaffQuerySchema>;

export type StockItem = z.infer<typeof StockItemSchema>;
export type UpdateStock = z.infer<typeof UpdateStockSchema>;
export type StockMovement = z.infer<typeof StockMovementSchema>;
export type StockQuery = z.infer<typeof StockQuerySchema>;

export type AdminConfig = z.infer<typeof AdminConfigSchema>;
export type UpdateConfig = z.infer<typeof UpdateConfigSchema>;

export type AdminLog = z.infer<typeof AdminLogSchema>;
export type CreateLog = z.infer<typeof CreateLogSchema>;

export type DashboardStats = z.infer<typeof DashboardStatsSchema>;

// ===== SCHÉMAS DE RÉPONSE =====

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(
  itemSchema: T,
) =>
  z.object({
    data: z.array(itemSchema),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    totalPages: z.number().int().min(1),
  });

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
