import { useMatches } from "@remix-run/react";
import {
  type PageRoleMeta,
  type RouteHandleWithRole,
} from "~/utils/page-role.types";
import { useVehicleContext } from "./useVehicleContext";

/**
 * Hook pour récupérer les métadonnées de rôle SEO de la route courante
 *
 * Cherche dans la hiérarchie de routes (de la plus spécifique à la racine)
 * pour trouver un handle avec pageRole.
 *
 * Usage:
 * ```tsx
 * // Dans un composant
 * const pageRole = usePageRole();
 * if (pageRole) {
 *   console.log(pageRole.role); // "R4"
 * }
 * ```
 */
export function usePageRole(): PageRoleMeta | null {
  const matches = useMatches();

  // Parcourir les routes de la plus profonde à la racine
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const handle = match.handle as RouteHandleWithRole | undefined;

    if (handle?.pageRole) {
      return handle.pageRole;
    }
  }

  return null;
}

/**
 * Hook pour récupérer les data-attributes SEO à appliquer sur un élément
 *
 * Phase 9: Inclut funnelStage, conversionGoal, vehicleContext
 *
 * Usage:
 * ```tsx
 * const dataAttrs = usePageRoleDataAttrs();
 * return <main {...dataAttrs}>...</main>;
 * ```
 */
export function usePageRoleDataAttrs(): Record<string, string> | null {
  const pageRole = usePageRole();
  const vehicleContext = useVehicleContext();

  if (!pageRole) {
    return null;
  }

  const attrs: Record<string, string> = {
    "data-page-role": pageRole.role,
    "data-page-intent": pageRole.intent,
    "data-content-type": pageRole.contentType,
  };

  if (pageRole.clusterId) {
    attrs["data-cluster-id"] = pageRole.clusterId;
  }

  if (pageRole.canonicalEntity) {
    attrs["data-canonical-entity"] = pageRole.canonicalEntity;
  }

  // Phase 9: Nouveaux attributs analytics
  if (pageRole.funnelStage) {
    attrs["data-funnel-stage"] = pageRole.funnelStage;
  }

  if (pageRole.conversionGoal) {
    attrs["data-conversion-goal"] = pageRole.conversionGoal;
  }

  // Contexte véhicule depuis URL/session
  if (vehicleContext.formatted) {
    attrs["data-vehicle-context"] = vehicleContext.formatted;
  }

  return attrs;
}
