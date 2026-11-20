/**
 * Sélection des pages R8 (`/constructeurs/<marque>-<id>/<modèle>-<id>/<type>-<id>.html`).
 *
 * Source unique de la liste R8 pour le hub HTML `constructeurs/`
 * (`HubsVehicleService.generateVehiclesHub`) et pour `sitemap-vehicules.xml`
 * (`SitemapV10StaticService.generateVehiculesSitemap`, mandat DR). Extraite
 * telle quelle du hub : même lecture de `__sitemap_p_link`, mêmes filtres,
 * même construction d'URL, même ordre.
 *
 * Le filtre robots de la page servie (`filterR8ByServedRobots`) n'est appliqué
 * que par le sitemap : le hub HTML garde sa liste.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { isR8TecdocReleaseGateOpen } from '@repo/seo-role-contracts';
import {
  normalizeAlias,
  normalizeTypeAlias,
  isMalformedSeoUrl,
} from '../../../common/utils/url-builder.utils';
import {
  getTypeModelIndex,
  sitemapLinkState,
} from './auto-type-valid-ids.helper';

export interface R8VehicleEntry {
  /** URL absolue (`baseUrl` + chemin). */
  url: string;
  typeId: number;
}

export interface R8VehicleSelection {
  entries: R8VehicleEntry[];
  /** Lignes parcourues (offset final de la pagination). */
  scannedRows: number;
  /** Combinaisons marque/modèle/type distinctes retenues avant le contrôle d'URL. */
  uniqueCount: number;
  skippedOrphans: number;
  skippedStaleModel: number;
  skippedMalformed: number;
  /** Lecture interrompue : la liste est partielle. */
  readError: { offset: number; message: string } | null;
}

interface SelectionLogger {
  log(message: string): void;
}

const PAGE_SIZE = 1000;

/**
 * Lit `__sitemap_p_link` (map_has_item > 5) page par page et retourne les R8
 * dont le type est affiché et rattaché au modèle de la ligne, dédupliquées
 * par marque/modèle/type, URL bien formée. Une erreur de lecture d'auto_type
 * est levée ; une erreur sur `__sitemap_p_link` arrête la lecture et est
 * rendue dans `readError` avec la liste partielle (comportement du hub).
 */
export async function collectR8VehicleUrls(
  supabase: SupabaseClient,
  baseUrl: string,
  logger?: SelectionLogger,
): Promise<R8VehicleSelection> {
  const typeModels = await getTypeModelIndex(supabase);
  let offset = 0;
  let hasMore = true;
  let skippedOrphans = 0;
  let skippedStaleModel = 0;
  let skippedMalformed = 0;
  let readError: R8VehicleSelection['readError'] = null;
  const seen = new Set<string>();
  const entries: R8VehicleEntry[] = [];

  while (hasMore) {
    const { data: vehicles, error } = await supabase
      .from('__sitemap_p_link')
      .select(
        'map_marque_alias, map_marque_id, map_modele_alias, map_modele_id, map_type_alias, map_type_id',
      )
      .gt('map_has_item', 5)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      readError = { offset, message: error.message };
      break;
    }

    if (vehicles && vehicles.length > 0) {
      for (const v of vehicles) {
        // Skip orphan type_ids (TecDoc V1 remap residue) and links whose
        // model is no longer the type's model (the URL would answer 301)
        const linkState = sitemapLinkState(v, typeModels);
        if (linkState === 'orphan_type') {
          skippedOrphans++;
          continue;
        }
        if (linkState === 'stale_model') {
          skippedStaleModel++;
          continue;
        }
        const key = `${v.map_marque_id}-${v.map_modele_id}-${v.map_type_id}`;
        if (
          !seen.has(key) &&
          v.map_marque_alias &&
          v.map_modele_alias &&
          v.map_type_alias
        ) {
          seen.add(key);
          // Format: /constructeurs/{marque}-{id}/{modele}-{id}/{type}-{id}.html
          const vehUrl = `${baseUrl}/constructeurs/${normalizeAlias(v.map_marque_alias)}-${v.map_marque_id}/${normalizeAlias(v.map_modele_alias)}-${v.map_modele_id}/${normalizeAlias(normalizeTypeAlias(v.map_type_alias, null, v.map_type_id))}-${v.map_type_id}.html`;
          if (isMalformedSeoUrl(vehUrl)) {
            skippedMalformed++;
          } else {
            entries.push({ url: vehUrl, typeId: Number(v.map_type_id) });
          }
        }
      }
      offset += PAGE_SIZE;
      hasMore = vehicles.length === PAGE_SIZE;

      if (offset % 50000 < PAGE_SIZE) {
        logger?.log(
          `   📊 Progress: ${offset.toLocaleString()} rows scanned, ${seen.size} unique vehicles`,
        );
      }
    } else {
      hasMore = false;
    }
  }

  return {
    entries,
    scannedRows: offset,
    uniqueCount: seen.size,
    skippedOrphans,
    skippedStaleModel,
    skippedMalformed,
    readError,
  };
}

