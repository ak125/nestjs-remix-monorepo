/**
 * 🚀 Service API pour les pages gamme avec fallback automatique
 * 
 * Stratégie :
 * 1. Essaie RPC V2 (ultra-rapide : ~75ms)
 * 2. Si échec, fallback sur méthode classique (~680ms)
 * 3. Log les performances pour monitoring
 */

const API_URL = process.env.API_URL || 'http://localhost:3000';

interface GammePageData {
  meta: {
    title: string;
    description: string;
    keywords: string;
    robots: string;
    canonical: string;
  };
  hero: {
    h1: string;
    content: string;
    image: string;
    wall: string;
    famille_info?: any;
  };
  motorisations: any[];
  catalogueFiltres?: any;
  equipementiers?: any;
  conseils?: any;
  informations?: any;
  guideAchat?: any;
  performance?: {
    total_time_ms: number;
    rpc_time_ms?: number;
    motorisations_count: number;
  };
}

interface FetchOptions {
  signal?: AbortSignal;
  useRpcV2?: boolean; // Feature flag
}

/**
 * Récupère les données d'une page gamme avec stratégie de fallback
 */
export async function fetchGammePageData(
  gammeId: number | string,
  options: FetchOptions = {}
): Promise<GammePageData> {
  const { signal, useRpcV2 = true } = options;
  
  const startTime = performance.now();
  
  // Tentative RPC V2 (ultra-optimisé)
  if (useRpcV2) {
    try {
      console.log(`⚡ Tentative RPC V2 pour gamme ${gammeId}...`);
      
      const rpcResponse = await fetch(
        `${API_URL}/api/gamme-rest-optimized/${gammeId}/page-data-rpc-v2`,
        {
          headers: { 'Accept': 'application/json' },
          signal,
        }
      );

      if (rpcResponse.ok) {
        const data = await rpcResponse.json();
        const elapsed = performance.now() - startTime;
        
        // Pas d'erreur dans la réponse
        if (!data.error) {
          console.log(
            `✅ RPC V2 SUCCESS pour gamme ${gammeId} en ${elapsed.toFixed(0)}ms` +
            ` (RPC: ${data.performance?.rpc_time_ms?.toFixed(0)}ms)`
          );
          return data;
        }
        
        console.warn(`⚠️ RPC V2 returned error:`, data.error);
      } else {
        console.warn(`⚠️ RPC V2 HTTP ${rpcResponse.status}`);
      }
    } catch (error) {
      console.warn(`⚠️ RPC V2 failed:`, error.message);
    }
  }

  // Fallback sur méthode classique
  console.log(`🔄 Fallback méthode classique pour gamme ${gammeId}...`);
  
  const classicResponse = await fetch(
    `${API_URL}/api/gamme-rest-optimized/${gammeId}/page-data`,
    {
      headers: { 'Accept': 'application/json' },
      signal,
    }
  );

  if (!classicResponse.ok) {
    throw new Response('API Error', { status: classicResponse.status });
  }

  const data = await classicResponse.json();
  const elapsed = performance.now() - startTime;
  
  console.log(
    `✅ Classic method SUCCESS pour gamme ${gammeId} en ${elapsed.toFixed(0)}ms` +
    ` (Total: ${data.performance?.total_time_ms?.toFixed(0)}ms)`
  );

  return data;
}

/**
 * Feature flag pour activer/désactiver RPC V2
 * À configurer via variable d'environnement
 */
export const ENABLE_RPC_V2 = process.env.ENABLE_RPC_V2 !== 'false'; // Activé par défaut

/**
 * Version simplifiée pour compatibilité
 */
export async function fetchGammePageDataLegacy(
  gammeId: number | string,
  signal?: AbortSignal
): Promise<GammePageData> {
  return fetchGammePageData(gammeId, { signal, useRpcV2: ENABLE_RPC_V2 });
}
