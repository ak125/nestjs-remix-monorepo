/**
 * Point d'entrée côté serveur pour l'intégration Remix <-> NestJS
 * Ce fichier ne doit être importé que dans les loaders et actions de Remix.
 */
// import "reflect-metadata"; // Désactivé - géré par le backend
import { type AppLoadContext } from "@remix-run/node";

/**
 * Récupère une instance du service d'intégration Remix.
 * Gère le bootstrap de l'application NestJS si nécessaire.
 */
export async function getRemixIntegrationService(
  context: AppLoadContext,
): Promise<any> {
  const ctx: any = context as any;
  if (ctx.remixIntegration) return ctx.remixIntegration;
  if (ctx.remixService?.integration) return ctx.remixService.integration;
  // Fallback sur le helper API
  const { getRemixApiService } = await import("./remix-api.server");
  return getRemixApiService(context);
}
