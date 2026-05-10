/**
 * AdminConseilController — Pack coverage dashboard + quality score backfill.
 * GET  /api/admin/conseil/coverage?pack=standard
 * GET  /api/admin/conseil/coverage/:pgId
 * POST /api/admin/conseil/backfill-scores
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { ConseilQualityScorerService } from '../services/conseil-quality-scorer.service';
import { ConseilPriorityService } from '../services/conseil-priority.service';
import type { PackLevel } from '../../../config/conseil-pack.constants';

@Controller('api/admin/conseil')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class AdminConseilController {
  private readonly logger = new Logger(AdminConseilController.name);

  constructor(
    private readonly qualityScorer: ConseilQualityScorerService,
    private readonly priorityService: ConseilPriorityService,
  ) {}

  /**
   * GET /api/admin/conseil/coverage?pack=standard&limit=50
   * Returns gammes sorted by priority (most gaps first).
   */
  @Get('coverage')
  async getCoverage(
    @Query('pack') pack: string = 'standard',
    @Query('limit') limit: string = '50',
  ) {
    const packLevel = (
      ['standard', 'pro', 'eeat'].includes(pack) ? pack : 'standard'
    ) as PackLevel;

    this.logger.log(
      `GET /api/admin/conseil/coverage?pack=${packLevel}&limit=${limit}`,
    );

    const queue = await this.priorityService.getPriorityQueue(
      packLevel,
      parseInt(limit, 10) || 50,
    );

    return {
      success: true,
      data: {
        pack: packLevel,
        total: queue.length,
        items: queue,
      },
    };
  }

  /**
   * GET /api/admin/conseil/coverage/:pgId
   * Returns detailed pack coverage for a single gamme.
   */
  @Get('coverage/:pgId')
  async getGammeCoverage(@Param('pgId') pgId: string) {
    this.logger.log(`GET /api/admin/conseil/coverage/${pgId}`);

    const coverage = await this.qualityScorer.computeGammeCoverage(pgId);
    return { success: true, data: coverage };
  }

  /**
   * POST /api/admin/conseil/backfill-scores
   * Populates sgc_quality_score for all NULL rows.
   */
  @Post('backfill-scores')
  async backfillScores() {
    this.logger.log('POST /api/admin/conseil/backfill-scores');

    const result = await this.qualityScorer.backfillQualityScores();
    return { success: true, data: result };
  }
}
