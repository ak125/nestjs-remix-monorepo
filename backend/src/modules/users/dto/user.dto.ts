/**
 * 📦 DTOs Utilisateurs Consolidés
 * Version unique sans redondance
 */

import { z } from 'zod';

// ============================================================================
// SCHEMAS ZOD - Validation
// ============================================================================

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional().default('France'),
  isPro: z.boolean().default(false),
  isCompany: z.boolean().default(false),
  isActive: z.boolean().default(true),
  level: z.number().int().min(1).max(10).default(1),
  civility: z.enum(['M', 'Mme', 'Autre']).optional(),
  companyName: z.string().optional(),
  siret: z.string().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  lastLoginAt: z.date().optional(),
});

export const CreateUserSchema = UserSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
}).extend({
  password: z
    .string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
});

export const UpdateUserSchema = UserSchema.omit({
  id: true,
  createdAt: true,
}).partial();

export const UserFiltersSchema = z.object({
  search: z.string().optional(),
  status: z.enum(['active', 'inactive', '']).optional(),
  userType: z.enum(['pro', 'company', 'individual', '']).optional(),
  level: z.number().int().min(1).max(10).optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  sortBy: z.string().default('email'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

// ============================================================================
// TYPES TYPESCRIPT
// ============================================================================

export type User = z.infer<typeof UserSchema>;
export type CreateUserDto = z.infer<typeof CreateUserSchema>;
export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;
export type UserFilters = z.infer<typeof UserFiltersSchema>;

export interface PaginatedUsers {
  users: User[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface UserStats {
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  lastOrderDate?: Date;
  favoriteCategories?: string[];
}

export interface UserWithStats extends User {
  stats: UserStats;
}

// ============================================================================
// MAPPERS - Supabase ↔ DTO
// ============================================================================

/**
 * Mapper Supabase → DTO
 */
export function mapSupabaseToUser(data: any): User {
  return {
    id: data.cst_id,
    email: data.cst_mail,
    firstName: data.cst_fname || undefined,
    lastName: data.cst_name || undefined,
    phone: data.cst_tel || data.cst_gsm || undefined,
    address: data.cst_address || undefined,
    city: data.cst_city || undefined,
    zipCode: data.cst_zip_code || undefined,
    country: data.cst_country || 'France',
    isPro: data.cst_is_pro === '1' || data.cst_level >= 5,
    isCompany: data.cst_is_cpy === '1',
    isActive: data.cst_activ === '1',
    level: parseInt(data.cst_level) || 1,
    civility: data.cst_civility || undefined,
    companyName: data.cst_rs || undefined,
    siret: data.cst_siret || undefined,
    createdAt: data.cst_created_at ? new Date(data.cst_created_at) : undefined,
    updatedAt: data.cst_updated_at ? new Date(data.cst_updated_at) : undefined,
    lastLoginAt: data.cst_last_login
      ? new Date(data.cst_last_login)
      : undefined,
  };
}

/**
 * Mapper DTO → Supabase
 */
export function mapUserToSupabase(
  user: Partial<CreateUserDto | UpdateUserDto>,
): Record<string, string> {
  const mapped: Record<string, string> = {};

  if (user.email !== undefined) mapped.cst_mail = user.email;
  if (user.firstName !== undefined) mapped.cst_fname = user.firstName;
  if (user.lastName !== undefined) mapped.cst_name = user.lastName;
  if (user.phone !== undefined) mapped.cst_tel = user.phone;
  if (user.address !== undefined) mapped.cst_address = user.address;
  if (user.city !== undefined) mapped.cst_city = user.city;
  if (user.zipCode !== undefined) mapped.cst_zip_code = user.zipCode;
  if (user.country !== undefined) mapped.cst_country = user.country;
  if (user.isPro !== undefined) mapped.cst_is_pro = user.isPro ? '1' : '0';
  if (user.isCompany !== undefined)
    mapped.cst_is_cpy = user.isCompany ? '1' : '0';
  if (user.isActive !== undefined) mapped.cst_activ = user.isActive ? '1' : '0';
  if (user.level !== undefined) mapped.cst_level = user.level.toString();
  if (user.civility !== undefined) mapped.cst_civility = user.civility;
  if (user.companyName !== undefined) mapped.cst_rs = user.companyName;
  if (user.siret !== undefined) mapped.cst_siret = user.siret;

  return mapped;
}

// ============================================================================
// VALIDATIONS
// ============================================================================

/**
 * Valider un email
 */
export function isValidEmail(email: string): boolean {
  const result = z.string().email().safeParse(email);
  return result.success;
}

/**
 * Valider un mot de passe
 */
export function isValidPassword(password: string): boolean {
  return password.length >= 8;
}

/**
 * Valider un SIRET
 */
export function isValidSiret(siret: string): boolean {
  return /^\d{14}$/.test(siret);
}

/**
 * Valider un niveau utilisateur
 */
export function isValidLevel(level: number): boolean {
  return level >= 1 && level <= 10;
}
