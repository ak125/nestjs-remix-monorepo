import { TABLES } from '@repo/database-types';
import { Injectable, Logger } from '@nestjs/common';
import { BlogService } from './blog.service';
import { normalizeAlias } from '../../../common/utils/url-builder.utils';
import { SupabaseIndexationService } from '../../search/services/supabase-indexation.service';
import { BlogCacheService } from './blog-cache.service';
import { BlogArticle } from '../interfaces/blog.interfaces';
import { RpcGateService } from '../../../security/rpc-gate/rpc-gate.service';
import { AdviceTransformService } from './advice-transform.service';
import { AdviceEnrichmentService } from './advice-enrichment.service';

export interface BlogAdvice {
  id?: number;
  articleId?: number;
  gammeId?: number;
  difficultyLevel?: 'facile' | 'moyen' | 'difficile';
  estimatedTime?: number;
  toolsRequired?: string[];
  category?: string;
  subcategory?: string;
  isStepByStep?: boolean;
  hasImages?: boolean;
  hasVideo?: boolean;
  steps?: Record<string, unknown>[];
  tips?: Record<string, unknown>[];
  warnings?: string[];
  relatedProducts?: Record<string, unknown>[];
}

export interface AdviceFilters {
  difficulty?: 'facile' | 'moyen' | 'difficile';
  category?: string;
  hasImages?: boolean;
  hasVideo?: boolean;
  minTime?: number;
  maxTime?: number;
  keywords?: string[];
  minViews?: number;
  gammeId?: number;
  sortBy?: 'ba_visit' | 'date' | 'popularity';
}

/**
 * Service facade pour la gestion des conseils automobiles.
 *
 * Delegue les transformations a AdviceTransformService
 * et les enrichissements/stats a AdviceEnrichmentService.
 */
@Injectable()
export class AdviceService {
  private readonly logger = new Logger(AdviceService.name);

  constructor(
    private readonly blogService: BlogService,
    private readonly supabaseService: SupabaseIndexationService,
    private readonly blogCacheService: BlogCacheService,
    private readonly rpcGate: RpcGateService,
    private readonly adviceTransformService: AdviceTransformService,
    private readonly adviceEnrichmentService: AdviceEnrichmentService,
  ) {}

