/**
 * Index des DTOs Users - Export centralisé
 * Facilite l'import des DTOs dans les services
 */

// =====================================
// EXPORTS DTOs UTILISATEURS DE BASE
// =====================================

export * from './create-user.dto';
export * from './change-password.dto';
export * from './login.dto';
export * from './user-profile.dto';
export * from './user-response.dto';
// export * from './users.dto'; // Commenté pour éviter les conflits

// =====================================
// EXPORTS NOUVEAUX DTOs
// =====================================

export * from './password-reset.dto';
export * from './user-sessions.dto';
export * from './addresses.dto';

// =====================================
// EXPORTS DTOs ADRESSES (EXISTANT)
// =====================================

export * from './user-address.dto';

// =====================================
// UTILITAIRES DE VALIDATION
// =====================================

import { z } from 'zod';
import {
  DomainValidationException,
  ErrorCodes,
} from '../../../common/exceptions';

/**
 * Fonction utilitaire générique pour valider avec Zod
 */
export function validateDto<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    ),
  };
}

/**
 * Fonction pour créer un middleware de validation Zod pour NestJS
 */
export function createValidationPipe<T>(schema: z.ZodSchema<T>) {
  return (value: unknown): T => {
    const result = schema.safeParse(value);
    if (!result.success) {
      const errors = result.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      );
      throw new DomainValidationException({
        code: ErrorCodes.VALIDATION.FAILED,
        message: `Validation failed: ${errors.join(', ')}`,
      });
    }
    return result.data;
  };
}
