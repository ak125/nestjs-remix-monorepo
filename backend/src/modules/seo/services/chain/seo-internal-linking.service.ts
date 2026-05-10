import { createHash } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { TABLES } from '@repo/database-types';
import { type SurfaceKey, SURFACE_TO_ROLE } from '@repo/seo-role-contracts';
import { type RoleId } from '@repo/seo-roles';

/**
 * Raison structurée pour laquelle un marqueur n'a pas généré de lien indexable.
 *
 * Énumération stable consommée par PR-3+ (controllers shadow mode), PR-7
 * (lookup MV `seo_internal_link_candidates`), PR-9 (fingerprint duplicate
 * gate). Toute extension passe par ajout — pas de retypage breaking.
 */
export type LinkResolutionReason =
  | 'NO_TARGET'
  | 'NOINDEX'
  | 'CANONICAL_MISMATCH'
  | 'FORBIDDEN_ROLE'
  | 'SELF_LINK'
  | 'ORPHAN';

/**
 * Résultat canonique de résolution d'un marqueur de lien interne.
 *
 * Contrat stable — l'implémentation interne (stub direct PR-2c → MV PR-7)
 * peut évoluer sans casser les consommateurs (orchestrator, builder,
 * controllers shadow).
 *
 * @see plan seo-v9 §3.1 + §6 verrous techniques rev 2 (anti-breaking PR-7)
 */
export interface LinkResolutionResult {
  /** Marqueur original (ex: `#LinkGamme_42#`). */
  marker: string;
  /** HTML `<a>` si lien indexable, fallback texte sinon. */
  html: string;
  /** True si on a généré un vrai `<a>`, false si fallback texte. */
  isLink: boolean;
  /** URL absolue de la cible si résolue (sinon `null`). */
  targetUrl: string | null;
  /** Rôle SEO canonique de la cible (issu de `SURFACE_TO_ROLE`). */
  targetRole: RoleId | null;
  /** True si la cible serait actuellement indexable (`pg_display=true`). */
  indexable: boolean;
  /** Raison structurée du fallback (absente si `isLink=true`). */
  reason?: LinkResolutionReason;
}

/**
 * Inputs canoniques de la résolution batch.
 *
 * `markers[]` est obligatoire ; les autres champs servent à PR-7+ (cache
 * key canonique, détection self-link, lookup MV pré-calculée).
 */
export interface ResolveLinksBatchInput {
  /** Surface qui PORTE le marqueur (page R1 contenant `#LinkGamme_42#`). */
  sourceSurfaceKey: SurfaceKey;
  /** Markers brut détectés dans le template. */
  markers: string[];
  /**
   * Identifiant de la source (pg_id, brand_id, type_id selon surface). Sert
   * à la clé de cache canonique et au check `SELF_LINK` (PR-7+).
   */
  sourceEntityId?: string | number;
  /** Contexte véhicule pour les surfaces R1_GAMME_VEHICLE_ROUTER / R8_VEHICLE. */
  vehicleId?: number | null;
  /** Contexte gamme parente (utile pour disambiguer une marque-gamme). */
  gammeId?: number | null;
  /** Locale (FR par défaut). */
  locale?: string;
}

interface GammeRow {
  pg_id: number;
  pg_name: string;
  pg_alias: string | null;
  pg_url_slug?: string | null;
  pg_display?: boolean | null;
}

