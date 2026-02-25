import { TABLES } from '@repo/database-types';
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  BlogArticle,
  BlogSection,
  BcRow,
  BaH2Row,
  BaH3Row,
} from '../interfaces/blog.interfaces';
import { BlogCacheService } from './blog-cache.service';

/**
 * ConstructeurTransformService - Transformation and utility methods for constructeurs
 *
 * Handles:
 * - Transforming raw DB rows into BlogArticle objects (single and batch)
 * - Slug/anchor generation
 * - Popularity scoring and tagging
 * - Content quality assessment
 */
@Injectable()
export class ConstructeurTransformService {
  private readonly logger = new Logger(ConstructeurTransformService.name);

  /**
   * Transformation batch (sans requetes DB) pour P3.3
   * Utilise les donnees pre-fetchees en batch
   */
  transformConstructeurToArticleBatch(
    constructeur: BcRow,
    h2Sections: BaH2Row[],
    h3Sections: BaH3Row[],
    modelsCount: number,
  ): BlogArticle {
    // Construction des sections avec decodage HTML optimise
    const sections: BlogSection[] = [
      ...(h2Sections?.map((s) => ({
        level: 2,
        title: BlogCacheService.decodeHtmlEntities(s.ba2_h2),
        content: BlogCacheService.decodeHtmlEntities(s.ba2_content),
        anchor: this.generateAnchor(s.ba2_h2),
      })) || []),
      ...(h3Sections?.map((s) => ({
        level: 3,
        title: BlogCacheService.decodeHtmlEntities(s.ba3_h3),
        content: BlogCacheService.decodeHtmlEntities(s.ba3_content),
        anchor: this.generateAnchor(s.ba3_h3),
      })) || []),
    ];

    // Generation des tags intelligents
    const baseTags = [
      `constructeur:${constructeur.bc_constructeur?.toLowerCase() || 'unknown'}`,
    ];
    const keywordTags = constructeur.bc_keywords
      ? constructeur.bc_keywords
          .split(', ')
          .map((k: string) => k.trim().toLowerCase())
      : [];

    const popularityTag = this.getPopularityTag(
      parseInt(constructeur.bc_visit) || 0,
    );
    const modelTag = modelsCount > 0 ? `models:${modelsCount}` : 'no-models';
    const letterTag = `letter:${(constructeur.bc_constructeur || 'A').charAt(0).toLowerCase()}`;

    const allTags = [
      ...baseTags,
      ...keywordTags,
      popularityTag,
      modelTag,
      letterTag,
    ];

    // Construction de l'article
    const article: BlogArticle = {
      id: `constructeur_${constructeur.bc_id}`,
      type: 'constructeur',
      title: BlogCacheService.decodeHtmlEntities(constructeur.bsm_marque_id),
      slug:
        constructeur.bc_alias || this.generateSlug(constructeur.bsm_marque_id),
      excerpt: BlogCacheService.decodeHtmlEntities(
        constructeur.bc_preview || constructeur.bc_descrip || '',
      ),
      content: BlogCacheService.decodeHtmlEntities(
        constructeur.bc_content || '',
      ),
      h1: BlogCacheService.decodeHtmlEntities(
        constructeur.bc_h1 || constructeur.bsm_marque_id,
      ),
      h2: BlogCacheService.decodeHtmlEntities(constructeur.bc_h2 || ''),
      keywords: keywordTags,
      tags: allTags,
      publishedAt: constructeur.bc_create || new Date().toISOString(),
      updatedAt:
        constructeur.bc_update ||
        constructeur.bc_create ||
        new Date().toISOString(),
      viewsCount: parseInt(constructeur.bc_visit) || 0,
      sections,
      legacy_id: parseInt(String(constructeur.bsm_id), 10),
      legacy_table: '__blog_constructeur',
      seo_data: {
        meta_title: BlogCacheService.decodeHtmlEntities(
          constructeur.bc_h1 || constructeur.bsm_marque_id,
        ),
        meta_description: BlogCacheService.decodeHtmlEntities(
          constructeur.bc_descrip || constructeur.bc_preview || '',
        ),
        keywords: keywordTags,
      },
    };

    return article;
  }

