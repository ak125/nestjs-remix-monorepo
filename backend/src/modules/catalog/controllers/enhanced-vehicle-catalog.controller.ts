import { 
  Controller, 
  Get, 
  Param, 
  Query, 
  Logger,
  Post,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiParam, 
  ApiQuery,
} from '@nestjs/swagger';
import { EnhancedVehicleCatalogService } from '../services/enhanced-vehicle-catalog.service';

/**
 * 🚗 ENHANCED VEHICLE CATALOG CONTROLLER - Contrôleur Catalogue Véhicule Modernisé
 * 
 * ✅ API REST COMPLÈTE avec meilleures pratiques :
 * - Validation automatique des paramètres
 * - Documentation Swagger intégrée
 * - Gestion d'erreurs structurée
 * - Logging complet des requêtes
 * - Cache transparent pour l'utilisateur
 * 
 * 🔗 Routes disponibles :
 * - GET /catalog/vehicles/:brandSlug/:modelSlug/:typeSlug → Catalogue complet
 * - GET /catalog/vehicles/:vehicleTypeId/popular-parts → Pièces populaires
 * - GET /catalog/vehicles/search/mine/:mineType → Recherche par type mine
 * - GET /catalog/vehicles/stats → Statistiques du service
 * - POST /catalog/vehicles/cache/clear → Nettoyage cache (admin)
 */
@ApiTags('🚗 Vehicle Catalog Enhanced')
@Controller('catalog/vehicles')
export class EnhancedVehicleCatalogController {
  private readonly logger = new Logger(EnhancedVehicleCatalogController.name);

  constructor(
    private readonly catalogService: EnhancedVehicleCatalogService,
  ) {}

  // =====================================================
  // 🔍 ENDPOINT PRINCIPAL - CATALOGUE VÉHICULE
  // =====================================================

