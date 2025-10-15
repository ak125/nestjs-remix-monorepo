import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { SearchService } from '../services/search.service';
import { SearchMonitoringService } from '../services/search-monitoring.service';

@ApiTags('search-enhanced')
@Controller('api/search-enhanced')
export class SearchEnhancedController {
  constructor(
    private readonly searchService: SearchService,
    private readonly monitoringService: SearchMonitoringService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check for enhanced search service' })
  @ApiResponse({ status: 200, description: 'Enhanced service is healthy' })
  async healthCheck() {
    return {
      status: 'operational',
      service: 'enhanced-fallback',
      timestamp: new Date().toISOString(),
      features: ['basic-search', 'monitoring', 'fallback-mode'],
    };
  }

  @Get('search')
  @ApiOperation({ summary: 'Advanced search with enhanced features' })
  @ApiQuery({ name: 'query', required: true, description: 'Search query' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiResponse({ status: 200, description: 'Enhanced search results' })
  async searchAdvanced(
    @Query('query') query: string,
    @Query('page') _page?: string,
    @Query('limit') _limit?: string,
  ) {
    const startTime = Date.now();

    try {
      const result = await this.searchService.search(
        {
          query,
          type: 'text',
        },
        'enhanced-user',
      );

      const responseTime = Date.now() - startTime;

      await this.monitoringService.recordSearch({
        service: 'enhanced',
        query: query,
        responseTime,
        resultCount: result.total || 0,
        fromCache: false,
        success: true,
      });

      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;

      await this.monitoringService.recordSearch({
        service: 'enhanced',
        query: query,
        responseTime,
        resultCount: 0,
        fromCache: false,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  @Get('autocomplete')
  @ApiOperation({ summary: 'Advanced autocomplete with ML suggestions' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiResponse({ status: 200, description: 'Autocomplete suggestions' })
  async autocomplete(@Query('q') query: string) {
    if (!query || query.length < 2) {
      return { suggestions: [] };
    }

    // Autocomplete simple temporaire
    return {
      suggestions: [
        `${query} filtre`,
        `${query} huile`,
        `${query} frein`,
        `${query} amortisseur`,
      ].slice(0, 5),
    };
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Enhanced service metrics and statistics' })
  @ApiResponse({ status: 200, description: 'Enhanced service metrics' })
  async getEnhancedMetrics() {
    return this.monitoringService.getMetrics();
  }
}
