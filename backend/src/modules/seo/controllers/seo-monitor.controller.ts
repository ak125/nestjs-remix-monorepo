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
} from '@nestjs/common';
import { SeoMonitorSchedulerService } from '../../../workers/services/seo-monitor-scheduler.service';
import {
  SeoRecoveryMonitorService,
  SeoRecoveryReport,
} from '../services/seo-recovery-monitor.service';

@Controller('api/seo/monitor')
export class SeoMonitorController {
  constructor(
    private readonly schedulerService: SeoMonitorSchedulerService,
    private readonly recoveryMonitor: SeoRecoveryMonitorService,
  ) {}

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
   * 🩺 GET /api/seo/monitor/recovery-status
   * Observable recovery report after the traffic-drop incident
   * 2026-04-22 → 2026-05-13. Compares current-week GSC impressions
   * on `/pieces/*` against the pre-incident W17 baseline and emits
   * a `status` field consumed by the daily CI watchdog
   * (.github/workflows/seo-recovery-watchdog.yml).
   *
   * Public read-only — same security profile as `/stats`. Configurable
   * via SEO_RECOVERY_* env vars (see service docstring).
   */
  @Get('recovery-status')
  async getRecoveryStatus(): Promise<SeoRecoveryReport> {
    return this.recoveryMonitor.getReport();
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
