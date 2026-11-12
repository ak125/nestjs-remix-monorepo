/**
 * 🛡️ CONTROLLER MONITORING SEO
 *
 * API pour gérer et surveiller le système de protection anti-désindexation
 */

import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AdminOrInternalKeyGuard } from '@auth/admin-or-internal-key.guard';
import { SeoMonitorSchedulerService } from '../../../workers/services/seo-monitor-scheduler.service';

@Controller('api/seo/monitor')
@UseGuards(AdminOrInternalKeyGuard)
export class SeoMonitorController {
  constructor(private readonly schedulerService: SeoMonitorSchedulerService) {}

  /**
   * 📊 GET /api/seo/monitor/stats
   * Récupère les stats de la queue de monitoring
   */
  @Get('stats')
  async getStats() {
    const stats = await this.schedulerService.getQueueStats();

    return {
      success: true,
      data: stats,
    };
  }

  /**
   * 📋 GET /api/seo/monitor/jobs/recent
   * Récupère les jobs récents
   */
  @Get('jobs/recent')
  async getRecentJobs(@Query('limit') limit?: string) {
    const jobs = await this.schedulerService.getRecentJobs(
      limit ? parseInt(limit) : 20,
    );

    return {
      success: true,
      count: jobs.length,
      data: jobs,
    };
  }

  /**
   * 🔍 GET /api/seo/monitor/jobs/:jobId
   * Récupère le résultat d'un job spécifique
   */
  @Get('jobs/:jobId')
  async getJobResult(@Param('jobId') jobId: string) {
    const result = await this.schedulerService.getJobResult(jobId);

    return {
      success: true,
      data: result,
    };
  }

  /**
   * 🚀 POST /api/seo/monitor/trigger
   * Déclenche un monitoring manuel
   *
   * Query params:
   * - taskType: 'check-critical-urls' | 'check-random-sample'
   */
  @Post('trigger')
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerManualCheck(
    @Query('taskType') taskType?: 'check-critical-urls' | 'check-random-sample',
  ) {
    const result = await this.schedulerService.triggerManualCheck(
      taskType || 'check-critical-urls',
    );

    return {
      success: true,
      message: 'Job de monitoring lancé',
      data: result,
    };
  }
}
