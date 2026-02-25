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
import { QualityScoringEngineService } from '../services/quality-scoring-engine.service';
import { GammeAggregatorService } from '../services/gamme-aggregator.service';
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

  constructor(
    private readonly enricherService: BuyingGuideEnricherService,
    private readonly qualityScoringEngine: QualityScoringEngineService,
    private readonly gammeAggregator: GammeAggregatorService,
  ) {}

  /**
   * POST /api/internal/buying-guides/compute-quality-scores
   * Trigger batch quality score computation (API key auth).
   */
  @Post('compute-quality-scores')
  async computeQualityScores() {
    this.logger.log('[Internal] Quality score computation triggered');
    const pageResult = await this.qualityScoringEngine.computeAllScores();
    const gammesAggregated = await this.gammeAggregator.aggregateAll();
    this.logger.log(
      `[Internal] Quality scores computed: ${pageResult.pagesScored} pages, ${pageResult.gammesScored} gammes, ${gammesAggregated} aggregated`,
    );
    return {
      pagesScored: pageResult.pagesScored,
      gammesScored: pageResult.gammesScored,
      gammesAggregated,
    };
  }

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
