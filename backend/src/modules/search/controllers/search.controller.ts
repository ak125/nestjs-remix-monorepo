import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { SearchSimpleService } from '../services/search-simple.service';
import { SearchMonitoringService } from '../services/search-monitoring.service';

@ApiTags('search')
@Controller('api/search')
export class SearchController {
  constructor(
    private readonly searchService: SearchSimpleService,
    private readonly monitoringService: SearchMonitoringService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check for search service' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async healthCheck() {
    return {
      status: 'healthy',
      service: 'SearchService',
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  @ApiOperation({ summary: 'Search pieces' })
  @ApiQuery({ name: 'query', required: false, description: 'Search query' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiQuery({ name: 'clear_cache', required: false, description: 'Clear cache' })
  @ApiResponse({ status: 200, description: 'Search results' })
  async searchPieces(
    @Query('query') query?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('clear_cache') clearCache?: string,
  ) {
    const searchParams = {
      query: query || '',
      page: parseInt(page || '1', 10),
      limit: parseInt(limit || '20', 10),
    };

    // Utilise SearchSimpleService.search
    return this.searchService.search({
      query: searchParams.query,
      pagination: {
        page: searchParams.page,
        limit: searchParams.limit,
      },
    });
  }

  // @Get('instant')
  // @ApiOperation({ summary: 'Instant search with auto-complete' })
  // @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  // @ApiResponse({ status: 200, description: 'Instant search results' })
  // async instantSearch(@Query('q') query: string) {
  //   if (!query || query.length < 2) {
  //     return { results: [], suggestions: [] };
  //   }
  //   return this.searchService.instantSearch(query);
  // }

  // @Get('mine')
  // @ApiOperation({ summary: 'Search user-specific pieces' })
  // @ApiQuery({ name: 'q', required: false, description: 'Search query' })
  // @ApiResponse({ status: 200, description: 'User-specific search results' })
  // async searchMyPieces(@Query('q') query?: string) {
  //   return this.searchService.searchMine(query || '');
  // }

  @Get('metrics')
  @ApiOperation({ summary: 'Get search performance metrics' })
  @ApiResponse({ status: 200, description: 'Performance metrics' })
  async getMetrics() {
    return this.monitoringService.getMetrics();
  }

  @Get('performance-report')
  @ApiOperation({ summary: 'Get detailed performance report' })
  @ApiResponse({ status: 200, description: 'Detailed performance report' })
  async getPerformanceReport() {
    return this.monitoringService.getPerformanceReport();
  }

  // @Get('stats')
  // @ApiOperation({ summary: 'Get search statistics' })
  // @ApiResponse({ status: 200, description: 'Search statistics' })
  // async getStats() {
  //   return this.searchService.getSearchStats();
  // }
}
