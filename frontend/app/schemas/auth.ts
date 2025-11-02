/**
 * 📝 SCHEMAS ZOD - Authentification & Utilisateur
 * 
 * Schemas de validation réutilisables pour les formulaires d'auth
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════
// 🔐 AUTHENTIFICATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Schema Login
 */
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email requis')
    .email('Email invalide')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(1, 'Mot de passe requis')
    .min(8, 'Minimum 8 caractères'),
  remember: z.boolean().optional().default(false),
});

export type LoginFormData = z.infer<typeof loginSchema>;

/**
 * Schema Register
 */
export const registerSchema = z.object({
  firstName: z
    .string()
    .min(2, 'Minimum 2 caractères')
    .max(50, 'Maximum 50 caractères')
    .trim(),
  lastName: z
    .string()
    .min(2, 'Minimum 2 caractères')
    .max(50, 'Maximum 50 caractères')
    .trim(),
  email: z
    .string()
    .min(1, 'Email requis')
    .email('Email invalide')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(8, 'Minimum 8 caractères')
    .max(100, 'Maximum 100 caractères')
    .regex(/[A-Z]/, 'Au moins une majuscule')
    .regex(/[a-z]/, 'Au moins une minuscule')
    .regex(/[0-9]/, 'Au moins un chiffre'),
  confirmPassword: z.string(),
  acceptTerms: z
    .boolean()
    .refine((val) => val === true, 'Vous devez accepter les conditions'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
});

export type RegisterFormData = z.infer<typeof registerSchema>;

/**
 * Schema Forgot Password
 */
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Email requis')
    .email('Email invalide')
    .toLowerCase()
    .trim(),
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

/**
 * Schema Reset Password
 */
export const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, 'Minimum 8 caractères')
    .max(100, 'Maximum 100 caractères')
    .regex(/[A-Z]/, 'Au moins une majuscule')
    .regex(/[a-z]/, 'Au moins une minuscule')
    .regex(/[0-9]/, 'Au moins un chiffre'),
  confirmPassword: z.string(),
  token: z.string().min(1, 'Token invalide'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
});

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// 📞 CONTACT & SUPPORT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Schema Contact
 */
export const contactSchema = z.object({
  name: z
    .string()
    .min(2, 'Minimum 2 caractères')
    .max(100, 'Maximum 100 caractères')
    .trim(),
  email: z
    .string()
    .min(1, 'Email requis')
    .email('Email invalide')
    .toLowerCase()
    .trim(),
  phone: z
    .string()
    .regex(/^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/, 'Téléphone invalide (format français)')
    .optional()
    .or(z.literal('')),
  subject: z
    .string()
    .min(5, 'Minimum 5 caractères')
    .max(200, 'Maximum 200 caractères'),
  message: z
    .string()
    .min(10, 'Minimum 10 caractères')
    .max(2000, 'Maximum 2000 caractères'),
});

export type ContactFormData = z.infer<typeof contactSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// 🔍 RECHERCHE & FILTRES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Schema Search
 */
export const searchSchema = z.object({
  query: z
    .string()
    .min(3, 'Minimum 3 caractères')
    .max(100, 'Maximum 100 caractères')
    .trim(),
  brands: z.array(z.string()).optional().default([]),
  categories: z.array(z.string()).optional().default([]),
  priceMin: z.coerce.number().min(0, 'Prix minimum invalide').optional(),
  priceMax: z.coerce.number().max(10000, 'Prix maximum invalide').optional(),
  inStockOnly: z.boolean().optional().default(false),
  sortBy: z.enum(['relevance', 'price-asc', 'price-desc', 'name']).optional().default('relevance'),
}).refine(
  (data) => {
    if (data.priceMin !== undefined && data.priceMax !== undefined) {
      return data.priceMin <= data.priceMax;
    }
    return true;
  },
  {
    message: 'Prix minimum doit être inférieur au prix maximum',
    path: ['priceMax'],
  }
);

export type SearchFormData = z.infer<typeof searchSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// 👤 PROFIL UTILISATEUR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Schema Update Profile
 */
export const updateProfileSchema = z.object({
  firstName: z.string().min(2, 'Minimum 2 caractères').max(50).trim(),
  lastName: z.string().min(2, 'Minimum 2 caractères').max(50).trim(),
  phone: z
    .string()
    .regex(/^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/, 'Téléphone invalide')
    .optional()
    .or(z.literal('')),
  company: z.string().max(100).optional().or(z.literal('')),
});

export type UpdateProfileFormData = z.infer<typeof updateProfileSchema>;

/**
 * Schema Change Password
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
  newPassword: z
    .string()
    .min(8, 'Minimum 8 caractères')
    .regex(/[A-Z]/, 'Au moins une majuscule')
    .regex(/[a-z]/, 'Au moins une minuscule')
    .regex(/[0-9]/, 'Au moins un chiffre'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
}).refine((data) => data.currentPassword !== data.newPassword, {
  message: 'Le nouveau mot de passe doit être différent',
  path: ['newPassword'],
});

export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;
