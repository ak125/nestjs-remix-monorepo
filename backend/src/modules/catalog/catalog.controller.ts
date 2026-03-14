import {
  Controller,
  Get,
  Query,
  Param,
  Logger,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { CatalogService, HomeCatalogData } from './catalog.service';
import { CatalogHierarchyService } from './services/catalog-hierarchy.service';
import { HomepageRpcService } from './services/homepage-rpc.service';

@ApiTags('Catalog - API Complète')
@Controller('api/catalog')
@UseInterceptors(CacheInterceptor)
export class CatalogController {
  private readonly logger = new Logger(CatalogController.name);

  constructor(
    private readonly catalogService: CatalogService,
    private readonly catalogHierarchyService: CatalogHierarchyService,
    private readonly homepageRpcService: HomepageRpcService,
  ) {}

  /**
   * GET /api/catalog/families - Reproduction exacte logique PHP index.php
   * Pour le composant SimpleCatalogFamilies du frontend
   */
  @Get('families')
  @ApiOperation({
    summary: 'Familles de catalogue avec gammes (logique PHP)',
    description:
      'Reproduction exacte de la logique PHP index.php pour le catalogue de familles avec leurs gammes',
  })
  @ApiResponse({
    status: 200,
    description: 'Familles avec gammes récupérées avec succès',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        families: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              mf_id: { type: 'number' },
              mf_name: { type: 'string' },
              mf_pic: { type: 'string' },
              gammes: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    pg_id: { type: 'number' },
                    pg_alias: { type: 'string' },
                    pg_name: { type: 'string' },
                  },
                },
              },
            },
          },
        },
        totalFamilies: { type: 'number' },
        message: { type: 'string' },
      },
    },
  })
  async getCatalogFamiliesPhpLogic() {
    this.logger.log(
      '📋 [GET] /api/catalog/families - Logique PHP pour SimpleCatalogFamilies',
    );

    try {
      const result = await this.catalogHierarchyService.getFamiliesResponse();

      this.logger.log(
        `✅ ${result.totalFamilies} familles récupérées pour le frontend`,
      );
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('❌ Erreur récupération familles:', message);
      return {
        success: false,
        families: [],
        totalFamilies: 0,
        message: 'Erreur lors de la récupération des familles',
      };
    }
  }

  /**
   * GET /api/catalog/brands
   * Récupérer toutes les marques automobiles
   */
  @Get('brands')
  @ApiOperation({
    summary: 'Liste des marques automobiles',
    description:
      'Récupère toutes les marques disponibles avec option de limitation',
  })
  @ApiQuery({
    name: 'limit',
    description: 'Nombre maximum de marques à retourner',
    required: false,
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des marques récupérée avec succès',
  })
  async getBrands(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.catalogService.getAutoBrands(limitNum);
  }

  /**
   * GET /api/catalog/models/:brandId
   * Récupérer les modèles d'une marque
   */
  @Get('models/:brandId')
  async getModelsByBrand(
    @Param('brandId') brandId: string,
    @Query('limit') limit?: string,
  ) {
    const brandIdNum = parseInt(brandId, 10);
    const limitNum = limit ? parseInt(limit, 10) : 100;
    return this.catalogService.getModelsByBrand(brandIdNum, limitNum);
  }

  /**
   * GET /api/catalog/pieces/search
   * Rechercher des pièces
   */
  @Get('pieces/search')
  async searchPieces(
    @Query('q') query: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (!query) {
      return {
        success: false,
        error: 'Paramètre de recherche requis',
        data: [],
        count: 0,
      };
    }

    const limitNum = limit ? parseInt(limit, 10) : 50;
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    return this.catalogService.searchPieces(query, limitNum, offsetNum);
  }

  /**
   * GET /api/catalog/pieces/:pieceId
   * Récupérer les détails d'une pièce
   */
  @Get('pieces/:pieceId')
  async getPieceById(@Param('pieceId') pieceId: string) {
    const pieceIdNum = parseInt(pieceId, 10);
    return this.catalogService.getPieceById(pieceIdNum);
  }

  /**
   * GET /api/catalog/stats
   * Statistiques du catalogue
   */
  @Get('stats')
  async getStats() {
    return this.catalogService.getCatalogStats();
  }

  /**
   * GET /api/catalog/pieces-gammes/families
   * Récupérer les gammes organisées par familles (seulement celles avec gammes)
   */
  @Get('pieces-gammes/families')
  @ApiOperation({
    summary: 'Gammes organisées par familles',
    description:
      'Récupère toutes les gammes regroupées par famille (pg_parent)',
  })
  @ApiResponse({
    status: 200,
    description: 'Familles de gammes récupérées avec succès',
  })
  async getGamesFamilies() {
    this.logger.log('👨‍👩‍👧‍👦 Requête familles de gammes reçue');
    return this.catalogService.getGamesFamilies();
  }

  /**
   * GET /api/catalog/families/all
   * Récupérer toutes les familles formatées comme des gammes (pour homepage)
   */
  @Get('families/all')
  @ApiOperation({
    summary: 'Toutes les familles comme gammes',
    description:
      'Récupère toutes les familles du catalogue formatées comme des gammes pour la homepage',
  })
  @ApiResponse({
    status: 200,
    description: 'Toutes les familles récupérées avec succès',
  })
  async getAllFamiliesAsGammes() {
    this.logger.log('👨‍👩‍👧‍👦 Requête toutes les familles comme gammes reçue');
    return this.catalogService.getAllFamiliesAsGammes();
  }

  /**
   * GET /api/catalog/family-gammes/:familyId
   * Gammes d'une famille pour chargement on-demand (expand catalogue)
   */
  @Get('family-gammes/:familyId')
  @ApiOperation({
    summary: 'Gammes par famille (on-demand)',
    description:
      "Retourne toutes les gammes d'une famille. Utilisé pour expand côté catalogue homepage.",
  })
  @ApiParam({
    name: 'familyId',
    description: 'ID de la famille (mf_id)',
    example: '1',
  })
  @ApiResponse({ status: 200, description: 'Gammes récupérées avec succès' })
  async getFamilyGammes(@Param('familyId') familyId: string) {
    const id = parseInt(familyId, 10);
    if (isNaN(id) || id <= 0) {
      return { success: false, gammes: [], error: 'Invalid familyId' };
    }
    const gammes = await this.catalogHierarchyService.getGammesByFamilyId(id);
    return {
      success: true,
      gammes: gammes.map((g) => ({
        pg_id: g.pg_id,
        pg_alias: g.pg_alias,
        pg_name: g.pg_name,
        pg_img: g.pg_img,
      })),
    };
  }

  /**
   * GET /api/catalog/homepage-data
   * Données complètes optimisées pour la page d'accueil
   */
  @Get('homepage-data')
  async getHomepageData() {
    this.logger.log('🏠 Requête données homepage reçue');
    return this.catalogService.getHomepageData();
  }

  /**
   * GET /api/catalog/homepage-rpc
   * ⚡ RPC optimisée - combine 4 appels API en 1 seule requête PostgreSQL
   * Performance: <150ms au lieu de 400-800ms
   */
  @Get('homepage-rpc')
  @ApiOperation({
    summary: 'Homepage RPC optimisée',
    description:
      'Combine 4 appels API (equipementiers, blog, catalog, brands) en 1 seule requête PostgreSQL. LCP < 1.5s.',
  })
  @ApiResponse({
    status: 200,
    description: 'Données homepage récupérées via RPC optimisée',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        equipementiers: { type: 'array' },
        blog_articles: { type: 'array' },
        catalog: { type: 'object' },
        brands: { type: 'array' },
        stats: { type: 'object' },
        _performance: { type: 'object' },
      },
    },
  })
  async getHomepageRpc() {
    this.logger.log('⚡ [RPC] Requête homepage optimisée');
    const startTime = performance.now();

    try {
      const result = await this.homepageRpcService.getHomepageDataOptimized();
      this.logger.log(
        `✅ RPC homepage en ${(performance.now() - startTime).toFixed(1)}ms`,
      );
      // Strip debug metadata from client response (saves ~200 bytes + avoids data leak)
      const { _performance, _cache, ...clientData } = result as Record<
        string,
        unknown
      >;
      return clientData;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('❌ RPC homepage error:', message);
      throw error; // NO fallback - retourne 500
    }
  }

  /**
   * GET /api/catalog/homepage-families
   * Above-fold families only — lightweight Supabase query (Phase 1 perf)
   */
  @Get('homepage-families')
  @ApiOperation({
    summary: 'Homepage families (above-fold)',
    description:
      'Retourne uniquement les familles catalogue pour above-fold SSR. Plus rapide que le RPC complet.',
  })
  async getHomepageFamilies() {
    try {
      return await this.catalogHierarchyService.getHierarchy();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('❌ Homepage families error:', message);
      throw error;
    }
  }

  /**
   * GET /api/catalog/homepage-below-fold
   * Below-fold data (brands, equipementiers, blog) — deferred by frontend
   */
  @Get('homepage-below-fold')
  @ApiOperation({
    summary: 'Homepage below-fold data',
    description:
      'Retourne brands, equipementiers, blog articles pour below-fold streaming.',
  })
  async getHomepageBelowFold() {
    try {
      return await this.homepageRpcService.getHomepageBelowFold();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('❌ Homepage below-fold error:', message);
      throw error;
    }
  }

  /**
   * GET /api/catalog/brands-selector
   * Marques optimisées pour le sélecteur de véhicule
   */
  @Get('brands-selector')
  async getBrandsForVehicleSelector(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.catalogService.getBrandsForVehicleSelector(limitNum);
  }

  /**
   * GET /api/catalog/home-catalog
   * Catalogue complet pour la page d'accueil (version fusionnée)
   */
  @Get('home-catalog')
  @ApiOperation({
    summary: 'Catalogue complet pour homepage',
    description:
      "Données optimisées pour page d'accueil : catégories, statistiques, accès rapide",
  })
  @ApiResponse({
    status: 200,
    description: 'Catalogue homepage récupéré avec succès',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            mainCategories: { type: 'array' },
            featuredCategories: { type: 'array' },
            quickAccess: { type: 'array' },
            stats: { type: 'object' },
          },
        },
      },
    },
  })
  async getHomeCatalog(): Promise<HomeCatalogData> {
    this.logger.log('🏠 Requête catalogue homepage fusionné');
    return this.catalogService.getHomeCatalog();
  }

  /**
   * GET /api/catalog/search
   * Recherche avancée dans le catalogue
   */
  @Get('search')
  @ApiOperation({
    summary: 'Recherche avancée dans le catalogue',
    description: 'Recherche textuelle avec filtres prix, catégorie et marque',
  })
  @ApiQuery({
    name: 'q',
    description: 'Terme de recherche',
    required: false,
    example: 'frein',
  })
  @ApiQuery({
    name: 'minPrice',
    description: 'Prix minimum',
    required: false,
    example: 10,
  })
  @ApiQuery({
    name: 'maxPrice',
    description: 'Prix maximum',
    required: false,
    example: 100,
  })
  @ApiQuery({
    name: 'categoryId',
    description: 'ID de catégorie',
    required: false,
    example: 5,
  })
  @ApiQuery({
    name: 'brandId',
    description: 'ID de marque',
    required: false,
    example: 12,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Nombre de résultats',
    required: false,
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: 'Résultats de recherche',
  })
  async searchCatalog(
    @Query('q') query?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('categoryId') categoryId?: string,
    @Query('brandId') brandId?: string,
    @Query('limit') limit?: string,
  ) {
    const filters = {
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      categoryId: categoryId ? parseInt(categoryId, 10) : undefined,
      brandId: brandId ? parseInt(brandId, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : 50,
    };

    return this.catalogService.searchCatalog(query || '', filters);
  }

  /**
   * GET /api/catalog/invalidate-cache
   * Invalide le cache du catalogue (admin)
   */
  @Get('invalidate-cache')
  @ApiOperation({
    summary: 'Invalidation du cache (admin)',
    description: 'Invalide le cache complet ou avec pattern spécifique',
  })
  @ApiQuery({
    name: 'pattern',
    description: 'Pattern de cache à invalider',
    required: false,
    example: 'home*',
  })
  @ApiResponse({
    status: 200,
    description: 'Cache invalidé avec succès',
  })
  async invalidateCache(@Query('pattern') pattern?: string) {
    this.catalogService.invalidateCache(pattern);
    return {
      success: true,
      message: pattern
        ? `Cache invalidé pour pattern: ${pattern}`
        : 'Cache complet invalidé',
      timestamp: new Date().toISOString(),
    };
  }

  // ========================================
  // 🆕 ENDPOINTS INSPIRÉS DU CODE PROPOSÉ
  // ========================================

  /**
   * GET /api/catalog/gamme/:code/overview
   * Vue d'ensemble d'une gamme avec métadonnées (inspiré du code proposé)
   * Note: Pour détails complets, utiliser /api/catalog/gammes/:code/with-pieces
   */
  @Get('gamme/:code/overview')
  @ApiOperation({
    summary: "Vue d'ensemble gamme avec métadonnées",
    description:
      "Informations de base d'une gamme avec métadonnées SEO (overview rapide)",
  })
  @ApiParam({
    name: 'code',
    description: 'Code (alias) de la gamme',
    example: 'freinage',
  })
  @ApiResponse({
    status: 200,
    description: "Vue d'ensemble récupérée avec succès",
  })
  @ApiResponse({
    status: 404,
    description: 'Gamme non trouvée',
  })
  async getGammeOverview(@Param('code') code: string) {
    try {
      this.logger.log(`🔍 Requête vue d'ensemble gamme: ${code}`);

      // Note: On utilise les services du module gamme mais depuis catalog controller
      // pour éviter duplication avec GammeController
      const catalogData = await this.catalogService.getHomeCatalog();

      // Rechercher la gamme dans les données du catalogue
      const gamme =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        catalogData.mainCategories.find((cat: any) => cat.code === code) ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        catalogData.featuredCategories.find((cat: any) => cat.code === code);

      if (!gamme) {
        return {
          success: false,
          error: `Gamme ${code} non trouvée`,
          data: null,
        };
      }

      // Métadonnées SEO basiques (pour overview rapide)
      const basicMetadata = {
        title: `${gamme.name} - Automecanik`,
        description: gamme.description || `Découvrez notre gamme ${gamme.name}`,
        breadcrumbs: [
          { label: 'Accueil', path: '/' },
          { label: 'Catalogue', path: '/catalog' },
          { label: gamme.name, path: `/catalog/gamme/${code}` },
        ],
      };

      this.logger.log(`✅ Vue d'ensemble gamme ${code} récupérée`);
      return {
        success: true,
        data: {
          gamme,
          metadata: basicMetadata,
          note: 'Pour détails complets avec pièces, utiliser /api/catalog/gammes/:code/with-pieces',
        },
      };
    } catch (error) {
      this.logger.error(`❌ Erreur vue d'ensemble gamme ${code}:`, error);
      return {
        success: false,
        error: 'Erreur lors de la récupération de la gamme',
        data: null,
      };
    }
  }
}