  /**
   * 🚗 Récupérer le catalogue complet d'un véhicule
   * Retourne : véhicule, catégories compatibles, breadcrumbs, métadonnées SEO, analytics
   */
  @Get(':brandSlug/:modelSlug/:typeSlug')
  @ApiOperation({ 
    summary: 'Catalogue complet véhicule',
    description: 'Récupère toutes les données nécessaires pour afficher le catalogue d\'un véhicule spécifique'
  })
  @ApiParam({ 
    name: 'brandSlug', 
    description: 'Slug de la marque (ex: peugeot, renault)', 
    example: 'peugeot' 
  })
  @ApiParam({ 
    name: 'modelSlug', 
    description: 'Slug du modèle (ex: 308, clio)', 
    example: '308' 
  })
  @ApiParam({ 
    name: 'typeSlug', 
    description: 'Slug du type/motorisation (ex: 1-6-hdi)', 
    example: '1-6-hdi' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Catalogue véhicule récupéré avec succès',
    schema: {
      example: {
        vehicle: {
          id: 123,
          name: '1.6 HDi',
          model: {
            id: 45,
            name: '308',
            brand: {
              id: 12,
              name: 'Peugeot',
              code: 'PEU'
            }
          },
          power: '92 ch',
          fuel: 'Diesel'
        },
        categories: [
          {
            id: 1,
            name: 'Freinage',
            slug: 'freinage',
            subcategories: []
          }
        ],
        breadcrumbs: [
          { label: 'Automecanik', path: '/', position: 1 },
          { label: 'Peugeot', path: '/constructeurs/peugeot', position: 2 },
          { label: '308 1.6 HDi', path: '#', position: 3 }
        ],
        metadata: {
          title: 'Pièces Peugeot 308 1.6 HDi acheter avec le meilleur prix',
          description: 'Catalogue pièces détachées pour Peugeot 308 1.6 HDi...'
        },
        analytics: {
          vehicleViews: 245,
          popularCategories: ['Freinage', 'Moteur'],
          cacheStatus: { vehicle: true, categories: true, metadata: true }
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Paramètres invalides' })
  @ApiResponse({ status: 404, description: 'Véhicule non trouvé' })
  async getVehicleCatalog(
    @Param('brandSlug') brandSlug: string,
    @Param('modelSlug') modelSlug: string,
    @Param('typeSlug') typeSlug: string,
  ) {
    const startTime = Date.now();
    
    this.logger.log(`🔍 GET /catalog/vehicles/${brandSlug}/${modelSlug}/${typeSlug}`);

    try {
      const result = await this.catalogService.getVehicleCatalog({
        brandSlug,
        modelSlug,
        typeSlug,
      });

      const responseTime = Date.now() - startTime;
      this.logger.log(`✅ Catalogue récupéré en ${responseTime}ms`);

      return {
        success: true,
        data: result,
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.logger.error(`❌ Erreur catalogue en ${responseTime}ms:`, error.message);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        'Erreur lors de la récupération du catalogue véhicule',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // =====================================================
  // 🔥 ENDPOINT PIÈCES POPULAIRES
  // =====================================================

  /**
   * 🔥 Récupérer les pièces populaires pour un véhicule
   */
  @Get(':vehicleTypeId/popular-parts')
  @ApiOperation({ 
    summary: 'Pièces populaires par véhicule',
    description: 'Liste des pièces les plus demandées pour un véhicule spécifique'
  })
  @ApiParam({ 
    name: 'vehicleTypeId', 
    description: 'ID du type de véhicule', 
    example: '123' 
  })
  @ApiQuery({ 
    name: 'limit', 
    description: 'Nombre maximum de pièces à retourner (1-100)', 
    example: 20,
    required: false 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Pièces populaires récupérées avec succès' 
  })
  @ApiResponse({ status: 400, description: 'Paramètres invalides' })
  async getPopularParts(
    @Param('vehicleTypeId') vehicleTypeId: string,
    @Query('limit') limit?: string,
  ) {
    this.logger.log(`🔥 GET /catalog/vehicles/${vehicleTypeId}/popular-parts?limit=${limit || '20'}`);

    try {
      const result = await this.catalogService.getPopularParts({
        vehicleTypeId,
        limit: limit ? parseInt(limit, 10) : 20,
      });

      this.logger.log(`✅ ${result.length} pièces populaires récupérées`);

      return {
        success: true,
        data: result,
        total: result.length,
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      this.logger.error('❌ Erreur pièces populaires:', error.message);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        'Erreur lors de la récupération des pièces populaires',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // =====================================================
  // 🔍 ENDPOINT RECHERCHE TYPE MINE
  // =====================================================

  /**
   * 🔍 Recherche véhicule par type mine
   */
  @Get('search/mine/:mineType')
  @ApiOperation({ 
    summary: 'Recherche par type mine',
    description: 'Trouve un véhicule spécifique grâce à son code type mine'
  })
  @ApiParam({ 
    name: 'mineType', 
    description: 'Code type mine du véhicule', 
    example: 'M1ABCD123' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Véhicule trouvé avec succès' 
  })
  @ApiResponse({ status: 400, description: 'Type mine invalide' })
  @ApiResponse({ status: 404, description: 'Aucun véhicule trouvé avec ce type mine' })
  async searchByMineType(@Param('mineType') mineType: string) {
    this.logger.log(`🔍 GET /catalog/vehicles/search/mine/${mineType}`);

    try {
      const result = await this.catalogService.searchByMineType({ mineType });

      this.logger.log(`✅ Véhicule trouvé: ${result.model.brand.name} ${result.model.name} ${result.name}`);

      return {
        success: true,
        data: result,
        mineType: mineType.toUpperCase(),
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      this.logger.error(`❌ Erreur recherche mine ${mineType}:`, error.message);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        'Erreur lors de la recherche par type mine',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // =====================================================
  // 📊 ENDPOINTS MONITORING ET ADMIN
  // =====================================================

  /**
   * 📊 Statistiques du service catalog
   */
  @Get('stats')
  @ApiOperation({ 
    summary: 'Statistiques du service',
    description: 'Métriques de performance et d\'utilisation du service catalog'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Statistiques récupérées avec succès',
    schema: {
      example: {
        catalogRequests: 1250,
        cacheHits: 875,
        cacheMisses: 375,
        cacheHitRate: 70.0,
        errorCount: 12,
        avgResponseTime: 156.7,
        uptime: 86400
      }
    }
  })
  async getServiceStats() {
    this.logger.log('📊 GET /catalog/vehicles/stats');

    try {
      const stats = this.catalogService.getServiceStats();

      this.logger.log('✅ Statistiques récupérées');

      return {
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      this.logger.error('❌ Erreur récupération stats:', error.message);
      
      throw new HttpException(
        'Erreur lors de la récupération des statistiques',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🧹 Nettoyer le cache du service (Admin)
   */
  @Post('cache/clear')
  @ApiOperation({ 
    summary: 'Nettoyer le cache [ADMIN]',
    description: 'Supprime toutes les données en cache du service catalog'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Cache nettoyé avec succès' 
  })
  @ApiResponse({ status: 500, description: 'Erreur lors du nettoyage' })
  async clearCache() {
    this.logger.log('🧹 POST /catalog/vehicles/cache/clear');

    try {
      await this.catalogService.clearServiceCache();

      this.logger.log('✅ Cache nettoyé avec succès');

      return {
        success: true,
        message: 'Cache du service catalog nettoyé avec succès',
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      this.logger.error('❌ Erreur nettoyage cache:', error.message);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        'Erreur lors du nettoyage du cache',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // =====================================================
  // 🔍 ENDPOINT HEALTH CHECK
  // =====================================================

  /**
   * ❤️ Health check du service
   */
  @Get('health')
  @ApiOperation({ 
    summary: 'Health check du service',
    description: 'Vérifie que le service catalog fonctionne correctement'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Service opérationnel' 
  })
  async healthCheck() {
    this.logger.debug('❤️ GET /catalog/vehicles/health');

    const stats = this.catalogService.getServiceStats();

    return {
      status: 'healthy',
      service: 'enhanced-vehicle-catalog',
      uptime: stats.uptime,
      totalRequests: stats.catalogRequests,
      cacheHitRate: stats.cacheHitRate.toFixed(2) + '%',
      errorRate: ((stats.errorCount / stats.catalogRequests) * 100).toFixed(2) + '%',
      avgResponseTime: stats.avgResponseTime.toFixed(2) + 'ms',
      timestamp: new Date().toISOString(),
    };
  }
}