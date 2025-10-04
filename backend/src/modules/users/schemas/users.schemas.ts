/**
 * Schémas de validation Zod pour le module Users
 * Garantit la type safety runtime
 */

import { z } from 'zod';

// Schéma de base utilisateur
export const userBaseSchema = z.object({
  email: z.string().email('Email invalide'),
  firstName: z.string().min(1, 'Prénom requis').optional(),
  lastName: z.string().min(1, 'Nom requis').optional(),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Téléphone invalide')
    .optional(),
});

// Schéma de mise à jour profil
export const updateProfileSchema = userBaseSchema.partial().extend({
  currentPassword: z.string().optional(),
  newPassword: z
    .string()
    .min(8, 'Mot de passe trop court')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Mot de passe trop simple')
    .optional(),
});

// Schéma d'adresse
export const addressSchema = z.object({
  street: z.string().min(1, 'Rue requise'),
  city: z.string().min(1, 'Ville requise'),
  postalCode: z.string().regex(/^\d{5}$/, 'Code postal invalide'),
  country: z.string().min(1, 'Pays requis').default('France'),
  isDefault: z.boolean().default(false),
});

// Schéma de mise à jour d'adresse
export const updateAddressSchema = z.object({
  billingAddress: addressSchema.optional(),
  deliveryAddress: addressSchema.optional(),
});

// Schéma de message utilisateur
export const userMessageSchema = z.object({
  subject: z.string().min(1, 'Sujet requis').max(255, 'Sujet trop long'),
  content: z.string().min(1, 'Contenu requis').max(10000, 'Contenu trop long'),
});

// Schéma de réinitialisation mot de passe
export const resetPasswordSchema = z.object({
  email: z.string().email('Email invalide'),
});

export const confirmResetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Token requis'),
    password: z
      .string()
      .min(8, 'Mot de passe trop court')
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Mot de passe trop simple'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });

// Schéma de recherche utilisateurs (Admin)
export const searchUsersSchema = z.object({
  search: z.string().optional(),
  isActive: z.boolean().optional(),
  emailVerified: z.boolean().optional(),
  page: z.number().min(1).optional(),
  limit: z.number().min(1).max(100).optional(),
  sortBy: z
    .enum(['email', 'firstName', 'lastName', 'createdAt', 'registrationDate'])
    .optional(),
  sortOrder: z.enum(['ASC', 'DESC']).optional(),
});

// Types TypeScript dérivés
export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
export type UpdateAddressDto = z.infer<typeof updateAddressSchema>;
export type UserMessageDto = z.infer<typeof userMessageSchema>;
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
export type ConfirmResetPasswordDto = z.infer<
  typeof confirmResetPasswordSchema
>;
export type SearchUsersDto = z.infer<typeof searchUsersSchema>;
