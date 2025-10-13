import { z } from 'zod';

/**
 * 🎯 DTOs pour l'authentification unifiée
 * 
 * Gère l'auth pour customers ET staff
 */

// Type d'utilisateur
export const UserType = z.enum(['customer', 'staff']);
export type UserTypeEnum = z.infer<typeof UserType>;

// Schema pour le login
export const LoginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Mot de passe trop court'),
});

// Schema pour la session
export const SessionSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  userType: UserType,
  level: z.number(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  isActive: z.boolean(),
});

// Schema pour le refresh token
export const RefreshTokenSchema = z.object({
  refreshToken: z.string(),
});

// Schema pour le register (customers uniquement)
export const RegisterSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string()
    .min(8, 'Minimum 8 caractères')
    .regex(/[A-Z]/, 'Au moins une majuscule')
    .regex(/[a-z]/, 'Au moins une minuscule')
    .regex(/[0-9]/, 'Au moins un chiffre'),
  confirmPassword: z.string(),
  firstName: z.string().min(2, 'Minimum 2 caractères'),
  lastName: z.string().min(2, 'Minimum 2 caractères'),
  civility: z.enum(['M', 'Mme', 'Autre']).optional(),
  phone: z.string().optional(),
  acceptTerms: z.boolean().refine(val => val === true, {
    message: 'Vous devez accepter les conditions',
  }),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
});

// Types exportés
export type LoginDto = z.infer<typeof LoginSchema>;
export type SessionDto = z.infer<typeof SessionSchema>;
export type RefreshTokenDto = z.infer<typeof RefreshTokenSchema>;
export type RegisterDto = z.infer<typeof RegisterSchema>;

// Response après login
export interface AuthResponse {
  user: SessionDto;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

// Payload du JWT
export interface JwtPayload {
  sub: string; // user ID
  email: string;
  userType: UserTypeEnum;
  level: number;
  iat?: number;
  exp?: number;
}
