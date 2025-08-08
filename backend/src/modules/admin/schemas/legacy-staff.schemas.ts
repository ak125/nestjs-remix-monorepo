/**
 * 📋 SCHÉMAS ZOD STAFF LEGACY - Module Admin
 *
 * Schemas pour la table ___config_admin (legacy PHP)
 * Migration des interfaces existantes vers Zod
 */

import { z } from 'zod';

// ===== SCHÉMA LEGACY TABLE ___config_admin =====

export const LegacyAdminStaffSchema = z.object({
  cnfa_id: z.preprocess(
    (val) => (typeof val === 'string' ? parseInt(val, 10) : val),
    z.number().int().positive(),
  ),
  cnfa_login: z.string().min(3).max(50),
  cnfa_pswd: z.string(), // Hash bcrypt
  cnfa_mail: z.string().email(),
  cnfa_keylog: z.string(),
  cnfa_level: z.preprocess(
    (val) => (typeof val === 'string' ? parseInt(val, 10) : val),
    z.number().int().min(1).max(9),
  ),
  cnfa_job: z.string().max(100),
  cnfa_name: z.string().max(50), // Nom de famille
  cnfa_fname: z.string().max(50), // Prénom
  cnfa_tel: z.string().max(20),
  cnfa_activ: z.enum(['0', '1']), // Legacy string boolean
  s_id: z.string().max(20).optional().nullable(),
});

export const CreateLegacyStaffSchema = z.object({
  login: z.string().min(3).max(50),
  password: z.string().min(6),
  email: z.string().email(),
  level: z.number().int().min(1).max(9),
  job: z.string().max(100),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  phone: z.string().max(20),
  departmentId: z.string().max(20).optional(),
});

export const UpdateLegacyStaffSchema = z.object({
  id: z.number().int().positive(),
  login: z.string().min(3).max(50).optional(),
  email: z.string().email().optional(),
  level: z.number().int().min(1).max(9).optional(),
  job: z.string().max(100).optional(),
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  phone: z.string().max(20).optional(),
});

export const LegacyStaffQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  level: z.number().int().min(1).max(9).optional(),
  isActive: z.boolean().optional(),
  department: z.string().optional(),
});

export const LegacyStaffStatsSchema = z.object({
  total: z.number().int().min(0),
  active: z.number().int().min(0),
  inactive: z.number().int().min(0),
  byLevel: z.record(z.string(), z.number().int().min(0)),
});

export const StaffPermissionsSchema = z.object({
  level: z.number().int().min(1).max(9),
  permissions: z.array(z.string()),
});

export const SuperAdminCreationSchema = z.object({
  login: z.string().min(3).max(50),
  email: z.string().email(),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  phone: z.string().max(20),
});

// ===== TYPES TYPESCRIPT =====

export type LegacyAdminStaff = z.infer<typeof LegacyAdminStaffSchema>;
export type CreateLegacyStaff = z.infer<typeof CreateLegacyStaffSchema>;
export type UpdateLegacyStaff = z.infer<typeof UpdateLegacyStaffSchema>;
export type LegacyStaffQuery = z.infer<typeof LegacyStaffQuerySchema>;
export type LegacyStaffStats = z.infer<typeof LegacyStaffStatsSchema>;
export type StaffPermissions = z.infer<typeof StaffPermissionsSchema>;
export type SuperAdminCreation = z.infer<typeof SuperAdminCreationSchema>;

// ===== UTILITAIRES DE CONVERSION =====

/**
 * Convertit les données legacy vers le format moderne
 */
export const convertLegacyToModern = (legacy: LegacyAdminStaff) => ({
  id: legacy.cnfa_id.toString(),
  email: legacy.cnfa_mail,
  firstName: legacy.cnfa_fname,
  lastName: legacy.cnfa_name,
  role:
    legacy.cnfa_level >= 9
      ? 'ADMIN'
      : legacy.cnfa_level >= 8
        ? 'MANAGER'
        : 'STAFF',
  level: legacy.cnfa_level,
  isActive: legacy.cnfa_activ === '1',
  departmentId: legacy.s_id,
  notes: legacy.cnfa_job,
  createdAt: new Date(),
  updatedAt: new Date(),
});

/**
 * Permissions par niveau selon l'analyse PHP legacy
 */
export const STAFF_PERMISSIONS_MAP: Record<number, string[]> = {
  1: ['view_basic'],
  2: ['view_basic', 'view_orders'],
  3: ['view_basic', 'view_orders', 'manage_customers'],
  4: ['view_basic', 'view_orders', 'manage_customers', 'view_stats'],
  5: [
    'view_basic',
    'view_orders',
    'manage_customers',
    'view_stats',
    'manage_products',
  ],
  6: [
    'view_basic',
    'view_orders',
    'manage_customers',
    'view_stats',
    'manage_products',
    'manage_inventory',
  ],
  7: [
    'view_orders',
    'manage_customers',
    'view_stats',
    'manage_products',
    'manage_inventory',
  ],
  8: [
    'view_orders',
    'manage_customers',
    'view_stats',
    'manage_products',
    'manage_inventory',
    'manage_staff_level_7',
    'advanced_settings',
  ],
  9: [
    'view_orders',
    'manage_customers',
    'view_stats',
    'manage_products',
    'manage_inventory',
    'manage_staff_level_7',
    'manage_staff_level_8',
    'advanced_settings',
    'super_admin_tools',
    'payment_management',
    'system_settings',
  ],
};

/**
 * Niveaux d'accès selon l'analyse PHP
 */
export const STAFF_LEVELS = {
  BASIC: 1,
  OPERATOR: 2,
  CUSTOMER_SERVICE: 3,
  SUPERVISOR: 4,
  MANAGER: 5,
  SENIOR_MANAGER: 6,
  COMMERCIAL_ADMIN: 7,
  SYSTEM_ADMIN: 8,
  SUPER_ADMIN: 9,
} as const;

/**
 * Descriptions des niveaux
 */
export const STAFF_LEVEL_DESCRIPTIONS: Record<number, string> = {
  1: 'Utilisateur de base',
  2: 'Opérateur',
  3: 'Service client',
  4: 'Superviseur',
  5: 'Manager',
  6: 'Manager senior',
  7: 'Admin commercial',
  8: 'Admin système',
  9: 'Super administrateur',
};
