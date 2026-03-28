/**
 * R1RelatedResourcesService — Construit des blocs de maillage contextuel
 * pour les pages gamme R1, basés sur RAG + DB.
 *
 * Règles :
 * - Max 3 blocs, max 3 liens par bloc
 * - Pas de self-link, pas de noindex
 * - Blocs vides non retournés
 * - Le frontend consomme, n'arbitre rien
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import {
  type R1RelatedBlock,
  type R1RelatedBlocksPayload,
  type R1RelatedLink,
  MAX_BLOCKS,
  MAX_LINKS_PER_BLOCK,
} from '../types/r1-related-links.types';
import { type RagData } from '../../admin/services/rag-data.types';
import { RagGammeReaderService } from '../../admin/services/rag-gamme-reader.service';

@Injectable()
export class R1RelatedResourcesService extends SupabaseBaseService {
  protected readonly logger = new Logger(R1RelatedResourcesService.name);

  @Inject() private readonly ragReader: RagGammeReaderService;

  async buildRelatedBlocks(
    pgId: number,
    pgAlias: string,
    pgName: string,
    _options?: { referenceSlug?: string | null },
  ): Promise<R1RelatedBlocksPayload> {
    // Lire le RAG (virtual merge si flag ON)
    const mergeResult =
      await this.ragReader.readAndParseWithDbKnowledge(pgAlias);
    const ragData = mergeResult?.ragData ?? null;

    // Construire les blocs candidats en parallèle
    const [confusionBlock, guideBlock, relatedBlock] = await Promise.all([
      this.buildConfusionBlock(pgAlias, pgName, ragData),
      this.buildGuideBlock(pgId, pgAlias, pgName),
      this.buildRelatedPartsBlock(pgAlias, pgName, ragData),
    ]);

    // Assembler : max 3 blocs non-vides, triés par priorité
    const allBlocks = [confusionBlock, guideBlock, relatedBlock]
      .filter((b): b is R1RelatedBlock => b !== null && b.items.length > 0)
      .slice(0, MAX_BLOCKS);

    return { blocks: allBlocks };
  }

  // ── Bloc 1 : À ne pas confondre ──

  private async buildConfusionBlock(
    pgAlias: string,
    pgName: string,
    ragData: RagData | null,
  ): Promise<R1RelatedBlock | null> {
    const confusions = ragData?.domain?.confusion_with ?? [];
    if (confusions.length === 0) return null;

    // Résoudre les aliases en gammes réelles
    const aliases = confusions.map((c) => c.term).filter((t) => t !== pgAlias);

    if (aliases.length === 0) return null;

    const { data: gammes } = await this.supabase
      .from('pieces_gamme')
      .select('pg_id, pg_alias, pg_name, pg_level')
      .in('pg_alias', aliases);

    const items: R1RelatedLink[] = (gammes ?? [])
      .filter((g) => String(g.pg_level) === '1') // Seulement gammes indexées
      .slice(0, MAX_LINKS_PER_BLOCK)
      .map((g) => {
        const confusion = confusions.find((c) => c.term === g.pg_alias);
        return {
          kind: 'avoid-confusion' as const,
          title: g.pg_name,
          href: `/pieces/${g.pg_alias}-${g.pg_id}.html`,
          reason: confusion?.difference || `Souvent confondu avec ${pgName}`,
          score: 1.0,
        };
      });

    if (items.length === 0) return null;

    return {
      kind: 'avoid-confusion',
      heading: `À ne pas confondre avec ${pgName.toLowerCase()}`,
      items,
    };
  }

  // ── Bloc 2 : Guides et choix ──

  private async buildGuideBlock(
    pgId: number,
    pgAlias: string,
    pgName: string,
  ): Promise<R1RelatedBlock | null> {
    const items: R1RelatedLink[] = [];

    // Vérifier R6 (guide achat)
    const { data: r6 } = await this.supabase
      .from('__seo_gamme_purchase_guide')
      .select('sgpg_id')
      .eq('sgpg_pg_id', pgId)
      .eq('sgpg_is_draft', false)
      .limit(1)
      .maybeSingle();

    if (r6) {
      items.push({
        kind: 'buying-guide',
        title: `Guide d'achat ${pgName}`,
        href: `/blog-pieces-auto/guide-achat/${pgAlias}`,
        reason: 'Guide complet pour bien choisir',
        score: 0.95,
      });
    }

    // Vérifier R3 (conseils)
    const { data: r3 } = await this.supabase
      .from('__seo_r3_keyword_plan')
      .select('rkp_id')
      .eq('rkp_pg_alias', pgAlias)
      .eq('rkp_status', 'validated')
      .limit(1)
      .maybeSingle();

    if (r3) {
      items.push({
        kind: 'buying-guide',
        title: `Conseils entretien ${pgName}`,
        href: `/blog-pieces-auto/conseils/${pgAlias}`,
        reason: 'Quand et comment remplacer',
        score: 0.9,
      });
    }

    if (items.length === 0) return null;

    return {
      kind: 'buying-guide',
      heading: `Bien choisir votre ${pgName.toLowerCase()}`,
      items: items.slice(0, MAX_LINKS_PER_BLOCK),
    };
  }

  // ── Bloc 3 : Pièces liées ──

  private async buildRelatedPartsBlock(
    pgAlias: string,
    pgName: string,
    ragData: RagData | null,
  ): Promise<R1RelatedBlock | null> {
    const relatedParts = ragData?.domain?.related_parts ?? [];
    if (relatedParts.length === 0) return null;

    // Filtrer self-link
    const aliases = relatedParts.filter((p) => p !== pgAlias);
    if (aliases.length === 0) return null;

    const { data: gammes } = await this.supabase
      .from('pieces_gamme')
      .select('pg_id, pg_alias, pg_name, pg_level')
      .in('pg_alias', aliases);

    const items: R1RelatedLink[] = (gammes ?? [])
      .filter((g) => String(g.pg_level) === '1')
      .slice(0, MAX_LINKS_PER_BLOCK)
      .map((g) => ({
        kind: 'compatible-parts' as const,
        title: g.pg_name,
        href: `/pieces/${g.pg_alias}-${g.pg_id}.html`,
        reason: `Souvent remplacé en même temps`,
        score: 0.6,
      }));

    if (items.length === 0) return null;

    return {
      kind: 'compatible-parts',
      heading: `Pièces souvent associées`,
      items,
    };
  }

  // RAG lecture centralisée via RagGammeReaderService (injecté)
}
