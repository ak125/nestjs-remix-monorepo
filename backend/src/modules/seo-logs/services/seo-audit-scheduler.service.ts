import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ExternalServiceException, ErrorCodes } from '@common/exceptions';
import { getErrorMessage } from '@common/utils/error.utils';
import { isReadOnlyMode } from '@config/env-validation';

const execAsync = promisify(exec);

/**
 * 📅 Service de scheduling des audits SEO hebdomadaires
 *
 * Utilise BullMQ directement (sans @nestjs/bullmq) pour éviter
 * les conflits de version avec @nestjs/common v10
 */
@Injectable()
export class SeoAuditSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SeoAuditSchedulerService.name);
  private auditQueue: Queue;
  private auditWorker: Worker;
  private readonly scriptPath = path.join(
    process.cwd(),
    '..',
    'scripts',
    'seo-audit-weekly.sh',
  );

  /**
   * 🚀 Initialise BullMQ queue et worker au démarrage
   */
  async onModuleInit() {
    this.logger.log('🚀 Initialisation BullMQ pour audits SEO...');

    // Configuration Redis
    const connection = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
    };

    // Créer la queue
    this.auditQueue = new Queue('seo-audit', {
      connection,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 500,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 60000,
        },
      },
    });

    // Créer le worker
    this.auditWorker = new Worker(
      'seo-audit',
      async (job) => {
        return await this.processJob(job);
      },
      { connection },
    );

    // Event listeners
    this.auditWorker.on('completed', (job) => {
      this.logger.log(
        `✅ Job #${job.id} completed in ${Date.now() - (job.processedOn || Date.now())}ms`,
      );
    });

    this.auditWorker.on('failed', (job, err) => {
      this.logger.error(
        `💥 Job #${job?.id} failed after ${job?.attemptsMade} attempts: ${err.message}`,
      );
    });

    this.auditWorker.on('active', (job) => {
      this.logger.log(`▶️  Job #${job.id} started`);
    });

    // Configurer les jobs répétitifs
    await this.setupWeeklyAudit();
    await this.setupDailyCleanup();

    this.logger.log('✅ BullMQ initialisé');
  }

  /**
   * 🛑 Cleanup au shutdown
   */
  async onModuleDestroy() {
    this.logger.log('🛑 Fermeture BullMQ...');
    await this.auditWorker?.close();
    await this.auditQueue?.close();
  }

  /**
   * 🔄 Process un job (audit ou cleanup)
   *
   * ADR-028 Option D — gate processor (Principe 1) : worker créé en preprod
   * pour valider BullMQ wiring, mais le handler court-circuite sans
   * `execAsync(scriptPath)` qui crasherait sur script absent du Docker image.
   */
  private async processJob(
    job: any,
  ): Promise<{ success: boolean; type: string } | Record<string, unknown>> {
    if (isReadOnlyMode()) {
      this.logger.warn(
        {
          metric: 'readonly.skipped',
          operation: 'seo-audit.processJob',
          jobId: job?.id,
          taskType: job?.data?.task ?? job?.data?.auditType ?? 'unknown',
        },
        `[READ_ONLY] Skip seo-audit job #${job?.id} — script execution disabled (ADR-028 Option D)`,
      );
      return { skipped: true, reason: 'READ_ONLY' };
    }

    // Job de nettoyage
    if (job.data.task === 'cleanup-old-jobs') {
      this.logger.log(`🗑️ Processing cleanup job #${job.id}`);
      await this.cleanOldJobs();
      return { success: true, type: 'cleanup' };
    }

    // Job d'audit
    this.logger.log(
      `🔄 Processing SEO audit job #${job.id} (${job.data.auditType})`,
    );

    try {
      await job.updateProgress(20);

      const { stdout, stderr } = await execAsync(this.scriptPath, {
        env: {
          ...process.env,
          SITEMAP_URL:
            process.env.SITEMAP_URL || 'https://automecanik.fr/sitemap.xml',
          LOKI_URL: process.env.LOKI_URL || 'http://loki:3100',
          MEILISEARCH_HOST:
            process.env.MEILISEARCH_HOST || 'http://localhost:7700',
          MEILISEARCH_API_KEY: process.env.MEILISEARCH_API_KEY,
        },
        maxBuffer: 10 * 1024 * 1024,
      });

      // Log stderr si présent (warnings, infos)
      if (stderr) {
        this.logger.warn(`⚠️ Script stderr: ${stderr.substring(0, 500)}`);
      }

      await job.updateProgress(60);

      // Extraire le répertoire de sortie
      const outputDirMatch = stdout.match(/output_dir":\s*"([^"]+)"/);
      const outputDir = outputDirMatch
        ? outputDirMatch[1]
        : `/tmp/seo-audit-${new Date().toISOString().split('T')[0].replace(/-/g, '')}`;

      await job.updateProgress(70);

      // Lire le rapport JSON
      const reportPath = path.join(outputDir, 'audit-report.json');
      const reportContent = await fs.readFile(reportPath, 'utf-8');
      const report = JSON.parse(reportContent);

      await job.updateProgress(80);

      // Envoyer vers Meilisearch
      await this.sendToMeilisearch(report, job.data);

      await job.updateProgress(90);

      // Envoyer vers Loki
      await this.sendToLoki(report, job.data);

      await job.updateProgress(100);

      this.logger.log(`✅ Audit job #${job.id} completed`);

      return report;
    } catch (error) {
      this.logger.error(
        `❌ Audit job #${job.id} failed:`,
        getErrorMessage(error),
      );
      const execError = error as { stderr?: string };
      if (execError.stderr) {
        this.logger.error(`📋 Script stderr:\n${execError.stderr}`);
      }
      throw error;
    }
  }

  /**
   * 📊 Envoie le rapport vers Meilisearch
   */
  private async sendToMeilisearch(report: any, jobData: any): Promise<void> {
    const MEILISEARCH_HOST =
      process.env.MEILISEARCH_HOST || 'http://localhost:7700';
    const MEILISEARCH_API_KEY = process.env.MEILISEARCH_API_KEY;

    if (!MEILISEARCH_API_KEY) {
      this.logger.debug('🔇 MEILISEARCH_API_KEY not set, skipping indexing');
      return;
    }

    try {
      const document = {
        ...report,
        audit_type: jobData.auditType,
        triggered_by: jobData.triggeredBy,
        indexed_at: new Date().toISOString(),
      };

      const response = await fetch(
        `${MEILISEARCH_HOST}/indexes/seo_audits/documents`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${MEILISEARCH_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([document]),
        },
      );

      if (!response.ok) {
        throw new ExternalServiceException({
          code: ErrorCodes.EXTERNAL.SERVICE_ERROR,
          message: `Meilisearch error: ${response.statusText}`,
          serviceName: 'Meilisearch',
        });
      }

      this.logger.log('✅ Report sent to Meilisearch');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('❌ Failed to send to Meilisearch:', message);
    }
  }

  /**
   * 📝 Envoie le rapport vers Loki
   */
  private async sendToLoki(report: any, jobData: any): Promise<void> {
    const LOKI_URL = process.env.LOKI_URL || 'http://loki:3100';

    // Skip si Loki n'est pas configuré (optionnel en dev)
    if (!process.env.LOKI_URL) {
      this.logger.debug('🔇 LOKI_URL not configured, skipping log shipping');
      return;
    }

    try {
      const timestamp = Date.now() * 1000000;

      const lokiPayload = {
        streams: [
          {
            stream: {
              job: 'seo-audit',
              audit_type: jobData.auditType,
              status: report.summary.status,
            },
            values: [[timestamp.toString(), JSON.stringify(report)]],
          },
        ],
      };

      const response = await fetch(`${LOKI_URL}/loki/api/v1/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(lokiPayload),
      });

      if (!response.ok) {
        throw new ExternalServiceException({
          code: ErrorCodes.EXTERNAL.SERVICE_ERROR,
          message: `Loki error: ${response.statusText}`,
          serviceName: 'Loki',
        });
      }

      this.logger.log('✅ Report sent to Loki');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('❌ Failed to send to Loki:', message);
    }
  }

  /**
   * 🕐 Configure le job hebdomadaire avec BullMQ repeatable jobs
   */
  private async setupWeeklyAudit() {
    this.logger.log('📅 Configuration du job hebdomadaire SEO audit...');

    try {
      // Supprimer les anciens jobs répétitifs s'ils existent
      const repeatableJobs = await this.auditQueue.getRepeatableJobs();
      for (const job of repeatableJobs) {
        if (job.name === 'weekly-audit') {
          await this.auditQueue.removeRepeatableByKey(job.key);
          this.logger.log(`🗑️ Ancien job répétitif supprimé: ${job.key}`);
        }
      }

      // Créer le nouveau job répétitif (tous les lundis à 3h00)
      await this.auditQueue.add(
        'weekly-audit',
        {
          auditType: 'weekly',
          triggeredBy: 'scheduler',
        },
        {
          repeat: {
            pattern: '0 3 * * 1', // Cron: Lundi 3h00
            tz: 'Europe/Paris',
          },
          removeOnComplete: 100,
          removeOnFail: 500,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 60000,
          },
          priority: 1,
        },
      );

      this.logger.log(
        '✅ Job hebdomadaire configuré: Lundi 3h00 (Europe/Paris)',
      );

      // Lister tous les jobs répétitifs
      const jobs = await this.auditQueue.getRepeatableJobs();
      this.logger.log(`📋 Total jobs répétitifs: ${jobs.length}`);
      jobs.forEach((job) => {
        this.logger.log(
          `  - ${job.name}: ${job.pattern} (next: ${new Date(job.next).toISOString()})`,
        );
      });
    } catch (error) {
      this.logger.error('❌ Erreur configuration job hebdomadaire:', error);
    }
  }

  /**
   * 🚀 Déclenche un audit manuel immédiat (via API)
   */
  async triggerManualAudit(triggeredBy: string = 'api') {
    this.logger.log('🚀 Triggering manual SEO audit...');

    const job = await this.auditQueue.add(
      'manual-audit',
      {
        auditType: 'manual',
        triggeredBy,
        triggeredAt: new Date().toISOString(),
      },
      {
        removeOnComplete: 50,
        removeOnFail: 200,
        attempts: 1, // Pas de retry pour manuel
        priority: 0, // Priorité max
      },
    );

    this.logger.log(`✅ Manual audit job created: ${job.id}`);

    return job;
  }

  /**
   * 📊 Récupère les stats de la queue
   */
  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.auditQueue.getWaitingCount(),
      this.auditQueue.getActiveCount(),
      this.auditQueue.getCompletedCount(),
      this.auditQueue.getFailedCount(),
      this.auditQueue.getDelayedCount(),
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
   * 🔍 Récupère les jobs récents
   */
  async getRecentJobs(limit: number = 10) {
    const jobs = await this.auditQueue.getJobs(
      ['completed', 'failed', 'active', 'waiting'],
      0,
      limit - 1,
    );

    return jobs.map((job) => ({
      id: job.id,
      name: job.name,
      data: job.data,
      state: job.getState(),
      progress: job.progress,
      attemptsMade: job.attemptsMade,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      returnvalue: job.returnvalue,
      failedReason: job.failedReason,
    }));
  }

  /**
   * 🗑️ Nettoie les anciens jobs (>90 jours)
   * Appelé automatiquement via un repeatable job quotidien
   */
  async setupDailyCleanup() {
    this.logger.log('🗑️ Configuration du nettoyage quotidien...');

    try {
      // Créer un job répétitif pour le nettoyage (tous les jours à 4h00)
      await this.auditQueue.add(
        'daily-cleanup',
        {
          task: 'cleanup-old-jobs',
        },
        {
          repeat: {
            pattern: '0 4 * * *', // Tous les jours à 4h00
            tz: 'Europe/Paris',
          },
          removeOnComplete: 10,
          removeOnFail: 50,
        },
      );

      this.logger.log('✅ Nettoyage quotidien configuré: 4h00');
    } catch (error) {
      this.logger.error('❌ Erreur configuration nettoyage:', error);
    }
  }

  /**
   * 🗑️ Nettoie les anciens jobs (>90 jours)
   */
  async cleanOldJobs() {
    this.logger.log('🗑️ Nettoyage des anciens jobs...');

    const gracePeriod = 90 * 24 * 60 * 60 * 1000; // 90 jours en ms

    await this.auditQueue.clean(gracePeriod, 1000, 'completed');
    await this.auditQueue.clean(gracePeriod, 1000, 'failed');

    this.logger.log('✅ Anciens jobs nettoyés');
  }
}
