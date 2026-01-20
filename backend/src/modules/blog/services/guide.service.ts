import { Injectable, Logger } from '@nestjs/common';
import { TABLES } from '@repo/database-types';
import { SupabaseIndexationService } from '../../search/services/supabase-indexation.service';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { BlogArticle, BlogSection } from '../interfaces/blog.interfaces';

export interface GuideFilters {
  type?: 'achat' | 'technique' | 'entretien' | 'réparation';
  difficulty?: 'débutant' | 'intermédiaire' | 'expert';
  minViews?: number;
}

/**
 * 📖 GuideService - Service spécialisé pour les guides automobiles
 *
 * Gère spécifiquement la table __blog_guide avec logique métier
 * dédiée aux guides d'achat, techniques et de réparation.
 */
@Injectable()
export class GuideService {
  private readonly logger = new Logger(GuideService.name);

  constructor(
    private readonly supabaseService: SupabaseIndexationService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * 📖 Récupérer tous les guides avec pagination
   */
  async getAllGuides(
    options: {
      limit?: number;
      offset?: number;
      filters?: GuideFilters;
    } = {},
  ): Promise<{ articles: BlogArticle[]; total: number }> {
    const { limit = 20, offset = 0, filters = {} } = options;
    const cacheKey = `guides_all:${limit}:${offset}:${JSON.stringify(filters)}`;

    try {
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        return cached as any;
      }

      const client = this.supabaseService.getClient();
      let query = client
        .from(TABLES.blog_guide)
        .select('*', { count: 'exact' });

      // Appliquer les filtres
      if (filters.type) {
        query = query.ilike('bg_title', `%${filters.type}%`);
      }

      if (filters.minViews) {
        query = query.gte('bg_visit', filters.minViews.toString());
      }

      // Pagination et tri
      query = query
        .order('bg_visit', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data: guidesList, count } = await query;

      if (!guidesList) {
        return { articles: [], total: 0 };
      }

      // Transformer chaque guide en article complet (parallélisé pour éviter N+1)
      const articlePromises = guidesList.map((guide) =>
        this.transformGuideToArticle(client, guide),
      );
      const articlesResults = await Promise.all(articlePromises);
      const articles = articlesResults.filter(
        (article): article is BlogArticle => article !== null,
      );

      const result = { articles, total: count || 0 };
      await this.cacheManager.set(cacheKey, result, 1800); // 30 min

      this.logger.log(`📖 Récupéré ${articles.length} guides (${count} total)`);
      return result;
    } catch (error) {
      this.logger.error(
        `❌ Erreur récupération guides: ${(error as Error).message}`,
      );
      return { articles: [], total: 0 };
    }
  }

