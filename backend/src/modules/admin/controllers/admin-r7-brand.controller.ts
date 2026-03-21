import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  Logger,
  BadRequestException,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../../../auth/authenticated.guard';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
import { R7BrandEnricherService } from '../services/r7-brand-enricher.service';

@Controller('api/admin/r7')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class AdminR7BrandController {
  private readonly logger = new Logger(AdminR7BrandController.name);

  constructor(private readonly r7Enricher: R7BrandEnricherService) {}

  /**
   * POST /api/admin/r7/enrich/:marqueId
   * Enrich a single R7 brand page using RAG + diversity scoring.
   */
  @Post('enrich/:marqueId')
  async enrichSingle(@Param('marqueId', ParseIntPipe) marqueId: number) {
    if (marqueId <= 0) {
      throw new BadRequestException('marqueId must be a positive integer');
    }

    this.logger.log(`R7 enrich request: marqueId=${marqueId}`);

    const result = await this.r7Enricher.enrichSingle(marqueId);

    this.logger.log(
      `R7 enrich done: marqueId=${marqueId} decision=${result.seoDecision} score=${result.diversityScore}`,
    );

    return { result };
  }

  /**
   * POST /api/admin/r7/enrich-batch
   * Enrich multiple R7 brand pages.
   * Body: { marqueIds: number[] }
   */
  @Post('enrich-batch')
  async enrichBatch(@Body() body: { marqueIds: number[] }) {
    const { marqueIds } = body;
    if (!Array.isArray(marqueIds) || marqueIds.length === 0) {
      throw new BadRequestException('marqueIds must be a non-empty array');
    }
    if (marqueIds.length > 100) {
      throw new BadRequestException('Maximum 100 brands per batch');
    }

    this.logger.log(`R7 batch enrich request: ${marqueIds.length} brands`);

    const results = [];
    for (const marqueId of marqueIds) {
      const result = await this.r7Enricher.enrichSingle(marqueId);
      results.push(result);
    }

    const summary = {
      total: results.length,
      publish: results.filter((r) => r.seoDecision === 'PUBLISH').length,
      review: results.filter((r) => r.seoDecision === 'REVIEW_REQUIRED').length,
      regenerate: results.filter((r) => r.seoDecision === 'REGENERATE').length,
      reject: results.filter((r) => r.seoDecision === 'REJECT').length,
    };

    this.logger.log(
      `R7 batch done: ${summary.publish} PUBLISH, ${summary.review} REVIEW, ${summary.regenerate} REGENERATE, ${summary.reject} REJECT`,
    );

    return { summary, results };
  }
}
