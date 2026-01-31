import {
  Controller,
  Post,
  Body,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { VehicleTypeResolverService } from '../services/vehicle-type-resolver.service';
import {
  ResolveVehicleTypesDto,
  ResolveVehicleTypesResponse,
} from '../dto/vehicle-resolve.dto';
import { IsAdminGuard } from '../../../auth/is-admin.guard';

/**
 * Controller pour la résolution batch des types véhicule
 *
 * Endpoints:
 * - POST /api/admin/vehicles/types/resolve - Résoudre un batch de type_ids
 */
@Controller('api/admin/vehicles/types')
export class AdminVehicleTypesController {
  private readonly logger = new Logger(AdminVehicleTypesController.name);

  constructor(private readonly resolver: VehicleTypeResolverService) {}

  /**
   * POST /api/admin/vehicles/types/resolve
   *
   * Résoudre un batch de type_ids en informations véhicule enrichies
   *
   * @body type_ids - Array de type_ids à résoudre
   * @returns Map de type_id -> EnrichedVehicleType
   */
  @Post('resolve')
  @UseGuards(IsAdminGuard)
  @HttpCode(HttpStatus.OK)
  async resolveTypes(
    @Body() dto: ResolveVehicleTypesDto,
  ): Promise<ResolveVehicleTypesResponse> {
    this.logger.log(`Resolving ${dto.type_ids?.length || 0} type_ids`);

    if (!dto.type_ids || dto.type_ids.length === 0) {
      return {};
    }

    // Limiter à 500 IDs max pour éviter les abus
    const limitedIds = dto.type_ids.slice(0, 500);

    if (dto.type_ids.length > 500) {
      this.logger.warn(
        `Request limited from ${dto.type_ids.length} to 500 type_ids`,
      );
    }

    const result = await this.resolver.resolveTypeIds(limitedIds);

    this.logger.log(
      `Resolved ${Object.keys(result).length}/${limitedIds.length} type_ids`,
    );

    return result;
  }
}
