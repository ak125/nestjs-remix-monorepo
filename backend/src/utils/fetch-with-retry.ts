import { Logger } from '@nestjs/common';
import { ExternalServiceException, ErrorCodes } from '@common/exceptions';
import { sleep } from './promise-helpers';

/**
 * 🚀 Utilitaire pour faire des fetch avec retry automatique et timeout
 * Gère les erreurs réseau (ETIMEDOUT, ECONNRESET, etc.)
 */

export interface FetchWithRetryOptions {
  maxRetries?: number;
  baseDelay?: number; // Délai initial en ms (exponential backoff)
  timeout?: number; // Timeout en ms
  logger?: Logger;
  onRetry?: (attempt: number, error: Error) => void;
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  options: FetchWithRetryOptions = {},
): Promise<Response> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    timeout = 30000,
    logger,
    onRetry,
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Créer un AbortController pour le timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          ...init,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Si erreur HTTP 5xx, on peut retry
        if (response.status >= 500 && attempt < maxRetries - 1) {
          throw new ExternalServiceException({
            code: ErrorCodes.EXTERNAL.HTTP_ERROR,
            message: `HTTP ${response.status}: ${response.statusText}`,
          });
        }

        return response;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Cast pour accéder aux propriétés spécifiques aux erreurs réseau
      const errObj = error as Record<string, unknown>;
      const errMessage = error instanceof Error ? error.message : String(error);
      const errName = error instanceof Error ? error.name : '';

      // Vérifier si c'est une erreur retryable
      const isTimeout =
        errName === 'AbortError' ||
        errObj.code === 'ETIMEDOUT' ||
        errMessage.includes('timeout');

      const isNetworkError =
        errObj.code === 'ECONNRESET' ||
        errObj.code === 'ECONNREFUSED' ||
        errObj.code === 'ENOTFOUND' ||
        errObj.code === 'EAI_AGAIN' ||
        errObj.type === 'system';

      const is5xxError = errMessage.includes('HTTP 5');

      const shouldRetry = isTimeout || isNetworkError || is5xxError;

      // Si dernière tentative ou erreur non-retryable, on throw
      if (attempt >= maxRetries - 1 || !shouldRetry) {
        logger?.error(
          `❌ Fetch failed after ${attempt + 1} attempts: ${errMessage}`,
        );
        throw error;
      }

      // Calculer le délai avec exponential backoff
      const delay = Math.min(baseDelay * Math.pow(2, attempt), 10000);

      logger?.warn(
        `⚠️ Fetch attempt ${attempt + 1}/${maxRetries} failed: ${errMessage}. Retrying in ${delay}ms...`,
      );

      // Callback optionnel
      if (onRetry) {
        onRetry(attempt + 1, lastError);
      }

      // Attendre avant le retry
      await sleep(delay);
    }
  }

  throw lastError!;
}

/**
 * 🎯 Version simplifiée pour GET JSON avec retry
 */
export async function fetchJsonWithRetry<T = any>(
  url: string,
  init: RequestInit = {},
  options: FetchWithRetryOptions = {},
): Promise<T> {
  const response = await fetchWithRetry(url, init, options);

  if (!response.ok) {
    throw new ExternalServiceException({
      code: ErrorCodes.EXTERNAL.HTTP_ERROR,
      message: `HTTP ${response.status}: ${response.statusText} - ${url}`,
    });
  }

  return response.json();
}

/**
 * 🔄 Wrapper pour Supabase REST API avec authentification
 */
export async function fetchSupabaseWithRetry<T = any>(
  url: string,
  apiKey: string,
  init: RequestInit = {},
  options: FetchWithRetryOptions = {},
): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    apikey: apiKey,
    Authorization: `Bearer ${apiKey}`,
    ...init.headers,
  };

  return fetchJsonWithRetry<T>(
    url,
    {
      ...init,
      headers,
    },
    options,
  );
}
