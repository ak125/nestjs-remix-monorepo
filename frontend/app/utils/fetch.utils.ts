/**
 * 🔧 Fetch Utilities
 * Utilitaires pour les appels HTTP avec gestion d'erreur et timeout
 */

/**
 * Fetch avec timeout et fallback automatique
 * Simplifie les appels non-critiques avec gestion d'erreur intégrée
 *
 * @param url - URL à fetcher
 * @param timeoutMs - Timeout en millisecondes (défaut: 3000)
 * @param fallback - Valeur de retour en cas d'erreur
 * @returns Promise avec les données ou le fallback
 */
export function fetchWithTimeout<T>(
  url: string,
  timeoutMs: number = 3000,
  fallback: T
): Promise<T> {
  return fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  })
    .then((res) => (res.ok ? res.json() : fallback))
    .catch(() => fallback);
}

/**
 * Fetch JSON avec timeout, retourne null si erreur
 * Wrapper simplifié pour les fetches optionnels
 */
export function fetchJsonOrNull<T = unknown>(
  url: string,
  timeoutMs: number = 3000
): Promise<T | null> {
  return fetchWithTimeout<T | null>(url, timeoutMs, null);
}
