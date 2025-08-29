import { Injectable, Logger } from '@nestjs/common';
import { BlogService } from './blog.service';
import { SupabaseService } from '../../supabase/services/supabase.service';
import { BlogCacheService } from './blog-cache.service';
import { BlogArticle, BlogSection } from '../interfaces/blog.interfaces';

export interface BlogAdvice {
  id?: number;
  articleId?: number;
  difficultyLevel?: 'facile' | 'moyen' | 'difficile';
  estimatedTime?: number; // en minutes
  toolsRequired?: string[];
  category?: string;
  subcategory?: string;
  isStepByStep?: boolean;
  hasImages?: boolean;
  hasVideo?: boolean;
}

export interface AdviceFilters {
  difficulty?: 'facile' | 'moyen' | 'difficile';
  category?: string;
  hasImages?: boolean;
  hasVideo?: boolean;
  minTime?: number;
  maxTime?: number;
}

/**
 * 🔧 Service amélioré pour la gestion des conseils automobiles
 * Utilise les optimisations de cache et le décodage HTML de BlogCacheService
 */
@Injectable()
export class AdviceService {
  private readonly logger = new Logger(AdviceService.name);

  constructor(
    private readonly blogService: BlogService,
    private readonly supabaseService: SupabaseService,
    private readonly blogCacheService: BlogCacheService,
  ) {}