/**
 * Service de résolution batch des marqueurs `#LinkGamme_X#` /
 * `#LinkGammeCar_X#` (linking interne SEO, marqueurs legacy `meta.conf.php`).
 *
 * **Stratégie PR-2c (stub interne, contrat stable)** :
 *   - 1 query Supabase batch (`IN (...)` sur les pg_id distincts).
 *   - Lien créé seulement si `pg_display=true` (gate `allowed=true` legacy).
 *   - Fallback texte sinon (jamais de lien cassé vers gamme désactivée).
 *
 * **PR-7 cible** : remplace ce stub par lookup MV pré-calculé
 * `seo_internal_link_candidates` (gain ~5-10× sur TTFB R1/R7/R8). Le
 * contrat `resolveLinksBatch(...) → LinkResolutionResult[]` reste stable.
 *
 * **Canon clé Redis** (PR-7/PR-8) :
 *   `seo:v9:linking:${surface}:${sourceEntityId}:${markerHash}`
 *   - TTL : 3600s (1h)
 *   - Invalidation : cron daily refresh + event `seo.target_indexability_changed`
 *   - Namespace : `seo:v9:*` (toutes les clés du moteur SEO v9)
 *
 * @see plan seo-v9 §3.1 + §6 verrous rev 2 — `SeoInternalLinkingService`
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
   * Reconnaît : `#LinkGamme_<id>#`, `#LinkGammeCar_<id>#` (insensible à la
   * casse).
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

  /**
   * URL cible absolue (sans le host — résolue à `https://example.com/gammes/...`
   * côté caller via `baseUrl`). Pure : testable sans DB.
   */
  buildTargetUrl(row: GammeRow): string {
    const slug = row.pg_url_slug || row.pg_alias || String(row.pg_id);
    return `/gammes/${slug}`;
  }

  /** Texte fallback exposé pour cohérence avec le caller. */
  fallbackText(): string {
    return SeoInternalLinkingService.FALLBACK_TEXT;
  }

  /**
   * Hash canonique des marqueurs pour la clé de cache (PR-7/PR-8). Trie
   * les markers pour stabiliser la clé indépendamment de l'ordre d'appel.
   *
   * Pure : testable sans DB.
   */
  buildCacheKey(input: ResolveLinksBatchInput): string {
    const sortedMarkers = [...new Set(input.markers)].sort();
    const markerHash = createHash('sha1')
      .update(sortedMarkers.join('|'))
      .digest('hex')
      .slice(0, 16);
    const entity = input.sourceEntityId ?? '';
    return `seo:v9:linking:${input.sourceSurfaceKey}:${entity}:${markerHash}`;
  }

  /**
   * Résout tous les marqueurs en batch (1 query Supabase quel que soit le
   * nombre de marqueurs distincts).
   *
   * Préserve l'ordre d'entrée : `result[i].marker === input.markers[i]`.
   *
   * @see {@link LinkResolutionResult} pour le contrat stable
   */
  async resolveLinksBatch(
    input: ResolveLinksBatchInput,
  ): Promise<LinkResolutionResult[]> {
    if (input.markers.length === 0) return [];

    const ids = this.extractGammeIds(input.markers);

    // Aucun id valide dans les markers : tous orphans.
    if (ids.length === 0) {
      return input.markers.map((marker) =>
        this.buildOrphanResult(marker, input.sourceSurfaceKey),
      );
    }

    const rowsById = await this.loadGammes(ids);

    return input.markers.map((marker) => {
      const idMatch = /#LinkGamme(?:Car)?_(\d+)#/i.exec(marker);
      if (!idMatch) {
        return this.buildOrphanResult(marker, input.sourceSurfaceKey);
      }

      const id = Number.parseInt(idMatch[1]!, 10);
      const row = rowsById.get(id);

      // Cible inexistante en base.
      if (!row) {
        return this.buildFallbackResult({
          marker,
          surface: input.sourceSurfaceKey,
          reason: 'NO_TARGET',
          indexable: false,
          targetUrl: null,
        });
      }

      // Cible désactivée éditorialement.
      if (row.pg_display === false) {
        return this.buildFallbackResult({
          marker,
          surface: input.sourceSurfaceKey,
          reason: 'NOINDEX',
          indexable: false,
          targetUrl: this.buildTargetUrl(row),
        });
      }

      // Self-link : pg_id source === pg_id target.
      if (
        input.sourceEntityId != null &&
        String(input.sourceEntityId) === String(row.pg_id)
      ) {
        return this.buildFallbackResult({
          marker,
          surface: input.sourceSurfaceKey,
          reason: 'SELF_LINK',
          indexable: true,
          targetUrl: this.buildTargetUrl(row),
        });
      }

      // Cible valide → lien indexable.
      return {
        marker,
        html: this.buildAnchor(row),
        isLink: true,
        targetUrl: this.buildTargetUrl(row),
        targetRole: this.resolveTargetRole(input.sourceSurfaceKey),
        indexable: true,
      };
    });
  }

  /**
   * @deprecated PR-2c stub — utilisez `resolveLinksBatch(input)`. Retourne
   * une `Map<string, LinkResolutionResult>` pour transition douce des
   * consommateurs existants. Sera supprimé en PR-3 quand orchestrator +
   * builder consomment l'array.
   */
  async resolveMarkers(input: {
    sourceSurfaceKey: SurfaceKey;
    markers: string[];
  }): Promise<Map<string, LinkResolutionResult>> {
    const results = await this.resolveLinksBatch({
      sourceSurfaceKey: input.sourceSurfaceKey,
      markers: input.markers,
    });
    return new Map(results.map((r) => [r.marker, r]));
  }

  // ───────────────── private — pure builders ─────────────────

  private buildOrphanResult(
    marker: string,
    surface: SurfaceKey,
  ): LinkResolutionResult {
    return this.buildFallbackResult({
      marker,
      surface,
      reason: 'ORPHAN',
      indexable: false,
      targetUrl: null,
    });
  }

  private buildFallbackResult(args: {
    marker: string;
    surface: SurfaceKey;
    reason: LinkResolutionReason;
    indexable: boolean;
    targetUrl: string | null;
  }): LinkResolutionResult {
    return {
      marker: args.marker,
      html: SeoInternalLinkingService.FALLBACK_TEXT,
      isLink: false,
      targetUrl: args.targetUrl,
      targetRole:
        args.reason === 'ORPHAN' ? null : this.resolveTargetRole(args.surface),
      indexable: args.indexable,
      reason: args.reason,
    };
  }

  private resolveTargetRole(surface: SurfaceKey): RoleId | null {
    return SURFACE_TO_ROLE[surface] ?? null;
  }

  private async loadGammes(ids: number[]): Promise<Map<number, GammeRow>> {
    const { data, error } = await this.supabase
      .from(TABLES.pieces_gamme)
      .select('pg_id, pg_name, pg_alias, pg_url_slug, pg_display')
      .in('pg_id', ids);

    if (error) {
      this.logger.error(
        `[SeoInternalLinkingService] erreur fetch pieces_gamme: ${error.message}`,
      );
      return new Map();
    }

    const rows = (data ?? []) as GammeRow[];
    return new Map(rows.map((r) => [r.pg_id, r]));
  }
}

/**
 * @deprecated Alias backward-compat. Utilisez `LinkResolutionResult`.
 */
export type ResolvedLink = LinkResolutionResult;

/**
 * @deprecated Alias backward-compat. Utilisez `ResolveLinksBatchInput`.
 */
export type MarkerLookupInput = Pick<
  ResolveLinksBatchInput,
  'sourceSurfaceKey' | 'markers'
>;
