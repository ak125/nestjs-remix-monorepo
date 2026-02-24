import {
  Controller,
  Delete,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../../../auth/authenticated.guard';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
import { AdminResponseInterceptor } from '../../../common/interceptors/admin-response.interceptor';
import { ContentRefreshService } from '../services/content-refresh.service';
import { WebhookAuditService } from '../../rag-proxy/services/webhook-audit.service';
import {
  TriggerRefreshDto,
  RefreshStatusQueryDto,
  RejectRefreshDto,
} from '../dto/content-refresh.dto';

@Controller('api/admin/content-refresh')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
@UseInterceptors(AdminResponseInterceptor)
export class AdminContentRefreshController {
  constructor(
    private readonly contentRefreshService: ContentRefreshService,
    private readonly webhookAuditService: WebhookAuditService,
  ) {}

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
   * GET /api/admin/content-refresh/observe-stats?days=7
   * Observe-only impact stats: would_block counts grouped by role/gate.
   */
  @Get('observe-stats')
  async getObserveOnlyStats(@Query('days') daysParam?: string) {
    const days = daysParam
      ? Math.min(Math.max(parseInt(daysParam, 10) || 7, 1), 90)
      : 7;
    return this.contentRefreshService.getObserveOnlyStats(days);
  }

  /**
   * GET /api/admin/content-refresh/composite-scores?aliases=alias1,alias2
   * Get composite quality scores per gamme (aggregated across all page types).
   */
  @Get('composite-scores')
  async getCompositeScores(@Query('aliases') aliasesParam?: string) {
    const aliases = aliasesParam
      ? aliasesParam
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean)
      : undefined;
    return this.contentRefreshService.getCompositeScores(aliases);
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
      parsed.data.force,
    );
  }

  /**
   * PATCH /api/admin/content-refresh/:id/publish
   * Admin validates and publishes a draft.
   */
  @Patch(':id/publish')
  async publishRefresh(@Param('id') id: string, @Req() req: any) {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      throw new BadRequestException('Invalid ID');
    }
    const adminUser =
      req.user?.email?.trim() ||
      req.user?.cst_id?.toString() ||
      req.user?.id?.toString() ||
      'admin';
    return this.contentRefreshService.publishRefresh(numId, adminUser);
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

  // ── Webhook Audit Trail Endpoints ──

  /**
   * GET /api/admin/content-refresh/webhook-audit
   * Returns recent webhook calls with pagination.
   */
  @Get('webhook-audit')
  async getWebhookAudit(
    @Query('limit') limitParam?: string,
    @Query('offset') offsetParam?: string,
  ) {
    const limit = Math.min(parseInt(limitParam || '20', 10) || 20, 100);
    const offset = parseInt(offsetParam || '0', 10) || 0;
    return this.webhookAuditService.getRecentWebhooks(limit, offset);
  }

  /**
   * GET /api/admin/content-refresh/webhook-stats
   * Returns aggregated webhook KPIs for the last N days.
   */
  @Get('webhook-stats')
  async getWebhookStats(@Query('days') daysParam?: string) {
    const days = daysParam
      ? Math.min(Math.max(parseInt(daysParam, 10) || 7, 1), 90)
      : 7;
    return this.webhookAuditService.getWebhookStats(days);
  }

  /**
   * GET /api/admin/content-refresh/snapshot/:refreshLogId
   * Returns content fingerprint and quality data for a specific refresh log entry.
   */
  @Get('snapshot/:refreshLogId')
  async getSnapshot(@Param('refreshLogId') id: string) {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      throw new BadRequestException('Invalid refresh log ID');
    }
    return this.contentRefreshService.getRefreshSnapshot(numId);
  }
}
