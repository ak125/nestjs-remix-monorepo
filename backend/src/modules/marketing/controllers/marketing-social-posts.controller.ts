import {
  Controller,
  Get,
  Post,
  Put,
  Query,
  Param,
  Body,
  UseGuards,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
import { MarketingHubDataService } from '../services/marketing-hub-data.service';
import { PublishQueueService } from '../services/publish-queue.service';
import { BrandComplianceGateService } from '../services/brand-compliance-gate.service';
import type {
  PostStatus,
  SocialChannel,
} from '../interfaces/marketing-hub.interfaces';

@Controller('api/admin/marketing/social')
@UseGuards(IsAdminGuard)
export class MarketingSocialPostsController {
  constructor(
    private readonly hubData: MarketingHubDataService,
    private readonly publishQueue: PublishQueueService,
    private readonly gateService: BrandComplianceGateService,
  ) {}

  /**
   * GET /api/admin/marketing/social/posts?week=2026-W09&status=gate_passed
   */
  @Get('posts')
  async getPosts(
    @Query('week') week: string,
    @Query('status') status?: string,
  ) {
    if (!week) return { error: 'week parameter required (e.g. 2026-W09)' };
    const posts = await this.hubData.getPostsByWeek(
      week,
      status as PostStatus | undefined,
    );
    return { data: posts, total: posts.length };
  }

  /**
   * PUT /api/admin/marketing/social/posts/:id/approve
   */
  @Put('posts/:id/approve')
  async approvePost(
    @Param('id') id: string,
    @Body('approved_by') approvedBy: string,
  ) {
    const ok = await this.publishQueue.approvePost(
      parseInt(id),
      approvedBy || 'admin',
    );
    return { success: ok };
  }

  /**
   * PUT /api/admin/marketing/social/posts/:id/reject
   */
  @Put('posts/:id/reject')
  async rejectPost(@Param('id') id: string) {
    const ok = await this.publishQueue.rejectPost(parseInt(id));
    return { success: ok };
  }

  /**
   * POST /api/admin/marketing/social/posts/bulk-approve
   */
  @Post('posts/bulk-approve')
  async bulkApprove(
    @Body('post_ids') postIds: number[],
    @Body('approved_by') approvedBy: string,
  ) {
    const result = await this.publishQueue.bulkApprove(
      postIds,
      approvedBy || 'admin',
    );
    return result;
  }

  /**
   * POST /api/admin/marketing/social/posts/:id/gate
   * Run brand + compliance gate on a single post.
   */
  @Post('posts/:id/gate')
  async runGate(@Param('id') id: string) {
    const posts = await this.hubData.getPostsByWeek('', undefined);
    // Get post by ID directly
    const post = posts.find((p) => p.id === parseInt(id));
    if (!post) return { error: 'Post not found' };

    const summary = await this.gateService.evaluateAndPersist(post);
    return { data: summary };
  }

  /**
   * GET /api/admin/marketing/social/export?week=2026-W09&channel=instagram
   * Export publish manifest JSON.
   */
  @Get('export')
  async exportManifest(
    @Query('week') week: string,
    @Query('channel') channel: string,
    @Res() res: Response,
  ) {
    if (!week || !channel) {
      return res
        .status(400)
        .json({ error: 'week and channel parameters required' });
    }

    const manifest = await this.publishQueue.exportManifest(
      week,
      channel as SocialChannel,
    );

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="manifest_${week}_${channel}.json"`,
    );
    return res.json(manifest);
  }

  /**
   * POST /api/admin/marketing/social/posts/mark-published
   */
  @Post('posts/mark-published')
  async markPublished(@Body('post_ids') postIds: number[]) {
    const count = await this.publishQueue.markAsPublished(postIds);
    return { published: count };
  }
}
