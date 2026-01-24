/**
 * Hook pour extraire le contexte véhicule depuis l'URL ou la session
 *
 * Phase 9: Analytics avancées - data-vehicle-context
 *
 * Priorité:
 * 1. URL params (/constructeurs/renault/clio/diesel)
 * 2. Session storage (véhicule sélectionné dans le sélecteur)
 */

import { useLocation, useParams } from "@remix-run/react";
import { useMemo } from "react";

export interface VehicleContext {
  brand?: string;
  model?: string;
  type?: string;
  /** Format: brand-model-type ou brand-model ou brand */
  formatted: string | null;
}

/**
 * Patterns d'URL qui contiennent des infos véhicule
 * - /constructeurs/{brand}
 * - /constructeurs/{brand}/{model}/{type}
 * - /pieces/{gamme}/{brand}/{model}/{type}.html
 */
const VEHICLE_URL_PATTERNS = [
  /\/constructeurs\/([^/]+)(?:\/([^/]+)\/([^/.]+))?/,
  /\/pieces\/[^/]+\/([^/]+)\/([^/]+)\/([^/.]+)\.html/,
];

/**
 * Extrait le contexte véhicule depuis l'URL ou la session
 */
export function useVehicleContext(): VehicleContext {
  const location = useLocation();
  const params = useParams();

  return useMemo(() => {
    let brand: string | undefined;
    let model: string | undefined;
    let type: string | undefined;

    // 1. Essayer d'extraire depuis les params Remix
    if (params.brand) {
      brand = params.brand;
      model = params.model;
      type = params.type;
    }

    // 2. Si pas trouvé, essayer via regex sur le pathname
    if (!brand) {
      for (const pattern of VEHICLE_URL_PATTERNS) {
        const match = location.pathname.match(pattern);
        if (match) {
          brand = match[1];
          model = match[2];
          type = match[3];
          break;
        }
      }
    }

    // 3. Fallback: session storage (côté client uniquement)
    if (!brand && typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem("selectedVehicle");
        if (stored) {
          const parsed = JSON.parse(stored);
          brand = parsed.brand;
          model = parsed.model;
          type = parsed.type;
        }
      } catch {
        // Ignore parsing errors
      }
    }

    // Formater le contexte véhicule
    let formatted: string | null = null;
    if (brand) {
      const parts = [brand, model, type].filter(Boolean);
      formatted = parts.join("-").toLowerCase();
    }

    return {
      brand,
      model,
      type,
      formatted,
    };
  }, [location.pathname, params]);
}

/**
 * Sauvegarde le véhicule sélectionné dans la session
 * À appeler depuis le sélecteur de véhicule
 */
export function saveVehicleToSession(vehicle: {
  brand?: string;
  model?: string;
  type?: string;
}): void {
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem("selectedVehicle", JSON.stringify(vehicle));
    } catch {
      // Ignore storage errors
    }
  }
}

/**
 * Efface le véhicule de la session
 */
export function clearVehicleFromSession(): void {
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem("selectedVehicle");
    } catch {
      // Ignore storage errors
    }
  }
}
