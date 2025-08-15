import { z } from 'zod';

/**
 * DTOs pour la gestion des tokens de réinitialisation de mot de passe
 * Compatible avec la table password_reset_tokens
 */

// =====================================
// SCHEMAS TOKENS
// =====================================

/**
 * Schema pour créer un token de réinitialisation
 */
export const CreatePasswordResetTokenSchema = z
  .object({
    customerId: z.string().min(1, "L'ID client est requis"),
    token: z.string().min(32, 'Le token doit faire au moins 32 caractères'),
    expiresAt: z.date(),
  })
  .strict();

/**
 * Schema pour valider un token de réinitialisation
 */
export const ValidatePasswordResetTokenSchema = z
  .object({
    token: z.string().min(1, 'Le token est requis'),
  })
  .strict();

/**
 * Schema pour utiliser un token de réinitialisation
 */
export const UsePasswordResetTokenSchema = z
  .object({
    token: z.string().min(1, 'Le token est requis'),
    newPassword: z
      .string()
      .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
      .max(128, 'Le mot de passe ne peut pas dépasser 128 caractères')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre',
      ),
  })
  .strict();

/**
 * Schema pour demander une réinitialisation de mot de passe
 */
export const RequestPasswordResetSchema = z
  .object({
    email: z.string().email("L'email doit être valide").toLowerCase(),
  })
  .strict();

/**
 * Schema pour changer le mot de passe directement (utilisateur connecté)
 */
export const ChangePasswordDirectSchema = z
  .object({
    currentPassword: z.string().min(1, 'Le mot de passe actuel est requis'),
    newPassword: z
      .string()
      .min(8, 'Le nouveau mot de passe doit contenir au moins 8 caractères')
      .max(128, 'Le nouveau mot de passe ne peut pas dépasser 128 caractères')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Le nouveau mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre',
      ),
  })
  .strict();

// =====================================
// TYPES INFÉRÉS
// =====================================

export type CreatePasswordResetTokenDto = z.infer<
  typeof CreatePasswordResetTokenSchema
>;
export type ValidatePasswordResetTokenDto = z.infer<
  typeof ValidatePasswordResetTokenSchema
>;
export type UsePasswordResetTokenDto = z.infer<
  typeof UsePasswordResetTokenSchema
>;
export type RequestPasswordResetDto = z.infer<
  typeof RequestPasswordResetSchema
>;
export type ChangePasswordDirectDto = z.infer<
  typeof ChangePasswordDirectSchema
>;

// =====================================
// INTERFACES POUR LES RÉPONSES
// =====================================

export interface PasswordResetToken {
  id: number;
  customerId: number;
  token: string;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}

export interface PasswordResetResponse {
  success: boolean;
  message: string;
  tokenId?: number;
}

export interface TokenValidationResponse {
  valid: boolean;
  expired?: boolean;
  used?: boolean;
  customerId?: number;
}
