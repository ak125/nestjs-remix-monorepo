/**
 * 🎮 CONTRÔLEUR CATÉGORIE
 * 
 * API REST pour récupérer les données des pages de catégorie
 */

import { Controller, Get, Param, Query, UseInterceptors, CacheInterceptor } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CategoryDataService } from '../services/category-data.service';
import { CategoryPageData, CategoryQueryParams, CategoryQuerySchema } from '../types/category-data.types';
import { ValidationPipe } from '../common/validation/validation.pipe';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';

@ApiTags('🗂️ Catégories')
@Controller('api/categories')
@UseInterceptors(CacheInterceptor) // Cache des réponses
export class CategoryController {
  
  constructor(
    private readonly categoryDataService: CategoryDataService
  ) {}

  /**
   * 🎯 ENDPOINT PRINCIPAL - Récupère toutes les données d'une page de catégorie
   */
  @Get(':slug/page-data')
  @ApiOperation({ 
    summary: 'Récupère les données complètes d\'une page de catégorie',
    description: 'Retourne toutes les informations nécessaires pour afficher une page de catégorie : infos de base, sélecteur véhicule, articles, motorisations populaires, etc.'
  })
  @ApiParam({ 
    name: 'slug', 
    description: 'Slug de la catégorie (ex: filtre-a-huile-7)',
    example: 'filtre-a-huile-7'
  })
  @ApiQuery({ 
    name: 'includeRelated', 
    required: false, 
    type: Boolean,
    description: 'Inclure les catégories liées et l\'article',
    example: true
  })
  @ApiQuery({ 
    name: 'includeMotorizations', 
    required: false, 
    type: Boolean,
    description: 'Inclure les motorisations populaires',
    example: true
  })
  @ApiQuery({ 
    name: 'includeEquipmentiers', 
    required: false, 
    type: Boolean,
    description: 'Inclure les équipementiers',
    example: true
  })
  @ApiQuery({ 
    name: 'includeTechnicalInfo', 
    required: false, 
    type: Boolean,
    description: 'Inclure les informations techniques',
    example: true
  })
  @ApiQuery({ 
    name: 'includeStats', 
    required: false, 
    type: Boolean,
    description: 'Inclure les statistiques de la catégorie',
    example: false
  })
  @ApiQuery({ 
    name: 'limit', 
    required: false, 
    type: Number,
    description: 'Nombre max de motorisations à retourner',
    example: 20
  })
  @ApiQuery({ 
    name: 'offset', 
    required: false, 
    type: Number,
    description: 'Décalage pour la pagination des motorisations',
    example: 0
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Données de la catégorie récupérées avec succès',
    type: 'object' // TODO: Ajouter le DTO Swagger quand disponible
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Catégorie non trouvée'
  })
  async getCategoryPageData(
    @Param('slug') slug: string,
    @Query(new ZodValidationPipe(CategoryQuerySchema.omit({ slug: true }))) 
    queryParams: Omit<CategoryQueryParams, 'slug'>
  ): Promise<CategoryPageData> {
    
    console.log(`🎯 Requête données catégorie: ${slug}`, queryParams);
    
    // Fusion du slug avec les paramètres de query
    const fullParams: CategoryQueryParams = {
      slug,
      ...queryParams
    };
    
    const data = await this.categoryDataService.getCategoryPageData(fullParams);
    
    console.log(`✅ Données récupérées pour ${data.category.name} - ${data.popularMotorizations.length} motorisations`);
    
    return data;
  }

