import { Controller, Get, Query, Param } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { VehiclePaginationDto } from './dto/vehicles.dto';

// ✅ VEHICLES CONTROLLER PRINCIPAL - Pour sélecteur véhicule
// Routes: /api/vehicles
@Controller('api/vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

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

  @Get('brands/:brandId/models')
  async getModelsByBrand(
    @Param('brandId') brandId: string,
    @Query() query: any,
  ) {
    const params = this.parseQueryParams(query);
    params.brandId = brandId;
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
}
