import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseInterceptors,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { User } from '../../../common/decorators/user.decorator';
import { SearchService } from '../services/search.service';

/**
 * 🔍 Contrôleur de Recherche Unifié
 * Compatible avec le service existant
 */
@ApiTags('search')
@Controller('search')
@UseInterceptors(CacheInterceptor)
export class SearchController {
  private readonly logger = new Logger(SearchController.name);

  constructor(private readonly searchService: SearchService) {}

  /**
   * 🔍 Recherche principale
   */
  @Get()
  @ApiOperation({ summary: 'Recherche de pièces' })
  @ApiResponse({ status: 200, description: 'Résultats de recherche' })
  @ApiQuery({ name: 'q', description: 'Terme de recherche', required: true })
  @ApiQuery({
    name: 'limit',
    description: 'Nombre de résultats',
    required: false,
  })
  @ApiQuery({ name: 'page', description: 'Numéro de page', required: false })
  async search(
    @Query('q') query: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @User() user?: any,
  ) {
    try {
      if (!query || query.trim().length < 2) {
        return {
          items: [],
          total: 0,
          page: 1,
          limit: 20,
          message: 'Le terme de recherche doit contenir au moins 2 caractères',
        };
      }

      const cleanQuery = query.trim();
      const limitNum = limit ? Math.min(parseInt(limit, 10), 100) : 20;
      const pageNum = page ? Math.max(parseInt(page, 10), 1) : 1;

      // Utiliser la méthode search existante
      const results = await this.searchService.search({
        query: cleanQuery,
        type: 'v8',
        pagination: { page: pageNum, limit: limitNum },
        options: { facets: true, suggestions: true },
      });

      this.logger.log(`Search "${cleanQuery}": ${results.total} results`);

      return results;
    } catch (error) {
      this.logger.error('Search error:', error);
      const message =
        error instanceof Error ? error.message : 'Erreur inconnue';

      throw new HttpException(
        `Erreur lors de la recherche: ${message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🔮 Auto-complétion via instant search
   */
  @Get('autocomplete')
  @ApiOperation({ summary: 'Auto-complétion' })
  @ApiQuery({ name: 'q', description: 'Terme partiel', required: true })
  async autocomplete(@Query('q') query: string) {
    try {
      if (!query || query.trim().length < 2) {
        return [];
      }

      // Utiliser instantSearch qui existe
      const results = await this.searchService.instantSearch(query.trim());

      // Extraire les suggestions du résultat
      return results.suggestions || [];
    } catch (error) {
      this.logger.error('Autocomplete error:', error);
      return [];
    }
  }

  /**
   * 🔧 Recherche avancée
   */
  @Post('advanced')
  @ApiOperation({ summary: 'Recherche avancée' })
  async advancedSearch(
    @Body()
    body: {
      query: string;
      filters?: {
        brandId?: number;
        categoryId?: number;
        priceMin?: number;
        priceMax?: number;
        inStock?: boolean;
      };
      sort?: {
        field?: 'relevance' | 'price' | 'name' | 'date';
        order?: 'asc' | 'desc';
      };
      pagination?: {
        page?: number;
        limit?: number;
      };
    },
  ) {
    try {
      if (!body.query || body.query.trim().length < 2) {
        throw new HttpException(
          'Le terme de recherche est requis (min 2 caractères)',
          HttpStatus.BAD_REQUEST,
        );
      }

      const results = await this.searchService.search({
        query: body.query.trim(),
        type: 'v8',
        filters: body.filters,
        sort: body.sort,
        pagination: body.pagination,
        options: { facets: true, suggestions: true },
      });

      return results;
    } catch (error) {
      this.logger.error('Advanced search error:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Erreur lors de la recherche avancée',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🚗 Recherche par MINE
   */
  @Get('mine')
  @ApiOperation({ summary: 'Recherche par code MINE' })
  @ApiQuery({
    name: 'code',
    description: 'Code MINE du véhicule',
    required: true,
  })
  async searchByMine(@Query('code') code: string, @User() user?: any) {
    try {
      if (!code || code.trim().length === 0) {
        throw new HttpException(
          'Le code MINE est requis',
          HttpStatus.BAD_REQUEST,
        );
      }

      const results = await this.searchService.searchByMine(
        code.trim(),
        user?.id,
      );
      return results;
    } catch (error) {
      this.logger.error('MINE search error:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Erreur lors de la recherche MINE',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 📋 Fiche produit
   */
  @Get('product/:reference')
  @ApiOperation({ summary: 'Fiche produit par référence' })
  async getProductSheet(@Query('reference') reference: string) {
    try {
      if (!reference) {
        throw new HttpException(
          'La référence est requise',
          HttpStatus.BAD_REQUEST,
        );
      }

      const product = await this.searchService.getProductSheet(reference);
      return product;
    } catch (error) {
      this.logger.error('Product sheet error:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Erreur lors de la récupération de la fiche produit',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * ⚡ Recherche instantanée
   */
  @Get('instant')
  @ApiOperation({ summary: 'Recherche instantanée' })
  @ApiQuery({ name: 'q', description: 'Terme de recherche', required: true })
  async instantSearch(@Query('q') query: string) {
    try {
      if (!query || query.trim().length < 2) {
        return {
          items: [],
          total: 0,
          suggestions: [],
        };
      }

      const results = await this.searchService.instantSearch(query.trim());
      return results;
    } catch (error) {
      this.logger.error('Instant search error:', error);
      return {
        items: [],
        total: 0,
        suggestions: [],
      };
    }
  }

  /**
   * 📊 Statistiques
   */
  @Get('stats')
  @ApiOperation({ summary: 'Statistiques de recherche' })
  async getStats() {
    try {
      const stats = await this.searchService.getSearchStats();
      return {
        ...stats,
        service: 'SearchService',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Stats error:', error);
      return {
        service: 'SearchService',
        status: 'error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🔄 Recherche legacy (compatibilité)
   */
  @Post('legacy')
  @ApiOperation({ summary: 'Recherche legacy (compatibilité)' })
  async searchLegacy(
    @Body()
    body: {
      query: string;
      category: 'all' | 'vehicles' | 'products' | 'pages';
      page: number;
      limit: number;
      filters: Record<string, any>;
    },
  ) {
    try {
      const results = await this.searchService.searchLegacy(body);
      return results;
    } catch (error) {
      this.logger.error('Legacy search error:', error);
      throw new HttpException(
        'Erreur lors de la recherche legacy',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * ✨ Recherche simple (pour tests)
   */
  @Get('simple')
  @ApiOperation({ summary: 'Recherche simple' })
  @ApiQuery({ name: 'q', description: 'Terme de recherche', required: true })
  @ApiQuery({
    name: 'limit',
    description: 'Nombre de résultats',
    required: false,
  })
  async simpleSearch(
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    try {
      if (!query || query.trim().length < 2) {
        return [];
      }

      const limitNum = limit ? Math.min(parseInt(limit, 10), 50) : 20;
      const results = await this.searchService.simpleSearch(
        query.trim(),
        limitNum,
      );

      return {
        items: results,
        count: results.length,
        query: query.trim(),
      };
    } catch (error) {
      this.logger.error('Simple search error:', error);
      return {
        items: [],
        count: 0,
        query: query,
      };
    }
  }
}
