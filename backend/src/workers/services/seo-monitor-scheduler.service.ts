/**
 * 📅 SERVICE DE SCHEDULING MONITORING SEO
 *
 * Configure et gère les jobs répétitifs BullMQ pour
 * surveiller les pages critiques et prévenir la désindexation SEO.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { DatabaseException, ErrorCodes } from '../../common/exceptions';
import { getErrorMessage } from '../../common/utils/error.utils';

@Injectable()
export class SeoMonitorSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SeoMonitorSchedulerService.name);

  constructor(
    @InjectQueue('seo-monitor') private readonly seoMonitorQueue: Queue,
  ) {}

  /**
   * 🚀 Configure les jobs répétitifs au démarrage de l'app
   */
  async onModuleInit() {
    this.logger.log('🚀 Initialisation scheduler monitoring SEO...');

    try {
      // Nettoyer les anciens jobs répétitifs
      await this.cleanOldRepeatableJobs();

      // Configurer job surveillance URLs critiques (toutes les 30min)
      await this.setupCriticalUrlsMonitoring();

      // Configurer job échantillon aléatoire (toutes les 6h)
      await this.setupRandomSampleMonitoring();

      this.logger.log('✅ Scheduler monitoring SEO configuré');
      await this.logScheduledJobs();
    } catch (error) {
      this.logger.error(
        '❌ Erreur configuration scheduler monitoring SEO:',
        getErrorMessage(error),
      );
    }
  }

  /**
   * 🗑️ Nettoie les anciens jobs répétitifs
   */
  private async cleanOldRepeatableJobs() {
    const repeatableJobs = await this.seoMonitorQueue.getRepeatableJobs();

    for (const job of repeatableJobs) {
      await this.seoMonitorQueue.removeRepeatableByKey(job.key);
      this.logger.log(`🗑️ Ancien job répétitif supprimé: ${job.name}`);
    }
  }

  /**
   * 🔍 Configure job surveillance URLs critiques (toutes les 30min)
   */
  private async setupCriticalUrlsMonitoring() {
    await this.seoMonitorQueue.add(
      'check-pages',
      {
        taskType: 'check-critical-urls',
        triggeredBy: 'scheduler',
      },
      {
        repeat: {
          cron: '*/30 * * * *', // Toutes les 30 minutes
        },
        jobId: 'critical-urls-monitoring', // ID unique pour éviter duplicatas
        removeOnComplete: 100,
        removeOnFail: 500,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 10000,
        },
      },
    );

    this.logger.log('✅ Surveillance URLs critiques: toutes les 30 minutes');
  }

  /**
   * 🎲 Configure job échantillon aléatoire (toutes les 6h)
   */
  private async setupRandomSampleMonitoring() {
    await this.seoMonitorQueue.add(
      'check-pages',
      {
        taskType: 'check-random-sample',
        triggeredBy: 'scheduler',
      },
      {
        repeat: {
          cron: '0 */6 * * *', // Toutes les 6 heures (00:00, 06:00, 12:00, 18:00)
        },
        jobId: 'random-sample-monitoring', // ID unique
        removeOnComplete: 50,
        removeOnFail: 200,
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 20000,
        },
      },
    );

    this.logger.log(
      '✅ Surveillance échantillon aléatoire: toutes les 6 heures',
    );
  }

  /**
   * 📋 Log tous les jobs programmés
   */
  private async logScheduledJobs() {
    const repeatableJobs = await this.seoMonitorQueue.getRepeatableJobs();

    this.logger.log(`📋 Jobs répétitifs actifs: ${repeatableJobs.length}`);

    for (const job of repeatableJobs) {
      const nextRun = new Date(job.next);
      this.logger.log(
        `  - ${job.id}: ${job.cron} (prochain: ${nextRun.toISOString()})`,
      );
    }
  }

  /**
   * 🚀 Déclenche un monitoring manuel (via API)
   */
  async triggerManualCheck(
    taskType:
      | 'check-critical-urls'
      | 'check-random-sample' = 'check-critical-urls',
  ) {
    this.logger.log(`🚀 Déclenchement manuel monitoring SEO (${taskType})`);

    const job = await this.seoMonitorQueue.add(
      'check-pages',
      {
        taskType,
        triggeredBy: 'api',
      },
      {
        priority: 1, // Haute priorité pour jobs manuels
        removeOnComplete: 50,
        removeOnFail: 100,
        attempts: 1, // Pas de retry pour jobs manuels
      },
    );

    this.logger.log(`✅ Job manuel créé: #${job.id}`);

    return {
      jobId: job.id,
      taskType,
      status: 'queued',
    };
  }

  /**
   * 📊 Récupère stats de la queue
   */
  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.seoMonitorQueue.getWaitingCount(),
      this.seoMonitorQueue.getActiveCount(),
      this.seoMonitorQueue.getCompletedCount(),
      this.seoMonitorQueue.getFailedCount(),
      this.seoMonitorQueue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
  }

  /**
   * 🔍 Récupère jobs récents
   */
  async getRecentJobs(limit: number = 20) {
    const jobs = await this.seoMonitorQueue.getJobs(
      ['completed', 'failed', 'active', 'waiting'],
      0,
      limit - 1,
    );

    return jobs.map((job) => ({
      id: job.id,
      name: job.name,
      data: job.data,
      progress: job.progress(),
      attemptsMade: job.attemptsMade,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      returnvalue: job.returnvalue,
      failedReason: job.failedReason,
    }));
  }

  /**
   * 🔍 Récupère résultat d'un job spécifique
   */
  async getJobResult(jobId: string | number) {
    const job = await this.seoMonitorQueue.getJob(jobId);

    if (!job) {
      throw new DatabaseException({
        code: ErrorCodes.SEO.MONITORING_ERROR,
        message: `Job #${jobId} introuvable`,
      });
    }

    const state = await job.getState();

    return {
      id: job.id,
      name: job.name,
      data: job.data,
      state,
      progress: job.progress(),
      result: job.returnvalue,
      error: job.failedReason,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      attemptsMade: job.attemptsMade,
    };
  }
}
