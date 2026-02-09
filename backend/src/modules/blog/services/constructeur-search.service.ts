import { TABLES } from '@repo/database-types';
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseIndexationService } from '../../search/services/supabase-indexation.service';
import { BlogArticle } from '../interfaces/blog.interfaces';
import { BlogCacheService } from './blog-cache.service';
import { ConstructeurTransformService } from './constructeur-transform.service';
import { ConstructeurFilters } from './constructeur.service';

/**
 * ConstructeurSearchService - Search-related operations for constructeurs
 *
 * Handles:
 * - Multi-criteria search with fuzzy matching
 * - Search suggestions generation
 */
@Injectable()
export class ConstructeurSearchService {
  private readonly logger = new Logger(ConstructeurSearchService.name);

  constructor(
    private readonly supabaseService: SupabaseIndexationService,
    private readonly cacheService: BlogCacheService,
    private readonly transformService: ConstructeurTransformService,
  ) {}

  /**
   * Build cache key from prefix and params
   */
  private buildCacheKey(
    prefix: string,
    params: Record<string, unknown>,
  ): string {
    const sortedParams = JSON.stringify(params, Object.keys(params).sort());
    const hash = Buffer.from(sortedParams).toString('base64').slice(0, 16);
    return `${prefix}:${hash}`;
  }

  /**
   * Recherche avancee multi-criteres avec suggestions intelligentes
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
    const startTime = Date.now();
    const {
      limit = 10,
      includeSuggestions = false,
      fuzzyMatch = true,
      filters = {},
    } = options;

    if (!searchTerm || searchTerm.length < 2) {
      return { results: [], total: 0, searchTime: 0 };
    }

    const cacheKey = this.buildCacheKey('search_constructeurs', {
      searchTerm,
      limit,
      fuzzyMatch,
      filters,
    });

    try {
      const cached = await this.cacheService.get<{
        results: BlogArticle[];
        total: number;
        suggestions?: string[];
        searchTime: number;
      }>(cacheKey);
      if (cached) {
        return cached;
      }

      const client = this.supabaseService.getClient();
      const searchTermClean = searchTerm.toLowerCase().trim();

      // Construction requete de recherche avancee
      let query = client.from(TABLES.blog_seo_marque).select('*');
      let countQuery = client
        .from(TABLES.blog_seo_marque)
        .select('*', { count: 'exact', head: true });

      // Recherche multi-colonnes avec priorite
      const searchConditions = [
        `bc_constructeur.ilike.%${searchTermClean}%`,
        `bc_alias.ilike.%${searchTermClean}%`,
        `bc_keywords.ilike.%${searchTermClean}%`,
        `bc_content.ilike.%${searchTermClean}%`,
      ];

      if (fuzzyMatch) {
        // Ajout recherche fuzzy pour tolerer les fautes de frappe
        const fuzzyTerm = searchTermClean.replace(/./g, '$&%');
        searchConditions.push(`bc_constructeur.ilike.%${fuzzyTerm}%`);
      }

      const searchFilter = searchConditions.join(',');
      query = query.or(searchFilter);
      countQuery = countQuery.or(searchFilter);

      // Application des filtres additionnels
      if (filters.minViews) {
        query = query.filter('bc_visit', 'gte', filters.minViews.toString());
        countQuery = countQuery.filter(
          'bc_visit',
          'gte',
          filters.minViews.toString(),
        );
      }

      if (filters.letter) {
        query = query.ilike('bsm_marque_id', `${filters.letter}%`);
        countQuery = countQuery.ilike('bsm_marque_id', `${filters.letter}%`);
      }

      // Tri par pertinence (vues + correspondance exacte privilegiee)
      query = query; // .order() removed - column doesn't exist.limit(limit);

      // Execution parallele
      const [{ data: results }, { count: total }] = await Promise.all([
        query,
        countQuery,
      ]);

      if (!results) {
        return { results: [], total: 0, searchTime: 0 };
      }

      // Paralleliser les transformations
      const articles = (
        await Promise.all(
          results.map((constructeur) =>
            this.transformService.transformConstructeurToArticle(
              client,
              constructeur,
            ),
          ),
        )
      ).filter(Boolean) as BlogArticle[];

      // Tri final par pertinence (vues d'abord, puis alphabetique)
      articles.sort((a, b) => {
        const titleMatchA = a.title.toLowerCase().indexOf(searchTermClean);
        const titleMatchB = b.title.toLowerCase().indexOf(searchTermClean);

        // Priorite a la correspondance exacte au debut du titre
        if (titleMatchA === 0 && titleMatchB !== 0) return -1;
        if (titleMatchB === 0 && titleMatchA !== 0) return 1;

        // Sinon tri par nombre de vues
        return b.viewsCount - a.viewsCount;
      });

      // Generation suggestions intelligentes si demandees
      let suggestions: string[] = [];
      if (includeSuggestions && articles.length < 5) {
        suggestions = await this.generateSearchSuggestions(
          searchTermClean,
          client,
        );
      }

      const searchTime = Date.now() - startTime;
      const result = {
        results: articles,
        total: total || 0,
        suggestions,
        searchTime,
      };

      // Cache court pour les recherches
      await this.cacheService.set(cacheKey, result, 300); // 5min

      this.logger.debug(
        `Recherche "${searchTerm}": ${articles.length}/${total} en ${searchTime}ms`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Erreur recherche constructeurs: ${(error as Error).message}`,
      );
      return { results: [], total: 0, searchTime: Date.now() - startTime };
    }
  }

  /**
   * Generation de suggestions intelligentes basees sur la recherche
   */
  async generateSearchSuggestions(
    searchTerm: string,
    client: SupabaseClient,
  ): Promise<string[]> {
    try {
      // Recherche de constructeurs similaires
      const { data: suggestions } = await client
        .from(TABLES.blog_seo_marque)
        .select('bsm_marque_id')
        .or(
          `bc_constructeur.ilike.%${searchTerm.charAt(0)}%,bc_constructeur.ilike.%${searchTerm.slice(0, 3)}%`,
        )
        // .order() removed - column doesn't exist
        .limit(5);

      if (!suggestions) return [];

      return suggestions
        .map((s) => s.bsm_marque_id)
        .filter(
          (name: string) => name.toLowerCase() !== searchTerm.toLowerCase(),
        )
        .slice(0, 3);
    } catch {
      return [];
    }
  }
}
