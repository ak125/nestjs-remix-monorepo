/**
 * Internal API URL utility for server-side Remix loaders/actions
 * Used to construct URLs for backend API calls from Remix server-side code
 *
 * IMPORTANT: Prefer getInternalApiUrlFromRequest() in loaders/actions
 * to avoid creating outbound HTTP connections to localhost (causes port exhaustion).
 */

/**
 * Construct API URL from the incoming request's origin.
 * This is the PREFERRED method in loaders/actions as it avoids creating
 * outbound HTTP connections to localhost, which can cause EADDRNOTAVAIL.
 *
 * @param path - API path (e.g., "/api/catalog/homepage-rpc")
 * @param request - The Remix Request object
 * @returns Full URL using the request's origin
 *
 * @example
 * ```ts
 * export async function loader({ request }: LoaderFunctionArgs) {
 *   const url = getInternalApiUrlFromRequest("/api/catalog/data", request);
 *   const response = await fetch(url);
 *   return json(await response.json());
 * }
 * ```
 */
export function getInternalApiUrlFromRequest(
  path: string,
  request: Request,
): string {
  const url = new URL(request.url);
  return `${url.origin}${path}`;
}

/**
 * Construct API URL from environment variable.
 * Use this ONLY when request object is not available (e.g., background jobs).
 * In loaders/actions, prefer getInternalApiUrlFromRequest().
 *
 * @param path - API path (e.g., "/api/catalog/homepage-rpc")
 * @returns Full URL using INTERNAL_API_BASE_URL or localhost fallback
 */
export function getInternalApiUrl(path: string): string {
  const baseUrl = process.env.INTERNAL_API_BASE_URL || "http://localhost:3000";
  return `${baseUrl}${path}`;
}
