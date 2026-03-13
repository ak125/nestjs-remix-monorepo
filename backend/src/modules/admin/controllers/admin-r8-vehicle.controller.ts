import {
  Controller,
  Post,
  Param,
  UseGuards,
  Logger,
  BadRequestException,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../../../auth/authenticated.guard';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
import { R8VehicleEnricherService } from '../services/r8-vehicle-enricher.service';

@Controller('api/admin/r8')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class AdminR8VehicleController {
  private readonly logger = new Logger(AdminR8VehicleController.name);

  constructor(private readonly r8Enricher: R8VehicleEnricherService) {}

  /**
   * POST /api/admin/r8/enrich/:typeId
   * Enrich a single R8 vehicle page using RAG + diversity scoring.
   * Returns seoDecision, diversityScore, warnings, reasons.
   */
  @Post('enrich/:typeId')
  async enrichSingle(@Param('typeId', ParseIntPipe) typeId: number) {
    if (typeId <= 0) {
      throw new BadRequestException('typeId must be a positive integer');
    }

    this.logger.log(`R8 enrich request: typeId=${typeId}`);

    const result = await this.r8Enricher.enrichSingle(typeId);

    this.logger.log(
      `R8 enrich done: typeId=${typeId} decision=${result.seoDecision} score=${result.diversityScore}`,
    );

    return { result };
  }
}
