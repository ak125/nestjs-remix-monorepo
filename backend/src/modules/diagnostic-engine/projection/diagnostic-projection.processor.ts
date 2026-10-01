/**
 * DiagnosticProjectionProcessor — consumer BullMQ de la projection diagnostic.
 *
 * Adaptateur fin : valide les données du job, revérifie le drapeau (un override
 * admin OFF arrête aussi un repeatable déjà enregistré), puis délègue au writer.
 * READ_ONLY est appliqué par le writer (`guardReadOnly`). Une exception du
 * writer fait échouer le job, visiblement (`@OnQueueFailed`) ; une dérive de
 * contrat post-commit (`DiagnosticProjectionContractError`) le fait échouer UNE
 * fois (`job.discard()`, bull v4 : aucune nouvelle tentative).
 */
import { OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { FeatureFlagsService } from '../../../config/feature-flags.service';
import {
  DiagnosticProjectionContractError,
  DiagnosticProjectionWriterService,
} from './diagnostic-projection-writer.service';
import {
  DIAGNOSTIC_PROJECTION_JOB,
  DIAGNOSTIC_PROJECTION_QUEUE,
  DiagnosticProjectionJobDataSchema,
  type DiagnosticProjectionRunResult,
} from './diagnostic-projection.types';

@Processor(DIAGNOSTIC_PROJECTION_QUEUE)
export class DiagnosticProjectionProcessor {
  private readonly logger = new Logger(DiagnosticProjectionProcessor.name);

  constructor(
    private readonly writer: DiagnosticProjectionWriterService,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  @Process(DIAGNOSTIC_PROJECTION_JOB)
  async handle(job: Job<unknown>): Promise<DiagnosticProjectionRunResult> {
    const { triggeredBy } = DiagnosticProjectionJobDataSchema.parse(job.data);
    if (!this.featureFlags.diagnosticProjectionEnabled) {
      this.logger.warn(
        { metric: 'diagnostic_projection.skipped', triggered_by: triggeredBy },
        'DIAGNOSTIC_PROJECTION_ENABLED!=true — job de projection ignoré.',
      );
      return { status: 'skipped', reason: 'FLAG_OFF' };
    }
    try {
      return await this.writer.run(triggeredBy);
    } catch (error) {
      // Dérive de contrat APRÈS commit : un retry rejouerait une projection déjà
      // appliquée et échouerait à l'identique → un seul échec, visible.
      if (error instanceof DiagnosticProjectionContractError) job.discard();
      throw error;
    }
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error): void {
    this.logger.error(
      `diagnostic-projection job ${String(job?.id)} failed: ${err?.message}`,
      err?.stack,
    );
  }
}
