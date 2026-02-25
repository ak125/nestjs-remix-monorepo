import { TABLES } from '@repo/database-types';
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseIndexationService } from '../../search/services/supabase-indexation.service';
import {
  BlogArticle,
  BcRow,
  BaH2Row,
  BaH3Row,
} from '../interfaces/blog.interfaces';
import { BlogCacheService } from './blog-cache.service';
import { ConstructeurSearchService } from './constructeur-search.service';
import { ConstructeurTransformService } from './constructeur-transform.service';

export interface ConstructeurFilters {
  search?: string;
  brand?: string;
  letter?: string;
  popular?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'ba_visit' | 'date' | 'models' | 'alpha';
  sortOrder?: 'asc' | 'desc';
  hasModels?: boolean;
  minViews?: number;
  maxViews?: number;
  alias?: string;
  withSections?: boolean;
  tags?: string[];
}

export interface ConstructeurStats {
  total: number;
  totalViews: number;
  avgViews: number;
  mostPopular: BlogArticle[];
  byLetter: Array<{ letter: string; count: number; avgViews: number }>;
  withModels: number;
  recentlyUpdated: BlogArticle[];
  topCategories: Array<{
    letter: string;
    totalViews: number;
    avgViews: number;
  }>;
  performance: {
    cacheHitRate: number;
    avgResponseTime: number;
    totalRequests: number;
  };
}

/**
 * ConstructeurService - Facade service for constructeur automobile pages
 *
 * Delegates to:
 * - ConstructeurSearchService for search operations
 * - ConstructeurTransformService for data transformation
 */
@Injectable()
export class ConstructeurService {
  private readonly logger = new Logger(ConstructeurService.name);
  private performanceMetrics = {
    totalRequests: 0,
    cacheHits: 0,
    avgResponseTime: 0,
  };

  constructor(
    private readonly supabaseService: SupabaseIndexationService,
    private readonly cacheService: BlogCacheService,
    private readonly searchService: ConstructeurSearchService,
    private readonly transformService: ConstructeurTransformService,
  ) {}

  // PRIVATE UTILITIES

  private buildCacheKey(
    prefix: string,
    params: Record<string, unknown>,
  ): string {
    const sortedParams = JSON.stringify(params, Object.keys(params).sort());
    const hash = Buffer.from(sortedParams).toString('base64').slice(0, 16);
    return `${prefix}:${hash}`;
  }

  private calculateIntelligentTTL(
    avgViews: number,
    totalItems: number,
  ): number {
    if (avgViews > 2000) return 300;
    if (avgViews > 1000) return 900;
    if (avgViews > 500) return 1800;
    if (totalItems > 50) return 3600;
    return 7200;
  }

  private getSortColumn(sortBy: string): string {
    const sortMapping: Record<string, string> = {
      name: 'bsm_marque_id',
      views: 'bc_visit',
      date: 'bsm_update',
      alpha: 'bsm_marque_id',
      models: 'bc_visit',
    };
    return sortMapping[sortBy] || 'bsm_marque_id';
  }

  private async sortByModelCount(
    articles: BlogArticle[],
    descending: boolean = false,
  ): Promise<void> {
    const client = this.supabaseService.getClient();

    const legacyIds = articles
      .map((a) => a.legacy_id?.toString())
      .filter((id): id is string => id != null && id !== '0');

    if (legacyIds.length === 0) return;

    const { data: crossData } = await client
      .from(TABLES.blog_advice_cross)
      .select('bac_ba_id')
      .in('bac_ba_id', legacyIds);

    const countMap = new Map<string, number>();
    (crossData || []).forEach((row) => {
      const id = row.bac_ba_id;
      countMap.set(id, (countMap.get(id) || 0) + 1);
    });

    const articleCountMap = new Map<string, number>();
    articles.forEach((article) => {
      const legacyId = article.legacy_id?.toString() || '0';
      articleCountMap.set(article.id, countMap.get(legacyId) || 0);
    });

    articles.sort((a, b) => {
      const countA = articleCountMap.get(a.id) || 0;
      const countB = articleCountMap.get(b.id) || 0;
      return descending ? countB - countA : countA - countB;
    });
  }

  private updatePerformanceMetrics(startTime: number, cacheHit: boolean): void {
    const responseTime = Date.now() - startTime;
    this.performanceMetrics.totalRequests += 1;
    if (cacheHit) this.performanceMetrics.cacheHits += 1;
    this.performanceMetrics.avgResponseTime =
      (this.performanceMetrics.avgResponseTime + responseTime) / 2;
  }

  // PUBLIC METHODS

