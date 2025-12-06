import { Controller, Get, Query, Param, Res, Logger } from '@nestjs/common';
import { Response } from 'express';
import { VehiclesService } from './vehicles.service';
import { VehiclePaginationDto } from './dto/vehicles.dto';
import { VehicleBrandsService } from './services/data/vehicle-brands.service';
import { CatalogGammeService } from '../catalog/services/catalog-gamme.service';

// ✅ VEHICLES CONTROLLER PRINCIPAL - Pour sélecteur véhicule
// Routes: /api/vehicles
@Controller('api/vehicles')
export class VehiclesController {
  private readonly logger = new Logger(VehiclesController.name);

  constructor(
    private readonly vehiclesService: VehiclesService,
    private readonly vehicleBrandsService: VehicleBrandsService,
    private readonly catalogGammeService: CatalogGammeService,
  ) {}

  /**
   * Transformer les query params string en VehiclePaginationDto
   */
  private parseQueryParams(query: any): VehiclePaginationDto {
    return {
      search: query.search || undefined,
      brandId: query.brandId || undefined,
      modelId: query.modelId || undefined,
      typeId: query.typeId || undefined,
      year: query.year ? parseInt(query.year, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      page: query.page ? parseInt(query.page, 10) : undefined,
    };
  }

  @Get('brands')
  async getAllBrands(@Query() query: any) {
    const params = this.parseQueryParams(query);
    return this.vehiclesService.findAll(params);
  }

  @Get('brands/:brandId')
  async getBrandById(@Param('brandId') brandId: string) {
    return this.vehiclesService.getBrandById(brandId);
  }

  @Get('brands/:brandId/models')
  async getModelsByBrand(
    @Param('brandId') brandId: string,
    @Query() query: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const params = this.parseQueryParams(query);
    params.brandId = brandId;

    // 🔍 Header pour traçabilité du cache (debugging)
    res.setHeader('X-Cache-Source', 'vehicles.service.findModelsByBrand');
    res.setHeader('X-Filter-Year', query.year || 'none');

    return this.vehiclesService.findModelsByBrand(brandId, params);
  }

  @Get('brands/:brandId/years')
  async getYearsByBrand(
    @Param('brandId') brandId: string,
    @Query() query: any,
  ) {
    const params = this.parseQueryParams(query);
    params.brandId = brandId;
    return this.vehiclesService.findYearsByBrand(brandId, params);
  }

  @Get('models/:modelId/types')
  async getTypesByModel(
    @Param('modelId') modelId: string,
    @Query() query: any,
  ) {
    const params = this.parseQueryParams(query);
    params.modelId = modelId;

    // 🔧 Support du filtrage par année
    if (query.year) {
      params.year = parseInt(query.year);
    }

    return this.vehiclesService.findTypesByModel(modelId, params);
  }

  @Get('stats')
  async getStats() {
    return this.vehiclesService.getVehicleStats();
  }

  @Get('search/advanced')
  async searchAdvanced(
    @Query('q') searchTerm: string,
    @Query('limit') limit?: number,
  ) {
    if (!searchTerm) {
      return { brands: [], models: [], types: [], total: 0, searchTerm: '' };
    }
    return this.vehiclesService.searchAdvanced(searchTerm, limit || 20);
  }

  @Get('search/mine/:code')
  async searchByMineCode(@Param('code') mineCode: string) {
    return this.vehiclesService.searchByMineCode(mineCode);
  }

  @Get('search/cnit/:code')
  async searchByCnit(@Param('code') cnitCode: string) {
    return this.vehiclesService.searchByCnit(cnitCode);
  }

  @Get('types/:typeId')
  async getVehicleType(@Param('typeId') typeId: string) {
    return this.vehiclesService.getTypeById(parseInt(typeId));
  }

  @Get('mines/model/:id')
  async getMinesByModel(@Param('id') modelId: string) {
    return this.vehiclesService.getMinesByModel(modelId);
  }

  @Get('test-mines')
  async testMinesCodes() {
    try {
      const client = this.vehiclesService['client'];
      const { data, error } = await client
        .from('auto_type_number_code')
        .select('tnc_code, tnc_cnit, tnc_type_id')
        .not('tnc_code', 'is', null)
        .limit(10);

      return {
        data: data || [],
        total: data?.length || 0,
        error: error ? String(error) : null,
      };
    } catch (error) {
      return {
        data: [],
        total: 0,
        error: 'Erreur lors de la récupération des codes: ' + String(error),
      };
    }
  }

  @Get('meta-tags/:typeId')
  async getMetaTagsByTypeId(@Param('typeId') typeId: string) {
    return this.vehiclesService.getMetaTagsByTypeId(parseInt(typeId));
  }

  /**
   * GET /api/vehicles/brand/:brandAlias/bestsellers
   * 🆕 Récupérer les véhicules et pièces populaires d'une marque
   * Utilise RPC get_brand_bestsellers_optimized
   */
  @Get('brand/:brandAlias/bestsellers')
  async getBrandBestsellers(
    @Param('brandAlias') brandAlias: string,
    @Query('limitVehicles') limitVehicles?: string,
    @Query('limitParts') limitParts?: string,
  ) {
    this.logger.log(
      `GET /api/vehicles/brand/${brandAlias}/bestsellers?limitVehicles=${limitVehicles || 12}&limitParts=${limitParts || 12}`,
    );

    const limitVehiclesNum = limitVehicles ? parseInt(limitVehicles, 10) : 12;
    const limitPartsNum = limitParts ? parseInt(limitParts, 10) : 12;

    return this.vehiclesService.getBrandBestsellers(
      brandAlias,
      limitVehiclesNum,
      limitPartsNum,
    );
  }

  /**
   * GET /api/vehicles/brand/:brandId/maillage
   * 🔗 Récupérer les données de maillage interne pour une marque
   * - Marques similaires (même pays d'origine ou populaires)
   * - Gammes populaires pour liens croisés
   */
  @Get('brand/:brandId/maillage')
  async getBrandMaillageData(
    @Param('brandId') brandId: string,
    @Query('limitBrands') limitBrands?: string,
    @Query('limitGammes') limitGammes?: string,
  ) {
    const brandIdNum = parseInt(brandId, 10);
    const limitBrandsNum = limitBrands ? parseInt(limitBrands, 10) : 6;
    const limitGammesNum = limitGammes ? parseInt(limitGammes, 10) : 8;

    this.logger.log(
      `🔗 GET /api/vehicles/brand/${brandIdNum}/maillage - Récupération données maillage SEO`,
    );

    try {
      // Récupération parallèle des données de maillage
      const [relatedBrands, popularGammes] = await Promise.all([
        this.vehicleBrandsService.getRelatedBrands(brandIdNum, limitBrandsNum),
        this.catalogGammeService.getPopularGammesForMaillage(limitGammesNum),
      ]);

      this.logger.log(
        `✅ Maillage récupéré: ${relatedBrands.length} marques, ${popularGammes.data.length} gammes`,
      );

      return {
        success: true,
        data: {
          related_brands: relatedBrands,
          popular_gammes: popularGammes.data,
        },
        meta: {
          brand_id: brandIdNum,
          total_related_brands: relatedBrands.length,
          total_popular_gammes: popularGammes.data.length,
          generated_at: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error('❌ Erreur getBrandMaillageData:', error);
      return {
        success: false,
        data: {
          related_brands: [],
          popular_gammes: [],
        },
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }
}
