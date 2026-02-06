import { Logger } from '@nestjs/common';

/**
 * Extraire et logger une erreur de manière cohérente.
 * Retourne le message d'erreur pour utilisation dans les throws.
 */
export function logPaymentError(
  logger: Logger,
  context: string,
  error: unknown,
): string {
  const message = error instanceof Error ? error.message : 'Unknown error';
  logger.error(
    `Failed to ${context}: ${message}`,
    error instanceof Error ? error.stack : '',
  );
  return message;
}
