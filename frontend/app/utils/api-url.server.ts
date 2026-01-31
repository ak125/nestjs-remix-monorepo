/**
 * Helper pour construire les URLs API dans les loaders SSR.
 * Évite les hardcodes localhost qui causent l'épuisement des ports.
 *
 * @module api-url.server
 */

/**
 * Construit l'URL de l'API pour les appels SSR (loaders/actions).
 * Utilise l'origin de la requête entrante, pas localhost hardcodé.
 *
 * Cela évite de créer des connexions HTTP sortantes vers le même serveur,
 * ce qui cause l'épuisement des ports éphémères (EADDRNOTAVAIL).
 *
 * @param path - Le chemin API (ex: "/api/catalog/homepage-rpc")
 * @param request - L'objet Request Remix
 * @returns L'URL complète pour l'appel API
 *
 * @example
 * ```ts
 * export async function loader({ request }: LoaderFunctionArgs) {
 *   const response = await fetch(getLoaderApiUrl("/api/catalog/homepage-rpc", request));
 *   return json(await response.json());
 * }
 * ```
 */
export function getLoaderApiUrl(path: string, request: Request): string {
  const url = new URL(request.url);
  return `${url.origin}${path}`;
}

/**
 * Pour les appels côté client - toujours relatif.
 * Le navigateur résout automatiquement l'URL relative.
 *
 * @param path - Le chemin API (ex: "/api/cart")
 * @returns Le chemin relatif
 *
 * @example
 * ```ts
 * // Dans un composant React
 * const response = await fetch(getClientApiUrl("/api/cart"));
 * ```
 */
export function getClientApiUrl(path: string): string {
  return path;
}
