import {
  Controller,
  Post,
  Body,
  UseGuards,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InternalApiKeyGuard } from '../../../auth/internal-api-key.guard';
import { BuyingGuideEnricherService } from '../services/buying-guide-enricher.service';
import { BuyingGuideEnrichRequestSchema } from '../dto/buying-guide-enrich.dto';

/**
 * Internal endpoint for automated enrichment (cron jobs, scripts).
 * Protected by X-Internal-Key header instead of session auth.
 * NOT exposed through Caddy in prod (localhost only).
 */
@Controller('api/internal/buying-guides')
@UseGuards(InternalApiKeyGuard)
export class InternalEnrichController {
  private readonly logger = new Logger(InternalEnrichController.name);

  constructor(private readonly enricherService: BuyingGuideEnricherService) {}

  @Post('enrich')
  async enrich(@Body() body: unknown) {
    const parsed = BuyingGuideEnrichRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }

    const { pgIds, dryRun } = parsed.data;

    this.logger.log(
      `[Internal] Enrich request: pgIds=[${pgIds.join(',')}] dryRun=${dryRun}`,
    );

    const results = await this.enricherService.enrich(pgIds, dryRun);

    return { results };
  }
}
