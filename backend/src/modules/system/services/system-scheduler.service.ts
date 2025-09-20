import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MetricsJobData } from '../processors/metrics.processor';

@Injectable()
export class SystemSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SystemSchedulerService.name);

  constructor(
    @InjectQueue('metrics-processing')
    private metricsQueue: Queue<MetricsJobData>,

    @InjectQueue('system-maintenance')
    private maintenanceQueue: Queue<MetricsJobData>,
  ) {}

  async onModuleInit() {
    this.logger.log(
      '🚀 SystemScheduler initialized - Setting up automated tasks',
    );

    // Démarrage immédiat pour collecte initiale
    await this.scheduleImmediateMetricsCollection();
  }

  /**
   * 📊 Collecte de métriques performance toutes les 2 minutes
   */
  @Cron(CronExpression.EVERY_2_MINUTES)
  async schedulePerformanceMetrics() {
    try {
      await this.metricsQueue.add(
        'performance-metrics',
        {
          type: 'performance',
          priority: 'normal',
        },
        {
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      );

      this.logger.debug('📊 Performance metrics job scheduled');
    } catch (error) {
      this.logger.error('❌ Failed to schedule performance metrics:', error);
    }
  }

  /**
   * 💼 Collecte de métriques business toutes les 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async scheduleBusinessMetrics() {
    try {
      await this.metricsQueue.add(
        'business-metrics',
        {
          type: 'business',
          priority: 'normal',
        },
        {
          removeOnComplete: 50,
          removeOnFail: 25,
        },
      );

      this.logger.debug('💼 Business metrics job scheduled');
    } catch (error) {
      this.logger.error('❌ Failed to schedule business metrics:', error);
    }
  }

  /**
   * 🎯 Collecte de métriques SEO toutes les 10 minutes
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async scheduleSeoMetrics() {
    try {
      await this.metricsQueue.add(
        'seo-metrics',
        {
          type: 'seo',
          priority: 'low',
        },
        {
          removeOnComplete: 25,
          removeOnFail: 10,
        },
      );

      this.logger.debug('🎯 SEO metrics job scheduled');
    } catch (error) {
      this.logger.error('❌ Failed to schedule SEO metrics:', error);
    }
  }

  /**
   * 🏥 Health check base de données toutes les 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async scheduleDatabaseHealthCheck() {
    try {
      await this.metricsQueue.add(
        'database-health',
        {
          type: 'database_health',
          priority: 'high',
        },
        {
          removeOnComplete: 50,
          removeOnFail: 25,
        },
      );

      this.logger.debug('🏥 Database health check scheduled');
    } catch (error) {
      this.logger.error('❌ Failed to schedule database health check:', error);
    }
  }

  /**
   * 🔧 Maintenance système toutes les heures
   */
  @Cron(CronExpression.EVERY_HOUR)
  async scheduleSystemMaintenance() {
    try {
      await this.maintenanceQueue.add(
        'system-maintenance',
        {
          type: 'maintenance',
          priority: 'low',
          metadata: {
            scheduledAt: new Date().toISOString(),
            source: 'automated',
          },
        },
        {
          removeOnComplete: 10,
          removeOnFail: 5,
        },
      );

      this.logger.log('🔧 System maintenance job scheduled');
    } catch (error) {
      this.logger.error('❌ Failed to schedule system maintenance:', error);
    }
  }

  /**
   * 🚨 Collecte prioritaire en cas d'alerte
   */
  async scheduleEmergencyMetricsCollection(alertType: string) {
    try {
      this.logger.warn(
        `🚨 Emergency metrics collection triggered: ${alertType}`,
      );

      const jobs = await Promise.allSettled([
        this.metricsQueue.add(
          'emergency-performance',
          {
            type: 'performance',
            priority: 'high',
            metadata: { trigger: alertType, emergency: true },
          },
          { priority: 1 },
        ),
        this.metricsQueue.add(
          'emergency-database',
          {
            type: 'database_health',
            priority: 'high',
            metadata: { trigger: alertType, emergency: true },
          },
          { priority: 1 },
        ),
      ]);

      const successful = jobs.filter(
        (job) => job.status === 'fulfilled',
      ).length;
      this.logger.warn(
        `🚨 Emergency collection: ${successful}/2 jobs scheduled`,
      );
    } catch (error) {
      this.logger.error('❌ Failed to schedule emergency metrics:', error);
    }
  }

  /**
   * 📈 Collecte immédiate au démarrage
   */
  private async scheduleImmediateMetricsCollection() {
    try {
      this.logger.log('🎬 Scheduling immediate metrics collection');

      const initialJobs = [
        { type: 'performance' as const, delay: 0 },
        { type: 'business' as const, delay: 5000 },
        { type: 'seo' as const, delay: 10000 },
        { type: 'database_health' as const, delay: 2000 },
      ];

      for (const job of initialJobs) {
        await this.metricsQueue.add(
          `initial-${job.type}`,
          {
            type: job.type,
            priority: 'normal',
            metadata: { source: 'startup' },
          },
          {
            delay: job.delay,
            removeOnComplete: 10,
            removeOnFail: 5,
          },
        );
      }

      this.logger.log('✅ Initial metrics collection scheduled');
    } catch (error) {
      this.logger.error('❌ Failed to schedule initial metrics:', error);
    }
  }

  /**
   * 📊 Statistiques des queues
   */
  async getQueueStatistics() {
    try {
      const [metricsStats, maintenanceStats] = await Promise.all([
        {
          waiting: await this.metricsQueue
            .getWaiting()
            .then((jobs) => jobs.length),
          active: await this.metricsQueue
            .getActive()
            .then((jobs) => jobs.length),
          completed: await this.metricsQueue
            .getCompleted()
            .then((jobs) => jobs.length),
          failed: await this.metricsQueue
            .getFailed()
            .then((jobs) => jobs.length),
        },
        {
          waiting: await this.maintenanceQueue
            .getWaiting()
            .then((jobs) => jobs.length),
          active: await this.maintenanceQueue
            .getActive()
            .then((jobs) => jobs.length),
          completed: await this.maintenanceQueue
            .getCompleted()
            .then((jobs) => jobs.length),
          failed: await this.maintenanceQueue
            .getFailed()
            .then((jobs) => jobs.length),
        },
      ]);

      return {
        metrics: metricsStats,
        maintenance: maintenanceStats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Failed to get queue statistics:', error);
      return {
        metrics: { waiting: 0, active: 0, completed: 0, failed: 0 },
        maintenance: { waiting: 0, active: 0, completed: 0, failed: 0 },
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }
}