  async getAllConstructeurs(
    options: {
      limit?: number;
      offset?: number;
      filters?: ConstructeurFilters;
    } = {},
  ): Promise<{ articles: BlogArticle[]; total: number }> {
    const startTime = Date.now();
    const { limit = 20, offset = 0, filters = {} } = options;
    const cacheKey = this.buildCacheKey('constructeurs_all', {
      limit,
      offset,
      filters,
    });

    try {
      const cached = await this.cacheService.get<{
        articles: BlogArticle[];
        total: number;
      }>(cacheKey);
      if (cached) {
        this.updatePerformanceMetrics(startTime, true);
        return cached;
      }

      const client = this.supabaseService.getClient();

      let query = client
        .from(TABLES.blog_seo_marque)
        .select('*')
        .range(offset, offset + limit - 1);

      let countQuery = client
        .from(TABLES.blog_seo_marque)
        .select('*', { count: 'exact', head: true });

      if (filters.search) {
        const searchFilter = `bc_constructeur.ilike.%${filters.search}%,bc_alias.ilike.%${filters.search}%,bc_keywords.ilike.%${filters.search}%`;
        query = query.or(searchFilter);
        countQuery = countQuery.or(searchFilter);
      }

      if (filters.letter) {
        query = query.ilike('bsm_marque_id', `${filters.letter}%`);
        countQuery = countQuery.ilike('bsm_marque_id', `${filters.letter}%`);
      }

      if (filters.minViews !== undefined) {
        query = query.filter('bc_visit', 'gte', filters.minViews.toString());
        countQuery = countQuery.filter(
          'bc_visit',
          'gte',
          filters.minViews.toString(),
        );
      }

      if (filters.maxViews !== undefined) {
        query = query.filter('bc_visit', 'lte', filters.maxViews.toString());
        countQuery = countQuery.filter(
          'bc_visit',
          'lte',
          filters.maxViews.toString(),
        );
      }

      const sortColumn = this.getSortColumn(filters.sortBy || 'name');
      const ascending = (filters.sortOrder || 'asc') === 'asc';
      query = query.order(sortColumn, { ascending });

      const [{ data: constructeursList }, { count: total }] = await Promise.all(
        [query, countQuery],
      );

      if (!constructeursList) {
        return { articles: [], total: 0 };
      }

      // Batch fetch sections
      const bsmIds = constructeursList.map((c) => c.bsm_id);

      const [
        { data: allH2Sections },
        { data: allH3Sections },
        { data: allCrossData },
      ] = await Promise.all([
        client
          .from(TABLES.blog_advice_h2)
          .select('*')
          .in('ba2_ba_id', bsmIds)
          .order('ba2_id'),
        client
          .from(TABLES.blog_advice_h3)
          .select('*')
          .in('bc3_bc_id', bsmIds)
          .order('ba3_id'),
        client
          .from(TABLES.blog_advice_cross)
          .select('bac_ba_id')
          .in('bac_ba_id', bsmIds),
      ]);

      const h2Map = new Map<string, Record<string, unknown>[]>();
      const h3Map = new Map<string, Record<string, unknown>[]>();
      const modelCountMap = new Map<string, number>();

      (allH2Sections || []).forEach((s) => {
        const key = s.ba2_ba_id;
        if (!h2Map.has(key)) h2Map.set(key, []);
        h2Map.get(key)!.push(s);
      });

      (allH3Sections || []).forEach((s) => {
        const key = s.bc3_bc_id;
        if (!h3Map.has(key)) h3Map.set(key, []);
        h3Map.get(key)!.push(s);
      });

      (allCrossData || []).forEach((row) => {
        const id = row.bac_ba_id;
        modelCountMap.set(id, (modelCountMap.get(id) || 0) + 1);
      });

      // Delegate transformation to ConstructeurTransformService
      const articles: BlogArticle[] = [];
      for (const constructeur of constructeursList) {
        try {
          const article =
            this.transformService.transformConstructeurToArticleBatch(
              constructeur as BcRow,
              (h2Map.get(constructeur.bsm_id) || []) as BaH2Row[],
              (h3Map.get(constructeur.bsm_id) || []) as BaH3Row[],
              modelCountMap.get(constructeur.bsm_id) || 0,
            );
          if (article) articles.push(article);
        } catch (error) {
          this.logger.warn(
            `Erreur transformation constructeur ${constructeur.bc_id}: ${(error as Error).message}`,
          );
        }
      }

      if (filters.sortBy === 'models' && articles.length > 0) {
        await this.sortByModelCount(articles, filters.sortOrder === 'desc');
      }

      const result = { articles: articles.slice(0, limit), total: total || 0 };

      const avgViews =
        articles.reduce((sum, a) => sum + a.viewsCount, 0) / articles.length;
      const ttl = this.calculateIntelligentTTL(avgViews, articles.length);
      await this.cacheService.set(cacheKey, result, ttl);

      this.updatePerformanceMetrics(startTime, false);
      this.logger.log(
        `Recupere ${articles.length} constructeurs (${total} total)`,
      );

      return result;
    } catch (error) {
      this.updatePerformanceMetrics(startTime, false);
      this.logger.error(
        `Erreur recuperation constructeurs: ${(error as Error).message}`,
      );
      return { articles: [], total: 0 };
    }
  }

