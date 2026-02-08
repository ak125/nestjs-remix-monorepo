/**
 * 📋 Service API pour récupérer les conseils de remplacement
 */

import { logger } from "~/utils/logger";

// Interface pour le conseil de gamme
export interface GammeConseil {
  title: string;
  content: string;
}

/**
 * Récupérer les conseils de remplacement pour une gamme
 * @param pg_id ID de la gamme (pieces_gamme)
 * @returns Objet avec titre et contenu des conseils ou null
 */
export async function getConseil(
  pg_id: number | string,
): Promise<GammeConseil | null> {
  try {
    const baseUrl =
      typeof window !== "undefined"
        ? window.ENV?.API_URL || "http://localhost:3000"
        : process.env.API_URL || "http://localhost:3000";

    const response = await fetch(`${baseUrl}/api/blog/conseil/${pg_id}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      logger.warn(`⚠️ Pas de conseils disponibles pour pg_id=${pg_id}`);
      return null;
    }

    const result = await response.json();

    if (!result.success || !result.data) {
      return null;
    }

    return result.data;
  } catch (error) {
    logger.error("❌ Erreur lors de la récupération des conseils:", error);
    return null;
  }
}
