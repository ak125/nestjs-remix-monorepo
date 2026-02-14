import {
  Controller,
  Post,
  Body,
  UseGuards,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../../../auth/authenticated.guard';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
import { BuyingGuideEnricherService } from '../services/buying-guide-enricher.service';
import { BuyingGuideEnrichRequestSchema } from '../dto/buying-guide-enrich.dto';

@Controller('api/admin/buying-guides')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class AdminBuyingGuideController {
  private readonly logger = new Logger(AdminBuyingGuideController.name);

  constructor(private readonly enricherService: BuyingGuideEnricherService) {}

  /**
   * POST /api/admin/buying-guides/enrich
   * Enrich buying guides using RAG-sourced professional content.
   *
   * dryRun=true (default) → preview with quality gates
   * dryRun=false → write to DB
   */
  @Post('enrich')
  async enrich(@Body() body: unknown) {
    const parsed = BuyingGuideEnrichRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }

    const { pgIds, dryRun } = parsed.data;

    this.logger.log(
      `Enrich request: pgIds=[${pgIds.join(',')}] dryRun=${dryRun}`,
    );

    const results = await this.enricherService.enrich(pgIds, dryRun);

    return { results };
  }
}
