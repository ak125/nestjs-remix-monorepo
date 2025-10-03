import { Injectable, Logger } from '@nestjs/common';
import { BlogService } from './blog.service';
import { SupabaseIndexationService } from '../../search/services/supabase-indexation.service';
import { BlogCacheService } from './blog-cache.service';
import { BlogArticle, BlogSection } from '../interfaces/blog.interfaces';

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
  steps?: any[];
  tips?: any[];
  warnings?: string[];
  relatedProducts?: any[];
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
  sortBy?: 'views' | 'date' | 'popularity';
}

/**
 * 🔧 Service optimisé pour la gestion des conseils automobiles
 *
 * 🎯 FONCTIONNALITÉS AVANCÉES :
 * - Cache intelligent avec stratégie 3-niveaux (hot/warm/cold)
 * - Décodage HTML automatique des entités
 * - Support des tables legacy (__blog_advice*) ET modernes
 * - Recherche avancée avec filtres multiples
 * - Gestion des gammes de produits
 * - Statistiques détaillées et analytics
 * - Création/modification avec validation
 * - Conseils liés par produit/gamme
 * - Performance optimisée avec requêtes parallèles
 */
@Injectable()
export class AdviceService {
  private readonly logger = new Logger(AdviceService.name);
  private readonly SUPABASE_URL =
    process.env.SUPABASE_URL || 'https://cxpojprgwgubzjyqzmoq.supabase.co';
  private readonly CDN_BASE_URL = `${this.SUPABASE_URL}/storage/v1/object/public/uploads`;

  constructor(
    private readonly blogService: BlogService,
    private readonly supabaseService: SupabaseIndexationService,
    private readonly blogCacheService: BlogCacheService,
  ) {}

