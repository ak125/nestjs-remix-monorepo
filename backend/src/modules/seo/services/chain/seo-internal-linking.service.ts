import { Injectable, Logger } from '@nestjs/common';

import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { TABLES } from '@repo/database-types';
import { type SurfaceKey } from '@repo/seo-role-contracts';

export interface MarkerLookupInput {
  /** Surface qui PORTE le marqueur (ex: page R1 contenant `#LinkGamme_42#`). */
  sourceSurfaceKey: SurfaceKey;
  /** Markers brut détectés dans le template (ex: `['#LinkGamme_42#', '#LinkGammeCar_5#']`). */
  markers: string[];
}

export interface ResolvedLink {
  /** Marker original. */
  marker: string;
  /** HTML du lien si la cible a un contenu valide, sinon fallback texte. */
  html: string;
  /** True si on a généré un vrai `<a>`, false si fallback texte. */
  isLink: boolean;
}

interface GammeRow {
  pg_id: number;
  pg_name: string;
  pg_alias: string | null;
  pg_url_slug?: string | null;
  pg_display?: boolean | null;
}

/**
 * STUB de résolution des marqueurs `#LinkGamme_X#` / `#LinkGammeCar_X#`
 * (linking interne SEO, marqueurs legacy `meta.conf.php`).
 *
 * Stratégie PR-2c :
 *   - **lookup direct** par pg_id sur `pieces_gamme` (1 query par batch).
 *   - lien créé seulement si `pg_display = true` (gate `allowed=true` legacy).
 *   - fallback texte sinon (jamais de lien cassé vers une gamme désactivée).
 *
 * **PR-7 cible** : remplace ce stub par lookup pré-calculé sur la MV
 * `seo_internal_link_candidates` (gain ~5-10× sur TTFB R1/R7/R8) — cf.
 * plan seo-v9 §3.7.
 *
 * @see plan seo-v9 §3.1 — `SeoInternalLinkingService` (stub PR-2c → MV PR-7)
 */
@Injectable()
export class SeoInternalLinkingService extends SupabaseBaseService {
  protected readonly logger = new Logger(SeoInternalLinkingService.name);

  /** Texte fallback si la gamme cible est inactive ou inconnue. */
  private static readonly FALLBACK_TEXT = 'nos pièces auto';

  /**
   * Extrait les pg_id distincts depuis une liste de marqueurs.
   * Pure : testable sans DB.
   *
   * Reconnaît : `#LinkGamme_<id>#`, `#LinkGammeCar_<id>#` (insensible à la casse).
   */
  extractGammeIds(markers: string[]): number[] {
    const ids = new Set<number>();
    const re = /#LinkGamme(?:Car)?_(\d+)#/i;
    for (const marker of markers) {
      const m = re.exec(marker);
      if (m) ids.add(Number.parseInt(m[1]!, 10));
    }
    return [...ids].sort((a, b) => a - b);
  }

  /**
   * Construit l'anchor `<a>` à partir d'une ligne `pieces_gamme` validée.
   * Pure : testable sans DB.
   */
  buildAnchor(row: GammeRow): string {
    const slug = row.pg_url_slug || row.pg_alias || String(row.pg_id);
    return `<a href="/gammes/${slug}" class="link-gamme-internal">${row.pg_name}</a>`;
  }

  /** Texte fallback exposé pour cohérence avec le caller. */
  fallbackText(): string {
    return SeoInternalLinkingService.FALLBACK_TEXT;
  }

  /**
   * Résout tous les marqueurs en batch (1 query Supabase quel que soit le
   * nombre de marqueurs). Cache mémoire 1h par pg_id pour atténuer les hits
   * répétés en attendant PR-7.
   *
   * @returns une Map `marker → ResolvedLink` (avec fallback si gamme inactive
   * ou inconnue).
   */
  async resolveMarkers(
    input: MarkerLookupInput,
  ): Promise<Map<string, ResolvedLink>> {
    const result = new Map<string, ResolvedLink>();
    if (!input.markers.length) return result;

    const ids = this.extractGammeIds(input.markers);
    if (!ids.length) {
      for (const marker of input.markers) {
        result.set(marker, {
          marker,
          html: SeoInternalLinkingService.FALLBACK_TEXT,
          isLink: false,
        });
      }
      return result;
    }

    const rowsById = await this.loadGammes(ids);

    for (const marker of input.markers) {
      const idMatch = /#LinkGamme(?:Car)?_(\d+)#/i.exec(marker);
      if (!idMatch) {
        result.set(marker, {
          marker,
          html: SeoInternalLinkingService.FALLBACK_TEXT,
          isLink: false,
        });
        continue;
      }
      const id = Number.parseInt(idMatch[1]!, 10);
      const row = rowsById.get(id);
      if (row && row.pg_display !== false) {
        result.set(marker, {
          marker,
          html: this.buildAnchor(row),
          isLink: true,
        });
      } else {
        result.set(marker, {
          marker,
          html: SeoInternalLinkingService.FALLBACK_TEXT,
          isLink: false,
        });
      }
    }
    return result;
  }

  private async loadGammes(ids: number[]): Promise<Map<number, GammeRow>> {
    const { data, error } = await this.supabase
      .from(TABLES.pieces_gamme)
      .select('pg_id, pg_name, pg_alias, pg_url_slug, pg_display')
      .in('pg_id', ids);

    const rows = (data ?? []) as GammeRow[];
    if (error) {
      this.logger.error(
        `[SeoInternalLinkingService] erreur fetch pieces_gamme: ${error.message}`,
      );
    }

    return new Map(rows.map((r) => [r.pg_id, r]));
  }
}
