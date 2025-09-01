import { Injectable, Logger, Inject, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { SupabaseIndexationService } from '../../search/services/supabase-indexation.service';
import { BlogCacheService } from './blog-cache.service';
import { 
  BlogArticle, 
  BlogSection, 
  BlogSearchResult, 
  BlogDashboard 
} from '../interfaces/blog.interfaces';

/**
 * 📰 BlogService - Service principal AMÉLIORÉ pour la gestion du contenu blog
 * 
 * 🎯 FONCTIONNALITÉS AMÉLIORÉES :
 * - Cache intelligent avec stratégie 3-niveaux (hot/warm/cold)
 * - Décodage HTML automatique des entités
 * - Recherche unifiée avec Meilisearch
 * - Agrégation de données multi-tables optimisée
 * - Gestion des articles legacy + modernes
 * - SEO et méta-données intégrés
 * - Temps de lecture automatique
 * - Gestion des vues et popularité
 */
@Injectable()
export class BlogService {
  private readonly logger = new Logger(BlogService.name);

  constructor(
    private readonly supabaseService: SupabaseIndexationService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly blogCacheService: BlogCacheService,
  ) {}

  /**
   * 🏠 Page d'accueil du blog (remplace blog.index.php) - VERSION AMÉLIORÉE
   */
  async getHomepageContent(): Promise<BlogDashboard> {
    const cacheKey = 'homepage';
    
    // Essayer le cache d'abord
    const cached = await this.blogCacheService.get<BlogDashboard>(cacheKey, 10000); // Cache chaud
    if (cached) return cached;

    this.logger.log('🏠 Génération du contenu homepage');

    try {
      const [featured, recent, popular, categories, stats] = await Promise.all([
        this.getFeaturedArticles(3),
        this.getRecentArticles(6),
        this.getPopularArticles(5),
        this.getCategories(),
        this.getBlogStats(),
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

      // Cache avec stratégie chaud (articles populaires)
      await this.blogCacheService.set(cacheKey, result, 10000);
      
      return result;
    } catch (error) {
      this.logger.error('Erreur homepage:', error);
      throw error;
    }
  }

    /**
   * � Recherche unifiée dans tout le contenu blog
   */
  /**
   * 🔍 Recherche unifiée dans tout le contenu blog
   */
  async searchBlog(
    query: string,
    type: 'all' | 'advice' | 'guide' | 'constructeur' | 'glossaire' = 'all',
    page: number = 1,
    limit: number = 20,
  ): Promise<BlogSearchResult> {
    try {
      this.logger.log(`🔍 Recherche "${query}"`);

      // Recherche simple dans les conseils pour le moment
      const { data } = await this.supabaseService.client
        .from('__blog_advice')
        .select('*')
        .ilike('ba_title', `%${query}%`)
        .range((page - 1) * limit, page * limit - 1);

      const results =
        data?.map((item) => this.transformAdviceToArticle(item)) || [];

      this.logger.log(`🔍 Recherche "${query}": ${results.length} résultats`);

      return {
        query,
        type,
        results,
        total: results.length,
        page,
        limit,
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur recherche blog: ${(error as Error).message}`,
      );
      return { query, type, results: [], total: 0, page, limit };
    }
  }

  /**
   * 📝 Créer un nouvel article - VERSION AMÉLIORÉE
   */
  async createArticle(article: Partial<BlogArticle>, authorId: string): Promise<BlogArticle> {
    try {
      // Générer un slug unique
      const slug = await this.generateUniqueSlug(article.title || '');

      // Calculer le temps de lecture
      const readingTime = this.calculateReadingTime(article.content);

      // Nettoyer et décoder le contenu HTML
      const cleanedContent = this.cleanAndDecodeContent(article.content);

      const newArticle: Partial<BlogArticle> = {
        ...article,
        slug,
        authorId,
        readingTime,
        content: cleanedContent,
        status: article.status || 'draft',
        publishedAt: article.status === 'published' ? new Date() : undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Insérer dans les tables modernes
      const { data, error } = await this.supabaseService.client
        .from('blog_articles')
        .insert(newArticle)
        .select()
        .single();

      if (error) throw error;

      // Invalider les caches
      await this.invalidateRelatedCaches(['homepage', 'recent', 'categories']);

      this.logger.log(`✅ Article créé: ${slug}`);
      return data;
    } catch (error) {
      this.logger.error('Erreur createArticle:', error);
      throw error;
    }
  }

  /**
   * ✏️ Mettre à jour un article - VERSION AMÉLIORÉE
   */
  async updateArticle(id: number, updates: Partial<BlogArticle>): Promise<BlogArticle> {
    try {
      const updateData: any = { ...updates };

      // Si le titre change, régénérer le slug
      if (updates.title) {
        updateData.slug = await this.generateUniqueSlug(updates.title, id);
      }

      // Recalculer le temps de lecture si le contenu change
      if (updates.content) {
        updateData.readingTime = this.calculateReadingTime(updates.content);
        updateData.content = this.cleanAndDecodeContent(updates.content);
      }

      updateData.updatedAt = new Date();

      const { data, error } = await this.supabaseService.client
        .from('blog_articles')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Invalider les caches liés
      await this.invalidateRelatedCaches([
        'homepage', 
        'recent', 
        `article:${data.slug}`,
        `article:${updates.slug}`
      ]);

      this.logger.log(`✅ Article mis à jour: ${data.slug}`);
      return data;
    } catch (error) {
      this.logger.error('Erreur updateArticle:', error);
      throw error;
    }
  }

  /**
   * 🔍 Recherche unifiée dans tout le contenu blog
   */
  async searchBlog(
    query: string,
    type: 'all' | 'advice' | 'guide' | 'constructeur' | 'glossaire' = 'all',
    page: number = 1,
    limit: number = 20,
  ): Promise<BlogSearchResult> {
    try {
      this.logger.log(`🔍 Recherche "${query}"`);

      // Recherche simple dans les conseils pour le moment
      const { data } = await this.supabaseService.client
        .from('__blog_advice')
        .select('*')
        .ilike('ba_title', `%${query}%`)
        .range((page - 1) * limit, page * limit - 1);

      const results = data?.map(item => this.transformAdviceToArticle(item)) || [];

      this.logger.log(`🔍 Recherche "${query}": ${results.length} résultats`);

      return {
        query,
        type,
        results,
        total: results.length,
        page,
        limit,
      };
    } catch (error) {
      this.logger.error(`❌ Erreur recherche blog: ${(error as Error).message}`);
      return { query, type, results: [], total: 0, page, limit };
    }
  }

  /**
   * 📄 Récupération d'un article par slug
   */
  async getArticleBySlug(slug: string): Promise<BlogArticle | null> {
    try {
      // Chercher dans toutes les tables via supabase
      const { data, error } = await this.supabaseService.client
        .from('__blog_advice')
        .select('*')
        .eq('ba_alias', slug)
        .single();

      if (error || !data) {
        // Essayer dans les guides
        const { data: guideData } = await this.supabaseService.client
          .from('__blog_guide')
          .select('*')
          .eq('bg_alias', slug)
          .single();

        if (guideData) {
          return this.transformGuideToArticle(guideData);
        }

        return null;
      }

      return this.transformAdviceToArticle(data);
    } catch (error) {
      this.logger.error(`❌ Erreur récupération article ${slug}: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * � Récupérer un article par son ID
   */
  async getArticleById(id: number): Promise<BlogArticle | null> {
    try {
      this.logger.log(`🔍 Récupération article ID: ${id}`);

      // Chercher d'abord dans la table moderne
      const { data: modernArticle } = await this.supabaseService.client
        .from('blog_articles')
        .select('*')
        .eq('id', id)
        .single();

      if (modernArticle) {
        return modernArticle;
      }

      // Chercher dans les tables legacy
      const { data: adviceData } = await this.supabaseService.client
        .from('__blog_advice')
        .select('*')
        .eq('ba_id', id)
        .single();

      if (adviceData) {
        return this.transformAdviceToArticle(adviceData);
      }

      // Chercher dans les guides
      const { data: guideData } = await this.supabaseService.client
        .from('__blog_guide')
        .select('*')
        .eq('bg_id', id)
        .single();

      if (guideData) {
        return this.transformGuideToArticle(guideData);
      }

      return null;
    } catch (error) {
      this.logger.error(`❌ Erreur récupération article ID ${id}: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * 📋 Récupérer les articles pour l'administration
   */
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
    try {
      this.logger.log(`📋 Récupération articles admin - Page: ${options.page}, Limite: ${options.limit}`);

      const offset = (options.page - 1) * options.limit;

      // Construction de la requête de base
      let query = this.supabaseService.client
        .from('__blog_advice')
        .select('*', { count: 'exact' });

      // Filtre par statut si spécifié
      if (options.status) {
        query = query.eq('ba_status', options.status);
      }

      // Filtre par recherche si spécifié
      if (options.search) {
        query = query.or(`ba_title.ilike.%${options.search}%,ba_content.ilike.%${options.search}%`);
      }

      // Pagination et tri
      query = query
        .order('ba_date', { ascending: false })
        .range(offset, offset + options.limit - 1);

      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      const articles = data ? data.map(advice => this.transformAdviceToArticle(advice)) : [];
      const total = count || 0;
      const totalPages = Math.ceil(total / options.limit);

      return {
        articles,
        total,
        page: options.page,
        totalPages
      };
    } catch (error) {
      this.logger.error(`❌ Erreur récupération articles admin: ${(error as Error).message}`);
      return {
        articles: [],
        total: 0,
        page: options.page,
        totalPages: 0
      };
    }
  }

  /**
   * �📊 Dashboard avec statistiques complètes
   */
  async getBlogStats(): Promise<BlogDashboard> {
    try {
      const cacheKey = 'blog:dashboard';
      const cached = await this.cacheManager.get<BlogDashboard>(cacheKey);
      if (cached) return cached;

      // Statistiques des conseils
      const { data: adviceStats } = await this.supabaseService.client
        .from('__blog_advice')
        .select('ba_visit, ba_create, ba_update');

      // Statistiques des guides  
      const { data: guideStats } = await this.supabaseService.client
        .from('__blog_guide')
        .select('bg_visit, bg_create, bg_update');

      const totalAdvice = adviceStats?.length || 0;
      const totalGuides = guideStats?.length || 0;
      const totalArticles = totalAdvice + totalGuides;

      const adviceViews = adviceStats
        ?.reduce((sum, item) => sum + (parseInt(item.ba_visit) || 0), 0) || 0;
      const guideViews = guideStats
        ?.reduce((sum, item) => sum + (parseInt(item.bg_visit) || 0), 0) || 0;
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
            avgViews: totalAdvice > 0 ? Math.round(adviceViews / totalAdvice) : 0,
          },
          guide: {
            total: totalGuides,
            views: guideViews,
            avgViews: totalGuides > 0 ? Math.round(guideViews / totalGuides) : 0,
          },
          constructeur: { total: 0, views: 0, avgViews: 0 },
          glossaire: { total: 0, views: 0, avgViews: 0 },
        },
        popular: await this.getPopularArticles(5),
        lastUpdated: new Date().toISOString(),
      };

      await this.cacheManager.set(cacheKey, dashboard, 3600 * 1000); // 1h TTL
      return dashboard;
    } catch (error) {
      this.logger.error(`❌ Erreur statistiques blog: ${(error as Error).message}`);
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
        .from('__blog_advice')
        .select('*')
        .order('ba_visit', { ascending: false })
        .limit(limit);

      return data?.map(item => this.transformAdviceToArticle(item)) || [];
    } catch (error) {
      this.logger.error(`❌ Erreur articles populaires: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * 🔄 Transformation advice → BlogArticle
   */
  private transformAdviceToArticle(advice: any): BlogArticle {
    return {
      id: `advice_${advice.ba_id}`,
      type: 'advice',
      title: BlogCacheService.decodeHtmlEntities(advice.ba_title || ''),
      slug: advice.ba_alias,
      excerpt: BlogCacheService.decodeHtmlEntities(advice.ba_preview || advice.ba_descrip || ''),
      content: BlogCacheService.decodeHtmlEntities(advice.ba_content || ''),
      h1: BlogCacheService.decodeHtmlEntities(advice.ba_h1 || ''),
      h2: BlogCacheService.decodeHtmlEntities(advice.ba_h2 || ''),
      keywords: advice.ba_keywords ? advice.ba_keywords.split(', ') : [],
      tags: advice.ba_keywords ? advice.ba_keywords.split(', ') : [],
      publishedAt: advice.ba_create,
      updatedAt: advice.ba_update,
      viewsCount: parseInt(advice.ba_visit) || 0,
      sections: this.extractSectionsFromContent(advice),
      legacy_id: advice.ba_id,
      legacy_table: '__blog_advice',
      seo_data: {
        meta_title: BlogCacheService.decodeHtmlEntities(advice.ba_title || ''),
        meta_description: BlogCacheService.decodeHtmlEntities(advice.ba_descrip || ''),
      },
    };
  }

  /**
   * 🔄 Transformation guide → BlogArticle
   */
  private transformGuideToArticle(guide: any): BlogArticle {
    return {
      id: `guide_${guide.bg_id}`,
      type: 'guide',
      title: BlogCacheService.decodeHtmlEntities(guide.bg_title || ''),
      slug: guide.bg_alias,
      excerpt: BlogCacheService.decodeHtmlEntities(guide.bg_preview || guide.bg_descrip || ''),
      content: BlogCacheService.decodeHtmlEntities(guide.bg_content || ''),
      h1: BlogCacheService.decodeHtmlEntities(guide.bg_h1 || ''),
      h2: BlogCacheService.decodeHtmlEntities(guide.bg_h2 || ''),
      keywords: guide.bg_keywords ? guide.bg_keywords.split(', ') : [],
      tags: guide.bg_keywords ? guide.bg_keywords.split(', ') : [],
      publishedAt: guide.bg_create,
      updatedAt: guide.bg_update,
      viewsCount: parseInt(guide.bg_visit) || 0,
      sections: [],
      legacy_id: guide.bg_id,
      legacy_table: '__blog_guide',
      seo_data: {
        meta_title: BlogCacheService.decodeHtmlEntities(guide.bg_meta_title || ''),
        meta_description: BlogCacheService.decodeHtmlEntities(guide.bg_meta_description || ''),
        keywords: guide.bg_keywords ? guide.bg_keywords.split(', ') : [],
      },
    };
  }

  /**
   * 📝 Extraction des sections depuis le contenu
   */
  private extractSectionsFromContent(data: any): BlogSection[] {
    const sections: BlogSection[] = [];

    // Section H2
    if (data.ba2_h2 && data.ba2_content) {
      sections.push({
        level: 2,
        title: BlogCacheService.decodeHtmlEntities(data.ba2_h2),
        content: BlogCacheService.decodeHtmlEntities(data.ba2_content),
        anchor: this.generateAnchor(data.ba2_h2),
      });
    }

    // Section H3
    if (data.ba3_h3 && data.ba3_content) {
      sections.push({
        level: 3,
        title: BlogCacheService.decodeHtmlEntities(data.ba3_h3),
        content: BlogCacheService.decodeHtmlEntities(data.ba3_content),
        anchor: this.generateAnchor(data.ba3_h3),
      });
    }

    return sections;
  }

  /**
   * 🔗 Génération d'ancre pour navigation
   */
  private generateAnchor(title: string): string {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  // === MÉTHODES AMÉLIORÉES AJOUTÉES ===

  /**
   * 🏠 Articles en vedette (Featured) - AMÉLIORÉ avec cache
   */
  private async getFeaturedArticles(limit: number = 3): Promise<BlogArticle[]> {
    const cacheKey = `featured:${limit}`;
    const cached = await this.blogCacheService.get<BlogArticle[]>(cacheKey, 5000);
    if (cached) return cached;

    try {
      const { data } = await this.supabaseService.client
        .from('__blog_advice')
        .select('*')
        .order('ba_views', { ascending: false })
        .limit(limit);

      const articles = data?.map(item => this.transformAdviceToArticle(item)) || [];
      await this.blogCacheService.set(cacheKey, articles, 5000);
      return articles;
    } catch (error) {
      this.logger.error('Erreur getFeaturedArticles:', error);
      return [];
    }
  }

  /**
   * 📰 Articles récents - AMÉLIORÉ
   */
  private async getRecentArticles(limit: number = 6): Promise<BlogArticle[]> {
    const cacheKey = `recent:${limit}`;
    const cached = await this.blogCacheService.get<BlogArticle[]>(cacheKey, 1000);
    if (cached) return cached;

    try {
      const { data } = await this.supabaseService.client
        .from('__blog_advice')
        .select('*')
        .order('ba_date_add', { ascending: false })
        .limit(limit);

      const articles = data?.map(item => this.transformAdviceToArticle(item)) || [];
      await this.blogCacheService.set(cacheKey, articles, 1000);
      return articles;
    } catch (error) {
      this.logger.error('Erreur getRecentArticles:', error);
      return [];
    }
  }

  /**
   * 📁 Catégories - AMÉLIORÉ
   */
  private async getCategories(): Promise<any[]> {
    const cacheKey = 'categories';
    const cached = await this.blogCacheService.get<any[]>(cacheKey, 5000);
    if (cached) return cached;

    try {
      const categories = [
        { 
          id: 1, 
          name: 'Conseils', 
          slug: 'advice', 
          description: 'Conseils pratiques pour l\'entretien automobile',
          articlesCount: await this.getTypeCount('__blog_advice')
        },
        { 
          id: 2, 
          name: 'Guides', 
          slug: 'guide', 
          description: 'Guides détaillés de réparation et maintenance',
          articlesCount: await this.getTypeCount('__blog_guide')
        }
      ];

      await this.blogCacheService.set(cacheKey, categories, 5000);
      return categories;
    } catch (error) {
      this.logger.error('Erreur getCategories:', error);
      return [];
    }
  }

  /**
   * ⏱️ Calculer le temps de lecture
   */
  private calculateReadingTime(content: any): number {
    if (!content) return 1;
    
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    const cleanText = BlogCacheService.decodeHtmlEntities(text).replace(/<[^>]*>/g, '');
    const wordsPerMinute = 200;
    const words = cleanText.split(/\s+/).filter((word: string) => word.length > 0).length;
    return Math.max(1, Math.ceil(words / wordsPerMinute));
  }

  /**
   * 🧹 Nettoyer et décoder le contenu
   */
  private cleanAndDecodeContent(content: any): string {
    if (!content) return '';
    
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    return BlogCacheService.decodeHtmlEntities(text);
  }

  /**
   * 🔗 Générer un slug unique - VERSION AMÉLIORÉE
   */
  private async generateUniqueSlug(title: string, excludeId?: number): Promise<string> {
    let slug = this.slugifyTitle(BlogCacheService.decodeHtmlEntities(title));
    let counter = 0;
    let uniqueSlug = slug;

    while (true) {
      const existsInAdvice = await this.checkSlugExists('__blog_advice', 'ba_alias', uniqueSlug);
      const existsInGuide = await this.checkSlugExists('__blog_guide', 'bg_alias', uniqueSlug);
      
      if (!existsInAdvice && !existsInGuide) {
        return uniqueSlug;
      }

      counter++;
      uniqueSlug = `${slug}-${counter}`;
    }
  }

  /**
   * 👁️ Incrémenter le compteur de vues
   */
  private async incrementViewCount(slug: string, type: string): Promise<void> {
    try {
      if (type === 'advice') {
        await this.supabaseService.client
          .rpc('increment_views', { 
            table_name: '__blog_advice', 
            slug_column: 'ba_alias',
            views_column: 'ba_views',
            slug_value: slug 
          });
      }
    } catch (error) {
      this.logger.warn('Erreur incrementViewCount:', error);
    }
  }

  /**
   * 🗑️ Invalider les caches liés
   */
  private async invalidateRelatedCaches(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.blogCacheService.del(key);
    }
  }

  /**
   * ✅ Vérifier si un slug existe
   */
  private async checkSlugExists(tableName: string, columnName: string, slug: string): Promise<boolean> {
    const { data } = await this.supabaseService.client
      .from(tableName)
      .select('id')
      .eq(columnName, slug)
      .maybeSingle();
    
    return !!data;
  }

  /**
   * 📊 Compter les articles par type
   */
  private async getTypeCount(tableName: string): Promise<number> {
    const { count } = await this.supabaseService.client
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    
    return count || 0;
  }

  /**
   * 🔄 Récupérer article depuis tables legacy
   */
  private async getArticleFromLegacyTables(slug: string): Promise<BlogArticle | null> {
    try {
      const { data: adviceData } = await this.supabaseService.client
        .from('__blog_advice')
        .select('*')
        .eq('ba_alias', slug)
        .single();

      if (adviceData) {
        return this.transformAdviceToArticle(adviceData);
      }

      const { data: guideData } = await this.supabaseService.client
        .from('__blog_guide')
        .select('*')
        .eq('bg_alias', slug)
        .single();

      if (guideData) {
        return this.transformGuideToArticle(guideData);
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 🆕 Récupérer article depuis tables modernes (placeholder)
   */
  private async getArticleFromModernTables(slug: string): Promise<BlogArticle | null> {
    // Pour l'instant retourne null, à implémenter quand les tables modernes seront créées
    return null;
  }
}
