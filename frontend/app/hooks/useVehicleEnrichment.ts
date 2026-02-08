import { useQuery } from "@tanstack/react-query";
import { logger } from "~/utils/logger";

/**
 * Interface pour un véhicule enrichi
 */
export interface EnrichedVehicleType {
  type_id: number;
  make: string;
  model: string;
  generation: string;
  engine: string;
  power_hp: number | null;
  year_from: string | null;
  year_to: string | null;
  fuel: string;
  type_name: string;
  type_liter?: string;
  type_body?: string;
}

/**
 * Hook pour récupérer les informations enrichies des véhicules par type_ids
 *
 * @param typeIds - Array de type_ids à enrichir
 * @returns Query avec les données enrichies sous forme de map type_id -> EnrichedVehicleType
 */
export function useVehicleEnrichment(typeIds: number[]) {
  // Filtrer et dédupliquer les IDs valides
  const validIds = [...new Set(typeIds.filter((id) => id > 0 && !isNaN(id)))];

  return useQuery({
    queryKey: ["vehicle-enrichment", validIds.sort().join(",")],
    queryFn: async (): Promise<Record<number, EnrichedVehicleType>> => {
      logger.log(
        "[useVehicleEnrichment] Starting fetch for IDs:",
        validIds.slice(0, 10),
        "... (total:",
        validIds.length,
        ")",
      );

      if (validIds.length === 0) {
        logger.log("[useVehicleEnrichment] No valid IDs, returning empty");
        return {};
      }

      try {
        const response = await fetch("/api/admin/vehicles/types/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include", // Inclure les cookies de session pour l'authentification admin
          body: JSON.stringify({ type_ids: validIds }),
        });

        logger.log(
          "[useVehicleEnrichment] Response status:",
          response.status,
          response.statusText,
        );

        if (!response.ok) {
          logger.error(
            "[useVehicleEnrichment] Failed to resolve vehicle types:",
            response.status,
            response.statusText,
          );
          return {};
        }

        const data = await response.json();
        logger.log(
          "[useVehicleEnrichment] Response data keys:",
          Object.keys(data).slice(0, 5),
          "... (total:",
          Object.keys(data).length,
          ")",
        );
        return data as Record<number, EnrichedVehicleType>;
      } catch (error) {
        logger.error(
          "[useVehicleEnrichment] Error fetching vehicle enrichment:",
          error,
        );
        return {};
      }
    },
    enabled: validIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (anciennement cacheTime)
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

/**
 * Formater l'affichage d'un véhicule enrichi en une ligne
 *
 * Format: #<type_id> — MAKE MODEL — engine — power ch — years — fuel
 */
export function formatEnrichedVehicle(enriched: EnrichedVehicleType): string {
  const parts: string[] = [];

  // ID
  parts.push(`#${enriched.type_id}`);

  // Make + Model/Generation
  const makeModel = [enriched.make, enriched.generation || enriched.model]
    .filter(Boolean)
    .join(" ");
  if (makeModel) parts.push(makeModel);

  // Engine
  if (enriched.engine && enriched.engine !== "N/A") {
    parts.push(enriched.engine);
  }

  // Power
  if (enriched.power_hp) {
    parts.push(`${enriched.power_hp} ch`);
  }

  // Years
  if (enriched.year_from) {
    const years =
      enriched.year_from + (enriched.year_to ? `–${enriched.year_to}` : "–...");
    parts.push(years);
  }

  // Fuel
  if (enriched.fuel && enriched.fuel !== "N/A") {
    parts.push(enriched.fuel);
  }

  return parts.join(" — ");
}