  async getConstructeurById(id: string | number): Promise<BlogArticle | null> {
    const cacheKey = `constructeur:${id}`;

    try {
      const cached = await this.cacheService.get<BlogArticle>(cacheKey);
      if (cached) return cached;

      const client = this.supabaseService.getClient();
      const { data: constructeur } = await client
        .from(TABLES.blog_seo_marque)
        .select('*')
        .eq('bsm_id', id.toString())
        .single();

      if (!constructeur) return null;

      const article =
        await this.transformService.transformConstructeurToArticle(
          client,
          constructeur,
        );
      if (article) {
        await this.cacheService.set(cacheKey, article, article.viewsCount);
      }

      return article;
    } catch (error) {
      this.logger.error(
        `Erreur recuperation constructeur ${id}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  async getConstructeurByBrand(brand: string): Promise<BlogArticle | null> {
    const cacheKey = `constructeur_brand:${brand.toLowerCase()}`;

    try {
      const cached = await this.cacheService.get<BlogArticle>(cacheKey);
      if (cached) return cached;

      const client = this.supabaseService.getClient();
      const { data: constructeur } = await client
        .from(TABLES.blog_seo_marque)
        .select('*')
        .or(
          [
            `bc_constructeur.ilike.%${brand}%`,
            `bc_alias.ilike.%${brand.toLowerCase()}%`,
          ].join(','),
        )
        .single();

      if (!constructeur) return null;

      const article =
        await this.transformService.transformConstructeurToArticle(
          client,
          constructeur,
        );
      if (article) {
        await this.cacheService.set(cacheKey, article, 3600);
      }

      return article;
    } catch (error) {
      this.logger.error(
        `Erreur recuperation constructeur par marque ${brand}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  async getPopularConstructeurs(limit: number = 10): Promise<BlogArticle[]> {
    const cacheKey = `constructeurs_popular:${limit}`;

    try {
      const cached = await this.cacheService.get<BlogArticle[]>(cacheKey);
      if (cached) return cached;

      const client = this.supabaseService.getClient();

      const { data: constructeursList } = await client
        .from(TABLES.blog_seo_marque)
        .select('*')
        // .order() removed - column doesn't exist
        .limit(limit);

      if (!constructeursList) return [];

      const BATCH_SIZE = 10;
      const articles: BlogArticle[] = [];

      for (let i = 0; i < constructeursList.length; i += BATCH_SIZE) {
        const batch = constructeursList.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map((constructeur) =>
            this.transformService.transformConstructeurToArticle(
              client,
              constructeur,
            ),
          ),
        );
        articles.push(...batchResults.filter(Boolean));
      }

      await this.cacheService.set(cacheKey, articles, 3600);
      return articles;
    } catch (error) {
      this.logger.error(
        `Erreur constructeurs populaires: ${(error as Error).message}`,
      );
      return [];
    }
  }

  async getConstructeursByAlpha(): Promise<{
    [letter: string]: BlogArticle[];
  }> {
    const cacheKey = 'constructeurs_alpha';

    try {
      const cached = await this.cacheService.get<{
        [letter: string]: BlogArticle[];
      }>(cacheKey);
      if (cached) return cached;

      const client = this.supabaseService.getClient();

      const { data: constructeursList } = await client
        .from(TABLES.blog_seo_marque)
        .select('*')
        .order('bsm_marque_id', { ascending: true });

      if (!constructeursList) return {};

      const BATCH_SIZE = 10;
      const articlesWithLetters: { article: BlogArticle; letter: string }[] =
        [];

      for (let i = 0; i < constructeursList.length; i += BATCH_SIZE) {
        const batch = constructeursList.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (constructeur) => {
            const article =
              await this.transformService.transformConstructeurToArticle(
                client,
                constructeur,
              );
            if (article) {
              const letter = constructeur.bc_constructeur
                .charAt(0)
                .toUpperCase();
              return { article, letter };
            }
            return null;
          }),
        );
        articlesWithLetters.push(
          ...(batchResults.filter(Boolean) as {
            article: BlogArticle;
            letter: string;
          }[]),
        );
      }

      const constructeursByLetter: { [letter: string]: BlogArticle[] } = {};
      for (const { article, letter } of articlesWithLetters) {
        if (!constructeursByLetter[letter]) {
          constructeursByLetter[letter] = [];
        }
        constructeursByLetter[letter].push(article);
      }

      await this.cacheService.set(cacheKey, constructeursByLetter, 7200);
      return constructeursByLetter;
    } catch (error) {
      this.logger.error(
        `Erreur constructeurs alphabetique: ${(error as Error).message}`,
      );
      return {};
    }
  }

