import { z } from 'zod';

// Schémas pour gestion des mots de passe
export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export const RequestPasswordResetSchema = z.object({
  email: z.string().email(),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;
export type RequestPasswordResetDto = z.infer<
  typeof RequestPasswordResetSchema
>;
export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;
