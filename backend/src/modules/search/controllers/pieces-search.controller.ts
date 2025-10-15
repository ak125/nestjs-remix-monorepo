import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Logger,
  HttpException,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { PiecesSearchEnhancedService } from '../services/pieces-search-enhanced.service';
import type {
  AdvancedSearchParams,
  PieceSearchResponse,
  PieceSearchResult,
} from '../services/pieces-search-enhanced.service';

/**
 * 🔍 PiecesSearchController - API REST pour recherche de pièces ultra-optimisée
 *
 * ✨ FONCTIONNALITÉS:
 * ✅ Recherche avancée multi-critères
 * ✅ Auto-complétion intelligente
 * ✅ Recherche par codes OEM
 * ✅ Recherche personnalisée
 * ✅ Analytics temps réel
 * ✅ Rate limiting intégré
 * ✅ Métriques de performance
 */
@ApiTags('Pieces Search Enhanced')
@Controller('api/pieces-search')
@UseGuards(ThrottlerGuard)
export class PiecesSearchController {
  private readonly logger = new Logger(PiecesSearchController.name);

  constructor(private readonly searchService: PiecesSearchEnhancedService) {}

  /**
   * 🔍 Recherche principale de pièces
   */
  @Get()
  @ApiOperation({
    summary: 'Recherche avancée de pièces',
    description: 'Recherche multi-critères avec cache intelligent et analytics',
  })
  @ApiResponse({
    status: 200,
    description: 'Résultats de recherche avec métadonnées',
    type: Object,
  })
  @ApiQuery({ name: 'q', description: 'Terme de recherche', required: true })
  @ApiQuery({ name: 'page', description: 'Numéro de page', required: false })
  @ApiQuery({
    name: 'limit',
    description: 'Nombre de résultats par page',
    required: false,
  })
  @ApiQuery({
    name: 'manufacturers',
    description: 'Filtres fabricants (séparés par virgule)',
    required: false,
  })
  @ApiQuery({ name: 'minPrice', description: 'Prix minimum', required: false })
  @ApiQuery({ name: 'maxPrice', description: 'Prix maximum', required: false })
  @ApiQuery({
    name: 'availability',
    description: 'Statuts de disponibilité',
    required: false,
  })
  @ApiQuery({
    name: 'sortBy',
    description: 'Champ de tri (relevance|price|name|stock)',
    required: false,
  })
  @ApiQuery({
    name: 'sortOrder',
    description: 'Ordre de tri (asc|desc)',
    required: false,
  })
  @ApiQuery({
    name: 'includeAlternatives',
    description: 'Inclure les alternatives',
    required: false,
  })
  @ApiQuery({
    name: 'fuzzySearch',
    description: 'Recherche floue',
    required: false,
  })
  @ApiQuery({
    name: 'userId',
    description: 'ID utilisateur pour personnalisation',
    required: false,
  })
  async search(
    @Query('q') searchTerm: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('manufacturers') manufacturers?: string,
    @Query('gammes') gammes?: string,
    @Query('qualities') qualities?: string,
    @Query('stars') stars?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('availability') availability?: string,
    @Query('sortBy') sortBy: string = 'relevance',
    @Query('sortOrder') sortOrder: string = 'desc',
    @Query('includeAlternatives') includeAlternatives?: string,
    @Query('includeCrossRefs') includeCrossRefs?: string,
    @Query('fuzzySearch') fuzzySearch?: string,
    @Query('includeOEM') includeOEM?: string,
    @Query('boostPopular') boostPopular?: string,
    @Query('userId') userId?: string,
    @Req() request?: any,
  ): Promise<{
    success: boolean;
    data?: PieceSearchResponse;
    error?: string;
    timestamp: string;
  }> {
    const startTime = Date.now();

    if (!searchTerm || searchTerm.trim().length < 2) {
      throw new HttpException(
        'Le terme de recherche doit contenir au moins 2 caractères',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      // Construction des paramètres de recherche
      const searchParams: AdvancedSearchParams = {
        searchTerm: searchTerm.trim(),
        filters: {
          manufacturers: manufacturers?.split(',').filter(Boolean),
          gammes: gammes?.split(',').filter(Boolean),
          qualities: qualities?.split(',').filter(Boolean),
          stars: stars
            ?.split(',')
            .map(Number)
            .filter((n) => !isNaN(n)),
          minPrice: minPrice ? parseFloat(minPrice) : undefined,
          maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
          availability: availability?.split(',').filter(Boolean) as any,
        },
        sort: {
          field: sortBy as any,
          order: sortOrder as 'asc' | 'desc',
        },
        pagination: {
          page: Math.max(1, parseInt(page) || 1),
          limit: Math.min(100, Math.max(1, parseInt(limit) || 20)),
        },
        options: {
          includeAlternatives: includeAlternatives === 'true',
          includeCrossRefs: includeCrossRefs === 'true',
          fuzzySearch: fuzzySearch !== 'false', // Par défaut activé
          includeOEM: includeOEM !== 'false', // Par défaut activé
          boostPopular: boostPopular !== 'false', // Par défaut activé
        },
      };

      // Contexte pour analytics
      const searchContext = {
        userId,
        sessionId: request?.sessionID,
        source: 'api',
        userAgent: request?.get('User-Agent'),
        ip: request?.ip || request?.connection?.remoteAddress,
      };

      this.logger.log(
        `🔍 Recherche pièces: "${searchTerm}" [User: ${userId || 'anonymous'}]`,
      );

      // Exécution de la recherche avec analytics
      const result = await this.searchService.searchWithAnalytics(
        searchParams,
        searchContext,
      );

      const executionTime = Date.now() - startTime;

      this.logger.log(
        `✅ Recherche "${searchTerm}": ${result.count} résultats en ${executionTime}ms [${result.searchId}]`,
      );

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';

      this.logger.error(
        `❌ Erreur recherche "${searchTerm}" après ${executionTime}ms: ${errorMessage}`,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Erreur lors de la recherche',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🔮 Auto-complétion intelligente
   */
  @Get('autocomplete')
  @ApiOperation({
    summary: 'Auto-complétion intelligente',
    description: 'Suggestions avec scoring et biais utilisateur',
  })
  @ApiQuery({ name: 'q', description: 'Terme partiel', required: true })
  @ApiQuery({
    name: 'limit',
    description: 'Nombre de suggestions',
    required: false,
  })
  @ApiQuery({
    name: 'includePopular',
    description: 'Inclure suggestions populaires',
    required: false,
  })
  @ApiQuery({
    name: 'userBias',
    description: 'Appliquer biais utilisateur',
    required: false,
  })
  @ApiQuery({ name: 'userId', description: 'ID utilisateur', required: false })
  async autocomplete(
    @Query('q') term: string,
    @Query('limit') limit: string = '10',
    @Query('includePopular') includePopular: string = 'true',
    @Query('userBias') userBias: string = 'false',
    @Query('userId') userId?: string,
  ): Promise<{
    success: boolean;
    data?: Array<{
      suggestion: string;
      type: string;
      score: number;
      metadata?: any;
    }>;
    error?: string;
    timestamp: string;
  }> {
    if (!term || term.trim().length < 2) {
      return {
        success: true,
        data: [],
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const suggestions = await this.searchService.autocomplete(
        term.trim(),
        {
          limit: Math.min(20, Math.max(1, parseInt(limit) || 10)),
          includePopular: includePopular === 'true',
          userBias: userBias === 'true',
        },
        userId,
      );

      return {
        success: true,
        data: suggestions,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ Erreur autocomplete "${term}": ${error.message}`);

      return {
        success: false,
        error: "Erreur lors de l'auto-complétion",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🔧 Recherche par codes OEM
   */
  @Post('oem')
  @ApiOperation({
    summary: 'Recherche par codes OEM',
    description: 'Recherche spécialisée par codes fabricants',
  })
  @ApiBody({
    description: 'Codes OEM à rechercher',
    schema: {
      type: 'object',
      properties: {
        codes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Liste des codes OEM',
        },
        includeAlternatives: {
          type: 'boolean',
          description: 'Inclure les alternatives',
        },
        limit: {
          type: 'number',
          description: 'Nombre maximum de résultats',
        },
      },
      required: ['codes'],
    },
  })
  async searchByOEM(
    @Body()
    body: {
      codes: string[];
      includeAlternatives?: boolean;
      limit?: number;
    },
  ): Promise<{
    success: boolean;
    data?: PieceSearchResult[];
    error?: string;
    timestamp: string;
  }> {
    if (!body.codes || !Array.isArray(body.codes) || body.codes.length === 0) {
      throw new HttpException('Codes OEM requis', HttpStatus.BAD_REQUEST);
    }

    try {
      const results = await this.searchService.searchByOEM(body.codes, {
        includeAlternatives: body.includeAlternatives !== false,
        limit: body.limit || 50,
      });

      this.logger.log(
        `🔧 Recherche OEM: ${body.codes.length} codes → ${results.length} résultats`,
      );

      return {
        success: true,
        data: results,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ Erreur recherche OEM: ${error.message}`);

      throw new HttpException(
        'Erreur lors de la recherche OEM',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 👤 Recherche personnalisée
   */
  @Get('personalized')
  @ApiOperation({
    summary: 'Recherche personnalisée',
    description: "Recherche avec scoring basé sur l'historique utilisateur",
  })
  @ApiQuery({ name: 'q', description: 'Terme de recherche', required: true })
  @ApiQuery({ name: 'userId', description: 'ID utilisateur', required: true })
  @ApiQuery({
    name: 'boostFactor',
    description: 'Facteur de boost personnalisé',
    required: false,
  })
  @ApiQuery({
    name: 'includeHistory',
    description: 'Inclure historique',
    required: false,
  })
  async searchPersonalized(
    @Query('q') searchTerm: string,
    @Query('userId') userId: string,
    @Query('boostFactor') boostFactor: string = '0.2',
    @Query('includeHistory') includeHistory: string = 'true',
  ): Promise<{
    success: boolean;
    data?: PieceSearchResponse;
    error?: string;
    timestamp: string;
  }> {
    if (!searchTerm || !userId) {
      throw new HttpException(
        'Terme de recherche et ID utilisateur requis',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const result = await this.searchService.searchPersonalized(
        searchTerm.trim(),
        userId,
        {
          boostFactor: parseFloat(boostFactor) || 0.2,
          includeHistory: includeHistory === 'true',
        },
      );

      this.logger.log(
        `👤 Recherche personnalisée "${searchTerm}" pour ${userId}: ${result.count} résultats`,
      );

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ Erreur recherche personnalisée: ${error.message}`);

      throw new HttpException(
        'Erreur lors de la recherche personnalisée',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 💡 Suggestions de recherche
   */
  @Get('suggestions')
  @ApiOperation({
    summary: 'Suggestions de recherche',
    description: "Suggestions basées sur l'historique et les tendances",
  })
  @ApiQuery({ name: 'userId', description: 'ID utilisateur', required: false })
  @ApiQuery({ name: 'category', description: 'Catégorie', required: false })
  @ApiQuery({
    name: 'includePopular',
    description: 'Inclure populaires',
    required: false,
  })
  @ApiQuery({
    name: 'includeTrending',
    description: 'Inclure tendances',
    required: false,
  })
  async getSuggestions(
    @Query('userId') userId?: string,
    @Query('category') category?: string,
    @Query('includePopular') includePopular: string = 'true',
    @Query('includeTrending') includeTrending: string = 'true',
  ): Promise<{
    success: boolean;
    data?: string[];
    error?: string;
    timestamp: string;
  }> {
    try {
      const suggestions = await this.searchService.getSearchSuggestions({
        userId,
        category,
        includePopular: includePopular === 'true',
        includeTrending: includeTrending === 'true',
      });

      return {
        success: true,
        data: suggestions,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ Erreur suggestions: ${error.message}`);

      return {
        success: false,
        error: 'Erreur lors de la récupération des suggestions',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 📊 Métriques de recherche
   */
  @Get('metrics')
  @ApiOperation({
    summary: 'Métriques de performance',
    description: 'Statistiques détaillées du service de recherche',
  })
  async getMetrics(): Promise<{
    success: boolean;
    data?: any;
    error?: string;
    timestamp: string;
  }> {
    try {
      const metrics = await this.searchService.getSearchMetrics();

      return {
        success: true,
        data: metrics,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ Erreur métriques: ${error.message}`);

      return {
        success: false,
        error: 'Erreur lors de la récupération des métriques',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 🏥 Health check du service
   */
  @Get('health')
  @ApiOperation({
    summary: 'Vérification santé du service',
    description: 'Status et performance du service de recherche',
  })
  async healthCheck(): Promise<{
    success: boolean;
    status: string;
    metrics?: any;
    timestamp: string;
  }> {
    try {
      const startTime = Date.now();

      // Test simple de recherche
      const testResult = await this.searchService.searchPieces({
        searchTerm: 'test',
        pagination: { page: 1, limit: 1 },
      });

      const responseTime = Date.now() - startTime;
      const metrics = await this.searchService.getSearchMetrics();

      return {
        success: true,
        status: 'healthy',
        metrics: {
          responseTime,
          totalSearches: metrics.totalSearches,
          cacheHitRate: metrics.cacheHitRate,
          avgResponseTime: metrics.avgResponseTime,
          errorRate: metrics.errorRate,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ Health check failed: ${error.message}`);

      return {
        success: false,
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
