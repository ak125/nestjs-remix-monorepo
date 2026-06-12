/**
 * R1RelatedResourcesService — Sert les blocs de maillage contextuel
 * des pages gamme R1 depuis `__seo_r1_related_blocks_cache` (ADR-024 Phase 5).
 *
 * Phase 5 (2026-06-11) : le chemin SSR ne lit plus le filesystem RAG
 * (RAG = chatbot only, ADR-031/046). Cache matérialisé le 2026-06-11 :
 * 238 G1/G2, golden sample 14/14 identique
 * (audit/r1-related-blocks-golden-sample-20260611/).
 * Producteur + rafraîchisseur futur du cache = sync wiki→DB ADR-059
 * (contrat candidat §C2, audit/seo-wiki-to-content-db-wiring-design-20260610.md).
 *
 * Contrat du payload (§C2) :
 * - Max 3 blocs, max 3 liens par bloc, pas de self-link
 * - Blocs vides non retournés ; le frontend consomme, n'arbitre rien
 * - Gamme hors cache (G3/noindex) → `{ blocks: [] }` par design, observable
 *   via GET /api/admin/r1-related-blocks-cache/stats
 */
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { type R1RelatedBlocksPayload } from '../types/r1-related-links.types';

@Injectable()
export class R1RelatedResourcesService extends SupabaseBaseService {
  protected readonly logger = new Logger(R1RelatedResourcesService.name);

  async buildRelatedBlocks(
    pgId: number,
    _pgAlias: string,
    _pgName: string,
    _options?: { referenceSlug?: string | null },
  ): Promise<R1RelatedBlocksPayload> {
    try {
      const { data: cachedPayload, error } =
        await this.callRpc<R1RelatedBlocksPayload | null>(
          'get_r1_related_blocks_cached',
          { p_pg_id: pgId },
          { source: 'api' },
        );
      if (
        !error &&
        cachedPayload &&
        Array.isArray(cachedPayload.blocks) &&
        cachedPayload.blocks.length > 0
      ) {
        return cachedPayload;
      }
      if (error) {
        this.logger.warn(
          `[R1-related-cache] read error pg_id=${pgId}, serving empty blocks: ${error.message ?? error}`,
        );
      }
    } catch (e) {
      this.logger.warn(
        `[R1-related-cache] read failed pg_id=${pgId}, serving empty blocks: ${e instanceof Error ? e.message : e}`,
      );
    }

    // Cache miss = gamme non matérialisée (G3/noindex) ou payload vide → blocs
    // vides par design (§C2). Le repeuplement appartient au sync ADR-059.
    return { blocks: [] };
  }

  async getCacheStats(): Promise<{
    total: number;
    stale: number;
    oldest_built_at: string | null;
    newest_built_at: string | null;
  }> {
    const [{ count: total }, { count: stale }, { data: oldestRaw }] =
      await Promise.all([
        this.supabase
          .from('__seo_r1_related_blocks_cache')
          .select('*', { count: 'exact', head: true }),
        this.supabase
          .from('__seo_r1_related_blocks_cache')
          .select('*', { count: 'exact', head: true })
          .eq('stale', true),
        this.supabase
          .from('__seo_r1_related_blocks_cache')
          .select('built_at')
          .order('built_at', { ascending: true })
          .limit(1),
      ]);
    const { data: newestRaw } = await this.supabase
      .from('__seo_r1_related_blocks_cache')
      .select('built_at')
      .order('built_at', { ascending: false })
      .limit(1);
    return {
      total: total ?? 0,
      stale: stale ?? 0,
      oldest_built_at: oldestRaw?.[0]?.built_at ?? null,
      newest_built_at: newestRaw?.[0]?.built_at ?? null,
    };
  }
}
