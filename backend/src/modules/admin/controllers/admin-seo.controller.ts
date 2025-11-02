/**
 * 🎯 ADMIN SEO CONTROLLER
 *
 * Dashboard administrateur pour le monitoring SEO
 */

import { Controller, Get } from '@nestjs/common';
import { SeoMonitorSchedulerService } from '../../../workers/services/seo-monitor-scheduler.service';

@Controller('api/admin/seo')
export class AdminSeoController {
  constructor(private readonly schedulerService: SeoMonitorSchedulerService) {}

  /**
   * 📊 GET /api/admin/seo
   * Dashboard SEO avec KPIs et stats de monitoring
   */
  @Get()
  async getDashboard() {
    const stats = await this.schedulerService.getQueueStats();
    const recentJobs = await this.schedulerService.getRecentJobs(10);

    // Calcul des KPIs
    const totalChecks = recentJobs.length;
    const failedChecks = recentJobs.filter(
      (j) => j.returnvalue?.errorCount > 0,
    ).length;
    const warningChecks = recentJobs.filter(
      (j) => j.returnvalue?.warningCount > 0,
    ).length;

    // Dernière exécution
    const lastJob = recentJobs[0];
    const lastCheck = lastJob
      ? {
          timestamp: new Date(lastJob.finishedOn).toISOString(),
          duration: lastJob.finishedOn - lastJob.processedOn,
          totalChecked: lastJob.returnvalue?.totalChecked || 0,
          okCount: lastJob.returnvalue?.okCount || 0,
          warningCount: lastJob.returnvalue?.warningCount || 0,
          errorCount: lastJob.returnvalue?.errorCount || 0,
          alerts: lastJob.returnvalue?.alerts || [],
        }
      : null;

    // Agrégation des alertes critiques
    const allAlerts = recentJobs
      .flatMap((j) => j.returnvalue?.alerts || [])
      .filter((alert) => alert.status === 'error')
      .slice(0, 20); // Top 20 alertes critiques

    return {
      success: true,
      data: {
        kpis: {
          queueStats: stats,
          totalChecks,
          failedChecks,
          warningChecks,
          healthScore:
            totalChecks > 0
              ? Math.round(((totalChecks - failedChecks) / totalChecks) * 100)
              : 100,
        },
        lastCheck,
        criticalAlerts: allAlerts,
        recentJobs: recentJobs.slice(0, 5).map((job) => ({
          id: job.id,
          timestamp: new Date(job.finishedOn).toISOString(),
          duration: job.finishedOn - job.processedOn,
          totalChecked: job.returnvalue?.totalChecked || 0,
          okCount: job.returnvalue?.okCount || 0,
          warningCount: job.returnvalue?.warningCount || 0,
          errorCount: job.returnvalue?.errorCount || 0,
        })),
      },
    };
  }

  /**
   * 📈 GET /api/admin/seo/trends
   * Tendances SEO sur les dernières 24h
   */
  @Get('trends')
  async getTrends() {
    const jobs = await this.schedulerService.getRecentJobs(50);

    // Calcul des tendances
    const timeline = jobs.map((job) => ({
      timestamp: new Date(job.finishedOn).toISOString(),
      errorCount: job.returnvalue?.errorCount || 0,
      warningCount: job.returnvalue?.warningCount || 0,
      okCount: job.returnvalue?.okCount || 0,
    }));

    return {
      success: true,
      data: {
        timeline,
        stats: {
          totalJobs: jobs.length,
          avgErrorCount:
            timeline.reduce((sum, t) => sum + t.errorCount, 0) /
            timeline.length,
          avgWarningCount:
            timeline.reduce((sum, t) => sum + t.warningCount, 0) /
            timeline.length,
        },
      },
    };
  }

  /**
   * 🔍 GET /api/admin/seo/urls-at-risk
   * URLs à risque de désindexation
   */
  @Get('urls-at-risk')
  async getUrlsAtRisk() {
    const jobs = await this.schedulerService.getRecentJobs(20);

    // Agrégation des URLs avec 0 pièces (dernières 24h)
    const urlsWithErrors = new Map<string, any>();

    for (const job of jobs) {
      const alerts = job.returnvalue?.alerts || [];
      for (const alert of alerts) {
        if (alert.status === 'error' && alert.piecesCount === 0) {
          const existing = urlsWithErrors.get(alert.url);
          if (
            !existing ||
            new Date(alert.checkedAt) > new Date(existing.lastSeen)
          ) {
            urlsWithErrors.set(alert.url, {
              url: alert.url,
              typeId: alert.typeId,
              gammeId: alert.gammeId,
              piecesCount: alert.piecesCount,
              lastSeen: alert.checkedAt,
              occurrences: (existing?.occurrences || 0) + 1,
            });
          }
        }
      }
    }

    const urlsAtRisk = Array.from(urlsWithErrors.values()).sort(
      (a, b) => b.occurrences - a.occurrences,
    );

    return {
      success: true,
      data: {
        count: urlsAtRisk.length,
        urls: urlsAtRisk,
      },
    };
  }
}