  /**
   * 🔍 ENDPOINT RAPIDE - Récupère seulement les infos de base
   */
  @Get(':slug/basic')
  @ApiOperation({ 
    summary: 'Récupère uniquement les informations de base d\'une catégorie',
    description: 'Version allégée pour les aperçus et la navigation'
  })
  @ApiParam({ 
    name: 'slug', 
    description: 'Slug de la catégorie',
    example: 'filtre-a-huile-7'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Informations de base récupérées'
  })
  async getCategoryBasic(@Param('slug') slug: string) {
    const params: CategoryQueryParams = {
      slug,
      includeRelated: false,
      includeMotorizations: false,
      includeEquipementiers: false,
      includeTechnicalInfo: false,
      includeStats: false,
      limit: 0,
      offset: 0
    };
    
    const data = await this.categoryDataService.getCategoryPageData(params);
    
    return {
      category: data.category,
      vehicleSelector: data.vehicleSelector,
      seo: data.seo
    };
  }

  /**
   * 🚗 ENDPOINT VÉHICULES - Récupère seulement les données du sélecteur
   */
  @Get(':slug/vehicles')
  @ApiOperation({ 
    summary: 'Récupère les données du sélecteur de véhicules pour une catégorie',
    description: 'Retourne les marques et options disponibles pour le sélecteur'
  })
  @ApiParam({ 
    name: 'slug', 
    description: 'Slug de la catégorie',
    example: 'filtre-a-huile-7'
  })
  async getCategoryVehicles(@Param('slug') slug: string) {
    const params: CategoryQueryParams = {
      slug,
      includeRelated: false,
      includeMotorizations: false,
      includeEquipementiers: false,
      includeTechnicalInfo: false,
      includeStats: false,
      limit: 0,
      offset: 0
    };
    
    const data = await this.categoryDataService.getCategoryPageData(params);
    
    return {
      vehicleSelector: data.vehicleSelector,
      categoryName: data.category.name
    };
  }

  /**
   * 🔧 ENDPOINT MOTORISATIONS - Récupère seulement les motorisations populaires
   */
  @Get(':slug/motorizations')
  @ApiOperation({ 
    summary: 'Récupère les motorisations populaires pour une catégorie',
    description: 'Permet de paginer les motorisations pour l\'affichage dynamique'
  })
  @ApiParam({ 
    name: 'slug', 
    description: 'Slug de la catégorie',
    example: 'filtre-a-huile-7'
  })
  @ApiQuery({ 
    name: 'limit', 
    required: false, 
    type: Number,
    description: 'Nombre de motorisations à retourner',
    example: 10
  })
  @ApiQuery({ 
    name: 'offset', 
    required: false, 
    type: Number,
    description: 'Décalage pour la pagination',
    example: 0
  })
  async getCategoryMotorizations(
    @Param('slug') slug: string,
    @Query('limit') limit: number = 20,
    @Query('offset') offset: number = 0
  ) {
    const params: CategoryQueryParams = {
      slug,
      includeRelated: false,
      includeMotorizations: true,
      includeEquipementiers: false,
      includeTechnicalInfo: false,
      includeStats: false,
      limit,
      offset
    };
    
    const data = await this.categoryDataService.getCategoryPageData(params);
    
    return {
      motorizations: data.popularMotorizations,
      categoryName: data.category.name,
      pagination: {
        limit,
        offset,
        hasMore: data.popularMotorizations.length === limit // Simple check
      }
    };
  }

  /**
   * 📊 ENDPOINT STATISTIQUES - Récupère les stats d'une catégorie
   */
  @Get(':slug/stats')
  @ApiOperation({ 
    summary: 'Récupère les statistiques d\'une catégorie',
    description: 'Nombre de produits, marques, véhicules, prix moyen, etc.'
  })
  @ApiParam({ 
    name: 'slug', 
    description: 'Slug de la catégorie',
    example: 'filtre-a-huile-7'
  })
  async getCategoryStats(@Param('slug') slug: string) {
    const params: CategoryQueryParams = {
      slug,
      includeRelated: false,
      includeMotorizations: false,
      includeEquipementiers: false,
      includeTechnicalInfo: false,
      includeStats: true,
      limit: 0,
      offset: 0
    };
    
    const data = await this.categoryDataService.getCategoryPageData(params);
    
    return {
      stats: data.stats,
      categoryName: data.category.name,
      lastUpdated: new Date().toISOString()
    };
  }
}