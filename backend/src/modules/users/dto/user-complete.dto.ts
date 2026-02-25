/**
 * DTO UNIFIÉ pour les utilisateurs
 * Basé sur l'analyse complète du module users
 * Consolide tous les champs nécessaires sans redondance
 */

import { z } from 'zod';

/**
 * Interface complète d'un utilisateur
 * Correspond exactement aux champs de la table ___xtr_customer
 */
export interface UserCompleteDto {
  // Identification
  id: string;
  email: string;

  // Informations personnelles
  firstName?: string;
  lastName?: string;
  civility?: string; // M, Mme, Mlle, Dr, Prof

  // Coordonnées
  address?: string;
  zipCode?: string;
  city?: string;
  country?: string;
  phone?: string; // CST_TEL - Téléphone fixe
  mobile?: string; // CST_GSM - Téléphone mobile

  // Informations entreprise (si isCompany = true)
  isCompany: boolean;
  companyName?: string; // CST_RS - Raison sociale
  siret?: string; // SIRET entreprise

  // Statut utilisateur
  isPro: boolean;
  isActive: boolean;
  level: number; // Niveau : 1 (client) à 9 (admin)

  // Dates
  createdAt: Date;
  updatedAt: Date;

  // Statistiques (optionnelles - calculées côté serveur)
  totalOrders?: number;
  totalSpent?: number;
  lastLogin?: Date;
}

/**
 * Schéma Zod pour validation
 */
export const UserCompleteDtoSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  civility: z.enum(['M', 'Mme', 'Mlle', 'Dr', 'Prof', 'Autre']).optional(),
  address: z.string().optional(),
  zipCode: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  isCompany: z.boolean(),
  companyName: z.string().optional(),
  siret: z.string().optional(),
  isPro: z.boolean(),
  isActive: z.boolean(),
  level: z.number().min(1).max(9),
  createdAt: z.date(),
  updatedAt: z.date(),
  totalOrders: z.number().optional(),
  totalSpent: z.number().optional(),
  lastLogin: z.date().optional(),
});

/**
 * DTO pour les listes paginées
 */
export interface PaginatedUsersDto {
  users: UserCompleteDto[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/**
 * DTO pour les filtres de recherche
 */
export interface UserSearchFiltersDto {
  search?: string; // Recherche dans email, firstName, lastName
  status?: 'active' | 'inactive' | 'all';
  userType?: 'pro' | 'particulier' | 'company' | 'all';
  level?: number;
  civility?: string;
  city?: string;
  country?: string;
  sortBy?: 'email' | 'firstName' | 'lastName' | 'city' | 'createdAt' | 'level';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

/**
 * Schéma de validation pour les filtres
 */
export const UserSearchFiltersDtoSchema = z.object({
  search: z.string().optional(),
  status: z.enum(['active', 'inactive', 'all']).optional(),
  userType: z.enum(['pro', 'particulier', 'company', 'all']).optional(),
  level: z.number().min(1).max(9).optional(),
  civility: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  sortBy: z
    .enum(['email', 'firstName', 'lastName', 'city', 'createdAt', 'level'])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.number().min(1).optional(),
  limit: z.number().min(1).max(100).optional(),
});

/**
 * DTO pour la création d'un utilisateur
 */
export interface CreateUserDto {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  civility?: string;
  address?: string;
  zipCode?: string;
  city?: string;
  country?: string;
  phone?: string;
  mobile?: string;
  isCompany?: boolean;
  companyName?: string;
  siret?: string;
  isPro?: boolean;
}

/**
 * DTO pour la mise à jour d'un utilisateur
 */
export interface UpdateUserDto {
  email?: string;
  firstName?: string;
  lastName?: string;
  civility?: string;
  address?: string;
  zipCode?: string;
  city?: string;
  country?: string;
  phone?: string;
  mobile?: string;
  companyName?: string;
  siret?: string;
}

/**
 * Mapper depuis les données Supabase vers UserCompleteDto
 * Utilise les vrais noms de colonnes (cst_*)
 */
export function mapSupabaseToUserDto(dbData: any): UserCompleteDto {
  return {
    // Identification
    id: String(dbData.cst_id),
    email: dbData.cst_mail,

    // Informations personnelles
    firstName: dbData.cst_fname || undefined,
    lastName: dbData.cst_name || undefined,
    civility: dbData.cst_civility || undefined, // Note: TYPO dans DB (cst_civitily)

    // Coordonnées
    address: dbData.cst_address || undefined,
    zipCode: dbData.cst_zip_code || undefined,
    city: dbData.cst_city || undefined,
    country: dbData.cst_country || undefined,
    phone: dbData.cst_tel || undefined,
    mobile: dbData.cst_gsm || undefined,

    // Informations entreprise
    isCompany: dbData.cst_is_cpy === '1',
    companyName: dbData.cst_rs || undefined,
    siret: dbData.cst_siret || undefined,

    // Statut
    isPro: dbData.cst_is_pro === '1',
    isActive: dbData.cst_activ === '1',
    level: parseInt(dbData.cst_level) || 1,

    // Dates
    createdAt: dbData.cst_created_at
      ? new Date(dbData.cst_created_at)
      : new Date(),
    updatedAt: dbData.cst_updated_at
      ? new Date(dbData.cst_updated_at)
      : new Date(),
  };
}

/**
 * Mapper depuis UserCompleteDto vers données Supabase
 */
export function mapUserDtoToSupabase(
  userData: Partial<CreateUserDto | UpdateUserDto>,
): Record<string, string> {
  const result: Record<string, string> = {};

  if (userData.email) result.cst_mail = userData.email;
  if (userData.firstName) result.cst_fname = userData.firstName;
  if (userData.lastName) result.cst_name = userData.lastName;
  if (userData.civility) result.cst_civility = userData.civility;
  if (userData.address) result.cst_address = userData.address;
  if (userData.zipCode) result.cst_zip_code = userData.zipCode;
  if (userData.city) result.cst_city = userData.city;
  if (userData.country) result.cst_country = userData.country;
  if (userData.phone) result.cst_tel = userData.phone;
  if (userData.mobile) result.cst_gsm = userData.mobile;
  if (userData.companyName) result.cst_rs = userData.companyName;
  if (userData.siret) result.cst_siret = userData.siret;

  if ('isCompany' in userData && typeof userData.isCompany !== 'undefined')
    result.cst_is_cpy = userData.isCompany ? '1' : '0';
  if ('isPro' in userData && typeof userData.isPro !== 'undefined')
    result.cst_is_pro = userData.isPro ? '1' : '0';

  return result;
}
