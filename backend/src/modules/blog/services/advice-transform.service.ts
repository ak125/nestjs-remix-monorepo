import { Injectable, Logger } from '@nestjs/common';
import { SupabaseIndexationService } from '../../search/services/supabase-indexation.service';
import { BlogCacheService } from './blog-cache.service';
import { BlogArticle, BlogSection } from '../interfaces/blog.interfaces';
import { TABLES } from '@repo/database-types';

/**
 * Service responsible for transforming raw advice DB rows
 * into structured BlogArticle objects with sections.
 *
 * Extracted from AdviceService to reduce complexity.
 */
@Injectable()
export class AdviceTransformService {
  private readonly logger = new Logger(AdviceTransformService.name);

  constructor(private readonly supabaseService: SupabaseIndexationService) {}

  /**
   * Batch transformation optimisee pour plusieurs conseils.
   * Reduit N*2 requetes DB en 2 requetes totales.
   */
  async transformAdvicesToArticles(advices: any[]): Promise<BlogArticle[]> {
    if (!advices || advices.length === 0) return [];

    try {
      const adviceIds = advices.map((a) => a.ba_id);

      // Batch H2/H3 en 2 requetes au lieu de N*2
      const [{ data: allH2Sections }, { data: allH3Sections }] =
        await Promise.all([
          this.supabaseService.client
            .from(TABLES.blog_advice_h2)
            .select('*')
            .in('ba2_ba_id', adviceIds)
            .order('ba2_id'),
          this.supabaseService.client
            .from(TABLES.blog_advice_h3)
            .select('*')
            .in('ba3_ba_id', adviceIds)
            .order('ba3_id'),
        ]);

      // Grouper par ba_id pour acces O(1)
      const h2ByAdviceId = new Map<number, any[]>();
      const h3ByAdviceId = new Map<number, any[]>();

      allH2Sections?.forEach((s) => {
        if (!h2ByAdviceId.has(s.ba2_ba_id)) h2ByAdviceId.set(s.ba2_ba_id, []);
        h2ByAdviceId.get(s.ba2_ba_id)!.push(s);
      });

      allH3Sections?.forEach((s) => {
        if (!h3ByAdviceId.has(s.ba3_ba_id)) h3ByAdviceId.set(s.ba3_ba_id, []);
        h3ByAdviceId.get(s.ba3_ba_id)!.push(s);
      });

      // Transformation parallele avec Promise.all
      return Promise.all(
        advices.map((advice) => {
          const h2 = h2ByAdviceId.get(advice.ba_id) || [];
          const h3 = h3ByAdviceId.get(advice.ba_id) || [];
          return this.transformAdviceToArticleWithSections(advice, h2, h3);
        }),
      );
    } catch (error) {
      this.logger.error(
        `Erreur transformAdvicesToArticles: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * Transformation advice -> BlogArticle avec sections pre-chargees.
   */
  transformAdviceToArticleWithSections(
    advice: any,
    h2Sections: any[],
    h3Sections: any[],
  ): BlogArticle {
    try {
      const sections: BlogSection[] = [];

      // Combiner H2 sections
      for (const s of h2Sections) {
        const title = s.ba2_h2 || '';
        sections.push({
          level: 2,
          title: BlogCacheService.decodeHtmlEntities(title),
          content: BlogCacheService.decodeHtmlEntities(s.ba2_content || ''),
          anchor: this.createAnchor(title),
        });
      }

      // Combiner H3 sections
      for (const s of h3Sections) {
        const title = s.ba3_h3 || '';
        sections.push({
          level: 3,
          title: BlogCacheService.decodeHtmlEntities(title),
          content: BlogCacheService.decodeHtmlEntities(s.ba3_content || ''),
          anchor: this.createAnchor(title),
        });
      }

      return {
        id: `advice_${advice.ba_id}`,
        type: 'advice' as const,
        title: BlogCacheService.decodeHtmlEntities(advice.ba_title || ''),
        slug: advice.ba_alias,
        pg_alias: null,
        pg_id: null,
        ba_pg_id: advice.ba_pg_id || null,
        excerpt: BlogCacheService.decodeHtmlEntities(
          advice.ba_preview || advice.ba_descrip || '',
        ),
        content: BlogCacheService.decodeHtmlEntities(advice.ba_content || ''),
        h1: BlogCacheService.decodeHtmlEntities(advice.ba_h1 || ''),
        h2: BlogCacheService.decodeHtmlEntities(advice.ba_h2 || ''),
        keywords: advice.ba_keywords
          ? advice.ba_keywords.split(',').map((k: string) => k.trim())
          : [],
        tags: advice.ba_keywords
          ? advice.ba_keywords.split(',').map((k: string) => k.trim())
          : [],
        publishedAt: advice.ba_create,
        updatedAt: advice.ba_update,
        viewsCount: parseInt(advice.ba_visit) || 0,
        readingTime: this.calculateReadingTime(
          advice.ba_content || advice.ba_descrip,
        ),
        sections,
        legacy_id: parseInt(advice.ba_id),
        legacy_table: '__blog_advice',
        seo_data: {
          meta_title: BlogCacheService.decodeHtmlEntities(
            advice.ba_title || advice.ba_h1 || '',
          ),
          meta_description: BlogCacheService.decodeHtmlEntities(
            advice.ba_descrip || advice.ba_preview || '',
          ),
          keywords: advice.ba_keywords || '',
        },
      };
    } catch (error) {
      this.logger.error(
        `Erreur transformAdviceToArticleWithSections (${advice.ba_id}): ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Transformation unitaire advice -> BlogArticle avec chargement des sections depuis DB.
   * Utilisee pour les details individuels.
   */
  async transformAdviceToArticle(advice: any): Promise<BlogArticle> {
    try {
      // Recuperer les sections H2/H3 en parallele
      const [{ data: h2Sections }, { data: h3Sections }] = await Promise.all([
        this.supabaseService.client
          .from(TABLES.blog_advice_h2)
          .select('*')
          .eq('ba2_ba_id', advice.ba_id)
          .order('ba2_id'),
        this.supabaseService.client
          .from(TABLES.blog_advice_h3)
          .select('*')
          .eq('ba3_ba_id', advice.ba_id)
          .order('ba3_id'),
      ]);

      // Combiner les sections
      const sections: BlogSection[] = [];

      if (h2Sections) {
        for (const s of h2Sections) {
          const title = s.ba2_h2 || '';
          sections.push({
            level: 2,
            title: BlogCacheService.decodeHtmlEntities(title),
            content: BlogCacheService.decodeHtmlEntities(s.ba2_content || ''),
            anchor: this.createAnchor(title),
          });
        }
      }

      if (h3Sections) {
        for (const s of h3Sections) {
          const title = s.ba3_h3 || '';
          sections.push({
            level: 3,
            title: BlogCacheService.decodeHtmlEntities(title),
            content: BlogCacheService.decodeHtmlEntities(s.ba3_content || ''),
            anchor: this.createAnchor(title),
          });
        }
      }

      return {
        id: `advice_${advice.ba_id}`,
        type: 'advice' as const,
        title: BlogCacheService.decodeHtmlEntities(advice.ba_title || ''),
        slug: advice.ba_alias,
        pg_alias: null,
        pg_id: null,
        ba_pg_id: advice.ba_pg_id || null,
        excerpt: BlogCacheService.decodeHtmlEntities(
          advice.ba_preview || advice.ba_descrip || '',
        ),
        content: BlogCacheService.decodeHtmlEntities(advice.ba_content || ''),
        h1: BlogCacheService.decodeHtmlEntities(advice.ba_h1 || ''),
        h2: BlogCacheService.decodeHtmlEntities(advice.ba_h2 || ''),
        keywords: advice.ba_keywords
          ? advice.ba_keywords.split(',').map((k: string) => k.trim())
          : [],
        tags: advice.ba_keywords
          ? advice.ba_keywords.split(',').map((k: string) => k.trim())
          : [],
        publishedAt: advice.ba_create,
        updatedAt: advice.ba_update,
        viewsCount: parseInt(advice.ba_visit) || 0,
        readingTime: this.calculateReadingTime(
          advice.ba_content || advice.ba_descrip,
        ),
        sections,
        legacy_id: parseInt(advice.ba_id),
        legacy_table: '__blog_advice',
        seo_data: {
          meta_title: BlogCacheService.decodeHtmlEntities(
            advice.ba_title || '',
          ),
          meta_description: BlogCacheService.decodeHtmlEntities(
            advice.ba_descrip || '',
          ),
          keywords: advice.ba_keywords
            ? advice.ba_keywords.split(',').map((k: string) => k.trim())
            : [],
        },
      };
    } catch (error) {
      this.logger.error(
        `Erreur transformation advice: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Calculer temps de lecture.
   */
  calculateReadingTime(content: string): number {
    if (!content) return 1;

    const cleanText = BlogCacheService.decodeHtmlEntities(content).replace(
      /<[^>]*>/g,
      '',
    );
    const wordsPerMinute = 200;
    const words = cleanText
      .split(/\s+/)
      .filter((word: string) => word.length > 0).length;
    return Math.max(1, Math.ceil(words / wordsPerMinute));
  }

  /**
   * Creer une ancre pour les sections.
   */
  createAnchor(text: string): string {
    if (!text) return '';

    return BlogCacheService.decodeHtmlEntities(text)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
