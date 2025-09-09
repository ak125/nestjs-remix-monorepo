import { Controller, Get, Query, Logger } from '@nestjs/common';
import { SearchService } from '../services/search.service';
import { VehicleSearchService } from '../services/vehicle-search-meilisearch.service';
import { SearchAnalyticsService } from '../services/search-analytics.service';

interface SearchRequest {
  query: string;
  filters?: Record<string, any>;
  page?: number;
  limit?: number;
  category?: 'all' | 'vehicles' | 'products' | 'pages';
}

interface SearchResult {
  success: boolean;
  data: {
    results: any[];
    totalCount: number;
    page: number;
    limit: number;
    suggestions?: string[];
    facets?: Record<string, any>;
  };
  timestamp: string;
}

@Controller('api/search')
export class SearchController {
  private readonly logger = new Logger(SearchController.name);

  constructor(
    private readonly searchService: SearchService,
    private readonly vehicleSearch: VehicleSearchService,
    private readonly analytics: SearchAnalyticsService,
  ) {}

  @Get('/test-meilisearch')
  async testMeilisearch(@Query('q') query: string = '1.4') {
    this.logger.log(`🔍 Test direct Meilisearch: "${query}"`);

    try {
      // Test direct des services Meilisearch
      const vehicleResults = await this.searchService[
        'meilisearch'
      ].searchVehicles(query, { limit: 5 });
      const productResults = await this.searchService[
        'meilisearch'
      ].searchProducts(query, { limit: 5 });

      return {
        success: true,
        vehicleResults,
        productResults,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Erreur test Meilisearch:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('/')
  async search(@Query() params: SearchRequest): Promise<SearchResult> {
    const startTime = Date.now();
    this.logger.log(
      `🔍 Recherche: "${params.query}" - Catégorie: ${params.category || 'all'}`,
    );

    try {
      const result = await this.searchService.search({
        query: params.query || '',
        type: 'text',
        pagination: {
          page: params.page || 1,
          limit: params.limit || 20,
        },
        category: params.category || 'all',
        options: {
          suggestions: true,
          facets: true,
        },
      });

      this.logger.debug(`🔍 Résultat SearchService:`, {
        version: result.version,
        itemsLength: result.items?.length,
        total: result.total,
        page: result.page,
        limit: result.limit,
      });

      const searchTime = Date.now() - startTime;

      // Enregistrer analytics
      await this.analytics.recordSearch({
        query: params.query,
        resultCount: result.total,
        searchTime,
        timestamp: new Date(),
      });

      this.logger.log(
        `✅ Recherche terminée: ${result.total} résultats en ${searchTime}ms`,
      );

      return {
        success: true,
        data: {
          results: result.items,
          totalCount: result.total,
          page: result.page,
          limit: result.limit,
          suggestions: result.suggestions,
          facets: result.facets,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ Erreur recherche:`, error);
      return {
        success: false,
        data: {
          results: [],
          totalCount: 0,
          page: 1,
          limit: 20,
        },
        timestamp: new Date().toISOString(),
      };
    }
  }
}
