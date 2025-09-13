import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  ParseIntPipe,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { EnhancedVehicleService } from './services/enhanced-vehicle.service';
import { PaginationOptions } from './types/vehicle.types';

/**
 * 🚗 ENHANCED VEHICLE CONTROLLER - API Véhicule Refactorisée
 * 
 * ✅ Architecture modulaire utilisant le nouveau EnhancedVehicleService
 * ✅ Toutes les 7 méthodes migrées disponibles
 * ✅ Endpoints RESTful cohérents
 * ✅ Documentation Swagger complète
 * 
 * 🎯 ENDPOINTS DISPONIBLES :
 * - GET /api/vehicles/search/code/:code - Recherche par code
 * - GET /api/vehicles/mine/model/:modelId - Codes mine par modèle  
 * - GET /api/vehicles/type/:typeId - Type par ID avec enrichissement
 * - GET /api/vehicles/search/cnit/:cnitCode - Recherche par CNIT
 * - GET /api/vehicles/search/mine/:mineCode - Recherche par code mine
 * - POST /api/vehicles/search/advanced - Recherche avancée
 * - GET /api/vehicles/brands - Toutes les marques
 * 
 * + API complète avec suggestions, stats, health check...
 */

@ApiTags('🚗 Vehicles Enhanced API')
@Controller('api/vehicles')
export class EnhancedVehicleController {
  private readonly logger = new Logger(EnhancedVehicleController.name);

  constructor(
    private readonly vehicleService: EnhancedVehicleService,
  ) {
    this.logger.log('🚗 EnhancedVehicleController REFACTORISÉ initialisé');
  }

  // =====================================================
  // 🔍 ENDPOINTS DES 7 MÉTHODES MIGRÉES
  // =====================================================

  /**
   * 🔍 1/7 - Recherche par code (Mine, CNIT, etc.)
   */
  @Get('search/code/:code')
  @ApiOperation({ 
    summary: '🔍 Recherche par code',
    description: 'Recherche flexible par code Mine, CNIT ou autre identifiant véhicule'
  })
  @ApiParam({ name: 'code', description: 'Code à rechercher (Mine, CNIT, etc.)', example: 'VF123' })
  @ApiQuery({ name: 'page', required: false, type: 'number', example: 0 })
  @ApiQuery({ name: 'limit', required: false, type: 'number', example: 50 })
  @ApiResponse({ status: 200, description: 'Résultats de recherche par code' })
  async searchByCode(
    @Param('code') code: string,
    @Query('page', ParseIntPipe) page: number = 0,
    @Query('limit', ParseIntPipe) limit: number = 50,
  ) {
    try {
      return await this.vehicleService.searchByCode(code, { page, limit });
    } catch (error) {
      this.logger.error(`Erreur searchByCode ${code}:`, error);
      throw error;
    }
  }

  /**
   * ⛏️ 2/7 - Codes mine par modèle
   */
  @Get('mine/model/:modelId')
  @ApiOperation({ 
    summary: '⛏️ Codes mine par modèle',
    description: 'Récupère tous les codes mine disponibles pour un modèle donné'
  })
  @ApiParam({ name: 'modelId', description: 'ID du modèle', type: 'number', example: 123 })
  @ApiQuery({ name: 'page', required: false, type: 'number', example: 0 })
  @ApiQuery({ name: 'limit', required: false, type: 'number', example: 50 })
  @ApiResponse({ status: 200, description: 'Liste des codes mine du modèle' })
  async getMinesByModel(
    @Param('modelId', ParseIntPipe) modelId: number,
    @Query('page', ParseIntPipe) page: number = 0,
    @Query('limit', ParseIntPipe) limit: number = 50,
  ) {
    try {
      return await this.vehicleService.getMinesByModel(modelId, { page, limit });
    } catch (error) {
      this.logger.error(`Erreur getMinesByModel ${modelId}:`, error);
      throw error;
    }
  }

