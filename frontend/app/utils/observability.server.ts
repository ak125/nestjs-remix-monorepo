/**
 * Observabilité côté serveur (loaders/actions Remix) — SERVER-ONLY.
 *
 * Le suffixe `.server` garantit l'exclusion du bundle client (le client charge
 * déjà Sentry en dynamic-import pour éviter ~159 KB gzip, cf. entry.client.tsx).
 *
 * Pourquoi : un loader qui ATTRAPE une erreur et dégrade gracieusement (ex.
 * cart/checkout → état « Erreur de chargement ») n'est JAMAIS vu par
 * l'auto-instrumentation Sentry (qui ne capte que les throws non rattrapés).
 * Ces échecs deviennent donc invisibles alors qu'ils impactent le funnel.
 * On REMONTE explicitement le signal via le pont serveur unique
 * (`AppLoadContext.serverObservability` → client Sentry NestJS) + un log
 * structuré stable. CE FICHIER NE CHARGE AUCUN SDK Sentry (single-server-SDK,
 * incident #1106) : le reporter est INJECTÉ par l'appelant depuis `context`.
 */
import type { ServerObservability } from "./observability-contract";
import { logger } from "./logger";

/**
 * Remonte une erreur de loader/action rattrapée vers l'observabilité serveur.
 * Ne lève jamais : l'observabilité ne doit pas casser le rendu.
 *
 * @param observability `context.serverObservability` (pont NestJS). `undefined`
 *   en mode autonome (SSR non embarqué) → no-op délibéré.
 * @param event Code d'événement stable (ex. `cart_load_failed`) — sert de tag
 *   Sentry et de marqueur de log pour la mesure post-merge.
 */
export function reportLoaderError(
  observability: ServerObservability | undefined,
  event: string,
  error: unknown,
  context?: Record<string, unknown>,
): void {
  const err = error instanceof Error ? error : new Error(String(error));

  // Marqueur structuré stable → comptage/mesure dans les logs agrégés.
  logger.error(`[observability] event=${event}`, err.message, context ?? {});

  try {
    observability?.captureException(err, {
      mechanism: { type: "react-router-loader-caught", handled: true },
      tags: { observability_event: event },
      extra: context,
    });
  } catch {
    // best-effort : ne jamais propager une erreur d'observabilité.
  }
}
