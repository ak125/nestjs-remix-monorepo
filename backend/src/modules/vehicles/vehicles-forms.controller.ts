import { Controller, Get, Query } from '@nestjs/common';
import { VehiclesFormsService } from './vehicles-forms.service';
import { VehicleSearchDto, VehicleFilterDto } from './dto/vehicles.dto';

/**
 * 🚗 CONTROLLER VEHICLES FORMS - MEILLEURE APPROCHE
 * 
 * Controller optimisé pour les formulaires de recherche véhicules
 * Remplace les anciens endpoints _form.get.car.*.php
 */
@Controller('api/vehicles/forms')
export class VehiclesFormsController {
  constructor(private readonly vehiclesFormsService: VehiclesFormsService) {}

  @Get('models')
  async getAllModels(@Query() query: any) {
    const filter: VehicleFilterDto = {
      search: query.search,
      brandId: query.brandId ? parseInt(query.brandId) : undefined,
      limit: query.limit ? Math.min(parseInt(query.limit), 500) : 100,
      offset: query.offset ? parseInt(query.offset) : 0,
      onlyActive: query.onlyActive === 'true',
    };
    return this.vehiclesFormsService.getAllModels(filter);
  }

  @Get('types')
  async getAllTypes(@Query() query: any) {
    const filter: VehicleFilterDto = {
      search: query.search,
      modelId: query.modelId ? parseInt(query.modelId) : undefined,
      brandId: query.brandId ? parseInt(query.brandId) : undefined,
      limit: query.limit ? Math.min(parseInt(query.limit), 1000) : 200,
      offset: query.offset ? parseInt(query.offset) : 0,
      onlyActive: query.onlyActive === 'true',
    };
    return this.vehiclesFormsService.getAllTypes(filter);
  }

  @Get('years')
  async getAllYears(
    @Query('typeId') typeId?: string,
    @Query('startYear') startYear?: string,
    @Query('endYear') endYear?: string,
  ) {
    return this.vehiclesFormsService.getAllYears({
      typeId: typeId ? parseInt(typeId) : undefined,
      startYear: startYear ? parseInt(startYear) : undefined,
      endYear: endYear ? parseInt(endYear) : undefined,
    });
  }

  @Get('search')
  async searchVehicles(@Query() query: any) {
    const searchDto: VehicleSearchDto = {
      brandCode: query.brandCode,
      modelCode: query.modelCode,
      typeCode: query.typeCode,
      year: query.year ? parseInt(query.year) : undefined,
      engineCode: query.engineCode,
      fuelType: query.fuelType,
    };
    return this.vehiclesFormsService.searchVehicles(searchDto);
  }

  @Get('stats')
  async getStats() {
    return this.vehiclesFormsService.getVehicleStats();
  }

  @Get('fuels')
  async getAllFuels() {
    const types = await this.vehiclesFormsService.getAllTypes({ limit: 10000 });
    const fuels = [...new Set(types.map((type) => type.type_fuel).filter(Boolean))];
    
    return {
      fuels: fuels.sort(),
      total: fuels.length,
    };
  }
}
