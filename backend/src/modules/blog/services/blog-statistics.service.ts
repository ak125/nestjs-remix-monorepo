import { TABLES } from '@repo/database-types';
import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { SupabaseIndexationService } from '../../search/services/supabase-indexation.service';
import { BlogArticleTransformService } from './blog-article-transform.service';
import { BlogCacheService } from './blog-cache.service';
import { BlogArticle, BlogDashboard } from '../interfaces/blog.interfaces';

/**
 * 📊 BlogStatisticsService - Statistiques et agrégations du blog
 *
 * Responsabilité unique : Métriques et données statistiques
 * - Dashboard avec overview et by type
 * - Articles populaires
 * - Comptage par type
 * - Stats simplifiées pour contrôleurs
 *
 * Extrait de BlogService pour réduire la complexité (SRP)
 */
@Injectable()
export class BlogStatisticsService {
  private readonly logger = new Logger(BlogStatisticsService.name);

  constructor(
    private readonly supabaseService: SupabaseIndexationService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly blogCacheService: BlogCacheService,
    private readonly transformService: BlogArticleTransformService,
  ) {}

  /**
   * 📊 Dashboard avec statistiques complètes
   */
  async getBlogStats(): Promise<BlogDashboard> {
    try {
      const cacheKey = 'blog:dashboard';
      const cached = await this.cacheManager.get<BlogDashboard>(cacheKey);
      if (cached) return cached;

      // Statistiques des conseils
      const { data: adviceStats } = await this.supabaseService.client
        .from(TABLES.blog_advice)
        .select('ba_visit, ba_create, ba_update');

      // Statistiques des guides
      const { data: guideStats } = await this.supabaseService.client
        .from(TABLES.blog_guide)
        .select('bg_visit, bg_create, bg_update');

      const totalAdvice = adviceStats?.length || 0;
      const totalGuides = guideStats?.length || 0;
      const totalArticles = totalAdvice + totalGuides;

      const adviceViews =
        adviceStats?.reduce(
          (sum, item) => sum + (parseInt(item.ba_visit) || 0),
          0,
        ) || 0;
      const guideViews =
        guideStats?.reduce(
          (sum, item) => sum + (parseInt(item.bg_visit) || 0),
          0,
        ) || 0;
      const totalViews = adviceViews + guideViews;

      const dashboard: BlogDashboard = {
        overview: {
          totalArticles,
          totalViews,
          totalAdvice,
          totalGuides,
        },
        byType: {
          advice: {
            total: totalAdvice,
            views: adviceViews,
            avgViews:
              totalAdvice > 0 ? Math.round(adviceViews / totalAdvice) : 0,
          },
          guide: {
            total: totalGuides,
            views: guideViews,
            avgViews:
              totalGuides > 0 ? Math.round(guideViews / totalGuides) : 0,
          },
          constructeur: { total: 0, views: 0, avgViews: 0 },
          glossaire: { total: 0, views: 0, avgViews: 0 },
        },
        popular: await this.getPopularArticles(5),
        lastUpdated: new Date().toISOString(),
        success: true,
      };

      await this.cacheManager.set(cacheKey, dashboard, 3600 * 1000); // 1h TTL
      return dashboard;
    } catch (error) {
      this.logger.error(
        `❌ Erreur statistiques blog: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * 📊 Statistiques simplifiées pour le contrôleur dashboard
   */
  async getSimpleBlogStats(): Promise<{
    totalArticles: number;
    totalViews: number;
    totalAdvice: number;
    totalGuides: number;
  }> {
    try {
      const dashboard = await this.getBlogStats();
      return {
        totalArticles: dashboard.overview?.totalArticles || 0,
        totalViews: dashboard.overview?.totalViews || 0,
        totalAdvice: dashboard.overview?.totalAdvice || 0,
        totalGuides: dashboard.overview?.totalGuides || 0,
      };
    } catch (error) {
      this.logger.error(`❌ Erreur stats simples: ${(error as Error).message}`);
      return {
        totalArticles: 0,
        totalViews: 0,
        totalAdvice: 0,
        totalGuides: 0,
      };
    }
  }

  /**
   * 🔥 Articles populaires
   */
  async getPopularArticles(limit: number = 10): Promise<BlogArticle[]> {
    try {
      const { data } = await this.supabaseService.client
        .from(TABLES.blog_advice)
        .select('*')
        .order('ba_visit', { ascending: false })
        .limit(limit);

      const articles =
        data?.map((item) =>
          this.transformService.transformAdviceToArticle(item),
        ) || [];
      return await this.enrichWithPgAlias(articles);
    } catch (error) {
      this.logger.error(
        `❌ Erreur articles populaires: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * 🏠 Articles en vedette (Featured)
   */
  async getFeaturedArticles(limit: number = 3): Promise<BlogArticle[]> {
    const cacheKey = `featured:${limit}`;
    const cached = await this.blogCacheService.get<BlogArticle[]>(
      cacheKey,
      5000,
    );
    if (cached) return cached;

    try {
      const { data } = await this.supabaseService.client
        .from(TABLES.blog_advice)
        .select('*')
        .order('ba_views', { ascending: false })
        .limit(limit);

      const articles =
        data?.map((item) =>
          this.transformService.transformAdviceToArticle(item),
        ) || [];
      await this.blogCacheService.set(cacheKey, articles, 5000);
      return articles;
    } catch (error) {
      this.logger.error('Erreur getFeaturedArticles:', error);
      return [];
    }
  }

  /**
   * 📰 Articles récents
   */
  async getRecentArticles(limit: number = 6): Promise<BlogArticle[]> {
    const cacheKey = `recent:${limit}`;
    const cached = await this.blogCacheService.get<BlogArticle[]>(
      cacheKey,
      1000,
    );
    if (cached) return cached;

    try {
      const { data } = await this.supabaseService.client
        .from(TABLES.blog_advice)
        .select('*')
        .order('ba_date_add', { ascending: false })
        .limit(limit);

      const articles =
        data?.map((item) =>
          this.transformService.transformAdviceToArticle(item),
        ) || [];
      const enriched = await this.enrichWithPgAlias(articles);
      await this.blogCacheService.set(cacheKey, enriched, 1000);
      return enriched;
    } catch (error) {
      this.logger.error('Erreur getRecentArticles:', error);
      return [];
    }
  }

  /**
   * 📁 Catégories
   */
  async getCategories(): Promise<any[]> {
    const cacheKey = 'categories';
    const cached = await this.blogCacheService.get<any[]>(cacheKey, 5000);
    if (cached) return cached;

    try {
      const categories = [
        {
          id: 1,
          name: 'Conseils',
          slug: 'advice',
          description: "Conseils pratiques pour l'entretien automobile",
          articlesCount: await this.getTypeCount('__blog_advice'),
        },
        {
          id: 2,
          name: 'Guides',
          slug: 'guide',
          description: 'Guides détaillés de réparation et maintenance',
          articlesCount: await this.getTypeCount('__blog_guide'),
        },
      ];

      await this.blogCacheService.set(cacheKey, categories, 5000);
      return categories;
    } catch (error) {
      this.logger.error('Erreur getCategories:', error);
      return [];
    }
  }

  /**
   * 📊 Compter les articles par type
   */
  async getTypeCount(tableName: string): Promise<number> {
    const { count } = await this.supabaseService.client
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    return count || 0;
  }

  // === Méthodes privées ===

  /**
   * 🔄 Enrichir les articles avec pg_alias depuis pieces_gamme
   */
  private async enrichWithPgAlias(
    articles: BlogArticle[],
  ): Promise<BlogArticle[]> {
    if (!articles || articles.length === 0) return articles;

    try {
      const pgIds = [
        ...new Set(articles.map((a) => a.ba_pg_id).filter((id) => id != null)),
      ];

      if (pgIds.length === 0) return articles;

      const { data: gammes } = await this.supabaseService.client
        .from(TABLES.pieces_gamme)
        .select('pg_id, pg_alias')
        .in('pg_id', pgIds);

      const pgAliasMap = new Map();
      gammes?.forEach((g) => pgAliasMap.set(g.pg_id, g.pg_alias));

      return articles.map((article) => {
        const ba_pg_id = article.ba_pg_id;
        const pg_id = ba_pg_id ? parseInt(ba_pg_id, 10) : null;

        return {
          ...article,
          pg_id: pg_id,
          pg_alias: pgAliasMap.get(ba_pg_id) || null,
          ba_pg_id: ba_pg_id,
        };
      });
    } catch (error) {
      this.logger.warn('Erreur enrichWithPgAlias:', error);
      return articles;
    }
  }
}