  /**
   * 📚 Récupérer la liste des conseils avec filtres avancés
   */
  async getAdviceList(
    gammeId?: number,
    page: number = 1,
    limit: number = 20,
    filters: AdviceFilters = {},
  ): Promise<{
    items: BlogArticle[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    success: boolean;
  }> {
    const cacheKey = `advice_list:${gammeId || 'all'}:${page}:${limit}:${JSON.stringify(filters)}`;
    
    try {
      const cached = await this.blogCacheService.get<any>(cacheKey);
      if (cached) return cached;

      this.logger.log(
        `📚 Récupération conseils - page ${page}, limite ${limit}`,
      );

      const client = this.supabaseService.client;
      const offset = (page - 1) * limit;

      let query = client
        .from('__blog_advice')
        .select('*', { count: 'exact' });

      // Filtres avancés
      if (filters.category) {
        query = query.ilike('ba_keywords', `%${filters.category}%`);
      }

      if (filters.difficulty) {
        const searchTerms = filters.difficulty === 'facile' 
          ? ['facile', 'simple', 'débutant']
          : filters.difficulty === 'difficile' 
          ? ['difficile', 'avancé', 'expert']
          : ['moyen', 'intermédiaire'];
        
        query = query.or(
          searchTerms
            .map(
              (k) =>
                `ba_title.ilike.%${k}%,ba_keywords.ilike.%${k}%,ba_descrip.ilike.%${k}%`,
            )
            .join(','),
        );
      }

      if (gammeId) {
        query = query.eq('ba_gamme_id', gammeId);
      }

      // Tri par popularité puis par date
      if (filters.difficulty === 'facile' || !filters.difficulty) {
        query = query
          .order('ba_visit', { ascending: false })
          .order('ba_create', { ascending: false });
      } else {
        query = query.order('ba_create', { ascending: false });
      }

      const { data, error, count } = await query.range(
        offset,
        offset + limit - 1,
      );

      if (error) {
        this.logger.error('Erreur récupération conseils:', error);
        throw error;
      }

      // Transformer en articles avec décodage HTML
      const items: BlogArticle[] = [];
      if (data) {
        for (const advice of data) {
          const article = await this.transformAdviceToArticle(advice);
          if (article) items.push(article);
        }
      }

      const result = {
        items,
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
        success: true,
      };

      // Cache avec stratégie basée sur la popularité moyenne
      const avgViews = items.reduce((sum, item) => sum + (item.viewsCount || 0), 0) / items.length;
      await this.blogCacheService.set(cacheKey, result, avgViews || 500);

      this.logger.log(`✅ ${items.length} conseils récupérés (${count} total)`);
      return result;

    } catch (error) {
      this.logger.error(`❌ Erreur getAdviceList: ${(error as Error).message}`);
      return {
        items: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
        success: false,
      };
    }
  }

  /**
   * 🏷️ Récupérer conseils par gamme
   */
  async getAdviceByGamme(gammeCode: string): Promise<{
    gamme: any;
    advices: BlogArticle[];
    success: boolean;
  }> {
    const cacheKey = `advice_gamme:${gammeCode}`;
    
    try {
      const cached = await this.blogCacheService.get<any>(cacheKey, 2000);
      if (cached) return cached;

      this.logger.log(`🏷️ Récupération conseils pour gamme: ${gammeCode}`);

      // Simulation de gamme pour l'exemple
      const gamme = {
        id: 1,
        code: gammeCode,
        name: `Gamme ${gammeCode}`,
        description: `Conseils pour la gamme ${gammeCode}`,
      };

      // Rechercher les conseils liés à cette gamme
      const { data, error } = await this.supabaseService.client
        .from('__blog_advice')
        .select('*')
        .or(`ba_title.ilike.%${gammeCode}%,ba_keywords.ilike.%${gammeCode}%`)
        .order('ba_visit', { ascending: false });

      if (error) {
        this.logger.error('Erreur récupération conseils gamme:', error);
        throw error;
      }

      const advices: BlogArticle[] = [];
      if (data) {
        for (const advice of data) {
          const article = await this.transformAdviceToArticle(advice);
          if (article) advices.push(article);
        }
      }

      const result = { gamme, advices, success: true };
      await this.blogCacheService.set(cacheKey, result, 2000);

      return result;

    } catch (error) {
      this.logger.error(`❌ Erreur getAdviceByGamme: ${(error as Error).message}`);
      return {
        gamme: null,
        advices: [],
        success: false,
      };
    }
  }

  /**
   * 🔗 Récupérer conseils liés à un produit
   */
  async getRelatedAdvice(productId: number, limit: number = 3): Promise<BlogArticle[]> {
    const cacheKey = `related_advice:${productId}:${limit}`;
    
    try {
      const cached = await this.blogCacheService.get<BlogArticle[]>(cacheKey, 1500);
      if (cached) return cached;

      this.logger.log(`🔗 Recherche conseils liés au produit: ${productId}`);

      // Recherche simple dans les conseils
      const { data, error } = await this.supabaseService.client
        .from('__blog_advice')
        .select('*')
        .or(`ba_title.ilike.%produit%,ba_keywords.ilike.%produit%,ba_title.ilike.%${productId}%`)
        .order('ba_visit', { ascending: false })
        .limit(limit);

      if (error) {
        this.logger.warn('Erreur recherche conseils liés:', error);
        return [];
      }

      const articles: BlogArticle[] = [];
      if (data) {
        for (const advice of data) {
          const article = await this.transformAdviceToArticle(advice);
          if (article) articles.push(article);
        }
      }

      await this.blogCacheService.set(cacheKey, articles, 1500);
      return articles;

    } catch (error) {
      this.logger.error(`❌ Erreur getRelatedAdvice: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * 📊 Statistiques des conseils
   */
  async getAdviceStats(): Promise<{
    total: number;
    totalViews: number;
    avgViews: number;
    topKeywords: Array<{ keyword: string; count: number }>;
    mostPopular: BlogArticle[];
    success: boolean;
  }> {
    const cacheKey = 'advice_stats_advanced';
    
    try {
      const cached = await this.blogCacheService.get<any>(cacheKey, 3000);
      if (cached) return cached;

      this.logger.log('📊 Calcul des statistiques conseils');

      const { data: allAdvice, error } = await this.supabaseService.client
        .from('__blog_advice')
        .select('ba_visit, ba_keywords, ba_title, ba_alias, ba_id');

      if (error) {
        throw error;
      }

      const total = allAdvice?.length || 0;
      const totalViews = allAdvice?.reduce((sum, item) => sum + (parseInt(item.ba_visit) || 0), 0) || 0;
      const avgViews = total > 0 ? Math.round(totalViews / total) : 0;

      // Analyser les mots-clés les plus populaires
      const keywordMap = new Map<string, number>();
      allAdvice?.forEach((advice) => {
        if (advice.ba_keywords) {
          const keywords = advice.ba_keywords.split(',').map((k: string) => k.trim().toLowerCase());
          keywords.forEach((keyword: string) => {
            if (keyword && keyword.length > 2) {
              keywordMap.set(keyword, (keywordMap.get(keyword) || 0) + 1);
            }
          });
        }
      });

      const topKeywords = Array.from(keywordMap.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([keyword, count]) => ({ keyword, count }));

      // Articles les plus populaires
      const popularAdvice = allAdvice
        ?.sort((a, b) => (parseInt(b.ba_visit) || 0) - (parseInt(a.ba_visit) || 0))
        ?.slice(0, 5) || [];

      const mostPopular: BlogArticle[] = [];
      for (const advice of popularAdvice) {
        const article = await this.transformAdviceToArticle(advice);
        if (article) mostPopular.push(article);
      }

      const stats = {
        total,
        totalViews,
        avgViews,
        topKeywords,
        mostPopular,
        success: true,
      };

      await this.blogCacheService.set(cacheKey, stats, 3000);
      return stats;

    } catch (error) {
      this.logger.error(`❌ Erreur getAdviceStats: ${(error as Error).message}`);
      return {
        total: 0,
        totalViews: 0,
        avgViews: 0,
        topKeywords: [],
        mostPopular: [],
        success: false,
      };
    }
  }

  // === MÉTHODES UTILITAIRES ===

  /**
   * 🔄 Transformation optimisée advice → BlogArticle
   */
  private async transformAdviceToArticle(advice: any): Promise<BlogArticle> {
    try {
      // Récupérer les sections H2/H3 en parallèle
      const [{ data: h2Sections }, { data: h3Sections }] = await Promise.all([
        this.supabaseService.client
          .from('__blog_advice_h2')
          .select('*')
          .eq('ba2_ba_id', advice.ba_id)
          .order('ba2_id'),
        this.supabaseService.client
          .from('__blog_advice_h3')
          .select('*')
          .eq('ba3_ba_id', advice.ba_id)
          .order('ba3_id'),
      ]);

      const sections: BlogSection[] = [
        ...(h2Sections?.map((s: any) => ({
          level: 2,
          title: BlogCacheService.decodeHtmlEntities(s.ba2_h2 || ''),
          content: BlogCacheService.decodeHtmlEntities(s.ba2_content || ''),
          anchor: this.createAnchor(s.ba2_h2),
        })) || []),
        ...(h3Sections?.map((s: any) => ({
          level: 3,
          title: BlogCacheService.decodeHtmlEntities(s.ba3_h3 || ''),
          content: BlogCacheService.decodeHtmlEntities(s.ba3_content || ''),
          anchor: this.createAnchor(s.ba3_h3),
        })) || []),
      ];

      return {
        id: `advice_${advice.ba_id}`,
        type: 'advice' as const,
        title: BlogCacheService.decodeHtmlEntities(advice.ba_title || ''),
        slug: advice.ba_alias,
        excerpt: BlogCacheService.decodeHtmlEntities(advice.ba_preview || advice.ba_descrip || ''),
        content: BlogCacheService.decodeHtmlEntities(advice.ba_content || ''),
        h1: BlogCacheService.decodeHtmlEntities(advice.ba_h1 || ''),
        h2: BlogCacheService.decodeHtmlEntities(advice.ba_h2 || ''),
        keywords: advice.ba_keywords ? advice.ba_keywords.split(',').map((k: string) => k.trim()) : [],
        tags: advice.ba_keywords ? advice.ba_keywords.split(',').map((k: string) => k.trim()) : [],
        publishedAt: advice.ba_create,
        updatedAt: advice.ba_update,
        viewsCount: parseInt(advice.ba_visit) || 0,
        readingTime: this.calculateReadingTime(advice.ba_content || advice.ba_descrip),
        sections,
        legacy_id: parseInt(advice.ba_id),
        legacy_table: '__blog_advice',
        seo_data: {
          meta_title: BlogCacheService.decodeHtmlEntities(advice.ba_title || ''),
          meta_description: BlogCacheService.decodeHtmlEntities(advice.ba_descrip || ''),
          keywords: advice.ba_keywords ? advice.ba_keywords.split(',').map((k: string) => k.trim()) : [],
        },
      };

    } catch (error) {
      this.logger.error(`❌ Erreur transformation advice: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * ⏱️ Calculer temps de lecture
   */
  private calculateReadingTime(content: string): number {
    if (!content) return 1;
    
    const cleanText = BlogCacheService.decodeHtmlEntities(content).replace(/<[^>]*>/g, '');
    const wordsPerMinute = 200;
    const words = cleanText.split(/\s+/).filter(word => word.length > 0).length;
    return Math.max(1, Math.ceil(words / wordsPerMinute));
  }

  /**
   * ⚓ Créer une ancre pour les sections
   */
  private createAnchor(text: string): string {
    if (!text) return '';
    
    return BlogCacheService.decodeHtmlEntities(text)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // === MÉTHODES DE COMPATIBILITÉ ===

  /**
   * Récupère la liste des conseils - compatibilité
   */
  async getAdvices(limit?: number): Promise<BlogArticle[]> {
    const result = await this.getAdviceList(undefined, 1, limit || 20);
    return result.items;
  }

  /**
   * Récupérer statistiques des conseils - compatibilité
   */
  async getStats(): Promise<{
    total: number;
    totalViews: number;
    avgViews: number;
    topKeywords: Array<{ keyword: string; count: number }>;
    mostPopular: BlogArticle[];
    success: boolean;
  }> {
    return this.getAdviceStats();
  }
}