/** Ligne de `__vehicle_page_cache` utile au filtre robots. */
export interface R8PageCacheRow {
  type_id: number;
  stale: boolean | null;
  is_indexable: unknown;
}

export type R8RobotsVerdict =
  | 'index'
  | 'tecdoc_gate'
  | 'not_indexable'
  | 'no_cache'
  | 'stale_cache';

/**
 * Traduction de la règle robots de la page R8 servie
 * (`frontend/app/components/vehicle/r8/r8-transform.ts:202-212`) :
 * `noindex` si `seo_validation.is_indexable` est faux ou si le type est sous
 * release gate TecDoc. `is_indexable` est lu dans `__vehicle_page_cache`, la
 * charge utile que sert `get_vehicle_page_data_cached`. Sans ligne de cache
 * fraîche, la page n'est pas jugée : elle n'entre pas au sitemap.
 */
export function r8RobotsVerdict(
  typeId: number,
  row: R8PageCacheRow | undefined,
): R8RobotsVerdict {
  if (isR8TecdocReleaseGateOpen(typeId)) return 'tecdoc_gate';
  if (!row) return 'no_cache';
  if (row.stale !== false) return 'stale_cache';
  return row.is_indexable === true ? 'index' : 'not_indexable';
}

const CACHE_CHUNK = 500;

/**
 * Garde les R8 servies `index, follow`. Lecture de `__vehicle_page_cache` par
 * paquets de type_id ; une erreur de lecture est levée (jamais un résultat
 * vide). Retourne les entrées gardées et le décompte des écartées par motif.
 */
export async function filterR8ByServedRobots(
  supabase: SupabaseClient,
  entries: R8VehicleEntry[],
): Promise<{
  kept: R8VehicleEntry[];
  excluded: Record<Exclude<R8RobotsVerdict, 'index'>, number>;
}> {
  const excluded = {
    tecdoc_gate: 0,
    not_indexable: 0,
    no_cache: 0,
    stale_cache: 0,
  };
  const typeIds = [
    ...new Set(
      entries
        .map((e) => e.typeId)
        .filter((id) => !isR8TecdocReleaseGateOpen(id)),
    ),
  ];
  const rows = new Map<number, R8PageCacheRow>();
  for (let i = 0; i < typeIds.length; i += CACHE_CHUNK) {
    const chunk = typeIds.slice(i, i + CACHE_CHUNK);
    const { data, error } = await supabase
      .from('__vehicle_page_cache')
      .select(
        'type_id, stale, is_indexable:payload->seo_validation->is_indexable',
      )
      .in('type_id', chunk);
    if (error) {
      throw new Error(
        `__vehicle_page_cache read failed (chunk ${i / CACHE_CHUNK}): ${error.message}`,
      );
    }
    for (const row of (data ?? []) as R8PageCacheRow[]) {
      rows.set(Number(row.type_id), row);
    }
  }

  const kept: R8VehicleEntry[] = [];
  for (const entry of entries) {
    const verdict = r8RobotsVerdict(entry.typeId, rows.get(entry.typeId));
    if (verdict === 'index') kept.push(entry);
    else excluded[verdict]++;
  }
  return { kept, excluded };
}
