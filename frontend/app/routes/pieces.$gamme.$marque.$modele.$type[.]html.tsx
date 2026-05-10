/**
 * Route : /pieces/:gamme/:marque/:modele/:type.html
 * Page Produit (R2 - PRODUIT) - Pieces avec contexte vehicule complet
 *
 * Role SEO : R2 - PRODUIT
 * Intention : Verifier compatibilite / acheter
 *
 * URLs PRESERVEES - Ne jamais modifier le format d'URL
 *
 * Thin orchestrator : loader, meta, composant et ErrorBoundary
 * sont delegues a des fichiers dedies.
 */

import { type MetaFunction } from "@remix-run/node";
import {
  isRouteErrorResponse,
  useLoaderData,
  useRouteError,
} from "@remix-run/react";
import { useEffect } from "react";
import { ErrorGeneric } from "~/components/errors/ErrorGeneric";
import {
  NoProductsAlternatives,
  type NoProductsData,
} from "~/components/pieces/NoProductsAlternatives";
import { PiecesVehicleContent } from "~/components/pieces/PiecesVehicleContent";
import { buildCacheHeaders } from "~/utils/cache-control";
import { logger } from "~/utils/logger";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";
import { piecesVehicleLoader } from "~/utils/pieces-vehicle.loader.server";
import { buildPiecesVehicleMeta } from "~/utils/pieces-vehicle.meta";

/**
 * Handle export pour propager le role SEO au root Layout
 * Permet l'ajout automatique de data-attributes sur <body>
 */
export const handle = {
  pageRole: createPageRoleMeta(PageRole.R2_PRODUCT, {
    clusterId: "pieces",
    canonicalEntity: "pieces-vehicule",
  }),
};

// ========================================
// LOADER - Delegue au fichier server-only
// ========================================

export const loader = piecesVehicleLoader;

// ========================================
// CACHE — 1min browser + 24h CDN stale on success, no-store on errors.
// `buildCacheHeaders` reads errorHeaders so loader-thrown 4xx/5xx never inherit
// the success policy (would otherwise let Cloudflare cache 5xx for 24h).
// ========================================

export const headers = buildCacheHeaders(
  "public, max-age=60, s-maxage=86400, stale-while-revalidate=3600",
);

// ========================================
// META - SEO (Schema.org genere par composant Breadcrumbs)
// ========================================

export const meta: MetaFunction<typeof loader> = ({ data, location }) =>
  buildPiecesVehicleMeta(data, location);

// ========================================
// COMPOSANT PRINCIPAL
// ========================================

export default function PiecesVehicleRoute() {
  const rawData = useLoaderData<typeof loader>();

  // Page alternatives quand 0 produits (200 + noindex)
  if ("noProducts" in rawData && rawData.noProducts) {
    return <NoProductsAlternatives data={rawData as NoProductsData} />;
  }

  return <PiecesVehicleContent />;
}

// ========================================
// ERROR BOUNDARY - Gestion 410 Gone & 503 Service Unavailable
// ========================================

export function ErrorBoundary() {
  const error = useRouteError();
  // SSR-safe: Log detaille de l'erreur uniquement cote client
  useEffect(() => {
    logger.error("[ERROR BOUNDARY] Erreur capturée:", error);
    logger.error("[ERROR BOUNDARY] Type:", typeof error);
    logger.error(
      "[ERROR BOUNDARY] Stack:",
      error instanceof Error ? error.stack : "N/A",
    );
  }, [error]);

  // Gestion specifique du 503 Service Unavailable (erreur reseau temporaire)
  if (isRouteErrorResponse(error)) {
    return (
      <ErrorGeneric
        status={error.status}
        message={error.statusText || error.data?.message}
      />
    );
  }

  return <ErrorGeneric />;
}
