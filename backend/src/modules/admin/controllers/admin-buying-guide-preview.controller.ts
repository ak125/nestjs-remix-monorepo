import {
  Controller,
  Get,
  Param,
  UseGuards,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../../../auth/authenticated.guard';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
import { BuyingGuideDataService } from '../../gamme-rest/services/buying-guide-data.service';

/**
 * Admin preview controller for buying guide prototyping.
 *
 * GET /api/admin/buying-guide/preview/:pgId
 *
 * Returns enriched guide (bypass provenance gate) + fallback side-by-side
 * for visual comparison before production activation.
 */
@Controller('api/admin/buying-guide')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class AdminBuyingGuidePreviewController {
  private readonly logger = new Logger(AdminBuyingGuidePreviewController.name);

  constructor(private readonly buyingGuideService: BuyingGuideDataService) {}

  @Get('preview/:pgId')
  async preview(@Param('pgId') pgId: string) {
    this.logger.log(`Preview buying guide for pgId=${pgId}`);

    // 1. Enriched guide (bypass provenance gate)
    const enriched = await this.buyingGuideService.getEnrichedGuideRaw(pgId);

    // 2. Fallback guide for comparison
    const fallback = this.buyingGuideService.buildAutoBuyingGuideV1({
      pgId,
      pgName: null,
      familyName: null,
    });

    if (!enriched && !fallback) {
      throw new NotFoundException(
        `No buying guide data found for pgId=${pgId}`,
      );
    }

    return {
      pgId,
      enriched: enriched || null,
      fallback: fallback || null,
      comparison: {
        enrichedAvailable: !!enriched,
        fallbackAvailable: !!fallback,
        enrichedQuality: enriched?.quality || null,
        fallbackQuality: fallback?.quality || null,
        enrichedSectionSources: enriched?.sectionSources || null,
        delta: enriched
          ? {
              selectionCriteria:
                (enriched.selectionCriteria?.length || 0) -
                (fallback?.selectionCriteria?.length || 0),
              antiMistakes:
                (enriched.antiMistakes?.length || 0) -
                (fallback?.antiMistakes?.length || 0),
              faq: (enriched.faq?.length || 0) - (fallback?.faq?.length || 0),
              symptoms:
                (enriched.symptoms?.length || 0) -
                (fallback?.symptoms?.length || 0),
              decisionTree:
                (enriched.decisionTree?.length || 0) -
                (fallback?.decisionTree?.length || 0),
              useCases:
                (enriched.useCases?.length || 0) -
                (fallback?.useCases?.length || 0),
            }
          : null,
      },
    };
  }
}
