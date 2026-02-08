/**
 * Service pour récupérer les variations SEO depuis Supabase
 * Réplique la logique PHP de __SEO_ITEM_SWITCH
 */

import { logger } from "~/utils/logger";

interface SeoVariation {
  sis_id: number;
  sis_pg_id: number;
  sis_alias: number;
  sis_content: string;
}

/**
 * Calcule l'index de variation basé sur type_id et pg_id
 * Réplique: ($type_id + $pg_id) % $total_variations
 */
export function calculateVariationIndex(
  typeId: number,
  pgId: number,
  totalVariations: number,
  offset: number = 0,
): number {
  return (typeId + pgId + offset) % totalVariations;
}

/**
 * Récupère une variation de texte "pas cher" depuis l'API
 */
export async function getPrixPasCherVariation(
  pgId: number,
  typeId: number,
): Promise<string> {
  try {
    // Récupérer toutes les variations pour SIS_ALIAS = 1 (prix pas cher)
    const response = await fetch(
      `http://localhost:3000/api/seo/variations?pg_id=${pgId}&alias=1`,
    );

    if (!response.ok) {
      return "au meilleur prix";
    }

    const data = await response.json();
    const variations: SeoVariation[] = data.variations || [];

    if (variations.length === 0) {
      return "au meilleur prix";
    }

    // Calculer l'index comme en PHP
    const index = calculateVariationIndex(typeId, pgId, variations.length);

    return variations[index]?.sis_content || "au meilleur prix";
  } catch (error) {
    logger.error("❌ Erreur récupération variation prix:", error);
    return "au meilleur prix";
  }
}

/**
 * Récupère une variation de texte pour le H1
 */
export async function getH1Variation(
  pgId: number,
  typeId: number,
): Promise<string> {
  try {
    // SIS_ALIAS = 3 pour les variations H1
    const response = await fetch(
      `http://localhost:3000/api/seo/variations?pg_id=0&alias=3`,
    );

    if (!response.ok) {
      return "";
    }

    const data = await response.json();
    const variations: SeoVariation[] = data.variations || [];

    if (variations.length === 0) {
      return "";
    }

    const index = calculateVariationIndex(typeId, pgId, variations.length);

    return variations[index]?.sis_content || "";
  } catch (error) {
    logger.error("❌ Erreur récupération variation H1:", error);
    return "";
  }
}

/**
 * Récupère une variation générique par alias
 */
export async function getSeoVariation(
  pgId: number,
  typeId: number,
  alias: number,
  offset: number = 0,
): Promise<string> {
  try {
    const response = await fetch(
      `http://localhost:3000/api/seo/variations?pg_id=${pgId}&alias=${alias}`,
    );

    if (!response.ok) {
      return "";
    }

    const data = await response.json();
    const variations: SeoVariation[] = data.variations || [];

    if (variations.length === 0) {
      return "";
    }

    const index = calculateVariationIndex(
      typeId,
      pgId,
      variations.length,
      offset,
    );

    return variations[index]?.sis_content || "";
  } catch (error) {
    logger.error(`❌ Erreur récupération variation alias ${alias}:`, error);
    return "";
  }
}
