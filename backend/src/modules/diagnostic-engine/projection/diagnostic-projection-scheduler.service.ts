/**
 * DiagnosticProjectionSchedulerService — planification de la projection WIKI →
 * `__diag_link_provenance` (spec §4.5).
 *
 * Repeatable BullMQ (pas `@Cron` : `@nestjs/schedule` est inerte dans ce monorepo,
 * cf. SeoProjectionFeederService). `DIAGNOSTIC_PROJECTION_ENABLED` défaut OFF :
 * OFF au boot dérégistre tout repeatable résiduel, de façon observable. Le
 * processor revérifie le drapeau à chaque job (un override admin OFF arrête
 * aussi un repeatable déjà enregistré).
 *
 * `onModuleInit` reste synchrone : Bull = Redis local, travail en `void`.
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bull';
import { getErrorMessage } from '@common/utils/error.utils';
import { FeatureFlagsService } from '../../../config/feature-flags.service';
import {
  DIAGNOSTIC_PROJECTION_JOB,
  DIAGNOSTIC_PROJECTION_QUEUE,
  DIAGNOSTIC_PROJECTION_REPEATABLE_JOB_ID,
  type DiagnosticProjectionJobData,
} from './diagnostic-projection.types';

export const DIAGNOSTIC_PROJECTION_CRON_ENV = 'DIAGNOSTIC_PROJECTION_CRON';
/** 02:00 UTC, même créneau que le feeder SEO : exports du pin courant. */
export const DEFAULT_DIAGNOSTIC_PROJECTION_CRON = '0 2 * * *';

@Injectable()
export class DiagnosticProjectionSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(
    DiagnosticProjectionSchedulerService.name,
  );

  constructor(
    @InjectQueue(DIAGNOSTIC_PROJECTION_QUEUE) private readonly queue: Queue,
    private readonly configService: ConfigService,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  /**
   * Le drapeau est lu UNE fois, au boot : l'activer à chaud ouvre le
   * déclenchement admin immédiatement, mais le repeatable nocturne n'est
   * enregistré qu'au prochain démarrage (pas de machinerie d'événements).
   */
  onModuleInit(): void {
    if (!this.featureFlags.diagnosticProjectionEnabled) {
      this.logger.log(
        'DIAGNOSTIC_PROJECTION_ENABLED!=true — projection diagnostic non planifiée.',
      );
      void this.deregisterResidualRepeatable();
      return;
    }
    void this.configureRepeatableJob();
  }

  /** Enqueue one-off (endpoint admin). Le processor applique le drapeau. */
  async triggerNow(): Promise<string> {
    const job = await this.queue.add(
      DIAGNOSTIC_PROJECTION_JOB,
      { triggeredBy: 'admin' } satisfies DiagnosticProjectionJobData,
      { removeOnComplete: 14, removeOnFail: 30, attempts: 1 },
    );
    this.logger.log(
      `Projection diagnostic déclenchée manuellement (jobId=${String(job.id)}).`,
    );
    return String(job.id);
  }

  private async configureRepeatableJob(): Promise<void> {
    try {
      await this.removeStaleRepeatableJobs();
      // Lu une seule fois : la valeur enregistrée est celle journalisée.
      const cron = this.readCron();
      await this.queue.add(
        DIAGNOSTIC_PROJECTION_JOB,
        { triggeredBy: 'repeatable' } satisfies DiagnosticProjectionJobData,
        {
          repeat: { cron, tz: 'UTC' },
          jobId: DIAGNOSTIC_PROJECTION_REPEATABLE_JOB_ID,
          removeOnComplete: 14,
          removeOnFail: 30,
          attempts: 2,
          backoff: { type: 'exponential', delay: 60_000 },
        },
      );
      this.logger.log(
        `✅ Projection diagnostic planifiée (cron="${cron}" UTC).`,
      );
    } catch (err) {
      this.logger.error(
        `❌ Échec d'enregistrement du repeatable de projection diagnostic: ${getErrorMessage(err)}`,
      );
    }
  }

  private async deregisterResidualRepeatable(): Promise<void> {
    const removed = await this.removeStaleRepeatableJobs();
    if (removed > 0) {
      this.logger.warn(
        `🧹 Projection diagnostic OFF — ${removed} repeatable résiduel supprimé.`,
      );
    } else {
      this.logger.log(
        '✅ Projection diagnostic OFF — aucun repeatable résiduel.',
      );
    }
  }

  /** Supprime les repeatables de ce job ; retourne le nombre supprimé. */
  private async removeStaleRepeatableJobs(): Promise<number> {
    let removed = 0;
    try {
      const jobs = await this.queue.getRepeatableJobs();
      for (const job of jobs) {
        if (job.name === DIAGNOSTIC_PROJECTION_JOB) {
          await this.queue.removeRepeatableByKey(job.key);
          removed += 1;
          this.logger.log(
            `🗑️ Repeatable de projection diagnostic supprimé: ${job.key}`,
          );
        }
      }
    } catch (err) {
      // On continue (l'appelant planifie quand même) : les runs sont idempotents
      // et sérialisés par le verrou advisory ; ne pas planifier laisserait la
      // provenance périmée jusqu'au prochain boot. Un repeatable en double est le
      // coût accepté — d'où l'erreur observable plutôt qu'un simple warn.
      this.logger.error(
        {
          metric: 'diagnostic_projection.repeatable_cleanup_failed',
          error: getErrorMessage(err),
        },
        'Énumération des repeatables de projection diagnostic impossible — un repeatable en double est possible.',
      );
    }
    return removed;
  }

  /**
   * Un override vide est une erreur de configuration, jamais remplacé par le
   * défaut (pas de repli silencieux). La syntaxe est validée par BullMQ à `add`.
   */
  private readCron(): string {
    const cron = this.configService.get<string>(
      DIAGNOSTIC_PROJECTION_CRON_ENV,
      DEFAULT_DIAGNOSTIC_PROJECTION_CRON,
    );
    if (cron.trim() === '') {
      throw new Error(
        `${DIAGNOSTIC_PROJECTION_CRON_ENV} est vide — retirer la variable pour le défaut ou fournir une expression cron.`,
      );
    }
    return cron;
  }
}
