import { Injectable, Logger } from '@nestjs/common';

import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { TABLES } from '@repo/database-types';

/**
 * Entrée meta canonique commune aux pages standard (`___meta_tags_ariane`)
 * et au blog (`__blog_meta_tags_ariane`).
 *
 * Les colonnes `mta_*` sont identiques dans les deux tables (cf. audit PR-1
 * volet 1 et plan seo-v9 §1.3.A).
 */
export interface SeoMetaEntry {
  alias: string;
  title: string;
  description: string;
  keywords: string;
  h1: string;
  ariane: string;
  content: string;
  /** `1` = follow, `0` = nofollow (legacy). */
  relfollow: '0' | '1';
}

/**
 * Catalogue des registres meta legacy. Aligné sur l'audit PR-1.
 */
export type SeoMetaCatalog = 'static' | 'blog';

const CATALOG_TABLE: Record<SeoMetaCatalog, string> = {
  static: TABLES.meta_tags_ariane,
  blog: TABLES.blog_meta_tags_ariane,
};

interface CacheEntry {
  data: SeoMetaEntry | null;
  expires: number;
}

/**
 * Service de lecture des meta legacy (`___meta_tags_ariane` 5 rows pour les
 * pages standard, `__blog_meta_tags_ariane` 5 rows pour le blog).
 *
 * Cache en mémoire 1h (suffisant : ces tables ne changent quasi jamais).
 * Pas de Redis : le cache est déjà partagé par worker, et les volumes (5 rows
 * × 2 catalogues) sont triviaux. Si besoin d'invalidation manuelle :
 * `invalidateCache()`.
 *
 * @see plan seo-v9 §3.2 — `SeoMetaRegistryService`
 * @see legacy PHP `meta.conf.php` (chargement metas standard + breadcrumbs)
 */
@Injectable()
export class SeoMetaRegistryService extends SupabaseBaseService {
  protected readonly logger = new Logger(SeoMetaRegistryService.name);

  private readonly CACHE_TTL_MS = 3_600_000;
  private readonly cache = new Map<string, CacheEntry>();

  /**
   * Récupère un registre meta par alias.
   *
   * @returns l'entrée meta si trouvée, sinon `null`. Pas de throw — le caller
   * décide du fallback (souvent : meta SEO programmatique pour la page).
   */
  async getMeta(
    catalog: SeoMetaCatalog,
    alias: string,
  ): Promise<SeoMetaEntry | null> {
    const cacheKey = `${catalog}:${alias}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.data;

    const table = CATALOG_TABLE[catalog];
    const { data, error } = await this.supabase
      .from(table)
      .select(
        'mta_alias, mta_title, mta_descrip, mta_keywords, mta_h1, mta_ariane, mta_content, mta_relfollow',
      )
      .eq('mta_alias', alias)
      .maybeSingle();

    if (error) {
      this.logger.error(
        `[SeoMetaRegistryService] erreur fetch ${table}.${alias}: ${error.message}`,
      );
      return null;
    }

    const entry = data ? this.mapRow(data) : null;
    this.cache.set(cacheKey, {
      data: entry,
      expires: Date.now() + this.CACHE_TTL_MS,
    });
    return entry;
  }

  /**
   * Mapping pure ligne SQL → `SeoMetaEntry`. Exposé pour testabilité (les
   * tests peuvent l'appeler directement avec une row fake sans hit la DB).
   */
  mapRow(row: Record<string, unknown>): SeoMetaEntry {
    const relfollow = String(row.mta_relfollow ?? '1') === '0' ? '0' : '1';
    return {
      alias: String(row.mta_alias ?? ''),
      title: String(row.mta_title ?? ''),
      description: String(row.mta_descrip ?? ''),
      keywords: String(row.mta_keywords ?? ''),
      h1: String(row.mta_h1 ?? ''),
      ariane: String(row.mta_ariane ?? ''),
      content: String(row.mta_content ?? ''),
      relfollow,
    };
  }

  invalidateCache(): void {
    this.cache.clear();
  }
}
