/**
 * 🛡️ FETCH WITH RETRY - Utilitaire pour des requêtes réseau robustes
 * 
 * Évite les faux 410/404 en cas d'erreur réseau temporaire
 * en implémentant des retries avec backoff exponentiel.
 * 
 * @version 1.0.0
 * @since 2025-12-05
 */

export interface FetchWithRetryOptions {
  /** Nombre maximum de tentatives (défaut: 3) */
  maxRetries?: number;
  /** Timeout par requête en ms (défaut: 10000) */
  timeout?: number;
  /** Délai initial entre retries en ms (défaut: 500) */
  initialDelay?: number;
  /** Multiplicateur de délai pour backoff (défaut: 2) */
  backoffMultiplier?: number;
  /** Headers additionnels */
  headers?: Record<string, string>;
  /** Méthode HTTP */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /** Corps de la requête (sera JSON.stringify si objet) */
  body?: any;
  /** Callback pour logger les retries */
  onRetry?: (attempt: number, error: Error) => void;
}

export interface FetchWithRetryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  attempts: number;
  duration: number;
}

/**
 * Effectue un fetch avec retry automatique et backoff exponentiel
 * 
 * @example
 * ```ts
 * const result = await fetchWithRetry<ApiResponse>(
 *   'http://localhost:3000/api/data',
 *   { maxRetries: 3, timeout: 10000 }
 * );
 * 
 * if (result.success) {
 *   console.log(result.data);
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export async function fetchWithRetry<T = any>(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<FetchWithRetryResult<T>> {
  const {
    maxRetries = 3,
    timeout = 10000,
    initialDelay = 500,
    backoffMultiplier = 2,
    headers = {},
    method = 'GET',
    body,
    onRetry
  } = options;

  const startTime = Date.now();
  let lastError: Error | null = null;
  let attempts = 0;

  while (attempts < maxRetries) {
    attempts++;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const fetchOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        signal: controller.signal
      };

      if (body && method !== 'GET') {
        fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        data,
        attempts,
        duration: Date.now() - startTime
      };

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Log le retry
      console.warn(
        `⚠️ [FETCH-RETRY] Tentative ${attempts}/${maxRetries} échouée pour ${url}:`,
        lastError.message
      );
      
      // Callback personnalisé
      if (onRetry) {
        onRetry(attempts, lastError);
      }

      // Si c'est la dernière tentative, ne pas attendre
      if (attempts < maxRetries) {
        const delay = initialDelay * Math.pow(backoffMultiplier, attempts - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  return {
    success: false,
    error: lastError?.message || 'Erreur inconnue après plusieurs tentatives',
    attempts,
    duration: Date.now() - startTime
  };
}

/**
 * Version qui throw une Response 503 en cas d'échec
 * Idéale pour les loaders Remix qui doivent retourner une erreur HTTP
 * 
 * @throws {Response} 503 Service Unavailable si toutes les tentatives échouent
 * 
 * @example
 * ```ts
 * // Dans un loader Remix
 * const data = await fetchWithRetryOrThrow503(
 *   'http://localhost:3000/api/data',
 *   { maxRetries: 3 }
 * );
 * return json(data);
 * ```
 */
export async function fetchWithRetryOrThrow503<T = any>(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<T> {
  const result = await fetchWithRetry<T>(url, options);
  
  if (!result.success) {
    console.error(
      `❌ [FETCH-RETRY] Échec définitif après ${result.attempts} tentatives pour ${url}`,
      `(${result.duration}ms)`
    );
    
    throw new Response(
      'Service temporairement indisponible. Veuillez réessayer dans quelques instants.',
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: {
          'Retry-After': '30',
          'Cache-Control': 'no-cache, no-store'
        }
      }
    );
  }
  
  return result.data!;
}

/**
 * Version POST pour les APIs qui nécessitent un body
 */
export async function postWithRetry<T = any>(
  url: string,
  body: any,
  options: Omit<FetchWithRetryOptions, 'method' | 'body'> = {}
): Promise<FetchWithRetryResult<T>> {
  return fetchWithRetry<T>(url, {
    ...options,
    method: 'POST',
    body
  });
}

/**
 * Version POST qui throw 503 en cas d'échec
 */
export async function postWithRetryOrThrow503<T = any>(
  url: string,
  body: any,
  options: Omit<FetchWithRetryOptions, 'method' | 'body'> = {}
): Promise<T> {
  return fetchWithRetryOrThrow503<T>(url, {
    ...options,
    method: 'POST',
    body
  });
}
