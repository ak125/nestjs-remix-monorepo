import { Logger } from '@nestjs/common';
import { ExternalServiceException, ErrorCodes } from '../common/exceptions';

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
          throw new ExternalServiceException({ code: ErrorCodes.EXTERNAL.HTTP_ERROR, message: `HTTP ${response.status}: ${response.statusText}` });
        }

        return response;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error: any) {
      lastError = error;

      // Vérifier si c'est une erreur retryable
      const isTimeout =
        error.name === 'AbortError' ||
        error.code === 'ETIMEDOUT' ||
        error.message?.includes('timeout');

      const isNetworkError =
        error.code === 'ECONNRESET' ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'EAI_AGAIN' ||
        error.type === 'system';

      const is5xxError = error.message?.includes('HTTP 5');

      const shouldRetry = isTimeout || isNetworkError || is5xxError;

      // Si dernière tentative ou erreur non-retryable, on throw
      if (attempt >= maxRetries - 1 || !shouldRetry) {
        logger?.error(
          `❌ Fetch failed after ${attempt + 1} attempts: ${error.message}`,
        );
        throw error;
      }

      // Calculer le délai avec exponential backoff
      const delay = Math.min(baseDelay * Math.pow(2, attempt), 10000);

      logger?.warn(
        `⚠️ Fetch attempt ${attempt + 1}/${maxRetries} failed: ${error.message}. Retrying in ${delay}ms...`,
      );

      // Callback optionnel
      if (onRetry) {
        onRetry(attempt + 1, error);
      }

      // Attendre avant le retry
      await new Promise((resolve) => setTimeout(resolve, delay));
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
    throw new ExternalServiceException({ code: ErrorCodes.EXTERNAL.HTTP_ERROR, message: `HTTP ${response.status}: ${response.statusText} - ${url}` });
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
