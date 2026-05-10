/**
 * Helper : cache en mémoire des type_id_i valides dans auto_type
 *
 * Contexte : le remap TecDoc V1→V2 a laissé ~3,545 type_ids orphelins (range
 * 100001-134362) dans __sitemap_p_link. Ces IDs n'existent plus dans auto_type
 * (capé à type_id_i <= 83456 post-remap). Les URLs générées avec ces IDs dans
 * le sitemap XML créent ~75-85% des 411k GSC 404s observés le 2026-04-23.
 *
 * Ce helper fournit le Set des type_id_i valides pour filtrer en mémoire
 * après chaque fetch paginé de __sitemap_p_link, sans modifier la DB ni
 * toucher au sitemap existant (non-destructif).
 *
 * Stratégie :
 * - Lazy load (1 fetch DB au premier appel)
 * - Cache in-process (TTL 10 min) — acceptable car auto_type change peu
 * - ~53k rows × 8 bytes (number) = ~400 KB mémoire (négligeable)
 *
 * Usage :
 * ```typescript
 * const validSet = await getValidTypeIds(this.supabase);
 * const filteredPieces = pieces.filter(p => validSet.has(p.map_type_id));
 * ```
 */
import type { SupabaseClient } from '@supabase/supabase-js';

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

let cachedSet: Set<number> | null = null;
let cacheExpiresAt = 0;
let inflightPromise: Promise<Set<number>> | null = null;

/**
 * Retourne le Set des type_id_i valides (type_display = '1') depuis auto_type.
 * Cache in-memory 10 min. Déduplique les appels concurrents.
 */
export async function getValidTypeIds(
  supabase: SupabaseClient,
): Promise<Set<number>> {
  const now = Date.now();
  if (cachedSet && now < cacheExpiresAt) {
    return cachedSet;
  }
  if (inflightPromise) {
    return inflightPromise;
  }

  inflightPromise = (async () => {
    const validIds = new Set<number>();
    const PAGE_SIZE = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('auto_type')
        .select('type_id_i')
        .eq('type_display', '1')
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        throw new Error(
          `getValidTypeIds failed at offset ${offset}: ${error.message}`,
        );
      }

      if (!data || data.length === 0) {
        hasMore = false;
        break;
      }

      for (const row of data) {
        if (typeof row.type_id_i === 'number') {
          validIds.add(row.type_id_i);
        }
      }

      hasMore = data.length === PAGE_SIZE;
      offset += PAGE_SIZE;
    }

    cachedSet = validIds;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    return validIds;
  })();

  try {
    return await inflightPromise;
  } finally {
    inflightPromise = null;
  }
}

/**
 * Invalide le cache (utilisé par les tests + après toute régénération auto_type)
 */
export function invalidateValidTypeIdsCache(): void {
  cachedSet = null;
  cacheExpiresAt = 0;
}
