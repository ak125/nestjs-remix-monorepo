import { Injectable, Logger } from '@nestjs/common';
import { SupabaseIndexationService } from '../../search/services/supabase-indexation.service';
import { decodeHtmlEntities } from '../../../utils/html-entities';
import { calculateReadingTime, generateAnchor } from '../utils/blog-text.utils';
import {
  BlogArticle,
  BlogSection,
  BaRow,
  BaH2Row,
  BaH3Row,
} from '../interfaces/blog.interfaces';
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
  async transformAdvicesToArticles(advices: BaRow[]): Promise<BlogArticle[]> {
    if (!advices || advices.length === 0) return [];

    try {
      const adviceIds = advices.map((a) => a.ba_id);

      // H3 belongs to H2, not directly to an advice.
      const { data: allH2Sections, error: h2Error } =
        await this.supabaseService.client
          .from(TABLES.blog_advice_h2)
          .select('*')
          .in('ba2_ba_id', adviceIds)
          .order('ba2_id');
      if (h2Error) throw h2Error;

      const h2Sections: BaH2Row[] = allH2Sections || [];
      const h2Ids = h2Sections.map((section) => section.ba2_id);
      const { data: allH3Sections, error: h3Error } = h2Ids.length
        ? await this.supabaseService.client
            .from(TABLES.blog_advice_h3)
            .select('*')
            .in('ba3_ba2_id', h2Ids)
            .order('ba3_id')
        : { data: [], error: null };
      if (h3Error) throw h3Error;

      const h2ByAdviceId = new Map<string, BaH2Row[]>();
      const h3ByAdviceId = new Map<string, BaH3Row[]>();
      const adviceIdByH2Id = new Map<string, string>();

      h2Sections.forEach((section) => {
        const adviceId = String(section.ba2_ba_id);
        adviceIdByH2Id.set(String(section.ba2_id), adviceId);
        if (!h2ByAdviceId.has(adviceId)) h2ByAdviceId.set(adviceId, []);
        h2ByAdviceId.get(adviceId)!.push(section);
      });

      allH3Sections?.forEach((section: BaH3Row) => {
        const adviceId = adviceIdByH2Id.get(String(section.ba3_ba2_id));
        if (adviceId === undefined) return;
        if (!h3ByAdviceId.has(adviceId)) h3ByAdviceId.set(adviceId, []);
        h3ByAdviceId.get(adviceId)!.push(section);
      });

      // Transformation parallele avec Promise.all
      return Promise.all(
        advices.map((advice) => {
          const h2 = h2ByAdviceId.get(String(advice.ba_id)) || [];
          const h3 = h3ByAdviceId.get(String(advice.ba_id)) || [];
          return this.transformAdviceToArticleWithSections(advice, h2, h3);
        }),
      );
    } catch (error) {
      this.logger.error(
        `Erreur transformAdvicesToArticles: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Transformation advice -> BlogArticle avec sections pre-chargees.
   */
  transformAdviceToArticleWithSections(
    advice: BaRow,
    h2Sections: BaH2Row[],
    h3Sections: BaH3Row[],
  ): BlogArticle {
    try {
      const sections: BlogSection[] = [];

      // Combiner H2 sections
      for (const s of h2Sections) {
        const title = s.ba2_h2 || '';
        sections.push({
          level: 2,
          title: decodeHtmlEntities(title),
          content: decodeHtmlEntities(s.ba2_content || ''),
          anchor: generateAnchor(title),
        });
      }

      // Combiner H3 sections
      for (const s of h3Sections) {
        const title = s.ba3_h3 || '';
        sections.push({
          level: 3,
          title: decodeHtmlEntities(title),
          content: decodeHtmlEntities(s.ba3_content || ''),
          anchor: generateAnchor(title),
        });
      }

      return {
        id: `advice_${advice.ba_id}`,
        type: 'advice' as const,
        title: decodeHtmlEntities(advice.ba_title || ''),
        slug: advice.ba_alias,
        pg_alias: null,
        pg_id: null,
        ba_pg_id: advice.ba_pg_id || null,
        contentType:
          (advice.ba_content_type as BlogArticle['contentType']) || undefined,
        difficulty: advice.ba_difficulty ?? undefined,
        timeMinutes: advice.ba_time_minutes ?? undefined,
        toolsCount: advice.ba_tools_count ?? undefined,
        primaryGammeSlug: advice.ba_primary_gamme_slug || undefined,
        excerpt: decodeHtmlEntities(
          advice.ba_preview || advice.ba_descrip || '',
        ),
        content: decodeHtmlEntities(advice.ba_content || ''),
        h1: decodeHtmlEntities(advice.ba_h1 || ''),
        h2: decodeHtmlEntities(advice.ba_h2 || ''),
        keywords: advice.ba_keywords
          ? advice.ba_keywords.split(',').map((k: string) => k.trim())
          : [],
        tags: advice.ba_keywords
          ? advice.ba_keywords.split(',').map((k: string) => k.trim())
          : [],
        publishedAt: advice.ba_create,
        updatedAt: advice.ba_update,
        viewsCount: parseInt(advice.ba_visit) || 0,
        readingTime: calculateReadingTime(
          advice.ba_content || advice.ba_descrip,
        ),
        sections,
        legacy_id: parseInt(String(advice.ba_id), 10),
        legacy_table: '__blog_advice',
        seo_data: {
          meta_title: decodeHtmlEntities(advice.ba_title || advice.ba_h1 || ''),
          meta_description: decodeHtmlEntities(
            advice.ba_descrip || advice.ba_preview || '',
          ),
          keywords: (advice.ba_keywords || '')
            .split(',')
            .map((k: string) => k.trim())
            .filter(Boolean),
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
  async transformAdviceToArticle(advice: BaRow): Promise<BlogArticle> {
    try {
      const { data: h2Sections, error: h2Error } =
        await this.supabaseService.client
          .from(TABLES.blog_advice_h2)
          .select('*')
          .eq('ba2_ba_id', advice.ba_id)
          .order('ba2_id');
      if (h2Error) throw h2Error;

      const h2Ids = (h2Sections || []).map((section) => section.ba2_id);
      const { data: h3Sections, error: h3Error } = h2Ids.length
        ? await this.supabaseService.client
            .from(TABLES.blog_advice_h3)
            .select('*')
            .in('ba3_ba2_id', h2Ids)
            .order('ba3_id')
        : { data: [], error: null };
      if (h3Error) throw h3Error;

      // Combiner les sections
      const sections: BlogSection[] = [];

      if (h2Sections) {
        for (const s of h2Sections) {
          const title = s.ba2_h2 || '';
          sections.push({
            level: 2,
            title: decodeHtmlEntities(title),
            content: decodeHtmlEntities(s.ba2_content || ''),
            anchor: generateAnchor(title),
          });
        }
      }

      if (h3Sections) {
        for (const s of h3Sections) {
          const title = s.ba3_h3 || '';
          sections.push({
            level: 3,
            title: decodeHtmlEntities(title),
            content: decodeHtmlEntities(s.ba3_content || ''),
            anchor: generateAnchor(title),
          });
        }
      }

      return {
        id: `advice_${advice.ba_id}`,
        type: 'advice' as const,
        title: decodeHtmlEntities(advice.ba_title || ''),
        slug: advice.ba_alias,
        pg_alias: null,
        pg_id: null,
        ba_pg_id: advice.ba_pg_id || null,
        contentType:
          (advice.ba_content_type as BlogArticle['contentType']) || undefined,
        difficulty: advice.ba_difficulty ?? undefined,
        timeMinutes: advice.ba_time_minutes ?? undefined,
        toolsCount: advice.ba_tools_count ?? undefined,
        primaryGammeSlug: advice.ba_primary_gamme_slug || undefined,
        excerpt: decodeHtmlEntities(
          advice.ba_preview || advice.ba_descrip || '',
        ),
        content: decodeHtmlEntities(advice.ba_content || ''),
        h1: decodeHtmlEntities(advice.ba_h1 || ''),
        h2: decodeHtmlEntities(advice.ba_h2 || ''),
        keywords: advice.ba_keywords
          ? advice.ba_keywords.split(',').map((k: string) => k.trim())
          : [],
        tags: advice.ba_keywords
          ? advice.ba_keywords.split(',').map((k: string) => k.trim())
          : [],
        publishedAt: advice.ba_create,
        updatedAt: advice.ba_update,
        viewsCount: parseInt(advice.ba_visit) || 0,
        readingTime: calculateReadingTime(
          advice.ba_content || advice.ba_descrip,
        ),
        sections,
        legacy_id: parseInt(String(advice.ba_id), 10),
        legacy_table: '__blog_advice',
        seo_data: {
          meta_title: decodeHtmlEntities(advice.ba_title || ''),
          meta_description: decodeHtmlEntities(advice.ba_descrip || ''),
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
}