  /**
   * 🔍 Récupérer un guide par ID
   */
  async getGuideById(id: string | number): Promise<BlogArticle | null> {
    const cacheKey = `guide:${id}`;

    try {
      const cached = await this.cacheManager.get<BlogArticle>(cacheKey);
      if (cached) {
        return cached;
      }

      const client = this.supabaseService.getClient();
      const { data: guide } = await client
        .from(TABLES.blog_guide)
        .select('*')
        .eq('bg_id', id.toString())
        .single();

      if (!guide) return null;

      const article = await this.transformGuideToArticle(client, guide);
      if (article) {
        await this.cacheManager.set(cacheKey, article, 3600); // 1h
      }

      return article;
    } catch (error) {
      this.logger.error(
        `❌ Erreur récupération guide ${id}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * � Récupérer un guide par slug (alias)
   */
  async getGuideBySlug(slug: string): Promise<BlogArticle | null> {
    const cacheKey = `guide:slug:${slug}`;

    try {
      const cached = await this.cacheManager.get<BlogArticle>(cacheKey);
      if (cached) {
        return cached;
      }

      const client = this.supabaseService.getClient();
      const { data: guide } = await client
        .from(TABLES.blog_guide)
        .select('*')
        .eq('bg_alias', slug)
        .single();

      if (!guide) return null;

      const article = await this.transformGuideToArticle(client, guide);
      if (article) {
        await this.cacheManager.set(cacheKey, article, 3600); // 1h
      }

      return article;
    } catch (error) {
      this.logger.error(
        `❌ Erreur récupération guide par slug ${slug}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * �🛒 Récupérer les guides d'achat
   */
  async getPurchaseGuides(): Promise<BlogArticle[]> {
    const cacheKey = 'guides_purchase';

    try {
      const cached = await this.cacheManager.get<BlogArticle[]>(cacheKey);
      if (cached) {
        return cached;
      }

      const client = this.supabaseService.getClient();

      const { data: guidesList } = await client
        .from(TABLES.blog_guide)
        .select('*')
        .or(
          [
            'bg_title.ilike.%achat%',
            'bg_title.ilike.%acheter%',
            'bg_title.ilike.%choisir%',
            'bg_keywords.ilike.%achat%',
          ].join(','),
        )
        .order('bg_visit', { ascending: false })
        .limit(10);

      if (!guidesList) return [];

      // Paralléliser les transformations pour éviter N+1
      const articlePromises = guidesList.map((guide) =>
        this.transformGuideToArticle(client, guide),
      );
      const articlesResults = await Promise.all(articlePromises);
      const articles = articlesResults.filter(
        (article): article is BlogArticle => article !== null,
      );

      await this.cacheManager.set(cacheKey, articles, 3600);
      return articles;
    } catch (error) {
      this.logger.error(
        `❌ Erreur guides d'achat: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * 🔧 Récupérer les guides techniques
   */
  async getTechnicalGuides(): Promise<BlogArticle[]> {
    const cacheKey = 'guides_technical';

    try {
      const cached = await this.cacheManager.get<BlogArticle[]>(cacheKey);
      if (cached) {
        return cached;
      }

      const client = this.supabaseService.getClient();

      const { data: guidesList } = await client
        .from(TABLES.blog_guide)
        .select('*')
        .or(
          [
            'bg_title.ilike.%technique%',
            'bg_title.ilike.%fonctionnement%',
            'bg_title.ilike.%comprendre%',
            'bg_keywords.ilike.%technique%',
          ].join(','),
        )
        .order('bg_visit', { ascending: false })
        .limit(10);

      if (!guidesList) return [];

      // Paralléliser les transformations pour éviter N+1
      const articlePromises = guidesList.map((guide) =>
        this.transformGuideToArticle(client, guide),
      );
      const articlesResults = await Promise.all(articlePromises);
      const articles = articlesResults.filter(
        (article): article is BlogArticle => article !== null,
      );

      await this.cacheManager.set(cacheKey, articles, 3600);
      return articles;
    } catch (error) {
      this.logger.error(
        `❌ Erreur guides techniques: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * 📊 Statistiques spécifiques aux guides
   */
  async getGuideStats(): Promise<{
    total: number;
    totalViews: number;
    avgViews: number;
    byType: Array<{ type: string; count: number }>;
    mostPopular: BlogArticle[];
  }> {
    const cacheKey = 'guides_stats';

    try {
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        return cached as any;
      }

      const client = this.supabaseService.getClient();

      // Statistiques de base
      const { data: allGuides } = await client
        .from(TABLES.blog_guide)
        .select('bg_visit, bg_title, bg_keywords');

      if (!allGuides) {
        return {
          total: 0,
          totalViews: 0,
          avgViews: 0,
          byType: [],
          mostPopular: [],
        };
      }

      const totalViews = allGuides.reduce(
        (sum, guide) => sum + (parseInt(guide.bg_visit) || 0),
        0,
      );
      const avgViews = Math.round(totalViews / allGuides.length);

      // Analyser les types de guides
      const typeCount: { [key: string]: number } = {};
      allGuides.forEach((guide) => {
        const title = guide.bg_title.toLowerCase();
        if (
          title.includes('achat') ||
          title.includes('acheter') ||
          title.includes('choisir')
        ) {
          typeCount['Achat'] = (typeCount['Achat'] || 0) + 1;
        } else if (
          title.includes('technique') ||
          title.includes('fonctionnement')
        ) {
          typeCount['Technique'] = (typeCount['Technique'] || 0) + 1;
        } else if (
          title.includes('entretien') ||
          title.includes('maintenance')
        ) {
          typeCount['Entretien'] = (typeCount['Entretien'] || 0) + 1;
        } else if (title.includes('réparation') || title.includes('réparer')) {
          typeCount['Réparation'] = (typeCount['Réparation'] || 0) + 1;
        } else {
          typeCount['Général'] = (typeCount['Général'] || 0) + 1;
        }
      });

      const byType = Object.entries(typeCount)
        .sort(([, a], [, b]) => b - a)
        .map(([type, count]) => ({ type, count }));

      // Guides les plus populaires
      const { data: popularGuides } = await client
        .from(TABLES.blog_guide)
        .select('*')
        .order('bg_visit', { ascending: false })
        .limit(5);

      const mostPopular: BlogArticle[] = [];
      if (popularGuides) {
        for (const guide of popularGuides) {
          const article = await this.transformGuideToArticle(client, guide);
          if (article) mostPopular.push(article);
        }
      }

      const stats = {
        total: allGuides.length,
        totalViews,
        avgViews,
        byType,
        mostPopular,
      };

      await this.cacheManager.set(cacheKey, stats, 3600);
      return stats;
    } catch (error) {
      this.logger.error(`❌ Erreur stats guides: ${(error as Error).message}`);
      return {
        total: 0,
        totalViews: 0,
        avgViews: 0,
        byType: [],
        mostPopular: [],
      };
    }
  }

  /**
   * 👀 Incrementer le compteur de vues d'un guide
   */
  async incrementGuideViews(id: string | number): Promise<boolean> {
    try {
      const client = this.supabaseService.getClient();

      // Récupérer les vues actuelles
      const { data: current } = await client
        .from(TABLES.blog_guide)
        .select('bg_visit')
        .eq('bg_id', id.toString())
        .single();

      if (!current) return false;

      const newViews = (parseInt(current.bg_visit) || 0) + 1;

      // Mettre à jour
      const { error } = await client
        .from(TABLES.blog_guide)
        .update({ bg_visit: newViews.toString() })
        .eq('bg_id', id.toString());

      if (error) {
        this.logger.error(`❌ Erreur mise à jour vues: ${error.message}`);
        return false;
      }

      // Invalider le cache
      await this.cacheManager.del(`guide:${id}`);
      await this.cacheManager.del('guides_stats');

      this.logger.debug(`👀 Vues mises à jour pour guide ${id}: ${newViews}`);
      return true;
    } catch (error) {
      this.logger.error(
        `❌ Erreur incrément vues: ${(error as Error).message}`,
      );
      return false;
    }
  }

  // MÉTHODES PRIVÉES

  private async transformGuideToArticle(
    client: any,
    guide: any,
  ): Promise<BlogArticle> {
    // Récupérer les sections H2
    const { data: h2Sections } = await client
      .from(TABLES.blog_guide_h2)
      .select('*')
      .eq('bg2_bg_id', guide.bg_id)
      .order('bg2_id');

    const sections: BlogSection[] = [];

    // Pour chaque H2, récupérer ses H3
    if (h2Sections && h2Sections.length > 0) {
      for (const h2 of h2Sections) {
        // Ajouter le H2
        sections.push({
          level: 2,
          title: h2.bg2_h2,
          content: h2.bg2_content,
          anchor: h2.bg2_h2?.toLowerCase().replace(/\s+/g, '-'),
          wall: h2.bg2_wall || null,
          cta_anchor: h2.bg2_cta_anchor || null,
          cta_link: h2.bg2_cta_link || null,
        });

        // Récupérer les H3 de ce H2
        const { data: h3Sections } = await client
          .from(TABLES.blog_guide_h3)
          .select('*')
          .eq('bg3_bg2_id', h2.bg2_id)
          .order('bg3_id');

        // Ajouter les H3 (sous-sections du H2 actuel)
        if (h3Sections && h3Sections.length > 0) {
          h3Sections.forEach((h3: any) => {
            sections.push({
              level: 3,
              title: h3.bg3_h3,
              content: h3.bg3_content,
              anchor: h3.bg3_h3?.toLowerCase().replace(/\s+/g, '-'),
              wall: h3.bg3_wall || null,
              cta_anchor: h3.bg3_cta_anchor || null,
              cta_link: h3.bg3_cta_link || null,
            });
          });
        }
      }
    }

    return {
      id: `guide_${guide.bg_id}`,
      type: 'guide',
      title: guide.bg_title,
      slug: guide.bg_alias,
      excerpt: guide.bg_preview || guide.bg_descrip,
      content: guide.bg_content,
      h1: guide.bg_h1,
      h2: guide.bg_h2,
      keywords: guide.bg_keywords ? guide.bg_keywords.split(', ') : [],
      tags: guide.bg_keywords ? guide.bg_keywords.split(', ') : [],
      publishedAt: guide.bg_create,
      updatedAt: guide.bg_update,
      viewsCount: parseInt(guide.bg_visit) || 0,
      sections,
      legacy_id: parseInt(guide.bg_id),
      legacy_table: '__blog_guide',
      seo_data: {
        meta_title: guide.bg_title,
        meta_description: guide.bg_descrip,
        keywords: guide.bg_keywords ? guide.bg_keywords.split(', ') : [],
      },
    };
  }
}
