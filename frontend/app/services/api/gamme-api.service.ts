/**
 * Service API pour les pages gamme avec fallback automatique
 *
 * Strategie :
 * 1. Essaie RPC V2 (ultra-rapide : ~75ms)
 * 2. Si echec, fallback sur methode classique (~680ms)
 * 3. Log les performances pour monitoring
 */

import {
  type GammePageMeta,
  type GammePageFamille,
  type GammePagePerformance,
  type GammePageMotorisationItem,
  type GammePageCatalogueItem,
  type GammePageEquipementierItem,
  type GammePageConseilItem,
  type GammePagePurchaseGuideData,
  type GammePageBuyingGuide,
  type GammePageSeoSwitch,
} from "~/types/gamme-page-contract.types";
import { logger } from "~/utils/logger";

const API_URL = process.env.API_URL || "http://localhost:3000";

export interface GammeApiResponse {
  meta: GammePageMeta;
  hero: {
    h1: string;
    content: string;
    image: string;
    wall: string;
    famille_info?: GammePageFamille;
    pg_name?: string;
    pg_alias?: string;
  };
  motorisations?: {
    title: string;
    items: GammePageMotorisationItem[];
  } | null;
  catalogueFiltres?: Record<string, unknown>;
  equipementiers?: {
    title: string;
    items: GammePageEquipementierItem[];
  } | null;
  conseils?: {
    title: string;
    content: string;
    items: GammePageConseilItem[];
  } | null;
  informations?: {
    title: string;
    content: string;
    items: string[];
  } | null;
  guideAchat?: Record<string, unknown> & { updated?: string };
  gammeBuyingGuide?: GammePageBuyingGuide | null;
  catalogueMameFamille?: {
    title: string;
    items: GammePageCatalogueItem[];
  } | null;
  purchaseGuideData?: GammePagePurchaseGuideData | null;
  performance?: GammePagePerformance;
  seoSwitches?: {
    verbs: GammePageSeoSwitch[];
    nouns: GammePageSeoSwitch[];
    verbCount: number;
    nounCount: number;
  };
  reference?: {
    slug: string;
    title: string;
    definition: string;
    roleMecanique: string | null;
    canonicalUrl: string | null;
  } | null;
}

interface FetchOptions {
  signal?: AbortSignal;
  useRpcV2?: boolean; // Feature flag
}

/**
 * Recupere les donnees d'une page gamme avec strategie de fallback
 */
export async function fetchGammePageData(
  gammeId: number | string,
  options: FetchOptions = {},
): Promise<GammeApiResponse> {
  const { signal, useRpcV2 = true } = options;

  const startTime = performance.now();

  // Tentative RPC V2 (ultra-optimise)
  if (useRpcV2) {
    try {
      logger.log(`⚡ Tentative RPC V2 pour gamme ${gammeId}...`);

      // Timeout specifique pour RPC V2 (10s max)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      // Timeout local 10s : ne PAS laisser le signal parent (30s) l'écraser
      const rpcSignal = controller.signal;

      const rpcResponse = await fetch(
        `${API_URL}/api/gamme-rest/${gammeId}/page-data-rpc-v2`,
        {
          headers: { Accept: "application/json" },
          signal: rpcSignal,
        },
      );

      clearTimeout(timeoutId);

      if (rpcResponse.ok) {
        const data = await rpcResponse.json();
        const elapsed = performance.now() - startTime;

        // Pas d'erreur dans la reponse
        if (!data.error) {
          logger.log(
            `✅ RPC V2 SUCCESS pour gamme ${gammeId} en ${elapsed.toFixed(0)}ms` +
              ` (RPC: ${data.performance?.rpc_time_ms?.toFixed(0)}ms)`,
          );
          return data;
        }

        logger.warn(`⚠️ RPC V2 returned error:`, data.error);
      } else {
        logger.warn(`⚠️ RPC V2 HTTP ${rpcResponse.status}`);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        logger.warn(`⏱️ RPC V2 Timeout (10s) pour gamme ${gammeId}`);
      } else {
        logger.warn(
          `⚠️ RPC V2 failed:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }

  // Fallback sur methode classique
  logger.log(`🔄 Fallback methode classique pour gamme ${gammeId}...`);

  // Timeout pour fallback (60s max)
  const fallbackController = new AbortController();
  const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), 60000);
  const fallbackSignal = signal || fallbackController.signal;

  try {
    const classicResponse = await fetch(
      `${API_URL}/api/gamme-rest-optimized/${gammeId}/page-data`,
      {
        headers: { Accept: "application/json" },
        signal: fallbackSignal,
      },
    );

    clearTimeout(fallbackTimeoutId);

    if (!classicResponse.ok) {
      throw new Response("API Error", { status: classicResponse.status });
    }

    const data = await classicResponse.json();
    const elapsed = performance.now() - startTime;

    logger.log(
      `✅ Classic method SUCCESS pour gamme ${gammeId} en ${elapsed.toFixed(0)}ms` +
        ` (Total: ${data.performance?.total_time_ms?.toFixed(0)}ms)`,
    );

    return data;
  } catch (error) {
    clearTimeout(fallbackTimeoutId);
    throw error;
  }
}

/**
 * Feature flag pour activer/desactiver RPC V2
 * A configurer via variable d'environnement
 */
export const ENABLE_RPC_V2 = process.env.ENABLE_RPC_V2 !== "false"; // Active par defaut

/**
 * Version simplifiee pour compatibilite
 */
export async function fetchGammePageDataLegacy(
  gammeId: number | string,
  signal?: AbortSignal,
): Promise<GammeApiResponse> {
  return fetchGammePageData(gammeId, { signal, useRpcV2: ENABLE_RPC_V2 });
}