  async getConstructeurStats(): Promise<ConstructeurStats> {
    const startTime = Date.now();
    const cacheKey = 'constructeurs_stats_premium';

    try {
      const cached = await this.cacheService.get<ConstructeurStats>(cacheKey);
      if (cached) {
        this.updatePerformanceMetrics(startTime, true);
        return cached;
      }

      const client = this.supabaseService.getClient();

      const [
        { data: allConstructeurs },
        { data: recentConstructeurs },
        { data: popularConstructeurs },
        { count: modelsCount },
      ] = await Promise.all([
        client
          .from(TABLES.blog_seo_marque)
          .select('bsm_marque_id, bsm_constructeur, bsm_visit'),
        client
          .from(TABLES.blog_seo_marque)
          .select('*')
          // .order() removed - column doesn't exist
          .limit(5),
        client
          .from(TABLES.blog_seo_marque)
          .select('*')
          // .order() removed - column doesn't exist
          .limit(5),
        client
          .from(TABLES.blog_advice_cross)
          .select('bac_ba_id', { count: 'exact', head: true }),
      ]);

      if (!allConstructeurs) {
        return {
          total: 0,
          totalViews: 0,
          avgViews: 0,
          mostPopular: [],
          byLetter: [],
          withModels: 0,
          recentlyUpdated: [],
          topCategories: [],
          performance: {
            cacheHitRate: 0,
            avgResponseTime: 0,
            totalRequests: 0,
          },
        };
      }

      const totalViews = allConstructeurs.reduce(
        (sum, c) => sum + (parseInt(c.bsm_visit) || 0),
        0,
      );
      const avgViews = Math.round(totalViews / allConstructeurs.length);

      const letterStats: {
        [letter: string]: { count: number; totalViews: number };
      } = {};
      allConstructeurs.forEach((c) => {
        const letter = c.bsm_constructeur.charAt(0).toUpperCase();
        if (!letterStats[letter]) {
          letterStats[letter] = { count: 0, totalViews: 0 };
        }
        letterStats[letter].count += 1;
        letterStats[letter].totalViews += parseInt(c.bsm_visit) || 0;
      });

      const byLetter = Object.entries(letterStats)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([letter, stats]) => ({
          letter,
          count: stats.count,
          avgViews: Math.round(stats.totalViews / stats.count),
        }));

      const topCategories = Object.entries(letterStats)
        .sort(([, a], [, b]) => b.totalViews - a.totalViews)
        .slice(0, 5)
        .map(([letter, stats]) => ({
          letter,
          totalViews: stats.totalViews,
          avgViews: Math.round(stats.totalViews / stats.count),
        }));

      // Delegate transformations to ConstructeurTransformService
      const [mostPopularRaw, recentlyUpdatedRaw] = await Promise.all([
        popularConstructeurs
          ? Promise.all(
              popularConstructeurs.map((c) =>
                this.transformService.transformConstructeurToArticle(client, c),
              ),
            )
          : [],
        recentConstructeurs
          ? Promise.all(
              recentConstructeurs.map((c) =>
                this.transformService.transformConstructeurToArticle(client, c),
              ),
            )
          : [],
      ]);
      const mostPopular = mostPopularRaw.filter(Boolean) as BlogArticle[];
      const recentlyUpdated = recentlyUpdatedRaw.filter(
        Boolean,
      ) as BlogArticle[];

      const cacheHitRate =
        this.performanceMetrics.totalRequests > 0
          ? Math.round(
              (this.performanceMetrics.cacheHits /
                this.performanceMetrics.totalRequests) *
                100,
            ) / 100
          : 0;

      const stats: ConstructeurStats = {
        total: allConstructeurs.length,
        totalViews,
        avgViews,
        mostPopular,
        byLetter,
        withModels: modelsCount || 0,
        recentlyUpdated,
        topCategories,
        performance: {
          cacheHitRate,
          avgResponseTime: Math.round(this.performanceMetrics.avgResponseTime),
          totalRequests: this.performanceMetrics.totalRequests,
        },
      };

      const ttl = this.calculateIntelligentTTL(
        avgViews,
        allConstructeurs.length,
      );
      await this.cacheService.set(cacheKey, stats, ttl);

      this.updatePerformanceMetrics(startTime, false);
      this.logger.log(
        `Statistiques constructeurs calculees: ${allConstructeurs.length} total, ${avgViews} vues moy.`,
      );

      return stats;
    } catch (error) {
      this.updatePerformanceMetrics(startTime, false);
      this.logger.error(
        `Erreur stats constructeurs: ${(error as Error).message}`,
      );
      return {
        total: 0,
        totalViews: 0,
        avgViews: 0,
        mostPopular: [],
        byLetter: [],
        withModels: 0,
        recentlyUpdated: [],
        topCategories: [],
        performance: {
          cacheHitRate: 0,
          avgResponseTime: 0,
          totalRequests: 0,
        },
      };
    }
  }

  /**
   * Delegate to ConstructeurSearchService
   */
  async searchConstructeurs(
    searchTerm: string,
    options: {
      limit?: number;
      includeSuggestions?: boolean;
      fuzzyMatch?: boolean;
      filters?: Partial<ConstructeurFilters>;
    } = {},
  ): Promise<{
    results: BlogArticle[];
    total: number;
    suggestions?: string[];
    searchTime: number;
  }> {
    return this.searchService.searchConstructeurs(searchTerm, options);
  }

  async getPopularTags(
    limit: number = 20,
  ): Promise<Array<{ tag: string; count: number }>> {
    const cacheKey = `constructeur_tags:${limit}`;

    try {
      const cached =
        await this.cacheService.get<Array<{ tag: string; count: number }>>(
          cacheKey,
        );
      if (cached) return cached;

      const client = this.supabaseService.getClient();
      const { data: constructeurs } = await client
        .from(TABLES.blog_seo_marque)
        .select('bsm_keywords, bsm_visit')
        .not('bsm_keywords', 'is', null);

      if (!constructeurs) return [];

      const tagCounts = new Map<string, number>();

      constructeurs.forEach((c) => {
        if (c.bsm_keywords) {
          const tags = c.bsm_keywords
            .split(', ')
            .map((t: string) => t.trim().toLowerCase());
          const weight = Math.max(1, Math.floor(parseInt(c.bsm_visit) / 100));

          tags.forEach((tag) => {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + weight);
          });
        }
      });

      const popularTags = Array.from(tagCounts.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([tag, count]) => ({ tag, count }));

      await this.cacheService.set(cacheKey, popularTags, 7200);
      return popularTags;
    } catch (error) {
      this.logger.error(`Erreur tags populaires: ${(error as Error).message}`);
      return [];
    }
  }

  async getConstructeurModels(
    constructeurId: string | number,
  ): Promise<Record<string, unknown>[]> {
    const cacheKey = `constructeur_models:${constructeurId}`;

    try {
      const cached =
        await this.cacheService.get<Record<string, unknown>[]>(cacheKey);
      if (cached) return cached;

      const client = this.supabaseService.getClient();

      const { data: models } = await client
        .from(TABLES.blog_advice_cross)
        .select('*')
        .eq('bac_ba_id', constructeurId.toString())
        .order('bcm_modele', { ascending: true });

      const result = models || [];
      await this.cacheService.set(cacheKey, result, 3600);
      return result;
    } catch (error) {
      this.logger.error(
        `Erreur modeles constructeur ${constructeurId}: ${(error as Error).message}`,
      );
      return [];
    }
  }

  async incrementConstructeurViews(id: string | number): Promise<boolean> {
    try {
      const client = this.supabaseService.getClient();

      const { data: current } = await client
        .from(TABLES.blog_seo_marque)
        .select('bc_visit')
        .eq('bsm_id', id.toString())
        .single();

      if (!current) return false;

      const newViews = (parseInt(current.bc_visit) || 0) + 1;

      const { error } = await client
        .from(TABLES.blog_seo_marque)
        .update({ bc_visit: newViews.toString() })
        .eq('bsm_id', id.toString());

      if (error) {
        this.logger.error(`Erreur mise a jour vues: ${error.message}`);
        return false;
      }

      await this.cacheService.del(`constructeur:${id}`);
      await this.cacheService.del('constructeurs_stats');

      this.logger.debug(
        `Vues mises a jour pour constructeur ${id}: ${newViews}`,
      );
      return true;
    } catch (error) {
      this.logger.error(`Erreur increment vues: ${(error as Error).message}`);
      return false;
    }
  }
}