  /**
   * 🔧 3/7 - Type par ID avec enrichissement
   */
  @Get('type/:typeId')
  @ApiOperation({ 
    summary: '🔧 Type par ID',
    description: 'Récupère un type véhicule avec enrichissement moteur automatique'
  })
  @ApiParam({ name: 'typeId', description: 'ID du type', type: 'number', example: 456 })
  @ApiQuery({ name: 'includeEngine', required: false, type: 'boolean', example: true })
  @ApiResponse({ status: 200, description: 'Détails du type avec enrichissement' })
  @ApiResponse({ status: 404, description: 'Type non trouvé' })
  async getTypeById(
    @Param('typeId', ParseIntPipe) typeId: number,
    @Query('includeEngine') includeEngine: boolean = true,
  ) {
    try {
      const result = await this.vehicleService.getTypeById(typeId, includeEngine);
      
      if (!result) {
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: `Type ${typeId} non trouvé`,
          data: null
        };
      }

      return {
        statusCode: HttpStatus.OK,
        message: 'Type récupéré avec succès',
        data: result
      };
    } catch (error) {
      this.logger.error(`Erreur getTypeById ${typeId}:`, error);
      throw error;
    }
  }

  /**
   * 🔍 4/7 - Recherche par code CNIT
   */
  @Get('search/cnit/:cnitCode')
  @ApiOperation({ 
    summary: '🔍 Recherche par CNIT',
    description: 'Recherche spécialisée par code CNIT (Contrôle National des Informations Techniques)'
  })
  @ApiParam({ name: 'cnitCode', description: 'Code CNIT', example: 'AB123CD' })
  @ApiQuery({ name: 'page', required: false, type: 'number', example: 0 })
  @ApiQuery({ name: 'limit', required: false, type: 'number', example: 50 })
  @ApiResponse({ status: 200, description: 'Résultats de recherche par CNIT' })
  async searchByCnit(
    @Param('cnitCode') cnitCode: string,
    @Query('page') page: number = 0,
    @Query('limit') limit: number = 50,
  ) {
    try {
      return await this.vehicleService.searchByCnit(cnitCode, { page, limit });
    } catch (error) {
      this.logger.error(`Erreur searchByCnit ${cnitCode}:`, error);
      throw error;
    }
  }

  /**
   * ⛏️ 5/7 - Recherche par code mine
   */
  @Get('search/mine/:mineCode')
  @ApiOperation({ 
    summary: '⛏️ Recherche par code mine',
    description: 'Recherche spécialisée par code mine avec support des variantes'
  })
  @ApiParam({ name: 'mineCode', description: 'Code mine', example: 'VF3123' })
  @ApiQuery({ name: 'page', required: false, type: 'number', example: 0 })
  @ApiQuery({ name: 'limit', required: false, type: 'number', example: 50 })
  @ApiQuery({ name: 'exactMatch', required: false, type: 'boolean', example: false })
  @ApiResponse({ status: 200, description: 'Résultats de recherche par code mine' })
  async searchByMineCode(
    @Param('mineCode') mineCode: string,
    @Query('page') page: number = 0,
    @Query('limit') limit: number = 50,
    @Query('exactMatch') exactMatch: boolean = false,
  ) {
    try {
      return await this.vehicleService.searchByMineCode(mineCode, { 
        page, 
        limit,
        exactMatch 
      });
    } catch (error) {
      this.logger.error(`Erreur searchByMineCode ${mineCode}:`, error);
      throw error;
    }
  }

  /**
   * 🔍 6/7 - Recherche avancée multi-critères
   */
  @Post('search/advanced')
  @ApiOperation({ 
    summary: '🔍 Recherche avancée',
    description: 'Recherche textuelle multi-critères dans marques, modèles et types'
  })
  @ApiResponse({ status: 200, description: 'Résultats de recherche avancée' })
  async searchAdvanced(
    @Body() searchDto: {
      query: string;
      searchIn?: string[];
      exactMatch?: boolean;
      includeEngine?: boolean;
      page?: number;
      limit?: number;
    }
  ) {
    try {
      const { query, ...options } = searchDto;
      return await this.vehicleService.searchAdvanced(query, options);
    } catch (error) {
      this.logger.error('Erreur searchAdvanced:', error);
      throw error;
    }
  }

  /**
   * 🏷️ 7/7 - Obtenir toutes les marques
   */
  @Get('brands')
  @ApiOperation({ 
    summary: '🏷️ Toutes les marques',
    description: 'Liste paginée de toutes les marques automobiles disponibles'
  })
  @ApiQuery({ name: 'page', required: false, type: 'number', example: 0 })
  @ApiQuery({ name: 'limit', required: false, type: 'number', example: 50 })
  @ApiQuery({ name: 'search', required: false, type: 'string', example: 'Audi' })
  @ApiResponse({ status: 200, description: 'Liste des marques' })
  async getBrands(
    @Query('page') page: number = 0,
    @Query('limit') limit: number = 50,
    @Query('search') search?: string,
  ) {
    try {
      return await this.vehicleService.getBrands({ page, limit, search });
    } catch (error) {
      this.logger.error('Erreur getBrands:', error);
      throw error;
    }
  }

  // =====================================================
  // 🎯 ENDPOINTS COMPLÉMENTAIRES
  // =====================================================

  /**
   * 🚗 Modèles par marque
   */
  @Get('brands/:brandId/models')
  @ApiOperation({ summary: '🚗 Modèles par marque' })
  @ApiParam({ name: 'brandId', type: 'number' })
  async getModelsByBrand(
    @Param('brandId', ParseIntPipe) brandId: number,
    @Query() options: PaginationOptions,
  ) {
    return await this.vehicleService.getModelsByBrand(brandId, options);
  }

  /**
   * 🔧 Types par modèle
   */
  @Get('models/:modelId/types')
  @ApiOperation({ summary: '🔧 Types par modèle' })
  @ApiParam({ name: 'modelId', type: 'number' })
  async getTypesByModel(
    @Param('modelId', ParseIntPipe) modelId: number,
    @Query() options: PaginationOptions,
  ) {
    return await this.vehicleService.getTypesByModel(modelId, options);
  }

  /**
   * 📅 Années par marque
   */
  @Get('brands/:brandId/years')
  @ApiOperation({ summary: '📅 Années de production par marque' })
  @ApiParam({ name: 'brandId', type: 'number' })
  async getYearsByBrand(
    @Param('brandId', ParseIntPipe) brandId: number,
    @Query() options: PaginationOptions,
  ) {
    return await this.vehicleService.getYearsByBrand(brandId, options);
  }

  /**
   * 🔍 Suggestions autocomplete
   */
  @Get('suggestions/:type')
  @ApiOperation({ summary: '🔍 Suggestions autocomplete' })
  @ApiParam({ name: 'type', enum: ['marque', 'modele', 'type'] })
  @ApiQuery({ name: 'q', description: 'Query string' })
  @ApiQuery({ name: 'limit', required: false, type: 'number', example: 10 })
  async getSuggestions(
    @Param('type') type: 'marque' | 'modele' | 'type',
    @Query('q') query: string,
    @Query('limit') limit: number = 10,
  ) {
    try {
      const suggestions = await this.vehicleService.getSuggestions(query, type, limit);
      return {
        statusCode: HttpStatus.OK,
        data: suggestions,
        total: suggestions.length
      };
    } catch (error) {
      this.logger.error(`Erreur getSuggestions ${type}:`, error);
      throw error;
    }
  }

  // =====================================================
  // 📊 ENDPOINTS DE MONITORING ET STATS
  // =====================================================

  /**
   * 📊 Statistiques globales
   */
  @Get('stats')
  @ApiOperation({ summary: '📊 Statistiques globales du système véhicules' })
  @ApiResponse({ status: 200, description: 'Statistiques complètes' })
  async getGlobalStats() {
    try {
      return await this.vehicleService.getGlobalStats();
    } catch (error) {
      this.logger.error('Erreur getGlobalStats:', error);
      throw error;
    }
  }

  /**
   * 🏆 Éléments populaires
   */
  @Get('popular')
  @ApiOperation({ summary: '🏆 Marques, modèles et moteurs populaires' })
  @ApiResponse({ status: 200, description: 'Top des éléments populaires' })
  async getPopularItems() {
    try {
      return await this.vehicleService.getPopularItems();
    } catch (error) {
      this.logger.error('Erreur getPopularItems:', error);
      throw error;
    }
  }

  /**
   * 🔍 Recherche globale
   */
  @Get('search/global')
  @ApiOperation({ summary: '🔍 Recherche globale multi-services' })
  @ApiQuery({ name: 'q', description: 'Query string' })
  @ApiQuery({ name: 'types', required: false, description: 'Types de recherche (comma-separated)' })
  @ApiQuery({ name: 'limit', required: false, type: 'number', example: 5 })
  async globalSearch(
    @Query('q') query: string,
    @Query('types') types?: string,
    @Query('limit') limit: number = 5,
  ) {
    try {
      const searchTypes = types ? types.split(',') as any[] : undefined;
      return await this.vehicleService.globalSearch(query, { searchTypes, limit });
    } catch (error) {
      this.logger.error('Erreur globalSearch:', error);
      throw error;
    }
  }

  /**
   * ❤️ Health check
   */
  @Get('health')
  @ApiOperation({ summary: '❤️ Vérification de la santé des services véhicules' })
  @ApiResponse({ status: 200, description: 'État de santé des services' })
  async healthCheck() {
    try {
      return await this.vehicleService.healthCheck();
    } catch (error) {
      this.logger.error('Erreur healthCheck:', error);
      throw error;
    }
  }

  /**
   * 📋 Résumé de l'architecture
   */
  @Get('architecture')
  @ApiOperation({ summary: '📋 Résumé de l\'architecture refactorisée' })
  @ApiResponse({ status: 200, description: 'Informations sur l\'architecture modulaire' })
  getArchitectureSummary() {
    return this.vehicleService.getArchitectureSummary();
  }
}