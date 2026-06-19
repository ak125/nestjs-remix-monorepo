/**
 * SeoProjectionFeederService — déclencheur R1 du forward-writer (ADR-059 PR-6c / ADR-090 §C2).
 *
 * Rôle : fermer la boucle « exports wiki → writer ». Découvre les `exports/seo/gamme/*.json`
 * (déjà TIER A côté wiki) et enqueue un write-job sur PROJECTION_WRITE_QUEUE → le write-processor
 * existant (PR-6b) projette + enqueue le refresh débouncé. Aucune logique d'écriture ici.
 *
 * Pourquoi BullMQ repeatable et pas `@Cron` : `@nestjs/schedule` est désactivé monorepo
 * (conflit de versions, cf. app.module.ts) → tous les `@Cron` sont inertes. Pattern canon =
 * repeatable jobs (cf. SitemapV10SchedulerService).
 *
 * Garde-fous (controlled rollout, runtime-awareness CLAUDE.md) :
 *   - `SEO_PROJECTION_R1_FEED_ENABLED` défaut **OFF** → rien n'est planifié (owner valide l'activation).
 *   - `onModuleInit` NON-bloquant (`void` fire-and-forget) — sinon stalle `app.listen()` (backend.md).
 *   - READ_ONLY (PREPROD, ADR-028) : skip observable (pas d'enqueue inutile).
 *   - Dossier d'exports absent/vide → no-op observable (PAS une erreur : les exports peuvent
 *     ne pas encore exister ; le wiki les produit en amont).
 *   - `triggerNow()` = enqueue one-off (endpoint admin) pour prouver la boucle sans attendre le cron.
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bull';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { getErrorMessage } from '@common/utils/error.utils';
import { getAppConfig } from '../../config/app.config';
import {
  PROJECTION_FEED_JOB,
  PROJECTION_FEED_QUEUE,
  PROJECTION_WRITE_JOB,
  PROJECTION_WRITE_QUEUE,
  type ProjectionFeedJobData,
  type ProjectionFeedResult,
  type ProjectionWriteJobData,
} from './seo-projection.types';

/** jobId stable du repeatable → pas de doublon au redeploy (BullMQ stocke les anciens cron sinon). */
const R1_FEED_REPEATABLE_JOB_ID = 'seo-projection-r1-nightly-feed';

@Injectable()
export class SeoProjectionFeederService implements OnModuleInit {
  private readonly logger = new Logger(SeoProjectionFeederService.name);

  constructor(
    @InjectQueue(PROJECTION_FEED_QUEUE) private readonly feedQueue: Queue,
    @InjectQueue(PROJECTION_WRITE_QUEUE)
    private readonly writeQueue: Queue,
    private readonly configService: ConfigService,
  ) {}

  /** Init NON-bloquant (fire-and-forget). Bloquer ici stallerait `app.listen()` (cf. backend.md). */
  onModuleInit(): void {
    if (!this.isEnabled()) {
      this.logger.log(
        'SEO_PROJECTION_R1_FEED_ENABLED!=true — feeder R1 non planifié (flag OFF, rollout owner-gated).',
      );
      return;
    }
    this.logger.log(
      `🚀 Feeder R1 planifié (cron="${this.getCron()}" UTC, exportsDir="${this.getExportsDir()}").`,
    );
    void this.configureRepeatableJob();
  }

  /** Enqueue immédiat one-off (endpoint admin) — prouve la boucle sans attendre le cron. */
  async triggerNow(): Promise<string> {
    const job = await this.feedQueue.add(
      PROJECTION_FEED_JOB,
      { triggeredBy: 'manual' } satisfies ProjectionFeedJobData,
      {
        removeOnComplete: 14,
        removeOnFail: 30,
        attempts: 1,
      },
    );
    this.logger.log(
      `Feeder R1 déclenché manuellement (jobId=${String(job.id)}).`,
    );
    return String(job.id);
  }