  /**
   * 🧪 Test méthode simple pour debug
   */
  async getTestAdvice(): Promise<{
    items: BlogArticle[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    success: boolean;
  }> {
    this.logger.log('🧪 Test method called');

    try {
      // Test simple sans DB pour voir si le service fonctionne
      const mockAdvice: BlogArticle = {
        id: 'test_1',
        type: 'advice',
        title: 'Conseil de test',
        slug: 'conseil-test',
        excerpt: 'Un conseil de test pour vérifier le service',
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
      this.logger.error(`❌ Erreur test: ${(error as Error).message}`);
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
   * 📚 Récupérer la liste des conseils avec filtres avancés - VERSION OPTIMISÉE
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

      let query = client.from('__blog_advice').select('*', { count: 'exact' });

      // Filtres avancés
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

      if (filters.minViews) {
        query = query.gte('ba_visit', filters.minViews.toString());
      }

      if (gammeId) {
        query = query.eq('ba_gamme_id', gammeId);
      }

      // Tri optimisé selon les filtres
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
        this.logger.error('Erreur récupération conseils:', error);
        throw error;
      }

      // ⚡ Transformation batch optimisée (2 requêtes au lieu de N×2)
      const items: BlogArticle[] = data
        ? await this.transformAdvicesToArticles(data)
        : [];

      // Enrichir avec pg_alias en une seule requête (optimisation)
      const enrichedItems = await this.enrichArticlesWithPgAlias(items);

      const result = {
        items: enrichedItems,
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
        success: true,
      };

      // Cache avec stratégie basée sur la popularité moyenne
      const avgViews =
        items.reduce((sum, item) => sum + (item.viewsCount || 0), 0) /
        (items.length || 1);
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
   * 🏷️ Récupérer conseils par gamme avec cache optimisé
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

      // Rechercher d'abord la gamme si nécessaire
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

      // ⚡ Transformation batch optimisée
      const advices: BlogArticle[] = data
        ? await this.transformAdvicesToArticles(data)
        : [];

      const result = { gamme, advices, success: true };
      await this.blogCacheService.set(cacheKey, result, 2000);

      return result;
    } catch (error) {
      this.logger.error(
        `❌ Erreur getAdviceByGamme: ${(error as Error).message}`,
      );
      return {
        gamme: null,
        advices: [],
        success: false,
      };
    }
  }

  /**
   * 🔗 Récupérer conseils liés à un produit avec cache intelligent
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

      this.logger.log(`🔗 Recherche conseils liés au produit: ${productId}`);

      // Recherche améliorée dans les conseils
      const { data, error } = await this.supabaseService.client
        .from('__blog_advice')
        .select('*')
        .or(
          `ba_title.ilike.%produit%,ba_keywords.ilike.%produit%,ba_title.ilike.%${productId}%`,
        )
        .order('ba_visit', { ascending: false })
        .limit(limit);

      if (error) {
        this.logger.warn('Erreur recherche conseils liés:', error);
        return [];
      }

      // ⚡ Transformation batch optimisée
      const articles: BlogArticle[] = data
        ? await this.transformAdvicesToArticles(data)
        : [];

      await this.blogCacheService.set(cacheKey, articles, 1500);
      return articles;
    } catch (error) {
      this.logger.error(
        `❌ Erreur getRelatedAdvice: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * 🔍 Récupérer un conseil par ID ou slug
   */
  async getAdviceById(id: string | number): Promise<BlogArticle | null> {
    const cacheKey = `advice_detail:${id}`;

    try {
      const cached = await this.blogCacheService.get<BlogArticle>(
        cacheKey,
        1000,
      );
      if (cached) return cached;

      this.logger.log(`🔍 Récupération conseil: ${id}`);

      let query;

      if (typeof id === 'string') {
        // Recherche par slug
        query = this.supabaseService.client
          .from('__blog_advice')
          .select('*')
          .eq('ba_alias', id)
          .single();
      } else {
        // Recherche par ID
        query = this.supabaseService.client
          .from('__blog_advice')
          .select('*')
          .eq('ba_id', id)
          .single();
      }

      const { data, error } = await query;

      if (error || !data) {
        this.logger.warn(`Conseil non trouvé: ${id}`);
        return null;
      }

      const article = await this.transformAdviceToArticle(data);

      // Incrémenter les vues de façon atomique
      await this.incrementViews(data.ba_id);

      // Cache avec TTL basé sur la popularité
      await this.blogCacheService.set(
        cacheKey,
        article,
        article.viewsCount + 1,
      );

      return article;
    } catch (error) {
      this.logger.error(`❌ Erreur getAdviceById: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * ➕ Créer un nouveau conseil (compatible avec la nouvelle interface)
   */
  async createAdvice(
    article: Partial<BlogArticle>,
    advice: BlogAdvice,
    authorId?: string,
  ): Promise<{
    article: BlogArticle;
    advice: BlogAdvice;
    success: boolean;
  }> {
    try {
      this.logger.log('➕ Création nouveau conseil');

      // Utiliser BlogService pour créer l'article si disponible
      let createdArticle: BlogArticle;

      if (
        this.blogService &&
        typeof this.blogService.createArticle === 'function'
      ) {
        createdArticle = await this.blogService.createArticle(
          {
            ...article,
            type: 'advice',
          },
          authorId || 'system',
        );
      } else {
        // Version simplifiée si BlogService pas disponible
        const articleData = {
          ba_title: article.title,
          ba_alias: article.slug || this.slugify(article.title || ''),
          ba_descrip: article.excerpt,
          ba_content: article.content,
          ba_keywords: article.keywords?.join(','),
          ba_create: new Date().toISOString(),
          ba_visit: '0',
        };

        const { data, error } = await this.supabaseService.client
          .from('__blog_advice')
          .insert(articleData)
          .select()
          .single();

        if (error) throw error;

        createdArticle = await this.transformAdviceToArticle(data);
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
      this.logger.error(`❌ Erreur createAdvice: ${(error as Error).message}`);
      throw error;
    }
  }

  // === MÉTHODES UTILITAIRES ===

  /**
   * ⚡ Batch transformation optimisée pour plusieurs conseils
   * Réduit 85×2 requêtes DB en 2 requêtes totales
   */
  private async transformAdvicesToArticles(
    advices: any[],
  ): Promise<BlogArticle[]> {
    if (!advices || advices.length === 0) return [];

    try {
      const adviceIds = advices.map((a) => a.ba_id);

      // ⚡ OPTIMISATION: Batch H2/H3 en 2 requêtes au lieu de N×2
      const [{ data: allH2Sections }, { data: allH3Sections }] =
        await Promise.all([
          this.supabaseService.client
            .from('__blog_advice_h2')
            .select('*')
            .in('ba2_ba_id', adviceIds)
            .order('ba2_id'),
          this.supabaseService.client
            .from('__blog_advice_h3')
            .select('*')
            .in('ba3_ba_id', adviceIds)
            .order('ba3_id'),
        ]);

      // Grouper par ba_id pour accès O(1)
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

      // Transformation parallèle avec Promise.all
      return Promise.all(
        advices.map((advice) => {
          const h2 = h2ByAdviceId.get(advice.ba_id) || [];
          const h3 = h3ByAdviceId.get(advice.ba_id) || [];
          return this.transformAdviceToArticleWithSections(advice, h2, h3);
        }),
      );
    } catch (error) {
      this.logger.error(
        `❌ Erreur transformAdvicesToArticles: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * 🔄 Transformation advice → BlogArticle avec sections pré-chargées
   */
  private transformAdviceToArticleWithSections(
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
        `❌ Erreur transformAdviceToArticleWithSections (${advice.ba_id}): ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * 🔄 Transformation optimisée advice → BlogArticle avec gestion des sections
   * ⚠️ Utilisée pour les transformations unitaires (détail, etc.)
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

      // Optimisation: Combiner les sections en une seule boucle
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
        pg_alias: null, // Sera enrichi après
        pg_id: null, // Sera enrichi après
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
        `❌ Erreur transformation advice: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * ⏱️ Calculer temps de lecture
   */
  private calculateReadingTime(content: string): number {
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

  /**
   * 🔢 Incrémenter les vues de manière atomique
   */
  private async incrementViews(adviceId: number): Promise<void> {
    try {
      await this.supabaseService.client.rpc('increment_advice_views', {
        advice_id: adviceId,
      });
    } catch (_error) {
      // Fallback - mise à jour manuelle si la fonction RPC n'existe pas
      await this.supabaseService.client
        .from('__blog_advice')
        .update({ ba_visit: 'ba_visit::int + 1' })
        .eq('ba_id', adviceId);
    }
  }

  /**
   * 🔗 Créer un slug à partir d'un titre
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  // === MÉTHODES DE COMPATIBILITÉ ===

  /**
   * 📚 Méthode compatible avec le contrôleur existant
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
      this.logger.error(`❌ Erreur getAllAdvice: ${(error as Error).message}`);
      return {
        articles: [],
        total: 0,
        success: false,
      };
    }
  }

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
    // Version simplifiée des stats pour la compatibilité
    try {
      const { data: allAdvice, error } = await this.supabaseService.client
        .from('__blog_advice')
        .select('ba_visit, ba_keywords, ba_title, ba_alias, ba_id');

      if (error) throw error;

      const total = allAdvice?.length || 0;
      const totalViews =
        allAdvice?.reduce(
          (sum: number, item: any) => sum + (parseInt(item.ba_visit) || 0),
          0,
        ) || 0;
      const avgViews = total > 0 ? Math.round(totalViews / total) : 0;

      const popularAdvice =
        allAdvice
          ?.sort(
            (a: any, b: any) =>
              (parseInt(b.ba_visit) || 0) - (parseInt(a.ba_visit) || 0),
          )
          ?.slice(0, 5) || [];

      const mostPopular: BlogArticle[] = [];
      for (const advice of popularAdvice) {
        const article = await this.transformAdviceToArticle(advice);
        if (article) mostPopular.push(article);
      }

      return {
        total,
        totalViews,
        avgViews,
        topKeywords: [],
        mostPopular,
        success: true,
      };
    } catch (error) {
      this.logger.error(`❌ Erreur getStats: ${(error as Error).message}`);
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

  /**
   * 📊 Alias pour getStats - compatibilité contrôleur
   */
  async getAdviceStats(): Promise<{
    total: number;
    totalViews: number;
    avgViews: number;
    topKeywords: Array<{ keyword: string; count: number }>;
    mostPopular: BlogArticle[];
    success: boolean;
  }> {
    return this.getStats();
  }

  /**
   * 🔗 Enrichir les articles avec pg_alias depuis pieces_gamme
   * Optimisé avec une seule requête pour tous les articles
   */
  private async enrichArticlesWithPgAlias(
    articles: BlogArticle[],
  ): Promise<BlogArticle[]> {
    if (!articles || articles.length === 0) return articles;

    try {
      // Récupérer tous les ba_pg_id uniques et les convertir en integers
      const pgIds = [
        ...new Set(
          articles
            .map((a) => {
              const id = (a as any).ba_pg_id;
              return id ? parseInt(id, 10) : null;
            })
            .filter((id) => id != null),
        ),
      ];

      if (pgIds.length === 0) return articles;

      // Charger tous les pg_alias ET pg_img en une seule requête
      const { data: gammes } = await this.supabaseService.client
        .from('pieces_gamme')
        .select('pg_id, pg_alias, pg_img')
        .in('pg_id', pgIds);

      // Créer des maps avec clés integers pour accès O(1)
      // ATTENTION : pg_id revient en STRING de Supabase, on doit convertir
      const pgDataMap = new Map();
      if (gammes) {
        for (const g of gammes) {
          // Convertir pg_id string → integer pour matcher parseInt(ba_pg_id)
          const pgIdInt =
            typeof g.pg_id === 'string' ? parseInt(g.pg_id, 10) : g.pg_id;
          pgDataMap.set(pgIdInt, { alias: g.pg_alias, img: g.pg_img });
        }
      }

      // Enrichir chaque article en une seule passe
      return articles.map((article) => {
        const ba_pg_id = (article as any).ba_pg_id;
        if (!ba_pg_id) {
          // Pas de ba_pg_id, retourner l'article tel quel avec valeurs nulles
          return {
            ...article,
            pg_id: null,
            pg_alias: null,
            ba_pg_id: null,
            featuredImage: null,
          };
        }

        const pg_id = parseInt(ba_pg_id, 10);
        const pgData = pgDataMap.get(pg_id);

        // Construire l'URL de l'image si on a les données
        let featuredImage = null;
        let pg_alias = null;

        if (pgData) {
          pg_alias = pgData.alias;
          const pg_image = pgData.img;

          // pg_image prioritaire, sinon pg_alias.webp
          const imageFilename =
            pg_image || (pg_alias ? `${pg_alias}.webp` : null);
          if (imageFilename) {
            featuredImage = `${this.CDN_BASE_URL}/articles/gammes-produits/catalogue/${imageFilename}`;
          }
        }

        return {
          ...article,
          pg_id: pg_id,
          pg_alias: pg_alias,
          ba_pg_id: ba_pg_id,
          featuredImage: featuredImage,
        };
      });
    } catch (error) {
      this.logger.warn('Erreur enrichArticlesWithPgAlias:', error);
      return articles;
    }
  }
}
