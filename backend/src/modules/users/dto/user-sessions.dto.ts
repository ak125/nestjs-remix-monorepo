import { z } from 'zod';

/**
 * DTOs pour la gestion des sessions utilisateur
 * Compatible avec la table user_sessions
 */

// =====================================
// SCHEMAS SESSIONS
// =====================================

/**
 * Schema pour créer une session utilisateur
 */
export const CreateUserSessionSchema = z
  .object({
    customerId: z.number().positive("L'ID client doit être un nombre positif"),
    sessionToken: z
      .string()
      .min(32, 'Le token de session doit faire au moins 32 caractères'),
    ipAddress: z.string().optional(),
    userAgent: z
      .string()
      .max(1000, "L'user agent ne peut pas dépasser 1000 caractères")
      .optional(),
    expiresAt: z.date(),
  })
  .strict();

/**
 * Schema pour valider une session
 */
export const ValidateSessionSchema = z
  .object({
    sessionToken: z.string().min(1, 'Le token de session est requis'),
  })
  .strict();

/**
 * Schema pour mettre à jour une session
 */
export const UpdateSessionSchema = z
  .object({
    sessionToken: z.string().min(1, 'Le token de session est requis'),
    expiresAt: z.date().optional(),
    ipAddress: z.string().optional(),
    userAgent: z.string().max(1000).optional(),
  })
  .strict();

/**
 * Schema pour supprimer une session
 */
export const DeleteSessionSchema = z
  .object({
    sessionToken: z.string().min(1, 'Le token de session est requis'),
  })
  .strict();

/**
 * Schema pour supprimer toutes les sessions d'un utilisateur
 */
export const DeleteAllUserSessionsSchema = z
  .object({
    customerId: z.number().positive("L'ID client doit être un nombre positif"),
    exceptToken: z.string().optional(),
  })
  .strict();

// =====================================
// TYPES INFÉRÉS
// =====================================

export type CreateUserSessionDto = z.infer<typeof CreateUserSessionSchema>;
export type ValidateSessionDto = z.infer<typeof ValidateSessionSchema>;
export type UpdateSessionDto = z.infer<typeof UpdateSessionSchema>;
export type DeleteSessionDto = z.infer<typeof DeleteSessionSchema>;
export type DeleteAllUserSessionsDto = z.infer<
  typeof DeleteAllUserSessionsSchema
>;

// =====================================
// INTERFACES POUR LES RÉPONSES
// =====================================

export interface UserSession {
  id: number;
  customerId: number;
  sessionToken: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface SessionValidationResponse {
  valid: boolean;
  expired?: boolean;
  session?: UserSession;
  customerId?: number;
}

export interface SessionCreationResponse {
  success: boolean;
  sessionToken: string;
  expiresAt: Date;
  sessionId?: number;
}

export interface SessionDeletionResponse {
  success: boolean;
  deletedCount: number;
  message: string;
}
