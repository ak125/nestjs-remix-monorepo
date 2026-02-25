import { Injectable, Logger } from '@nestjs/common';
import { BlogCacheService } from './blog-cache.service';
import { BlogArticleTransformService } from './blog-article-transform.service';
import { BlogArticleDataService } from './blog-article-data.service';
import { BlogStatisticsService } from './blog-statistics.service';
import { BlogSeoService } from './blog-seo.service';
import { BlogArticleRelationService } from './blog-article-relation.service';
import {
  BlogArticle,
  BlogDashboard,
  BaRow,
  BgRow,
} from '../interfaces/blog.interfaces';
import {
  VehicleContext,
  LinkInjectionResult,
} from '../../seo/internal-linking.service';

/**
 * 📰 BlogService - Orchestrateur principal du module blog
 *
 * 🎯 REFACTORÉ: Ce service est maintenant un orchestrateur mince qui délègue
 * les responsabilités aux services spécialisés:
 *
 * - BlogArticleTransformService : Transformations et mappings
 * - BlogArticleDataService : CRUD et requêtes Supabase
 * - BlogStatisticsService : Métriques et agrégations
 * - BlogSeoService : SEO et liens internes
 * - BlogArticleRelationService : Relations et véhicules compatibles
 *
 * Avant refactoring: 1976 lignes, 48 méthodes
 * Après refactoring: ~200 lignes, délégation vers 5 services spécialisés
 */
@Injectable()
export class BlogService {
  private readonly logger = new Logger(BlogService.name);

  constructor(
    private readonly blogCacheService: BlogCacheService,
    private readonly transformService: BlogArticleTransformService,
    private readonly dataService: BlogArticleDataService,
    private readonly statisticsService: BlogStatisticsService,
    private readonly seoService: BlogSeoService,
    private readonly relationService: BlogArticleRelationService,
  ) {}

  // =====================================================
  // 🏠 HOMEPAGE & DASHBOARD
  // =====================================================

  /**
   * 🏠 Page d'accueil du blog
   */
  async getHomepageContent(): Promise<BlogDashboard> {
    const cacheKey = 'homepage';

    const cached = await this.blogCacheService.get<BlogDashboard>(
      cacheKey,
      10000,
    );
    if (cached) return cached;

    this.logger.log('🏠 Génération du contenu homepage');

    try {
      const [featured, recent, popular, categories, stats] = await Promise.all([
        this.statisticsService.getFeaturedArticles(3),
        this.statisticsService.getRecentArticles(6),
        this.statisticsService.getPopularArticles(5),
        this.statisticsService.getCategories(),
        this.statisticsService.getBlogStats(),
      ]);

      const result: BlogDashboard = {
        featured,
        recent,
        popular,
        categories,
        stats,
        lastUpdated: new Date().toISOString(),
        success: true,
      };

      await this.blogCacheService.set(cacheKey, result, 10000);
      return result;
    } catch (error) {
      this.logger.error('Erreur homepage:', error);
      throw error;
    }
  }

  // =====================================================
  // 📦 CRUD ARTICLES (délégué à BlogArticleDataService)
  // =====================================================

  async getArticleBySlug(slug: string): Promise<BlogArticle | null> {
    return this.dataService.getArticleBySlug(slug);
  }

  async getArticleById(id: number): Promise<BlogArticle | null> {
    return this.dataService.getArticleById(id);
  }

  async getArticleByGamme(pg_alias: string): Promise<BlogArticle | null> {
    const { article, gammeData } =
      await this.dataService.getArticleByGamme(pg_alias);

    if (!article || !gammeData) {
      return null;
    }

    // Charger les articles croisés
    article.relatedArticles = await this.dataService.getRelatedArticles(
      article.legacy_id,
    );

    // Charger les véhicules compatibles
    article.compatibleVehicles =
      await this.relationService.getCompatibleVehicles(
        gammeData.pg_id,
        1000,
        pg_alias,
      );

    return article;
  }

  async createArticle(article: Partial<BlogArticle>): Promise<BlogArticle> {
    return this.dataService.createArticle(article);
  }

  async updateArticle(
    id: number,
    updates: Partial<BlogArticle>,
  ): Promise<BlogArticle> {
    return this.dataService.updateArticle(id, updates);
  }

