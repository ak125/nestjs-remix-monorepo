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
 * const typeModels = await getTypeModelIndex(this.supabase);
 * const kept = pieces.filter(p => sitemapLinkState(p, typeModels) === 'live');
 * ```
 *
 * Modèle de rattachement : __sitemap_p_link garde aussi le modèle que le type
 * avait à sa génération. Quand un type a été rattaché à un autre modèle dans
 * auto_type, l'URL construite depuis la ligne répond 301 vers le modèle actuel.
 * `sitemapLinkState` écarte ces lignes de la même façon, en mémoire, sans
 * écrire en base.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** type_id_i → modèle de rattachement actuel (null si non numérique). */
export type TypeModelIndex = Map<number, number | null>;

export type SitemapLinkState = 'live' | 'orphan_type' | 'stale_model';

let cachedIndex: TypeModelIndex | null = null;
let cacheExpiresAt = 0;
let inflightPromise: Promise<TypeModelIndex> | null = null;

function toInt(value: unknown): number | null {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? parseInt(value, 10)
        : NaN;
  return Number.isInteger(n) ? n : null;
}

/**
 * Retourne, pour chaque type affiché (type_display = '1'), son modèle de
 * rattachement actuel dans auto_type. Cache in-memory 10 min. Déduplique les
 * appels concurrents. Une erreur de lecture est levée, jamais remplacée par un
 * index vide.
 */
export async function getTypeModelIndex(
  supabase: SupabaseClient,
): Promise<TypeModelIndex> {
  const now = Date.now();
  if (cachedIndex && now < cacheExpiresAt) {
    return cachedIndex;
  }
  if (inflightPromise) {
    return inflightPromise;
  }

  inflightPromise = (async () => {
    const index: TypeModelIndex = new Map();
    const PAGE_SIZE = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('auto_type')
        .select('type_id_i, type_modele_id')
        .eq('type_display', '1')
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        throw new Error(
          `auto_type read failed at offset ${offset}: ${error.message}`,
        );
      }

      if (!data || data.length === 0) {
        hasMore = false;
        break;
      }

      for (const row of data) {
        if (typeof row.type_id_i === 'number') {
          index.set(row.type_id_i, toInt(row.type_modele_id));
        }
      }

      hasMore = data.length === PAGE_SIZE;
      offset += PAGE_SIZE;
    }

    cachedIndex = index;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    return index;
  })();

  try {
    return await inflightPromise;
  } finally {
    inflightPromise = null;
  }
}

/**
 * État d'une ligne de __sitemap_p_link face à auto_type :
 * - `orphan_type` : le type n'existe plus ou n'est plus affiché ;
 * - `stale_model` : le type est rattaché à un autre modèle que celui de la
 *   ligne — l'URL construite depuis la ligne redirige ;
 * - `live` : sinon. Un modèle de rattachement illisible dans auto_type ne
 *   suffit pas à écarter la ligne.
 */
export function sitemapLinkState(
  link: { map_type_id: unknown; map_modele_id?: unknown },
  index: TypeModelIndex,
): SitemapLinkState {
  const typeId = toInt(link.map_type_id);
  if (typeId === null || !index.has(typeId)) {
    return 'orphan_type';
  }
  const currentModelId = index.get(typeId) ?? null;
  if (currentModelId === null) {
    return 'live';
  }
  return toInt(link.map_modele_id) === currentModelId ? 'live' : 'stale_model';
}

/**
 * Invalide le cache (utilisé par les tests + après toute régénération auto_type)
 */
export function invalidateValidTypeIdsCache(): void {
  cachedIndex = null;
  cacheExpiresAt = 0;
}
