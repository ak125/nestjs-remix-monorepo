/**
 * Point d'entrée côté serveur pour l'intégration Remix <-> NestJS
 * Ce fichier ne doit être importé que dans les loaders et actions de Remix.
 */
import "reflect-metadata";
import { bootstrapNest } from "../../../backend/src/main.server";
import { RemixIntegrationService } from "../../../backend/src/remix/remix-integration.service";
import type { AppLoadContext } from "@remix-run/node";

/**
 * Récupère une instance du service d'intégration Remix.
 * Gère le bootstrap de l'application NestJS si nécessaire.
 */
export async function getRemixIntegrationService(
  context: AppLoadContext
): Promise<RemixIntegrationService> {
  // Le contexte de Remix peut contenir l'instance de l'app Nest
  // pour éviter de la recréer à chaque requête.
  if (context.nestApp) {
    return context.nestApp.get(RemixIntegrationService);
  }

  // Sinon, on bootstrap l'application
  const app = await bootstrapNest();
  context.nestApp = app; // On la stocke dans le contexte

  return app.get(RemixIntegrationService);
}