  /**
   * Cœur du feed : découvre les exports gamme et enqueue UN write-job (le write-processor
   * projette + déclenche le refresh débouncé). Fail-closed observable, jamais de throw fatal.
   */
  async discoverAndEnqueue(
    triggeredBy: ProjectionFeedJobData['triggeredBy'],
  ): Promise<ProjectionFeedResult> {
    const exportsDir = this.getExportsDir();

    if (getAppConfig().supabase.readOnly) {
      this.logger.log(
        `[READ_ONLY] feeder R1 skip (aucun enqueue) — exportsDir=${exportsDir}.`,
      );
      return {
        discovered: 0,
        enqueued: false,
        exportsDir,
        reason: 'READ_ONLY',
      };
    }

    let exportPaths: string[];
    try {
      const entries = await fs.readdir(exportsDir);
      exportPaths = entries
        .filter((f) => f.endsWith('.json'))
        .map((f) => path.join(exportsDir, f))
        .sort();
    } catch (err) {
      // Dossier absent/illisible = no-op observable (les exports peuvent ne pas exister encore).
      this.logger.warn(
        `Feeder R1 : dossier d'exports absent/illisible (${exportsDir}) — 0 export, skip. (${getErrorMessage(err)})`,
      );
      return {
        discovered: 0,
        enqueued: false,
        exportsDir,
        reason: 'NO_EXPORTS_DIR',
      };
    }

    if (exportPaths.length === 0) {
      this.logger.log(
        `Feeder R1 : 0 export dans ${exportsDir} — rien à projeter.`,
      );
      return { discovered: 0, enqueued: false, exportsDir, reason: 'EMPTY' };
    }

    await this.writeQueue.add(
      PROJECTION_WRITE_JOB,
      {
        triggeredBy: 'cron',
        exportPaths,
        runMeta: { pipeline_version: `r1-feeder/${triggeredBy}` },
      } satisfies ProjectionWriteJobData,
      {
        removeOnComplete: 14,
        removeOnFail: 30,
        attempts: 2,
        backoff: { type: 'exponential', delay: 60_000 },
      },
    );

    this.logger.log(
      `Feeder R1 : ${exportPaths.length} export(s) gamme découvert(s) → 1 write-job enqueue (${triggeredBy}).`,
    );
    return { discovered: exportPaths.length, enqueued: true, exportsDir };
  }

  private async configureRepeatableJob(): Promise<void> {
    try {
      await this.removeStaleRepeatableJob();
      await this.feedQueue.add(
        PROJECTION_FEED_JOB,
        { triggeredBy: 'scheduler' } satisfies ProjectionFeedJobData,
        {
          repeat: { cron: this.getCron(), tz: 'UTC' },
          jobId: R1_FEED_REPEATABLE_JOB_ID,
          removeOnComplete: 14,
          removeOnFail: 30,
          attempts: 2,
          backoff: { type: 'exponential', delay: 60_000 },
        },
      );
      this.logger.log(
        `✅ Feeder R1 repeatable enregistré (cron="${this.getCron()}" UTC).`,
      );
    } catch (err) {
      this.logger.error(
        `❌ Échec d'enregistrement du repeatable feeder R1: ${getErrorMessage(err)}`,
      );
    }
  }

  private async removeStaleRepeatableJob(): Promise<void> {
    try {
      const jobs = await this.feedQueue.getRepeatableJobs();
      for (const job of jobs) {
        if (job.name === PROJECTION_FEED_JOB) {
          await this.feedQueue.removeRepeatableByKey(job.key);
          this.logger.log(
            `🗑️ Repeatable feeder R1 obsolète supprimé: ${job.key}`,
          );
        }
      }
    } catch (err) {
      this.logger.warn(
        `Énumération des repeatables feeder impossible: ${getErrorMessage(err)}`,
      );
    }
  }

  /** 02:00 UTC = avant la régénération sitemap (03:00) → projection fraîche avant le sitemap. */
  private getCron(): string {
    return this.configService.get<string>(
      'SEO_PROJECTION_R1_FEED_CRON',
      '0 2 * * *',
    );
  }

  /** Défaut OFF (rollout owner-gated) : seul `=true` active. */
  private isEnabled(): boolean {
    return (
      this.configService.get<string>('SEO_PROJECTION_R1_FEED_ENABLED') ===
      'true'
    );
  }

  private getExportsDir(): string {
    const configured = this.configService.get<string>(
      'SEO_PROJECTION_R1_EXPORTS_DIR',
      'content/automecanik-wiki/exports/seo/gamme',
    );
    return path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured);
  }
}
