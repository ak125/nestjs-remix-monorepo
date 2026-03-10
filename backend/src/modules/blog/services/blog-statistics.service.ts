import { TABLES } from '@repo/database-types';
import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { SupabaseIndexationService } from '../../search/services/supabase-indexation.service';
import { BlogArticleTransformService } from './blog-article-transform.service';
import { BlogCacheService } from './blog-cache.service';
import {
  BlogArticle,
  BlogBadge,
  BlogDashboard,
} from '../interfaces/blog.interfaces';

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
      const enriched = await this.enrichWithPgAlias(articles);
      return this.enrichWithMeta(enriched);
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
        .order('ba_visit', { ascending: false })
        .limit(limit);

      const articles =
        data?.map((item) =>
          this.transformService.transformAdviceToArticle(item),
        ) || [];
      const enriched = await this.enrichWithPgAlias(articles);
      const withMeta = this.enrichWithMeta(enriched);
      await this.blogCacheService.set(cacheKey, withMeta, 5000);
      return withMeta;
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
      const withMeta = this.enrichWithMeta(enriched);
      await this.blogCacheService.set(cacheKey, withMeta, 1000);
      return withMeta;
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
      const [adviceCount, guideCount, constructeurCount] = await Promise.all([
        this.getTypeCount('__blog_advice'),
        this.getTypeCount('__blog_guide'),
        this.getTypeCount('__blog_seo_marque'),
      ]);

      const categories = [
        {
          id: 1,
          name: 'Conseils',
          slug: 'advice',
          description: "Conseils pratiques pour l'entretien automobile",
          articlesCount: adviceCount,
        },
        {
          id: 2,
          name: 'Guides',
          slug: 'guide',
          description: 'Guides détaillés de réparation et maintenance',
          articlesCount: guideCount,
        },
        {
          id: 3,
          name: 'Constructeurs',
          slug: 'constructeur',
          description: 'Histoire et spécificités des marques automobiles',
          articlesCount: constructeurCount,
        },
      ].sort((a, b) => b.articlesCount - a.articlesCount);

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

  /**
   * 📈 Articles tendances (scoring basé sur vues + fraîcheur)
   */
  async getTrendingArticles(
    limit: number = 6,
    days: number = 7,
  ): Promise<BlogArticle[]> {
    const cacheKey = `trending:${limit}:${days}`;
    const cached = await this.blogCacheService.get<BlogArticle[]>(
      cacheKey,
      5000,
    );
    if (cached) return cached;

    try {
      // Fetch articles mis à jour dans les 30 derniers jours
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

      const { data } = await this.supabaseService.client
        .from(TABLES.blog_advice)
        .select('*')
        .gte('ba_update', thirtyDaysAgo)
        .order('ba_visit', { ascending: false })
        .limit(50);

      if (!data || data.length === 0) return [];

      const now = Date.now();
      const scored = data.map((item) => {
        const article = this.transformService.transformAdviceToArticle(item);
        const updatedAt = new Date(
          item.ba_update || item.ba_date_add,
        ).getTime();
        const daysSinceUpdate = (now - updatedAt) / 86400000;
        const score = article.viewsCount * (1 / (1 + daysSinceUpdate / days));
        return { article, score };
      });

      scored.sort((a, b) => b.score - a.score);
      const articles = scored.slice(0, limit).map((s) => s.article);

      const enriched = await this.enrichWithPgAlias(articles);
      const withMeta = this.enrichWithMeta(enriched);
      await this.blogCacheService.set(cacheKey, withMeta, 5000);
      return withMeta;
    } catch (error) {
      this.logger.error('Erreur getTrendingArticles:', error);
      return [];
    }
  }

  /**
   * 🕐 Articles récemment mis à jour (triés par ba_update DESC)
   */
  async getRecentlyUpdatedArticles(limit: number = 6): Promise<BlogArticle[]> {
    const cacheKey = `recently-updated:${limit}`;
    const cached = await this.blogCacheService.get<BlogArticle[]>(
      cacheKey,
      1000,
    );
    if (cached) return cached;

    try {
      const { data } = await this.supabaseService.client
        .from(TABLES.blog_advice)
        .select('*')
        .not('ba_update', 'is', null)
        .order('ba_update', { ascending: false })
        .limit(limit);

      const articles =
        data?.map((item) =>
          this.transformService.transformAdviceToArticle(item),
        ) || [];
      const enriched = await this.enrichWithPgAlias(articles);
      const withMeta = this.enrichWithMeta(enriched);
      await this.blogCacheService.set(cacheKey, withMeta, 1000);
      return withMeta;
    } catch (error) {
      this.logger.error('Erreur getRecentlyUpdatedArticles:', error);
      return [];
    }
  }

  /**
   * 🩺 Articles diagnostic (intent=diagnostic, triés par vues)
   */
  async getDiagnosticArticles(limit: number = 6): Promise<BlogArticle[]> {
    const cacheKey = `diagnostic:${limit}`;
    const cached = await this.blogCacheService.get<BlogArticle[]>(
      cacheKey,
      5000,
    );
    if (cached) return cached;

    try {
      const { data } = await this.supabaseService.client
        .from(TABLES.blog_advice)
        .select('*')
        .or(
          'ba_keywords.ilike.%symptom%,ba_keywords.ilike.%panne%,ba_keywords.ilike.%bruit%,ba_keywords.ilike.%voyant%,ba_keywords.ilike.%diagnostic%,ba_title.ilike.%symptom%,ba_title.ilike.%panne%,ba_title.ilike.%HS%',
        )
        .order('ba_visit', { ascending: false })
        .limit(limit * 3);

      if (!data || data.length === 0) return [];

      const articles = data
        .map((item) => this.transformService.transformAdviceToArticle(item))
        .filter((a) => a.intent === 'diagnostic')
        .slice(0, limit);

      const enriched = await this.enrichWithPgAlias(articles);
      const withMeta = this.enrichWithMeta(enriched);
      await this.blogCacheService.set(cacheKey, withMeta, 5000);
      return withMeta;
    } catch (error) {
      this.logger.error('Erreur getDiagnosticArticles:', error);
      return [];
    }
  }

  /**
   * 🚗 Marques ayant des articles blog associés (via cross_gamme_car)
   */
  async getVehicleMarques(): Promise<
    Array<{ marque_id: number; marque_name: string; marque_alias: string }>
  > {
    const cacheKey = 'blog:vehicle-marques';
    const cached = await this.blogCacheService.get<
      Array<{ marque_id: number; marque_name: string; marque_alias: string }>
    >(cacheKey, 60000);
    if (cached) return cached;

    try {
      // 1. Get all pg_ids that have blog articles
      const { data: articles } = await this.supabaseService.client
        .from(TABLES.blog_advice)
        .select('ba_pg_id')
        .not('ba_pg_id', 'is', null);

      if (!articles || articles.length === 0) return [];

      const pgIds = [
        ...new Set(
          articles
            .map((a) => parseInt(a.ba_pg_id, 10))
            .filter((id) => !isNaN(id)),
        ),
      ];

      // 2. Get type_ids linked to those gammes
      const { data: crossData } = await this.supabaseService.client
        .from('__cross_gamme_car_new')
        .select('cgc_type_id')
        .in('cgc_pg_id', pgIds)
        .eq('cgc_level', 1)
        .limit(5000);

      if (!crossData || crossData.length === 0) return [];

      const typeIds = [
        ...new Set(
          crossData
            .map((c) => parseInt(c.cgc_type_id, 10))
            .filter((id) => !isNaN(id)),
        ),
      ];

      // 3. Get modele_ids from types
      const { data: types } = await this.supabaseService.client
        .from(TABLES.auto_type)
        .select('type_modele_id')
        .in('type_id', typeIds.slice(0, 1000))
        .eq('type_display', 1);

      if (!types || types.length === 0) return [];

      const modeleIds = [
        ...new Set(
          types
            .map((t) =>
              typeof t.type_modele_id === 'string'
                ? parseInt(t.type_modele_id, 10)
                : t.type_modele_id,
            )
            .filter((id) => !isNaN(id)),
        ),
      ];

      // 4. Get marque_ids from modeles
      const { data: modeles } = await this.supabaseService.client
        .from(TABLES.auto_modele)
        .select('modele_marque_id')
        .in('modele_id', modeleIds.slice(0, 500))
        .eq('modele_display', 1);

      if (!modeles || modeles.length === 0) return [];

      const marqueIds = [...new Set(modeles.map((m) => m.modele_marque_id))];

      // 5. Get marques
      const { data: marques } = await this.supabaseService.client
        .from(TABLES.auto_marque)
        .select('marque_id, marque_name, marque_alias')
        .in('marque_id', marqueIds)
        .eq('marque_display', 1)
        .order('marque_name', { ascending: true });

      const result = marques || [];
      await this.blogCacheService.set(cacheKey, result, 60000);
      return result;
    } catch (error) {
      this.logger.error('Erreur getVehicleMarques:', error);
      return [];
    }
  }

  /**
   * 🚗 Modèles d'une marque ayant des articles blog
   */
  async getVehicleModeles(
    marqueId: number,
  ): Promise<
    Array<{ modele_id: number; modele_name: string; modele_alias: string }>
  > {
    const cacheKey = `blog:vehicle-modeles:${marqueId}`;
    const cached = await this.blogCacheService.get<
      Array<{ modele_id: number; modele_name: string; modele_alias: string }>
    >(cacheKey, 30000);
    if (cached) return cached;

    try {
      const { data: modeles } = await this.supabaseService.client
        .from(TABLES.auto_modele)
        .select('modele_id, modele_name, modele_alias')
        .eq('modele_marque_id', marqueId)
        .eq('modele_display', 1)
        .order('modele_name', { ascending: true });

      const result = modeles || [];
      await this.blogCacheService.set(cacheKey, result, 30000);
      return result;
    } catch (error) {
      this.logger.error('Erreur getVehicleModeles:', error);
      return [];
    }
  }

  /**
   * 🚗 Articles blog liés à un véhicule (marque ou modèle)
   */
  async getArticlesByVehicle(
    marqueId: number,
    modeleId?: number,
    limit: number = 12,
  ): Promise<BlogArticle[]> {
    const cacheKey = `blog:by-vehicle:${marqueId}:${modeleId || 'all'}:${limit}`;
    const cached = await this.blogCacheService.get<BlogArticle[]>(
      cacheKey,
      5000,
    );
    if (cached) return cached;

    try {
      // 1. Get type_ids for the vehicle filter
      let typeIds: number[] = [];

      if (modeleId) {
        // Filter by specific model
        const { data: types } = await this.supabaseService.client
          .from(TABLES.auto_type)
          .select('type_id')
          .eq('type_modele_id', modeleId)
          .eq('type_display', 1)
          .limit(500);

        typeIds = (types || []).map((t) => t.type_id);
      } else {
        // Filter by brand → get all modeles → get all types
        const { data: modeles } = await this.supabaseService.client
          .from(TABLES.auto_modele)
          .select('modele_id')
          .eq('modele_marque_id', marqueId)
          .eq('modele_display', 1);

        if (!modeles || modeles.length === 0) return [];

        const modeleIds = modeles.map((m) => m.modele_id);
        const { data: types } = await this.supabaseService.client
          .from(TABLES.auto_type)
          .select('type_id')
          .in('type_modele_id', modeleIds.slice(0, 200))
          .eq('type_display', 1)
          .limit(1000);

        typeIds = (types || []).map((t) => t.type_id);
      }

      if (typeIds.length === 0) return [];

      // 2. Get pg_ids linked to these vehicles
      const { data: crossData } = await this.supabaseService.client
        .from('__cross_gamme_car_new')
        .select('cgc_pg_id')
        .in('cgc_type_id', typeIds.slice(0, 500))
        .limit(1000);

      if (!crossData || crossData.length === 0) return [];

      const pgIds = [...new Set(crossData.map((c) => c.cgc_pg_id))];

      // 3. Get blog articles for those gammes
      const { data } = await this.supabaseService.client
        .from(TABLES.blog_advice)
        .select('*')
        .in('ba_pg_id', pgIds.slice(0, 200))
        .order('ba_visit', { ascending: false })
        .limit(limit);

      if (!data || data.length === 0) return [];

      const articles = data.map((item) =>
        this.transformService.transformAdviceToArticle(item),
      );
      const enriched = await this.enrichWithPgAlias(articles);
      const withMeta = this.enrichWithMeta(enriched);

      await this.blogCacheService.set(cacheKey, withMeta, 5000);
      return withMeta;
    } catch (error) {
      this.logger.error('Erreur getArticlesByVehicle:', error);
      return [];
    }
  }

  /**
   * 📊 Analytics détaillées pour admin dashboard
   */
  async getDetailedAnalytics(): Promise<{
    overview: {
      totalArticles: number;
      totalViews: number;
      totalAdvice: number;
      totalGuides: number;
      avgViewsPerArticle: number;
    };
    topArticles: BlogArticle[];
    recentlyUpdated: BlogArticle[];
    lowPerformers: BlogArticle[];
    viewsDistribution: Array<{ range: string; count: number }>;
    intentBreakdown: Array<{ intent: string; count: number }>;
  }> {
    const cacheKey = 'blog:detailed-analytics';
    const cached = await this.cacheManager.get<any>(cacheKey);
    if (cached) return cached;

    try {
      // Fetch all advice articles for analysis
      const { data: allArticles } = await this.supabaseService.client
        .from(TABLES.blog_advice)
        .select('*')
        .order('ba_visit', { ascending: false });

      if (!allArticles || allArticles.length === 0) {
        return {
          overview: {
            totalArticles: 0,
            totalViews: 0,
            totalAdvice: 0,
            totalGuides: 0,
            avgViewsPerArticle: 0,
          },
          topArticles: [],
          recentlyUpdated: [],
          lowPerformers: [],
          viewsDistribution: [],
          intentBreakdown: [],
        };
      }

      const transformed = allArticles.map((item) =>
        this.transformService.transformAdviceToArticle(item),
      );

      const totalViews = transformed.reduce((sum, a) => sum + a.viewsCount, 0);
      const totalArticles = transformed.length;

      // Guide count
      const { count: guideCount } = await this.supabaseService.client
        .from(TABLES.blog_guide)
        .select('*', { count: 'exact', head: true });

      // Views distribution
      const ranges = [
        { range: '0-100', min: 0, max: 100 },
        { range: '100-500', min: 100, max: 500 },
        { range: '500-1000', min: 500, max: 1000 },
        { range: '1k-5k', min: 1000, max: 5000 },
        { range: '5k-10k', min: 5000, max: 10000 },
        { range: '10k+', min: 10000, max: Infinity },
      ];
      const viewsDistribution = ranges.map((r) => ({
        range: r.range,
        count: transformed.filter(
          (a) => a.viewsCount >= r.min && a.viewsCount < r.max,
        ).length,
      }));

      // Intent breakdown
      const intentMap = new Map<string, number>();
      transformed.forEach((a) => {
        const intent = a.intent || 'unknown';
        intentMap.set(intent, (intentMap.get(intent) || 0) + 1);
      });
      const intentBreakdown = Array.from(intentMap.entries())
        .map(([intent, count]) => ({ intent, count }))
        .sort((a, b) => b.count - a.count);

      // Top 10 articles (enriched)
      const top10 = transformed.slice(0, 10);
      const topEnriched = await this.enrichWithPgAlias(top10);
      const topArticles = this.enrichWithMeta(topEnriched);

      // Recently updated (top 10)
      const sortedByUpdate = [...transformed]
        .filter((a) => a.updatedAt)
        .sort(
          (a, b) =>
            new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime(),
        )
        .slice(0, 10);
      const recentEnriched = await this.enrichWithPgAlias(sortedByUpdate);
      const recentlyUpdated = this.enrichWithMeta(recentEnriched);

      // Low performers (bottom 10 by views, >30 days old)
      const thirtyDaysAgo = Date.now() - 30 * 86400000;
      const lowPerformersRaw = transformed
        .filter(
          (a) =>
            a.publishedAt && new Date(a.publishedAt).getTime() < thirtyDaysAgo,
        )
        .sort((a, b) => a.viewsCount - b.viewsCount)
        .slice(0, 10);
      const lowEnriched = await this.enrichWithPgAlias(lowPerformersRaw);
      const lowPerformers = this.enrichWithMeta(lowEnriched);

      const result = {
        overview: {
          totalArticles: totalArticles + (guideCount || 0),
          totalViews,
          totalAdvice: totalArticles,
          totalGuides: guideCount || 0,
          avgViewsPerArticle:
            totalArticles > 0 ? Math.round(totalViews / totalArticles) : 0,
        },
        topArticles,
        recentlyUpdated,
        lowPerformers,
        viewsDistribution,
        intentBreakdown,
      };

      await this.cacheManager.set(cacheKey, result, 3600 * 1000);
      return result;
    } catch (error) {
      this.logger.error('Erreur getDetailedAnalytics:', error);
      throw error;
    }
  }

  // === Méthodes privées ===

  /**
   * 🔗 Calculer canonicalUrl pour chaque article (après enrichWithPgAlias)
   */
  private computeCanonicalUrls(articles: BlogArticle[]): BlogArticle[] {
    return articles.map((a) => ({
      ...a,
      canonicalUrl: a.pg_alias
        ? `https://www.automecanik.com/blog-pieces-auto/conseils/${a.pg_alias}`
        : `https://www.automecanik.com/blog-pieces-auto/article/${a.slug}`,
    }));
  }

  /**
   * 🏷️ Calculer les badges pour un article
   */
  private computeBadges(article: BlogArticle): BlogBadge[] {
    const badges: BlogBadge[] = [];
    const now = Date.now();

    // Nouveau : publié il y a moins de 30 jours
    if (article.publishedAt) {
      const pub = new Date(article.publishedAt).getTime();
      if (now - pub < 30 * 86400000) badges.push('nouveau');
    }

    // Populaire : plus de 5000 vues
    if (article.viewsCount > 5000) badges.push('populaire');

    // Mis à jour : écart > 24h entre publishedAt et updatedAt
    if (article.publishedAt && article.updatedAt) {
      const pub = new Date(article.publishedAt).getTime();
      const upd = new Date(article.updatedAt).getTime();
      if (upd - pub > 86400000) badges.push('mis-a-jour');
    }

    // Guide complet : plus de 5 sections H2
    if ((article.h2Count ?? 0) > 5) badges.push('guide-complet');

    return badges;
  }

  /**
   * 🏷️ Enrichir les articles avec badges + canonicalUrl (post-enrichWithPgAlias)
   */
  private enrichWithMeta(articles: BlogArticle[]): BlogArticle[] {
    const withCanonical = this.computeCanonicalUrls(articles);
    return withCanonical.map((a) => ({
      ...a,
      badges: this.computeBadges(a),
    }));
  }

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
