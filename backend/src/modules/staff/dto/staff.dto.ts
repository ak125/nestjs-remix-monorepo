import { z } from 'zod';

/**
 * 🎯 DTOs pour le PERSONNEL ADMINISTRATIF (table ___config_admin)
 *
 * IMPORTANT: Staff = Employés de la société (pas les clients)
 */

// Schema de base pour un membre du staff
export const StaffSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  level: z.number().min(7).max(9).default(7), // 7-9 pour staff/admin
  job: z.string().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// Schema pour créer un nouveau membre du staff
export const CreateStaffSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  level: z.enum(['7', '8', '9']).default('7').transform(Number),
  job: z.string().optional(),
});

// Schema pour mettre à jour un membre du staff
export const UpdateStaffSchema = StaffSchema.partial().omit({ id: true });

// Schema pour les filtres de recherche staff
export const StaffFiltersSchema = z.object({
  search: z.string().optional(),
  level: z.number().min(7).max(9).optional(),
  isActive: z.boolean().optional(),
  job: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

// Types exportés
export type Staff = z.infer<typeof StaffSchema>;
export type CreateStaffDto = z.infer<typeof CreateStaffSchema>;
export type UpdateStaffDto = z.infer<typeof UpdateStaffSchema>;
export type StaffFilters = z.infer<typeof StaffFiltersSchema>;

// Response paginée
export interface PaginatedStaff {
  data: Staff[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Niveaux staff avec descriptions
export const StaffLevels = {
  7: 'Admin Commercial',
  8: 'Admin Système',
  9: 'Super Admin',
} as const;
