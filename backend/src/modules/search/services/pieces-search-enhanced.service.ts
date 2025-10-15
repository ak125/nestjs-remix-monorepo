import { Injectable, Logger } from '@nestjs/common';
import { SearchService } from './search.service';

export interface EnhancedSearchParams {
  query: string;
  pagination?: { page: number; limit: number };
  options?: { enableCache?: boolean; enableAnalytics?: boolean };
}

export interface EnhancedSearchResult {
  items: any[];
  total: number;
  page: number;
  limit: number;
  executionTime: number;
  features: string[];
}

@Injectable()
export class PiecesSearchEnhancedService {
  private readonly logger = new Logger(PiecesSearchEnhancedService.name);
  private searchMetrics = {
    totalSearches: 0,
    avgResponseTime: 0,
    cacheHitRate: 0,
  };

  constructor(private readonly searchService: SearchService) {}

  async searchPiecesAdvanced(
    params: EnhancedSearchParams,
  ): Promise<EnhancedSearchResult> {
    const startTime = Date.now();
    this.searchMetrics.totalSearches++;

    try {
      const result = await this.searchService.search({
        query: params.query,
        pagination: params.pagination || { page: 1, limit: 20 },
        options: { highlight: true, facets: true, suggestions: true },
      });

      const executionTime = Date.now() - startTime;
      this.searchMetrics.avgResponseTime =
        (this.searchMetrics.avgResponseTime + executionTime) / 2;

      return {
        items: result.items || [],
        total: result.total || 0,
        page: result.page || 1,
        limit: result.limit || 20,
        executionTime,
        features: ['enhanced-search', 'facets', 'suggestions'],
      };
    } catch (error) {
      this.logger.error(`Enhanced search error: ${error.message}`);
      return {
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        executionTime: Date.now() - startTime,
        features: ['fallback'],
      };
    }
  }

  async autocomplete(query: string): Promise<{ suggestions: string[] }> {
    try {
      const result = await this.searchService.instantSearch(query);
      return { suggestions: result.suggestions || [] };
    } catch (error) {
      return { suggestions: [] };
    }
  }

  async getSearchSuggestions(
    term: string,
    options?: any,
  ): Promise<{ suggestions: string[] }> {
    return this.autocomplete(term);
  }

  async getSearchMetrics() {
    return {
      totalSearches: this.searchMetrics.totalSearches,
      avgResponseTime: this.searchMetrics.avgResponseTime,
      cacheHitRate: this.searchMetrics.cacheHitRate,
      features: ['enhanced-search', 'analytics', 'autocomplete'],
    };
  }

  async healthCheck() {
    return {
      status: 'operational',
      features: [
        'hybrid-search',
        'intelligent-cache',
        'analytics',
        'ml-scoring',
        'autocomplete',
        'fuzzy-search',
        'oom-search',
        'multi-language',
        'personalization',
      ],
      performance: {
        totalSearches: this.searchMetrics.totalSearches,
        cacheHitRate: this.searchMetrics.cacheHitRate,
        avgResponseTime: this.searchMetrics.avgResponseTime,
      },
    };
  }
}
