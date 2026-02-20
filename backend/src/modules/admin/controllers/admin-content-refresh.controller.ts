import {
  Controller,
  Delete,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ContentRefreshService } from '../services/content-refresh.service';
import {
  TriggerRefreshDto,
  RefreshStatusQueryDto,
  RejectRefreshDto,
} from '../dto/content-refresh.dto';

@Controller('api/admin/content-refresh')
export class AdminContentRefreshController {
  constructor(private readonly contentRefreshService: ContentRefreshService) {}

  /**
   * GET /api/admin/content-refresh/dashboard
   * Returns counts by status + recent items.
   */
  @Get('dashboard')
  async getDashboard() {
    return this.contentRefreshService.getDashboard();
  }

  /**
   * GET /api/admin/content-refresh/status
   * List refresh log entries with optional filters.
   */
  @Get('status')
  async getStatus(@Query() rawQuery: Record<string, string>) {
    const parsed = RefreshStatusQueryDto.safeParse(rawQuery);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.contentRefreshService.getStatus({
      ...parsed.data,
      limit: parsed.data.limit ?? 50,
      offset: parsed.data.offset ?? 0,
    });
  }

  /**
   * GET /api/admin/content-refresh/qa-gate
   * Verify protected SEO fields (title/H1/canonical/meta) are unchanged vs baseline.
   * Returns GO if 0 mutations, BLOCK if any mutation detected.
   */
  @Get('qa-gate')
  async checkQaGate() {
    return this.contentRefreshService.checkProtectedFieldsGate();
  }

  /**
   * POST /api/admin/content-refresh/trigger
   * Manually trigger content refresh for one or more gammes.
   */
  @Post('trigger')
  async triggerRefresh(@Body() body: Record<string, unknown>) {
    const parsed = TriggerRefreshDto.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const { pgAlias, pgAliases } = parsed.data;
    const aliases = pgAliases || (pgAlias ? [pgAlias] : []);

    if (aliases.length === 0) {
      throw new BadRequestException('Provide pgAlias or pgAliases');
    }

    return this.contentRefreshService.triggerManualRefresh(
      aliases,
      parsed.data.supplementaryFiles,
    );
  }

  /**
   * PATCH /api/admin/content-refresh/:id/publish
   * Admin validates and publishes a draft.
   */
  @Patch(':id/publish')
  async publishRefresh(@Param('id') id: string) {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      throw new BadRequestException('Invalid ID');
    }
    return this.contentRefreshService.publishRefresh(
      numId,
      'admin', // TODO: extract from session
    );
  }

  /**
   * PATCH /api/admin/content-refresh/:id/reject
   * Admin rejects a draft with a reason.
   */
  @Patch(':id/reject')
  async rejectRefresh(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      throw new BadRequestException('Invalid ID');
    }

    const parsed = RejectRefreshDto.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    return this.contentRefreshService.rejectRefresh(numId, parsed.data.reason);
  }

  // ── SEO Gamme Draft Endpoints ──

  /**
   * GET /api/admin/content-refresh/seo-drafts
   * List all gammes with pending sg_descrip_draft or sg_content_draft.
   */
  @Get('seo-drafts')
  async listSeoDrafts() {
    return this.contentRefreshService.listSeoDrafts();
  }

  /**
   * GET /api/admin/content-refresh/seo-draft/:pgId
   * Preview current vs draft for a specific gamme.
   */
  @Get('seo-draft/:pgId')
  async getSeoDraft(@Param('pgId') pgId: string) {
    const result = await this.contentRefreshService.getSeoDraft(pgId);
    if (!result) {
      throw new NotFoundException(`Gamme not found for pgId=${pgId}`);
    }
    return result;
  }

  /**
   * PATCH /api/admin/content-refresh/seo-draft/:pgId/publish
   * Publish draft → live, re-baseline QA hash if sg_descrip changed.
   */
  @Patch('seo-draft/:pgId/publish')
  async publishSeoDraft(@Param('pgId') pgId: string) {
    const result = await this.contentRefreshService.publishSeoDraft(pgId);
    if (!result.published) {
      throw new BadRequestException(result.error);
    }
    return result;
  }

  /**
   * DELETE /api/admin/content-refresh/seo-draft/:pgId
   * Reject draft: clear draft columns without publishing.
   */
  @Delete('seo-draft/:pgId')
  async rejectSeoDraft(@Param('pgId') pgId: string) {
    const result = await this.contentRefreshService.rejectSeoDraft(pgId);
    if (!result.rejected) {
      throw new BadRequestException(result.error);
    }
    return result;
  }
}
