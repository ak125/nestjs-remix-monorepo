/**
 * Point d'entrée côté serveur pour l'intégration Remix <-> NestJS
 * Ce fichier ne doit être importé que dans les loaders et actions de Remix.
 */
// import "reflect-metadata"; // Désactivé - géré par le backend
import { type RouterContextProvider } from "react-router";
import {
  remixIntegrationContext,
  remixServiceContext,
} from "~/utils/load-context";

/**
 * Récupère une instance du service d'intégration Remix.
 * Gère le bootstrap de l'application NestJS si nécessaire.
 */
export async function getRemixIntegrationService(
  context: Readonly<RouterContextProvider>,
): Promise<any> {
  // v8_middleware : lecture via clés typées (pas d'accès propriété sur le provider).
  const remixIntegration = context.get(remixIntegrationContext);
  if (remixIntegration) return remixIntegration;
  const remixService = context.get(remixServiceContext);
  if (remixService?.integration) return remixService.integration;
  // Fallback sur le helper API
  const { getRemixApiService } = await import("./remix-api.server");
  return getRemixApiService(context);
}