  /**
   * Transformation optimisee avec decodage HTML et requetes paralleles ameliorees
   */
  async transformConstructeurToArticle(
    client: SupabaseClient,
    constructeur: BcRow,
  ): Promise<BlogArticle> {
    try {
      // Recuperer les sections H2/H3 et modeles en parallele pour performance maximale
      const [h2Result, h3Result, crossResult] = await Promise.allSettled([
        client
          .from(TABLES.blog_advice_h2)
          .select('*')
          .eq('ba2_ba_id', constructeur.bsm_id)
          .order('ba2_id'),
        client
          .from(TABLES.blog_advice_h3)
          .select('*')
          .eq('bc3_bc_id', constructeur.bsm_id)
          .order('ba3_id'),
        client
          .from(TABLES.blog_advice_cross)
          .select('*', { count: 'exact', head: true })
          .eq('bac_ba_id', constructeur.bsm_id),
      ]);
      const h2Sections =
        h2Result.status === 'fulfilled' ? (h2Result.value.data ?? []) : [];
      const h3Sections =
        h3Result.status === 'fulfilled' ? (h3Result.value.data ?? []) : [];
      const modelsCount =
        crossResult.status === 'fulfilled' ? (crossResult.value.count ?? 0) : 0;

      // Construction des sections avec decodage HTML optimise
      const sections: BlogSection[] = [
        ...(h2Sections?.map((s) => ({
          level: 2,
          title: BlogCacheService.decodeHtmlEntities(s.ba2_h2),
          content: BlogCacheService.decodeHtmlEntities(s.ba2_content),
          anchor: this.generateAnchor(s.ba2_h2),
        })) || []),
        ...(h3Sections?.map((s) => ({
          level: 3,
          title: BlogCacheService.decodeHtmlEntities(s.ba3_h3),
          content: BlogCacheService.decodeHtmlEntities(s.ba3_content),
          anchor: this.generateAnchor(s.ba3_h3),
        })) || []),
      ];

      // Generation des tags intelligents
      const baseTags = [
        `constructeur:${constructeur.bc_constructeur.toLowerCase()}`,
      ];
      const keywordTags = constructeur.bc_keywords
        ? constructeur.bc_keywords
            .split(', ')
            .map((k: string) => k.trim().toLowerCase())
        : [];

      const popularityTag = this.getPopularityTag(
        parseInt(constructeur.bc_visit) || 0,
      );
      const modelTag = modelsCount > 0 ? `models:${modelsCount}` : 'no-models';
      const letterTag = `letter:${constructeur.bc_constructeur.charAt(0).toLowerCase()}`;

      const allTags = [
        ...baseTags,
        ...keywordTags,
        popularityTag,
        modelTag,
        letterTag,
      ];

      // Construction de l'article optimise avec metadonnees enrichies
      const article: BlogArticle = {
        id: `constructeur_${constructeur.bc_id}`,
        type: 'constructeur',
        title: BlogCacheService.decodeHtmlEntities(constructeur.bsm_marque_id),
        slug:
          constructeur.bc_alias ||
          this.generateSlug(constructeur.bsm_marque_id),
        excerpt: BlogCacheService.decodeHtmlEntities(
          constructeur.bc_preview || constructeur.bc_descrip || '',
        ),
        content: BlogCacheService.decodeHtmlEntities(
          constructeur.bc_content || '',
        ),
        h1: BlogCacheService.decodeHtmlEntities(
          constructeur.bc_h1 || constructeur.bsm_marque_id,
        ),
        h2: BlogCacheService.decodeHtmlEntities(constructeur.bc_h2 || ''),
        keywords: keywordTags,
        tags: allTags,
        publishedAt: constructeur.bc_create || new Date().toISOString(),
        updatedAt:
          constructeur.bc_update ||
          constructeur.bc_create ||
          new Date().toISOString(),
        viewsCount: parseInt(constructeur.bc_visit) || 0,
        sections,
        legacy_id: parseInt(String(constructeur.bsm_id), 10),
        legacy_table: '__blog_constructeur',

        // Metadonnees SEO enrichies
        seo_data: {
          meta_title: BlogCacheService.decodeHtmlEntities(
            constructeur.bc_h1 || constructeur.bsm_marque_id,
          ),
          meta_description: BlogCacheService.decodeHtmlEntities(
            constructeur.bc_descrip || constructeur.bc_preview || '',
          ),
          keywords: keywordTags,
        },
      };

      return article;
    } catch (error) {
      this.logger.error(
        `Erreur transformation constructeur ${constructeur.bc_id}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  // UTILITY METHODS

  /**
   * Generation d'ancres propres pour navigation interne
   */
  generateAnchor(text: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
  }

  /**
   * Generation de slug URL-friendly
   */
  generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  /**
   * Comptage intelligent de mots
   */
  countWords(content: string): number {
    if (!content) return 0;
    return content
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  }

  /**
   * Attribution tag de popularite base sur les vues
   */
  getPopularityTag(views: number): string {
    if (views > 5000) return 'popularity:very-high';
    if (views > 2000) return 'popularity:high';
    if (views > 1000) return 'popularity:medium';
    if (views > 500) return 'popularity:low';
    return 'popularity:very-low';
  }

  /**
   * Calcul du score de popularite normalise
   */
  calculatePopularityScore(views: number, sectionsCount: number): number {
    const baseScore = Math.min(100, (views / 100) * 10); // Max 100 pour 1000+ vues
    const contentBonus = Math.min(20, sectionsCount * 2); // Bonus contenu riche
    return Math.round(baseScore + contentBonus);
  }

  /**
   * Evaluation de la qualite du contenu
   */
  assessContentQuality(
    constructeur: BcRow,
    sections: BlogSection[],
  ): 'high' | 'medium' | 'low' {
    let score = 0;

    // Criteres de qualite
    if (constructeur.bc_content && constructeur.bc_content.length > 500)
      score += 2;
    if (constructeur.bc_descrip && constructeur.bc_descrip.length > 100)
      score += 1;
    if (
      constructeur.bc_keywords &&
      constructeur.bc_keywords.split(',').length > 3
    )
      score += 1;
    if (sections.length > 3) score += 2;
    if (sections.some((s) => (s.content?.length || 0) > 100)) score += 1;
    if (constructeur.bc_h1 && constructeur.bc_h2) score += 1;

    if (score >= 6) return 'high';
    if (score >= 3) return 'medium';
    return 'low';
  }
}
