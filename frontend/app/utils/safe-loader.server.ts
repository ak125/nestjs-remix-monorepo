/**
 * Safe Loader - Wrapper try/catch pour loaders Remix
 *
 * Previent les pages blanches quand le backend est down.
 * Retourne un fallback + `_error` string si erreur.
 *
 * Usage:
 *   export const loader = createSafeLoader(
 *     async ({ request }) => {
 *       const data = await fetchBackend(request);
 *       return { items: data.items, total: data.total };
 *     },
 *     { items: [], total: 0 }
 *   );
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { logger } from "~/utils/logger";

export function createSafeLoader<T extends Record<string, unknown>>(
  loaderFn: (args: LoaderFunctionArgs) => Promise<T>,
  fallback: T,
) {
  return async (args: LoaderFunctionArgs) => {
    try {
      const result = await loaderFn(args);
      return json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("[SafeLoader] Error:", message);
      return json({ ...fallback, _error: message } as T & { _error: string });
    }
  };
}
