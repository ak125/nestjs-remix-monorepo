import { Controller, Get, Query, Param, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CatalogService, HomeCatalogData } from './catalog.service';
import { CatalogFamilyService } from './services/catalog-family.service';
import { VehicleFilteredCatalogService } from './services/vehicle-filtered-catalog-v2.service';
import { VehicleFilteredCatalogServiceV3 } from './services/vehicle-filtered-catalog-v3-simple.service';

@ApiTags('Catalog - API Complète')
@Controller('api/catalog')
export class CatalogController {
  private readonly logger = new Logger(CatalogController.name);

  constructor(
    private readonly catalogService: CatalogService,
    private readonly catalogFamilyService: CatalogFamilyService,
    private readonly vehicleFilteredCatalogService: VehicleFilteredCatalogService,
    private readonly vehicleFilteredCatalogServiceV3: VehicleFilteredCatalogServiceV3, // 🚗 V3: Service avec logique PHP complète
  ) {}

  /**
   * GET /api/catalog/families - Reproduction exacte logique PHP index.php
   * Pour le composant SimpleCatalogFamilies du frontend
   */
  @Get('families')
  @ApiOperation({ 
    summary: 'Familles de catalogue avec gammes (logique PHP)',
    description: 'Reproduction exacte de la logique PHP index.php pour le catalogue de familles avec leurs gammes'
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
                    pg_name: { type: 'string' }
                  }
                }
              }
            }
          }
        },
        totalFamilies: { type: 'number' },
        message: { type: 'string' }
      }
    }
  })
  async getCatalogFamiliesPhpLogic() {
    this.logger.log('📋 [GET] /api/catalog/families - Logique PHP pour SimpleCatalogFamilies');
    
    try {
      const result = await this.catalogFamilyService.getCatalogFamiliesPhpLogic();
      
      this.logger.log(`✅ ${result.totalFamilies} familles récupérées pour le frontend`);
      return result;
    } catch (error: any) {
      this.logger.error('❌ Erreur récupération familles:', error);
      return {
        success: false,
        families: [],
        totalFamilies: 0,
        message: 'Erreur lors de la récupération des familles'
      };
    }
  }

  /**
   * GET /api/catalog/families/vehicle/:typeId - Familles filtrées par véhicule
   * Utilise cross_gamme_car pour ne montrer que les pièces compatibles
   */
  @Get('families/vehicle/:typeId')
  @ApiOperation({ 
    summary: 'Familles de catalogue filtrées par véhicule',
    description: 'Récupère uniquement les familles de catalogue qui ont des pièces compatibles avec le véhicule spécifié (utilise cross_gamme_car)'
  })
  @ApiParam({
    name: 'typeId',
    description: 'ID du type de véhicule (type_id)',
    example: 115277
  })
  async getCatalogFamiliesForVehicle(@Param('typeId') typeId: string) {
    this.logger.log(`🚗 [GET] /api/catalog/families/vehicle/${typeId} - Catalogue filtré par véhicule`);
    
    try {
      const typeIdNum = parseInt(typeId, 10);
      if (isNaN(typeIdNum)) {
        return {
          success: false,
          families: [],
          totalFamilies: 0,
          message: 'type_id invalide'
        };
      }

      const result = await this.vehicleFilteredCatalogService.getCatalogFamiliesForVehicle(typeIdNum);
      
      this.logger.log(`✅ ${result.totalFamilies} familles compatibles avec véhicule ${typeId}`);
      return result;
    } catch (error: any) {
      this.logger.error(`❌ Erreur catalogue filtré pour véhicule ${typeId}:`, error);
      return {
        success: false,
        families: [],
        totalFamilies: 0,
        message: 'Erreur lors de la récupération du catalogue filtré'
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
    description: 'Récupère toutes les marques disponibles avec option de limitation'
  })
  @ApiQuery({ 
    name: 'limit', 
    description: 'Nombre maximum de marques à retourner',
    required: false,
    example: 50
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Liste des marques récupérée avec succès'
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
    description: 'Récupère toutes les gammes regroupées par famille (pg_parent)'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Familles de gammes récupérées avec succès'
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
    description: 'Récupère toutes les familles du catalogue formatées comme des gammes pour la homepage'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Toutes les familles récupérées avec succès'
  })
  async getAllFamiliesAsGammes() {
    this.logger.log('👨‍👩‍👧‍👦 Requête toutes les familles comme gammes reçue');
    return this.catalogService.getAllFamiliesAsGammes();
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
    description: 'Données optimisées pour page d\'accueil : catégories, statistiques, accès rapide'
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
            stats: { type: 'object' }
          }
        }
      }
    }
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
    description: 'Recherche textuelle avec filtres prix, catégorie et marque'
  })
  @ApiQuery({ 
    name: 'q', 
    description: 'Terme de recherche',
    required: false,
    example: 'frein'
  })
  @ApiQuery({ 
    name: 'minPrice', 
    description: 'Prix minimum',
    required: false,
    example: 10
  })
  @ApiQuery({ 
    name: 'maxPrice', 
    description: 'Prix maximum',
    required: false,
    example: 100
  })
  @ApiQuery({ 
    name: 'categoryId', 
    description: 'ID de catégorie',
    required: false,
    example: 5
  })
  @ApiQuery({ 
    name: 'brandId', 
    description: 'ID de marque',
    required: false,
    example: 12
  })
  @ApiQuery({ 
    name: 'limit', 
    description: 'Nombre de résultats',
    required: false,
    example: 50
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Résultats de recherche'
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
    description: 'Invalide le cache complet ou avec pattern spécifique'
  })
  @ApiQuery({ 
    name: 'pattern', 
    description: 'Pattern de cache à invalider',
    required: false,
    example: 'home*'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Cache invalidé avec succès'
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
    summary: 'Vue d\'ensemble gamme avec métadonnées',
    description: 'Informations de base d\'une gamme avec métadonnées SEO (overview rapide)'
  })
  @ApiParam({ 
    name: 'code', 
    description: 'Code (alias) de la gamme',
    example: 'freinage'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Vue d\'ensemble récupérée avec succès'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Gamme non trouvée'
  })
  async getGammeOverview(@Param('code') code: string) {
    try {
      this.logger.log(`🔍 Requête vue d'ensemble gamme: ${code}`);
      
      // Note: On utilise les services du module gamme mais depuis catalog controller
      // pour éviter duplication avec GammeController
      const catalogData = await this.catalogService.getHomeCatalog();
      
      // Rechercher la gamme dans les données du catalogue
      const gamme = catalogData.data.mainCategories.find(
        (cat: any) => cat.code === code
      ) || catalogData.data.featuredCategories.find(
        (cat: any) => cat.code === code
      );

      if (!gamme) {
        return {
          success: false,
          error: `Gamme ${code} non trouvée`,
          data: null
        };
      }

      // Métadonnées SEO basiques (pour overview rapide)
      const basicMetadata = {
        title: `${gamme.name} - Automecanik`,
        description: gamme.description || `Découvrez notre gamme ${gamme.name}`,
        breadcrumbs: [
          { label: 'Accueil', path: '/' },
          { label: 'Catalogue', path: '/catalog' },
          { label: gamme.name, path: `/catalog/gamme/${code}` }
        ]
      };

      this.logger.log(`✅ Vue d'ensemble gamme ${code} récupérée`);
      return {
        success: true,
        data: {
          gamme,
          metadata: basicMetadata,
          note: 'Pour détails complets avec pièces, utiliser /api/catalog/gammes/:code/with-pieces'
        }
      };
    } catch (error) {
      this.logger.error(`❌ Erreur vue d'ensemble gamme ${code}:`, error);
      return {
        success: false,
        error: 'Erreur lors de la récupération de la gamme',
        data: null
      };
    }
  }

  /**
   * � V3: Récupère le catalogue complet filtré par véhicule avec logique PHP
   * PIECES_RELATION_TYPE → CROSS_GAMME_CAR → GENERIC_HIERARCHY
   */
  @Get('families/vehicle-v3/:typeId')
  @ApiOperation({ 
    summary: '[V3] Catalogue filtré par véhicule avec logique PHP complète',
    description: 'Utilise pieces_relation_type avec fallback vers __cross_gamme_car_new puis hiérarchie générique. Tables en minuscules pour Supabase.'
  })
  @ApiParam({ name: 'typeId', type: 'number', description: 'ID du type de véhicule' })
  @ApiResponse({
    status: 200,
    description: 'Catalogue complet récupéré avec succès',
    schema: {
      type: 'object',
      properties: {
        catalog: {
          type: 'object',
          properties: {
            families: { type: 'array' },
            success: { type: 'boolean' },
            totalFamilies: { type: 'number' },
            totalGammes: { type: 'number' },
            seoValid: { type: 'boolean' },
            queryType: { type: 'string', enum: ['PIECES_RELATION_TYPE', 'CROSS_GAMME_CAR', 'GENERIC_HIERARCHY'] }
          }
        },
        popularParts: { type: 'array' }
      }
    }
  })
  async getVehicleCatalogV3(@Param('typeId') typeId: string) {
    this.logger.log(`🚗 [V3] GET /api/catalog/families/vehicle-v3/${typeId}`);
    
    const typeIdNum = parseInt(typeId);
    if (isNaN(typeIdNum)) {
      throw new Error('typeId doit être un nombre valide');
    }
    
    try {
      const result = await this.vehicleFilteredCatalogServiceV3.getVehicleCatalogWithPopularParts(typeIdNum);
      
      this.logger.log(`✅ [V3] Succès: ${result.catalog.totalFamilies} familles (${result.catalog.queryType}), ${result.popularParts.length} pièces populaires`);
      
      return {
        success: true,
        catalog: result.catalog,
        popularParts: result.popularParts,
        meta: {
          typeId: typeIdNum,
          queryType: result.catalog.queryType,
          seoValid: result.catalog.seoValid,
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error: any) {
      this.logger.error(`❌ [V3] Erreur pour type_id ${typeId}:`, error);
      throw new Error(`Erreur récupération catalogue V3: ${error.message}`);
    }
  }

  /**
   * 🔍 DIAGNOSTIC: Vérifie les type_ids disponibles dans pieces_relation_type
   * GET /api/catalog/diagnostic/pieces-relation-type
   */
  @Get('diagnostic/pieces-relation-type')
  @ApiOperation({ 
    summary: '🔍 Diagnostic des données pieces_relation_type',
    description: 'Vérifie quels type_ids sont disponibles dans la table pieces_relation_type pour tester le V3'
  })
  async diagnosticPiecesRelationType() {
    this.logger.log(`🔍 [DIAGNOSTIC] Analyse de pieces_relation_type...`);
    
    try {
      // Déléguer au service V3 qui a accès à Supabase
      const diagnostic = await this.vehicleFilteredCatalogServiceV3.diagnosticPiecesRelationType();
      
      this.logger.log(`✅ [DIAGNOSTIC] Résultats: ${diagnostic.available_type_ids?.length || 0} type_ids trouvés`);
      
      return diagnostic;

    } catch (error: any) {
      this.logger.error(`❌ [DIAGNOSTIC] Erreur: ${error.message}`);
      return { 
        success: false, 
        error: error.message,
        recommendations: ['Vérifier la connexion à Supabase', 'Vérifier que la table pieces_relation_type existe']
      };
    }
  }

  /**
   * �🔍 ENDPOINT TEMPORAIRE - Test des tables gammes
   * GET /api/catalog/test-gamme-tables
   */
  @Get('test-gamme-tables')
  @ApiOperation({ 
    summary: '[TEST] Explorer les tables gammes disponibles',
    description: 'Endpoint temporaire pour tester pieces_gamme et catalog_gamme'
  })
  async testGammeTables() {
    this.logger.log('🔍 Test des tables gammes disponibles...');
    
    const results: any = {
      timestamp: new Date().toISOString(),
      tables_tested: [],
      errors: []
    };

    // Test 1: pieces_gamme
    try {
      this.logger.log('📋 Test table pieces_gamme...');
      const piecesResult = await this.catalogService.testTable('pieces_gamme');
      results.tables_tested.push({
        table: 'pieces_gamme',
        status: 'success',
        count: piecesResult.count,
        sample_columns: piecesResult.columns,
        sample_data: piecesResult.sample
      });
    } catch (error: any) {
      this.logger.error('❌ Erreur pieces_gamme:', error);
      results.errors.push({
        table: 'pieces_gamme',
        error: error.message
      });
    }

    // Test 2: catalog_gamme
    try {
      this.logger.log('📋 Test table catalog_gamme...');
      const catalogResult = await this.catalogService.testTable('catalog_gamme');
      results.tables_tested.push({
        table: 'catalog_gamme',
        status: 'success',
        count: catalogResult.count,
        sample_columns: catalogResult.columns,
        sample_data: catalogResult.sample
      });
    } catch (error: any) {
      this.logger.error('❌ Erreur catalog_gamme:', error);
      results.errors.push({
        table: 'catalog_gamme',
        error: error.message
      });
    }

    return {
      success: true,
      message: 'Test des tables gammes terminé',
      data: results
    };
  }
}
