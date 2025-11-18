/**
 * 🏷️ BRANDS CONTROLLER
 * 
 * API REST pour les marques automobiles et leurs modèles
 * Routes: /api/brands/*
 * 
 * Utilise VehicleBrandsService et VehicleModelsService
 * Tables: auto_marque, auto_modele
 */

import {
  Controller,
  Get,
  Param,
  Query,
  Logger,
  ParseIntPipe,
} from '@nestjs/common';
import { VehicleBrandsService } from './services/data/vehicle-brands.service';
import { VehicleModelsService } from './services/data/vehicle-models.service';

@Controller('api/brands')
export class BrandsController {
  private readonly logger = new Logger(BrandsController.name);

  constructor(
    private readonly brandsService: VehicleBrandsService,
    private readonly modelsService: VehicleModelsService,
  ) {
    this.logger.log('✅ BrandsController initialisé - Routes /api/brands/* actives');
  }

  /**
   * GET /api/brands
   * Retourne toutes les marques avec recherche optionnelle
   */
  @Get()
  async getAllBrands(@Query('search') search?: string) {
    return this.brandsService.getBrands({ search, limit: 200 });
  }

  /**
   * GET /api/brands/brands-logos
   * Retourne marques avec logos
   */
  @Get('brands-logos')
  async getBrandsLogos(@Query('limit', ParseIntPipe) limit: number = 50) {
    const result = await this.brandsService.getBrands({ limit });

    return {
      success: true,
      data: result.data || [],
      total: result.total,
    };
  }

  /**
   * GET /api/brands/popular-models
   * Retourne modèles populaires
   */
  @Get('popular-models')
  async getPopularModels(@Query('limit', ParseIntPipe) limit: number = 12) {
    const result = await this.modelsService.getModels({ limit });

    return {
      success: true,
      data: result.data || [],
      total: result.total,
    };
  }

  /**
   * GET /api/brands/brand/:brand
   * Retourne info marque par slug
   */
  @Get('brand/:brand')
  async getBrandBySlug(@Param('brand') brandSlug: string) {
    const result = await this.brandsService.getBrands({
      search: brandSlug,
      limit: 1,
    });

    if (!result.data || result.data.length === 0) {
      return {
        success: false,
        message: `Marque "${brandSlug}" introuvable`,
      };
    }

    return {
      success: true,
      data: result.data[0],
    };
  }

  /**
   * GET /api/brands/brand/:brand/model/:model
   * Retourne modèle spécifique d'une marque
   */
  @Get('brand/:brand/model/:model')
  async getModelByBrandAndSlug(
    @Param('brand') brandSlug: string,
    @Param('model') modelSlug: string,
  ) {
    // 1. Trouver marque
    const brandResult = await this.brandsService.getBrands({
      search: brandSlug,
      limit: 1,
    });

    if (!brandResult.data || brandResult.data.length === 0) {
      return {
        success: false,
        message: `Marque "${brandSlug}" introuvable`,
      };
    }

    const brand: any = brandResult.data[0];

    // 2. Trouver modèle (utilise marque_id de la DB)
    const modelResult = await this.modelsService.getModelsByBrand(
      brand.marque_id || brand.id,
      {
        search: modelSlug,
        limit: 1,
      },
    );

    if (!modelResult.data || modelResult.data.length === 0) {
      return {
        success: false,
        message: `Modèle "${modelSlug}" introuvable pour "${brandSlug}"`,
      };
    }

    return {
      success: true,
      data: {
        brand: brand,
        model: modelResult.data[0],
      },
    };
  }

  /**
   * GET /api/brands/page-metadata/:page
   * Métadonnées SEO pour pages constructeurs
   */
  @Get('page-metadata/:page')
  async getPageMetadata(@Param('page') page: string) {
    return {
      success: true,
      data: {
        page,
        title: `Pièces auto par ${page}`,
        description: `Trouvez les meilleures pièces automobiles`,
        keywords: 'pièces auto, constructeurs, marques',
      },
    };
  }
}
