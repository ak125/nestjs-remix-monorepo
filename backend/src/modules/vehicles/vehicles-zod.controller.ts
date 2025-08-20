import { Controller, Get, Query, Param, UsePipes } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import {
  BrandQuerySchema,
  ModelQuerySchema,
  TypeQuerySchema,
  type BrandQueryDto,
  type ModelQueryDto,
  type TypeQueryDto,
} from './dto/vehicles-simple-zod.dto';
import { VehicleZodValidationPipe } from './pipes/vehicle-validation.pipe';

@Controller('api/vehicles-zod')
export class VehiclesZodController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get('brands')
  @UsePipes(new VehicleZodValidationPipe(BrandQuerySchema))
  async getAllBrands(@Query() query: BrandQueryDto) {
    return this.vehiclesService.findAll(query);
  }

  @Get('brands/:brandId/models')
  @UsePipes(new VehicleZodValidationPipe(ModelQuerySchema))
  async getModelsByBrand(
    @Param('brandId') brandId: string,
    @Query() query: ModelQueryDto,
  ) {
    return this.vehiclesService.findModelsByBrand(brandId, query);
  }

  @Get('models/:modelId/types')
  @UsePipes(new VehicleZodValidationPipe(TypeQuerySchema))
  async getTypesByModel(
    @Param('modelId') modelId: string,
    @Query() query: TypeQueryDto,
  ) {
    return this.vehiclesService.findTypesByModel(modelId, query);
  }

  @Get('stats')
  async getStats() {
    return this.vehiclesService.getStats();
  }

  @Get('search')
  async searchVehicles(@Query() query: BrandQueryDto) {
    const { search, limit } = query;
    return this.vehiclesService.findAll({ search, limit });
  }
}
