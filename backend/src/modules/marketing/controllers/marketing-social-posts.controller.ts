import { parseSocialReview } from '../dto/social-review.dto';
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
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { IsAdminGuard } from '@auth/is-admin.guard';
import {
  DomainNotFoundException,
  DomainValidationException,
} from '@common/exceptions';
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
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const ok = await this.publishQueue.approvePost(
      this.postId(id),
      parseSocialReview(body),
      this.actor(req),
    );
    return { success: ok };
  }

  @Put('posts/:id/reject')
  async rejectPost(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const ok = await this.publishQueue.rejectPost(
      this.postId(id),
      parseSocialReview(body),
      this.actor(req),
    );
    return { success: ok };
  }

  @Post('posts/bulk-approve')
  async bulkApprove() {
    throw new DomainValidationException({
      message: 'Review each channel and revision before approval',
      field: 'review',
    });
  }

  @Get('posts/:id/history')
  async getHistory(@Param('id') id: string) {
    return { data: await this.hubData.getPostHistory(this.postId(id)) };
  }

  @Get('posts/:id')
  async getPost(@Param('id') id: string) {
    const post = await this.hubData.getPostById(this.postId(id));
    if (!post) throw new DomainNotFoundException({ message: 'Post not found' });
    return { data: post };
  }

  @Post('posts/:id/preparations')
  async preparePublication(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    return this.publishQueue.preparePublication(
      this.postId(id),
      body,
      this.actor(req),
    );
  }

  @Get('posts/:id/preparations')
  async getPreparations(@Param('id') id: string) {
    return {
      purpose: 'preparation_history',
      publication_ready: false,
      data: await this.hubData.getPublicationPreparations(this.postId(id)),
    };
  }

  @Post('posts/:id/gate')
  async runGate(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const postId = this.postId(id);
    const target = parseSocialReview(body);
    const actor = this.actor(req);
    const post = await this.hubData.getPostById(postId);
    if (!post) throw new DomainNotFoundException({ message: 'Post not found' });
    const summary = await this.gateService.evaluateAndPersist(
      post,
      target,
      actor,
    );
    return { data: summary };
  }

  @Get('posts/:id/preparations/:requestId/export')
  async exportPreparation(
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @Res() res: Response,
  ) {
    // Errors, too, must not be reused after a decision or session changes.
    res.setHeader('Cache-Control', 'private, no-store');
    const result = await this.publishQueue.exportPreparation(
      this.postId(id),
      requestId,
    );
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="preparation_${result.preparation.request_id}.json"`,
    );
    return res.json(result);
  }

  private postId(id: string): number {
    if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
      throw new DomainValidationException({
        message: 'Invalid post ID',
        field: 'id',
      });
    }
    return Number(id);
  }

  private actor(req: Request): string {
    const id: unknown = req?.user?.id;
    if (
      (typeof id !== 'string' && typeof id !== 'number') ||
      !String(id).trim()
    ) {
      throw new UnauthorizedException(
        'Authenticated reviewer identity required',
      );
    }
    return String(id);
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