  /**
   * Test methode simple pour debug
   */
  async getTestAdvice(): Promise<{
    items: BlogArticle[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    success: boolean;
  }> {
    this.logger.log('Test method called');

    try {
      const mockAdvice: BlogArticle = {
        id: 'test_1',
        type: 'advice',
        title: 'Conseil de test',
        slug: 'conseil-test',
        excerpt: 'Un conseil de test pour verifier le service',
        content: 'Contenu complet du conseil de test',
        keywords: ['test', 'debug'],
        tags: ['test'],
        publishedAt: '2025-08-29T16:00:00Z',
        viewsCount: 1,
        sections: [],
        legacy_id: 1,
        legacy_table: '__blog_advice',
        readingTime: 1,
      };

      return {
        items: [mockAdvice],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        success: true,
      };
    } catch (error) {
      this.logger.error(`Erreur test: ${(error as Error).message}`);
      return {
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        success: false,
      };
    }
  }

  /**
   * Recuperer la liste des conseils avec filtres avances
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
      const cached = await this.blogCacheService.get<{
        items: BlogArticle[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        success: boolean;
      }>(cacheKey);
      if (cached) return cached;

      this.logger.log(`Recuperation conseils - page ${page}, limite ${limit}`);

      const client = this.supabaseService.client;
      const offset = (page - 1) * limit;

      let query = client
        .from(TABLES.blog_advice)
        .select('*', { count: 'exact' });

      // Filtres avances
      if (filters.category) {
        query = query.ilike('ba_keywords', `%${filters.category}%`);
      }

      if (filters.keywords?.length) {
        const keywordFilter = filters.keywords
          .map(
            (k) =>
              `ba_title.ilike.%${k}%,ba_keywords.ilike.%${k}%,ba_descrip.ilike.%${k}%`,
          )
          .join(',');
        query = query.or(keywordFilter);
      }

      if (filters.difficulty) {
        const searchTerms =
          filters.difficulty === 'facile'
            ? ['facile', 'simple', 'debutant']
            : filters.difficulty === 'difficile'
              ? ['difficile', 'avance', 'expert']
              : ['moyen', 'intermediaire'];

        query = query.or(
          searchTerms
            .map(
              (k) =>
                `ba_title.ilike.%${k}%,ba_keywords.ilike.%${k}%,ba_descrip.ilike.%${k}%`,
            )
            .join(','),
        );
      }

      if (filters.minViews) {
        query = query.gte('ba_visit', filters.minViews.toString());
      }

      if (gammeId) {
        query = query.eq('ba_gamme_id', gammeId);
      }

      // Tri optimise selon les filtres
      if (
        filters.sortBy === 'popularity' ||
        filters.difficulty === 'facile' ||
        !filters.sortBy
      ) {
        query = query
          .order('ba_visit', { ascending: false })
          .order('ba_create', { ascending: false });
      } else if (filters.sortBy === 'date') {
        query = query.order('ba_create', { ascending: false });
      } else {
        query = query.order('ba_visit', { ascending: false });
      }

      const { data, error, count } = await query.range(
        offset,
        offset + limit - 1,
      );

      if (error) {
        this.logger.error('Erreur recuperation conseils:', error);
        throw error;
      }

      // Delegate transformation to AdviceTransformService
      const items: BlogArticle[] = data
        ? await this.adviceTransformService.transformAdvicesToArticles(data)
        : [];

      // Delegate enrichment to AdviceEnrichmentService
      const enrichedItems =
        await this.adviceEnrichmentService.enrichArticlesWithPgAlias(items);

      const result = {
        items: enrichedItems,
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
        success: true,
      };

      // Cache avec strategie basee sur la popularite moyenne
      const avgViews =
        items.reduce((sum, item) => sum + (item.viewsCount || 0), 0) /
        (items.length || 1);
      await this.blogCacheService.set(cacheKey, result, avgViews || 500);

      this.logger.log(`${items.length} conseils recuperes (${count} total)`);
      return result;
    } catch (error) {
      this.logger.error(`Erreur getAdviceList: ${(error as Error).message}`);
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
   * Recuperer conseils par gamme avec cache optimise
   */
  async getAdviceByGamme(gammeCode: string): Promise<{
    gamme: {
      id: number;
      code: string;
      name: string;
      description: string;
    } | null;
    advices: BlogArticle[];
    success: boolean;
  }> {
    const cacheKey = `advice_gamme:${gammeCode}`;

    try {
      const cached = await this.blogCacheService.get<{
        gamme: {
          id: number;
          code: string;
          name: string;
          description: string;
        } | null;
        advices: BlogArticle[];
        success: boolean;
      }>(cacheKey, 2000);
      if (cached) return cached;

      this.logger.log(`Recuperation conseils pour gamme: ${gammeCode}`);

      const gamme = {
        id: 1,
        code: gammeCode,
        name: `Gamme ${gammeCode}`,
        description: `Conseils pour la gamme ${gammeCode}`,
      };

      const { data, error } = await this.supabaseService.client
        .from(TABLES.blog_advice)
        .select('*')
        .or(`ba_title.ilike.%${gammeCode}%,ba_keywords.ilike.%${gammeCode}%`)
        .order('ba_visit', { ascending: false });

      if (error) {
        this.logger.error('Erreur recuperation conseils gamme:', error);
        throw error;
      }

      // Delegate transformation
      const advices: BlogArticle[] = data
        ? await this.adviceTransformService.transformAdvicesToArticles(data)
        : [];

      const result = { gamme, advices, success: true };
      await this.blogCacheService.set(cacheKey, result, 2000);

      return result;
    } catch (error) {
      this.logger.error(`Erreur getAdviceByGamme: ${(error as Error).message}`);
      return {
        gamme: null,
        advices: [],
        success: false,
      };
    }
  }

  /**
   * Recuperer conseils lies a un produit avec cache intelligent
   */
  async getRelatedAdvice(
    productId: number,
    limit: number = 3,
  ): Promise<BlogArticle[]> {
    const cacheKey = `related_advice:${productId}:${limit}`;

    try {
      const cached = await this.blogCacheService.get<BlogArticle[]>(
        cacheKey,
        1500,
      );
      if (cached) return cached;

      this.logger.log(`Recherche conseils lies au produit: ${productId}`);

      const { data, error } = await this.supabaseService.client
        .from(TABLES.blog_advice)
        .select('*')
        .or(
          `ba_title.ilike.%produit%,ba_keywords.ilike.%produit%,ba_title.ilike.%${productId}%`,
        )
        .order('ba_visit', { ascending: false })
        .limit(limit);

      if (error) {
        this.logger.warn('Erreur recherche conseils lies:', error);
        return [];
      }

      // Delegate transformation
      const articles: BlogArticle[] = data
        ? await this.adviceTransformService.transformAdvicesToArticles(data)
        : [];

      await this.blogCacheService.set(cacheKey, articles, 1500);
      return articles;
    } catch (error) {
      this.logger.error(`Erreur getRelatedAdvice: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * Recuperer un conseil par ID ou slug
   */
  async getAdviceById(id: string | number): Promise<BlogArticle | null> {
    const cacheKey = `advice_detail:${id}`;

    try {
      const cached = await this.blogCacheService.get<BlogArticle>(
        cacheKey,
        1000,
      );
      if (cached) return cached;

      this.logger.log(`Recuperation conseil: ${id}`);

      let query;

      if (typeof id === 'string') {
        query = this.supabaseService.client
          .from(TABLES.blog_advice)
          .select('*')
          .eq('ba_alias', id)
          .single();
      } else {
        query = this.supabaseService.client
          .from(TABLES.blog_advice)
          .select('*')
          .eq('ba_id', id)
          .single();
      }

      const { data, error } = await query;

      if (error || !data) {
        this.logger.warn(`Conseil non trouve: ${id}`);
        return null;
      }

      // Delegate transformation
      const article =
        await this.adviceTransformService.transformAdviceToArticle(data);

      // Incrementer les vues de facon atomique
      await this.incrementViews(data.ba_id);

      // Cache avec TTL base sur la popularite
      await this.blogCacheService.set(
        cacheKey,
        article,
        article.viewsCount + 1,
      );

      return article;
    } catch (error) {
      this.logger.error(`Erreur getAdviceById: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Creer un nouveau conseil (compatible avec la nouvelle interface)
   */
  async createAdvice(
    article: Partial<BlogArticle>,
    advice: BlogAdvice,
  ): Promise<{
    article: BlogArticle;
    advice: BlogAdvice;
    success: boolean;
  }> {
    try {
      this.logger.log('Creation nouveau conseil');

      let createdArticle: BlogArticle;

      if (
        this.blogService &&
        typeof this.blogService.createArticle === 'function'
      ) {
        createdArticle = await this.blogService.createArticle({
          ...article,
          type: 'advice',
        });
      } else {
        const articleData = {
          ba_title: article.title,
          ba_alias: article.slug || normalizeAlias(article.title || ''),
          ba_descrip: article.excerpt,
          ba_content: article.content,
          ba_keywords: article.keywords?.join(','),
          ba_create: new Date().toISOString(),
          ba_visit: '0',
        };

        const { data, error } = await this.supabaseService.client
          .from(TABLES.blog_advice)
          .insert(articleData)
          .select()
          .single();

        if (error) throw error;

        // Delegate transformation
        createdArticle =
          await this.adviceTransformService.transformAdviceToArticle(data);
      }

      return {
        article: createdArticle,
        advice: {
          ...advice,
          articleId: parseInt(createdArticle.legacy_id.toString()),
        },
        success: true,
      };
    } catch (error) {
      this.logger.error(`Erreur createAdvice: ${(error as Error).message}`);
      throw error;
    }
  }

  // === PRIVATE HELPERS ===

  /**
   * Incrementer les vues de maniere atomique.
   * RPC Safety Gate: Evalue via rpcGate avant appel.
   */
  private async incrementViews(adviceId: number): Promise<void> {
    try {
      const { decision, reason } = this.rpcGate.evaluate(
        'increment_advice_views',
        {
          source: 'api',
        },
      );

      if (decision === 'BLOCK') {
        this.logger.warn(`RPC blocked: increment_advice_views (${reason})`);
        return;
      }

      await this.supabaseService.client.rpc('increment_advice_views', {
        advice_id: adviceId,
      });
    } catch {
      // Fallback - mise a jour manuelle si la fonction RPC n'existe pas
      await this.supabaseService.client
        .from(TABLES.blog_advice)
        .update({ ba_visit: 'ba_visit::int + 1' })
        .eq('ba_id', adviceId);
    }
  }

  // === COMPATIBILITY METHODS ===

  /**
   * Methode compatible avec le controleur existant
   */
  async getAllAdvice(params: {
    limit?: number;
    offset?: number;
    filters?: AdviceFilters;
  }): Promise<{
    articles: BlogArticle[];
    total: number;
    success: boolean;
  }> {
    try {
      const { limit = 20, offset = 0, filters = {} } = params;
      const page = Math.floor(offset / limit) + 1;

      const result = await this.getAdviceList(undefined, page, limit, filters);

      return {
        articles: result.items,
        total: result.total,
        success: result.success,
      };
    } catch (error) {
      this.logger.error(`Erreur getAllAdvice: ${(error as Error).message}`);
      return {
        articles: [],
        total: 0,
        success: false,
      };
    }
  }

  /**
   * Recupere la liste des conseils - compatibilite
   */
  async getAdvices(limit?: number): Promise<BlogArticle[]> {
    const result = await this.getAdviceList(undefined, 1, limit || 20);
    return result.items;
  }

  /**
   * Recuperer statistiques des conseils - compatibilite.
   * Delegates to AdviceEnrichmentService.
   */
  async getStats(): Promise<{
    total: number;
    totalViews: number;
    avgViews: number;
    topKeywords: Array<{ keyword: string; count: number }>;
    mostPopular: BlogArticle[];
    success: boolean;
  }> {
    return this.adviceEnrichmentService.getStats();
  }

  /**
   * Alias pour getStats - compatibilite controleur.
   * Delegates to AdviceEnrichmentService.
   */
  async getAdviceStats(): Promise<{
    total: number;
    totalViews: number;
    avgViews: number;
    topKeywords: Array<{ keyword: string; count: number }>;
    mostPopular: BlogArticle[];
    success: boolean;
  }> {
    return this.adviceEnrichmentService.getAdviceStats();
  }

  /**
   * Incrementer les vues d'un conseil (methode publique)
   */
  async incrementAdviceViews(adviceId: number): Promise<void> {
    return this.incrementViews(adviceId);
  }

  /**
   * Rechercher des conseils par mots-cles.
   * Delegates to AdviceEnrichmentService.
   */
  async getAdviceByKeywords(
    keywords: string[],
    limit: number = 10,
  ): Promise<BlogArticle[]> {
    return this.adviceEnrichmentService.getAdviceByKeywords(
      keywords,
      limit,
      (params) => this.getAllAdvice(params),
    );
  }

  /**
   * Obtenir les conseils lies a une famille de produits.
   * Delegates to AdviceEnrichmentService.
   */
  async getAdviceForProduct(
    productFamily: string,
    limit: number = 10,
  ): Promise<BlogArticle[]> {
    return this.adviceEnrichmentService.getAdviceForProduct(
      productFamily,
      limit,
      (params) => this.getAllAdvice(params),
    );
  }

  /**
   * Mettre a jour un conseil (article __blog_advice)
   */
  async updateAdvice(
    adviceId: number,
    updates: {
      title?: string;
      preview?: string;
      content?: string;
      h1?: string;
      descrip?: string;
      keywords?: string;
    },
  ): Promise<{
    success: boolean;
    message: string;
    data?: Record<string, unknown>;
  }> {
    try {
      this.logger.log(`Mise a jour conseil #${adviceId}`);

      const updateData: Record<string, unknown> = {};
      if (updates.title !== undefined) updateData.ba_title = updates.title;
      if (updates.preview !== undefined)
        updateData.ba_preview = updates.preview;
      if (updates.content !== undefined)
        updateData.ba_content = updates.content;
      if (updates.h1 !== undefined) updateData.ba_h1 = updates.h1;
      if (updates.descrip !== undefined)
        updateData.ba_descrip = updates.descrip;
      if (updates.keywords !== undefined)
        updateData.ba_keywords = updates.keywords;

      updateData.ba_update = new Date().toISOString();

      const { data, error } = await this.supabaseService.client
        .from(TABLES.blog_advice)
        .update(updateData)
        .eq('ba_id', adviceId)
        .select()
        .single();

      if (error) {
        this.logger.error(`Erreur mise a jour conseil #${adviceId}:`, error);
        return {
          success: false,
          message: error.message,
        };
      }

      this.logger.log(`Conseil #${adviceId} mis a jour avec succes`);
      return {
        success: true,
        message: 'Conseil mis a jour avec succes',
        data,
      };
    } catch (error) {
      this.logger.error(`Erreur updateAdvice:`, error);
      return {
        success: false,
        message: (error as Error).message,
      };
    }
  }
}