  async getArticlesForAdmin(options: {
    page: number;
    limit: number;
    status?: string;
    search?: string;
  }): Promise<{
    articles: BlogArticle[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    return this.dataService.getArticlesForAdmin(options);
  }

  async incrementArticleViews(
    slug: string,
  ): Promise<{ success: boolean; views: number }> {
    return this.dataService.incrementArticleViews(slug);
  }

  async searchBlog(
    query: string,
    options?: {
      type?: 'all' | 'advice' | 'guide' | 'constructeur' | 'glossaire';
      limit?: number;
      offset?: number;
    },
  ): Promise<{ articles: BlogArticle[]; total: number }> {
    return this.dataService.searchBlog(query, options);
  }

  async getRelatedArticles(ba_id: number): Promise<BlogArticle[]> {
    return this.dataService.getRelatedArticles(ba_id);
  }

  async getAdjacentArticles(
    slug: string,
  ): Promise<{ previous: BlogArticle | null; next: BlogArticle | null }> {
    return this.dataService.getAdjacentArticles(slug);
  }

  // =====================================================
  // 📊 STATISTIQUES (délégué à BlogStatisticsService)
  // =====================================================

  async getBlogStats(): Promise<BlogDashboard> {
    return this.statisticsService.getBlogStats();
  }

  async getSimpleBlogStats(): Promise<{
    totalArticles: number;
    totalViews: number;
    totalAdvice: number;
    totalGuides: number;
  }> {
    return this.statisticsService.getSimpleBlogStats();
  }

  async getPopularArticles(limit: number = 10): Promise<BlogArticle[]> {
    return this.statisticsService.getPopularArticles(limit);
  }

  // =====================================================
  // 🔗 SEO & LIENS INTERNES (délégué à BlogSeoService)
  // =====================================================

  async injectInternalLinks(
    content: string,
    vehicle?: VehicleContext,
    sourceUrl?: string,
  ): Promise<LinkInjectionResult> {
    return this.seoService.injectInternalLinks(content, vehicle, sourceUrl);
  }

  async injectSimpleLinks(content: string): Promise<string> {
    return this.seoService.injectSimpleLinks(content);
  }

  async getSeoItemSwitches(pg_id: number): Promise<Record<string, unknown>[]> {
    return this.seoService.getSeoItemSwitches(pg_id);
  }

  async getGammeConseil(pg_id: number): Promise<
    Array<{
      title: string;
      content: string;
      sectionType: string | null;
      order: number | null;
    }>
  > {
    return this.seoService.getGammeConseil(pg_id);
  }

  async getInternalLinkStats(): Promise<{
    totalArticlesWithLinks: number;
    averageLinksPerArticle: number;
    topFormulas: Array<{ formula: string; count: number }>;
  }> {
    return this.seoService.getInternalLinkStats();
  }

  // =====================================================
  // 🚗 VÉHICULES COMPATIBLES (délégué à BlogArticleRelationService)
  // =====================================================

  async getCompatibleVehicles(
    pg_id: number,
    limit = 1000,
    pg_alias = '',
  ): Promise<Record<string, unknown>[]> {
    return this.relationService.getCompatibleVehicles(pg_id, limit, pg_alias);
  }

  // =====================================================
  // 🔍 DEBUG
  // =====================================================

  async debugArticleSections(ba_id: number) {
    return this.relationService.debugArticleSections(ba_id);
  }

  async findArticlesWithH3() {
    return this.relationService.findArticlesWithH3();
  }

  // =====================================================
  // 🔄 TRANSFORMATIONS (exposées pour compatibilité)
  // =====================================================

  /**
   * Expose la méthode de transformation pour les contrôleurs qui en ont besoin
   */
  transformAdviceToArticle(advice: Record<string, unknown>): BlogArticle {
    return this.transformService.transformAdviceToArticle(advice as BaRow);
  }

  transformGuideToArticle(guide: Record<string, unknown>): BlogArticle {
    return this.transformService.transformGuideToArticle(guide as BgRow);
  }

  buildImageUrl(
    filename: string | null,
    folder: string,
    marqueAlias?: string,
  ): string | null {
    return this.transformService.buildImageUrl(filename, folder, marqueAlias);
  }

  calculateReadingTime(content: string): number {
    return this.transformService.calculateReadingTime(content);
  }
}
