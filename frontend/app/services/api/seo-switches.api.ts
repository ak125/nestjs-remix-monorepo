/**
 * 🔤 API pour récupérer les switches SEO depuis la base de données
 */

import { logger } from "~/utils/logger";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export interface SeoItemSwitch {
  sis_id: string;
  sis_pg_id: string;
  sis_alias: string;
  sis_content: string;
}

export interface SeoSwitchesResponse {
  success: boolean;
  data: SeoItemSwitch[];
  count: number;
}

/**
 * Récupérer les switches SEO pour une gamme
 * @param pg_id ID de la gamme (ex: 1 pour alternateur)
 */
export async function getSeoSwitches(pg_id: number): Promise<SeoItemSwitch[]> {
  try {
    const response = await fetch(`${API_BASE}/api/blog/seo-switches/${pg_id}`);

    if (!response.ok) {
      logger.warn(`⚠️ Erreur API switches SEO: ${response.status}`);
      return [];
    }

    const result: SeoSwitchesResponse = await response.json();

    if (!result.success || !result.data) {
      logger.warn("⚠️ Aucun switch SEO trouvé");
      return [];
    }

    logger.log(`✅ ${result.count} switches SEO récupérés`);
    return result.data;
  } catch (error) {
    logger.error("❌ Erreur récupération switches SEO:", error);
    return [];
  }
}

/**
 * Obtenir un switch aléatoire depuis la liste
 * @param switches Liste des switches
 */
export function getRandomSwitch(switches: SeoItemSwitch[]): string | null {
  if (!switches || switches.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * switches.length);
  return switches[randomIndex].sis_content;
}
