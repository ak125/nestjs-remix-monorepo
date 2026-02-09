import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  Res,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { VehiclesService } from './vehicles.service';
import { VehiclePaginationDto } from './dto/vehicles.dto';
import { VehicleBrandsService } from './services/data/vehicle-brands.service';
import { VehicleModelsService } from './services/data/vehicle-models.service';
import { VehicleTypesService } from './services/data/vehicle-types.service';
import { VehicleSearchService } from './services/search/vehicle-search.service';
import { VehicleMineService } from './services/search/vehicle-mine.service';
import { VehicleMetaService } from './services/vehicle-meta.service';
import { PopularGammesService } from '../catalog/services/popular-gammes.service';
import { VehicleRpcService } from './services/vehicle-rpc.service';
import { BrandBestsellersService } from './services/brand-bestsellers.service';
import { VehicleMotorCodesService } from './services/vehicle-motor-codes.service';
import { VehicleProfileService } from './services/vehicle-profile.service';

// ✅ VEHICLES CONTROLLER PRINCIPAL - Pour sélecteur véhicule
// Routes: /api/vehicles
@Controller('api/vehicles')
export class VehiclesController {
  private readonly logger = new Logger(VehiclesController.name);

  constructor(
    private readonly vehiclesService: VehiclesService,
    private readonly vehicleBrandsService: VehicleBrandsService,
    private readonly vehicleModelsService: VehicleModelsService,
    private readonly vehicleTypesService: VehicleTypesService,
    private readonly vehicleSearchService: VehicleSearchService,
    private readonly vehicleMineService: VehicleMineService,
    private readonly vehicleMetaService: VehicleMetaService,
    private readonly popularGammesService: PopularGammesService,
    private readonly vehicleRpcService: VehicleRpcService,
    private readonly brandBestsellersService: BrandBestsellersService,
    private readonly vehicleMotorCodesService: VehicleMotorCodesService,
    private readonly vehicleProfileService: VehicleProfileService,
  ) {}

