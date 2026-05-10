import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  Logger,
  BadRequestException,
  NotFoundException,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { R7BrandEnricherService } from '../services/r7-brand-enricher.service';
import {
  BrandEditorialService,
  BrandEditorialPayloadSchema,
  type BrandEditorialPayload,
} from '../services/brand-editorial.service';

@Controller('api/admin/r7')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class AdminR7BrandController {
  private readonly logger = new Logger(AdminR7BrandController.name);

  constructor(
    private readonly r7Enricher: R7BrandEnricherService,
    private readonly editorial: BrandEditorialService,
  ) {}

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

  // ── Editorial content CRUD (FAQ / issues / maintenance) ──

  /**
   * GET /api/admin/r7/editorial/:marqueId
   * Returns curated editorial content for a brand (null if not yet curated).
   */
  @Get('editorial/:marqueId')
  async getEditorial(@Param('marqueId', ParseIntPipe) marqueId: number) {
    if (marqueId <= 0) {
      throw new BadRequestException('marqueId must be a positive integer');
    }
    const row = await this.editorial.findOne(marqueId);
    if (!row) {
      throw new NotFoundException(
        `No editorial content for marque_id=${marqueId}`,
      );
    }
    return { editorial: row };
  }

  /**
   * PUT /api/admin/r7/editorial/:marqueId
   * Upsert editorial content + déclenche automatiquement enrichSingle pour
   * régénérer la page R7 en DB. 1 clic = contenu publié.
   *
   * Body validé contre BrandEditorialPayloadSchema.
   * Query param ?skipEnrich=true pour batch imports (skip auto-enrich).
   */
  @Put('editorial/:marqueId')
  async upsertEditorial(
    @Param('marqueId', ParseIntPipe) marqueId: number,
    @Body() body: BrandEditorialPayload,
    @Query('skipEnrich') skipEnrich?: string,
  ) {
    if (marqueId <= 0) {
      throw new BadRequestException('marqueId must be a positive integer');
    }
    const parsed = BrandEditorialPayloadSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid editorial payload',
        issues: parsed.error.issues,
      });
    }
    const row = await this.editorial.upsert(marqueId, parsed.data);
    this.logger.log(
      `Editorial upsert: marque_id=${marqueId} faq=${row.faq.length} issues=${row.common_issues.length} maintenance=${row.maintenance_tips.length}`,
    );

    // Auto-trigger enrichment sauf si explicitement désactivé (batch imports)
    if (skipEnrich === 'true') {
      return { editorial: row, enrichment: { skipped: true } };
    }
    const enrich = await this.r7Enricher.enrichSingle(marqueId);
    this.logger.log(
      `Auto-enrich after editorial upsert: marque_id=${marqueId} decision=${enrich.seoDecision} score=${enrich.diversityScore}`,
    );
    return { editorial: row, enrichment: enrich };
  }
}
