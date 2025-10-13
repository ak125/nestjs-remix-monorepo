/**
 * Utilitaires pour la gestion sécurisée des erreurs
 */

/**
 * Extrait le message d'une erreur de manière sûre
 * @param error - L'erreur à traiter (type unknown)
 * @returns Le message d'erreur sous forme de string
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return String(error);
}

/**
 * Extrait la stack trace d'une erreur de manière sûre
 * @param error - L'erreur à traiter (type unknown)
 * @returns La stack trace ou undefined
 */
export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }
  return undefined;
}

/**
 * Convertit une erreur en objet sérialisable
 * @param error - L'erreur à convertir
 * @returns Un objet avec message et stack
 */
export function serializeError(error: unknown): {
  message: string;
  stack?: string;
} {
  return {
    message: getErrorMessage(error),
    stack: getErrorStack(error),
  };
}