  /**
   * Transformer les query params string en VehiclePaginationDto
   */
  private parseQueryParams(
    query: Record<string, string>,
  ): VehiclePaginationDto {
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
  async getAllBrands(@Query() query: Record<string, string>) {
    const params = this.parseQueryParams(query);
    return this.vehicleBrandsService.getBrands(params);
  }

  @Get('brands/:brandId')
  async getBrandById(@Param('brandId') brandId: string) {
    return this.vehicleBrandsService.getBrandById(parseInt(brandId, 10));
  }

  @Get('brands/:brandId/models')
  async getModelsByBrand(
    @Param('brandId') brandId: string,
    @Query() query: Record<string, string>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const params = this.parseQueryParams(query);
    params.brandId = brandId;

    // 🔍 Header pour traçabilité du cache (debugging)
    res.setHeader('X-Cache-Source', 'vehicleModelsService.getModelsByBrand');
    res.setHeader('X-Filter-Year', query.year || 'none');

    return this.vehicleModelsService.getModelsByBrand(
      parseInt(brandId, 10),
      params,
    );
  }

  @Get('brands/:brandId/years')
  async getYearsByBrand(
    @Param('brandId') brandId: string,
    @Query() query: Record<string, string>,
  ) {
    const params = this.parseQueryParams(query);
    params.brandId = brandId;
    return this.vehicleBrandsService.getYearsByBrand(
      parseInt(brandId, 10),
      params,
    );
  }

  @Get('models/:modelId/types')
  async getTypesByModel(
    @Param('modelId') modelId: string,
    @Query() query: Record<string, string>,
  ) {
    const params = this.parseQueryParams(query);
    params.modelId = modelId;

    // 🔧 Support du filtrage par année
    if (query.year) {
      params.year = parseInt(query.year);
    }

    return this.vehicleTypesService.getTypesByModel(parseInt(modelId, 10), {
      ...params,
      includeEngine: true,
    });
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
    // Use VehiclesService for now - searchAdvanced has different signature in VehicleSearchService
    return this.vehiclesService.searchAdvanced(searchTerm, limit || 20);
  }

  @Get('search/mine/:code')
  async searchByMineCode(@Param('code') mineCode: string) {
    return this.vehicleMineService.searchByMineCode(mineCode);
  }

  @Get('search/cnit/:code')
  async searchByCnit(@Param('code') cnitCode: string) {
    return this.vehicleSearchService.searchByCnit(cnitCode);
  }

  @Get('types/:typeId')
  async getVehicleType(@Param('typeId') typeId: string) {
    return this.vehicleTypesService.getTypeById(parseInt(typeId, 10), true);
  }

  @Get('mines/model/:id')
  async getMinesByModel(@Param('id') modelId: string) {
    return this.vehicleMineService.getMinesByModel(parseInt(modelId, 10));
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
    return this.vehicleMetaService.getMetaTagsByTypeId(parseInt(typeId, 10));
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

    return this.brandBestsellersService.getBrandBestsellers(
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
        this.popularGammesService.getPopularGammesForMaillage(limitGammesNum),
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

  // ====================================
  // 🔧 NOUVELLES ROUTES - Codes Moteur & Types Mines
  // ====================================

  /**
   * GET /api/vehicles/top-brands
   * 🏠 Récupère les marques populaires pour la homepage (marque_top = 1)
   */
  @Get('top-brands')
  async getTopBrands(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    this.logger.log(`🏠 GET /api/vehicles/top-brands?limit=${limitNum}`);
    return this.vehiclesService.getTopBrands(limitNum);
  }

  /**
   * GET /api/vehicles/search/motor-code/:code
   * 🔍 Recherche de véhicules par code moteur (ex: K9K, M9R, CAGA)
   */
  @Get('search/motor-code/:code')
  async searchByMotorCode(
    @Param('code') motorCode: string,
    @Query('exact') exact?: string,
  ) {
    const isExact = exact === 'true' || exact === '1';
    this.logger.log(
      `🔍 GET /api/vehicles/search/motor-code/${motorCode}?exact=${isExact}`,
    );
    return this.vehicleMotorCodesService.searchByMotorCode(motorCode, isExact);
  }

  /**
   * GET /api/vehicles/types/:typeId/motor-codes
   * 🔧 Récupère tous les codes moteur d'un type de véhicule
   */
  @Get('types/:typeId/motor-codes')
  async getMotorCodesByTypeId(@Param('typeId') typeId: string) {
    const typeIdNum = parseInt(typeId, 10);
    this.logger.log(`🔧 GET /api/vehicles/types/${typeIdNum}/motor-codes`);
    return this.vehicleMotorCodesService.getMotorCodesByTypeId(typeIdNum);
  }

  /**
   * GET /api/vehicles/types/:typeId/mine-codes
   * 🔧 Récupère tous les types mines et CNIT d'un type de véhicule
   */
  @Get('types/:typeId/mine-codes')
  async getMineCodesByTypeId(@Param('typeId') typeId: string) {
    const typeIdNum = parseInt(typeId, 10);
    this.logger.log(`🔧 GET /api/vehicles/types/${typeIdNum}/mine-codes`);
    return this.vehicleMotorCodesService.getMineCodesByTypeId(typeIdNum);
  }

  /**
   * GET /api/vehicles/types/:typeId/full
   * 🚗 Récupère TOUTES les données d'un véhicule
   * (marque + modèle + type + codes moteur + types mines + formatage)
   */
  @Get('types/:typeId/full')
  async getVehicleFullDetails(@Param('typeId') typeId: string) {
    const typeIdNum = parseInt(typeId, 10);
    this.logger.log(`🚗 GET /api/vehicles/types/${typeIdNum}/full`);
    return this.vehicleProfileService.getVehicleFullDetails(typeIdNum);
  }

  // ========================================
  // 🚀 RPC OPTIMISÉ - Endpoints pour LCP
  // ========================================

  /**
   * GET /api/vehicles/types/:typeId/page-data-rpc
   * ⚡ Récupère TOUTES les données d'une page véhicule en 1 seule requête RPC
   * Remplace 4 appels API séquentiels (800-1600ms → ~75ms)
   * Utilisé par le loader frontend /constructeurs/.../type.html
   */
  @Get('types/:typeId/page-data-rpc')
  async getVehiclePageDataRpc(@Param('typeId') typeId: string) {
    const typeIdNum = parseInt(typeId, 10);
    this.logger.log(`⚡ GET /api/vehicles/types/${typeIdNum}/page-data-rpc`);

    try {
      const result =
        await this.vehicleRpcService.getVehiclePageDataOptimized(typeIdNum);

      return {
        success: true,
        data: result,
        _performance: result._performance,
      };
    } catch (error) {
      this.logger.error(
        `❌ RPC Error for type ${typeIdNum}:`,
        error instanceof Error ? error.message : error,
      );

      // Pas de fallback - erreur 500
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        type_id: typeIdNum,
      };
    }
  }

  /**
   * POST /api/vehicles/cache/warm
   * 🔥 Préchauffe le cache pour les véhicules populaires
   */
  @Post('cache/warm')
  async warmVehicleCache(@Body() body: { typeIds?: number[] }) {
    // Véhicules populaires par défaut (à enrichir via analytics)
    const defaultPopularVehicles = [17173, 22547, 15432, 25896, 18765];
    const typeIds = body.typeIds || defaultPopularVehicles;

    this.logger.log(`🔥 Warm cache pour ${typeIds.length} véhicules`);

    const result = await this.vehicleRpcService.warmCache(typeIds);
    return { status: 200, ...result };
  }

  /**
   * POST /api/vehicles/types/:typeId/cache/invalidate
   * 🗑️ Invalide le cache d'un véhicule spécifique
   */
  @Post('types/:typeId/cache/invalidate')
  async invalidateVehicleCache(@Param('typeId') typeId: string) {
    const typeIdNum = parseInt(typeId, 10);
    await this.vehicleRpcService.invalidateCache(typeIdNum);
    return { status: 200, message: `Cache invalidé pour vehicle ${typeIdNum}` };
  }
}
