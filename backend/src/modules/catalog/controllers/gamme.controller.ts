import { 
  Controller, 
  Get, 
  Param, 
  Query, 
  Logger,
  ParseIntPipe,
  ParseBoolPipe,
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
import { GammeService } from '../services/gamme.service';

/**
 * 🎯 GAMME CONTROLLER - API Gammes de Produits
 * 
 * ✅ ENDPOINTS DISPONIBLES :
 * - GET /api/catalog/gammes - Toutes les gammes avec filtres
 * - GET /api/catalog/gammes/featured - Gammes mises en avant
 * - GET /api/catalog/gammes/popular - Gammes populaires  
 * - GET /api/catalog/gammes/homepage-data - Données pour page d'accueil
 * - GET /api/catalog/gammes/:id - Détails d'une gamme
 * 
 * 🔧 FEATURES :
 * - Documentation Swagger automatique
 * - Validation des paramètres
 * - Cache intelligent transparent
 * - Gestion d'erreurs structurée
 * - Logging complet
 */
@ApiTags('Catalog - Gammes')
@Controller('api/catalog/gammes')
export class GammeController {
  private readonly logger = new Logger(GammeController.name);

  constructor(private readonly gammeService: GammeService) {}

  /**
   * 🏠 GET /api/catalog/gammes/homepage-data
   * Données complètes optimisées pour la page d'accueil
   */
  @Get('homepage-data')
  @ApiOperation({ 
    summary: 'Données gammes pour page d\'accueil',
    description: 'Retourne les gammes featured, populaires et statistiques optimisées pour la homepage'
  })
  @ApiQuery({ 
    name: 'includeFeatured', 
    required: false, 
    type: Boolean, 
    description: 'Inclure les gammes mises en avant' 
  })
  @ApiQuery({ 
    name: 'includeStats', 
    required: false, 
    type: Boolean, 
    description: 'Inclure les statistiques' 
  })
  @ApiQuery({ 
    name: 'maxCategories', 
    required: false, 
    type: Number, 
    description: 'Nombre maximum de catégories (1-50)' 
  })
  @ApiResponse({ status: 200, description: 'Données homepage récupérées avec succès' })
  @ApiResponse({ status: 400, description: 'Paramètres invalides' })
  async getHomepageData(
    @Query('includeFeatured', new ParseBoolPipe({ optional: true })) includeFeatured?: boolean,
    @Query('includeStats', new ParseBoolPipe({ optional: true })) includeStats?: boolean,
    @Query('maxCategories', new ParseIntPipe({ optional: true })) maxCategories?: number,
  ) {
    try {
      this.logger.log(`🏠 Requête homepage gammes - Featured: ${includeFeatured}, Stats: ${includeStats}, Max: ${maxCategories}`);
      
      const result = await this.gammeService.getHomepageGammeData({
        includeFeatured,
        includeStats,
        maxCategories,
      });
      
      this.logger.log(`✅ Homepage gammes: ${result.featured_gammes.length} featured, ${result.popular_gammes.length} populaires`);
      return result;
      
    } catch (error) {
      this.logger.error('❌ Erreur homepage gammes:', error);
      throw new HttpException(
        'Erreur lors de la récupération des données homepage',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 🌟 GET /api/catalog/gammes/featured
   * Gammes mises en avant
   */
  @Get('featured')
  @ApiOperation({ 
    summary: 'Gammes mises en avant',
    description: 'Retourne les gammes configurées comme featured dans l\'admin'
  })
  @ApiQuery({ 
    name: 'limit', 
    required: false, 
    type: Number, 
    description: 'Nombre maximum de gammes (1-50)' 
  })
  @ApiResponse({ status: 200, description: 'Gammes featured récupérées avec succès' })
  async getFeaturedGammes(
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    try {
      this.logger.log(`🌟 Requête gammes featured - Limite: ${limit || 12}`);
      
      const result = await this.gammeService.getFeaturedGammes(limit);
      
      this.logger.log(`✅ ${result.length} gammes featured récupérées`);
      return {
        success: true,
        data: result,
        count: result.length,
        message: 'Gammes featured récupérées avec succès'
      };
      
    } catch (error) {
      this.logger.error('❌ Erreur gammes featured:', error);
      throw new HttpException(
        'Erreur lors de la récupération des gammes featured',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 🔥 GET /api/catalog/gammes/popular
   * Gammes populaires basées sur les commandes
   */
  @Get('popular')
  @ApiOperation({ 
    summary: 'Gammes populaires',
    description: 'Retourne les gammes les plus commandées (basé sur les statistiques de vente)'
  })
  @ApiQuery({ 
    name: 'limit', 
    required: false, 
    type: Number, 
    description: 'Nombre maximum de gammes (1-20)' 
  })
  @ApiResponse({ status: 200, description: 'Gammes populaires récupérées avec succès' })
  async getPopularGammes(
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    try {
      this.logger.log(`🔥 Requête gammes populaires - Limite: ${limit || 8}`);
      
      const result = await this.gammeService.getPopularGammes(limit);
      
      this.logger.log(`✅ ${result.length} gammes populaires récupérées`);
      return {
        success: true,
        data: result,
        count: result.length,
        message: 'Gammes populaires récupérées avec succès'
      };
      
    } catch (error) {
      this.logger.error('❌ Erreur gammes populaires:', error);
      throw new HttpException(
        'Erreur lors de la récupération des gammes populaires',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 📋 GET /api/catalog/gammes
   * Toutes les gammes avec filtres avancés
   */
  @Get()
  @ApiOperation({ 
    summary: 'Toutes les gammes avec filtres',
    description: 'Retourne toutes les gammes actives avec possibilité de filtrage'
  })
  @ApiQuery({ 
    name: 'featured', 
    required: false, 
    type: Boolean, 
    description: 'Filtrer par statut featured' 
  })
  @ApiQuery({ 
    name: 'brandId', 
    required: false, 
    type: Number, 
    description: 'Filtrer par marque' 
  })
  @ApiQuery({ 
    name: 'categoryFilter', 
    required: false, 
    type: String, 
    description: 'Filtrer par nom de catégorie (recherche partielle)' 
  })
  @ApiQuery({ 
    name: 'limit', 
    required: false, 
    type: Number, 
    description: 'Nombre maximum de résultats (1-100)' 
  })
  @ApiQuery({ 
    name: 'offset', 
    required: false, 
    type: Number, 
    description: 'Décalage pour la pagination' 
  })
  @ApiResponse({ status: 200, description: 'Gammes récupérées avec succès' })
  @ApiResponse({ status: 400, description: 'Paramètres de filtre invalides' })
  async getAllGammes(
    @Query('featured', new ParseBoolPipe({ optional: true })) featured?: boolean,
    @Query('brandId', new ParseIntPipe({ optional: true })) brandId?: number,
    @Query('categoryFilter') categoryFilter?: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('offset', new ParseIntPipe({ optional: true })) offset?: number,
  ) {
    try {
      this.logger.log(`📋 Requête toutes gammes - Featured: ${featured}, Brand: ${brandId}, Filter: ${categoryFilter}`);
      
      const result = await this.gammeService.getAllGammes({
        featured,
        brandId,
        categoryFilter,
        limit,
        offset,
      });
      
      this.logger.log(`✅ ${result.length} gammes récupérées avec filtres`);
      return {
        success: true,
        data: result,
        count: result.length,
        filters: {
          featured,
          brandId,
          categoryFilter,
          limit: limit || 20,
          offset: offset || 0
        },
        message: 'Gammes récupérées avec succès'
      };
      
    } catch (error) {
      this.logger.error('❌ Erreur récupération gammes:', error);
      throw new HttpException(
        'Erreur lors de la récupération des gammes',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 🔍 GET /api/catalog/gammes/:id
   * Détails complets d'une gamme
   */
  @Get(':id')
  @ApiOperation({ 
    summary: 'Détails d\'une gamme',
    description: 'Retourne les détails complets d\'une gamme avec produits populaires optionnels'
  })
  @ApiParam({ 
    name: 'id', 
    type: Number, 
    description: 'ID unique de la gamme' 
  })
  @ApiQuery({ 
    name: 'includeProducts', 
    required: false, 
    type: Boolean, 
    description: 'Inclure les produits populaires de la gamme' 
  })
  @ApiResponse({ status: 200, description: 'Détails de la gamme récupérés avec succès' })
  @ApiResponse({ status: 404, description: 'Gamme non trouvée' })
  async getGammeById(
    @Param('id', ParseIntPipe) gammeId: number,
    @Query('includeProducts', new ParseBoolPipe({ optional: true })) includeProducts?: boolean,
  ) {
    try {
      this.logger.log(`🔍 Requête détails gamme ID: ${gammeId} - Produits: ${includeProducts}`);
      
      const result = await this.gammeService.getGammeById(gammeId, includeProducts);
      
      this.logger.log(`✅ Gamme ${gammeId} récupérée: ${result.gamme_name}`);
      return {
        success: true,
        data: result,
        message: `Détails de la gamme ${result.gamme_name} récupérés avec succès`
      };
      
    } catch (error) {
      this.logger.error(`❌ Erreur détails gamme ${gammeId}:`, error);
      
      if (error.status === 404) {
        throw error; // Re-throw NotFoundException
      }
      
      throw new HttpException(
        'Erreur lors de la récupération des détails de la gamme',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // ========================================
  // 🆕 NOUVELLES MÉTHODES AMÉLIORÉES
  // ========================================

  /**
   * 🔍 GET /api/catalog/gammes/:code/with-pieces
   * Gamme spécifique avec ses pièces détachées
   */
  @Get(':code/with-pieces')
  @ApiOperation({ 
    summary: 'Récupère une gamme avec ses pièces',
    description: 'Retourne les détails d\'une gamme avec la liste de ses pièces détachées associées'
  })
  @ApiParam({ 
    name: 'code', 
    description: 'Code (alias) de la gamme',
    example: 'freinage'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Gamme avec pièces récupérée avec succès'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Gamme non trouvée'
  })
  async getGammeWithPieces(
    @Param('code') gammeCode: string,
  ) {
    try {
      this.logger.log(`🔍 API - Récupération gamme avec pièces: ${gammeCode}`);
      
      const gamme = await this.gammeService.getGammeWithPieces(gammeCode);
      
      if (!gamme) {
        throw new HttpException(
          `Gamme ${gammeCode} non trouvée`,
          HttpStatus.NOT_FOUND
        );
      }

      this.logger.log(`✅ API - Gamme ${gammeCode} avec ${gamme.pieces?.length || 0} pièces`);
      return {
        success: true,
        data: gamme,
        metadata: {
          piece_count: gamme.pieces?.length || 0,
          retrieved_at: new Date().toISOString()
        }
      };
    } catch (error) {
      this.logger.error(`❌ Erreur API gamme avec pièces ${gammeCode}:`, error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Erreur lors de la récupération de la gamme',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 🏗️ GET /api/catalog/gammes/hierarchy
   * Arborescence complète des gammes
   */
  @Get('hierarchy')
  @ApiOperation({ 
    summary: 'Récupère l\'arborescence des gammes',
    description: 'Retourne la hiérarchie complète des gammes avec leurs sous-catégories'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Hiérarchie récupérée avec succès'
  })
  async getGammeHierarchy() {
    try {
      this.logger.log('🏗️ API - Récupération hiérarchie gammes');
      
      const hierarchy = await this.gammeService.getGammeHierarchy();
      
      this.logger.log(`✅ API - Hiérarchie: ${hierarchy.length} gammes principales`);
      return {
        success: true,
        data: hierarchy,
        metadata: {
          total_categories: hierarchy.length,
          total_subcategories: hierarchy.reduce((sum, cat) => sum + (cat.children?.length || 0), 0),
          retrieved_at: new Date().toISOString()
        }
      };
    } catch (error) {
      this.logger.error('❌ Erreur API hiérarchie gammes:', error);
      throw new HttpException(
        'Erreur lors de la récupération de la hiérarchie',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 🎯 GET /api/catalog/gammes/:code/metadata
   * Métadonnées SEO pour une gamme
   */
  @Get(':code/metadata')
  @ApiOperation({ 
    summary: 'Récupère les métadonnées SEO d\'une gamme',
    description: 'Retourne title, description, mots-clés et breadcrumbs pour le SEO'
  })
  @ApiParam({ 
    name: 'code', 
    description: 'Code (alias) de la gamme',
    example: 'freinage'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Métadonnées récupérées avec succès'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Gamme non trouvée'
  })
  async getGammeMetadata(
    @Param('code') gammeCode: string,
  ) {
    try {
      this.logger.log(`🎯 API - Récupération métadonnées SEO: ${gammeCode}`);
      
      const metadata = await this.gammeService.getGammeMetadata(gammeCode);
      
      if (!metadata) {
        throw new HttpException(
          `Métadonnées pour gamme ${gammeCode} non trouvées`,
          HttpStatus.NOT_FOUND
        );
      }

      this.logger.log(`✅ API - Métadonnées SEO générées pour ${gammeCode}`);
      return {
        success: true,
        data: metadata,
        metadata: {
          breadcrumb_count: metadata.breadcrumbs.length,
          keyword_count: metadata.keywords.length,
          generated_at: new Date().toISOString()
        }
      };
    } catch (error) {
      this.logger.error(`❌ Erreur API métadonnées ${gammeCode}:`, error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Erreur lors de la récupération des métadonnées',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 🔍 GET /api/catalog/gammes/search
   * Recherche de gammes avec texte libre
   */
  @Get('search')
  @ApiOperation({ 
    summary: 'Recherche de gammes',
    description: 'Recherche textuelle dans les noms, descriptions et codes de gammes'
  })
  @ApiQuery({ 
    name: 'q', 
    description: 'Terme de recherche',
    example: 'frein'
  })
  @ApiQuery({ 
    name: 'limit', 
    description: 'Nombre maximum de résultats',
    required: false,
    example: 20
  })
  @ApiQuery({ 
    name: 'includeProducts', 
    description: 'Inclure les produits dans les résultats',
    required: false,
    example: false
  })
  @ApiQuery({ 
    name: 'onlyFeatured', 
    description: 'Uniquement les gammes mises en avant',
    required: false,
    example: false
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Résultats de recherche'
  })
  async searchGammes(
    @Query('q') query: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('includeProducts', new ParseBoolPipe({ optional: true })) includeProducts?: boolean,
    @Query('onlyFeatured', new ParseBoolPipe({ optional: true })) onlyFeatured?: boolean,
  ) {
    try {
      if (!query || query.trim().length < 2) {
        throw new HttpException(
          'Le terme de recherche doit contenir au moins 2 caractères',
          HttpStatus.BAD_REQUEST
        );
      }

      this.logger.log(`🔍 API - Recherche gammes: "${query}"`);
      
      const results = await this.gammeService.searchGammes(query, {
        limit: limit || 20,
        includeProducts: includeProducts || false,
        onlyFeatured: onlyFeatured || false
      });
      
      this.logger.log(`✅ API - Recherche "${query}": ${results.length} résultats`);
      return {
        success: true,
        data: results,
        metadata: {
          query: query.trim(),
          result_count: results.length,
          filters: {
            limit: limit || 20,
            include_products: includeProducts || false,
            only_featured: onlyFeatured || false
          },
          searched_at: new Date().toISOString()
        }
      };
    } catch (error) {
      this.logger.error(`❌ Erreur API recherche gammes "${query}":`, error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Erreur lors de la recherche de gammes',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}