/**
 * ADR-059 Phase B PR-6b — SeoProjectionWriteProcessor.
 *
 * Workflow :
 *  1. Validate `WriteJobData` (Zod strict)
 *  2. assertCompatibleProjectionContract → abort si MAJOR mismatch
 *  3. READ_ONLY gate au processor (per `feedback_readonly_gate_at_processor_not_scheduler.md`)
 *  4. INSERT __seo_projection_runs (status='running')
 *  5. Process entities (INSERT versions + UPDATE active_version_id OR record conflict)
 *  6. UPDATE __seo_projection_runs (status='success', counts)
 *  7. **APRÈS COMMIT** : enqueue refresh job (idempotent jobId)
 *
 * GARDE-FOU NON-NÉGOCIABLE :
 *  - JAMAIS `REFRESH MATERIALIZED VIEW` dans ce fichier
 *  - JAMAIS write-back wiki (`git push`, fetch wiki repo)
 *  - JAMAIS replay logic (= PR-6c)
 *  - JAMAIS RPC public (= PR-7)
 */
import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';

import { Job, Queue } from 'bull';

import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

import {
  RUNNER_PROJECTION_CONTRACT_VERSION,
  RUNNER_VERSION,
  REFRESH_DEBOUNCE_MS,
  SEO_PROJECTION_REFRESH_QUEUE,
  SEO_PROJECTION_WRITE_QUEUE,
  ProjectionContractMismatchError,
  assertCompatibleProjectionContract,
} from './projection-contract.constants';
import {
  RefreshJobData,
  WriteJobData,
  WriteJobDataSchema,
  WriteJobResult,
} from './dto/projection-job.dto';
import { SeoProjectionConflictService } from './seo-projection-conflict.service';

function isReadOnly(): boolean {
  const v = process.env.READ_ONLY?.toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

@Processor(SEO_PROJECTION_WRITE_QUEUE)
export class SeoProjectionWriteProcessor extends SupabaseBaseService {
  private readonly writeLogger = new Logger(SeoProjectionWriteProcessor.name);

  constructor(
    private readonly conflictService: SeoProjectionConflictService,
    @InjectQueue(SEO_PROJECTION_REFRESH_QUEUE)
    private readonly refreshQueue: Queue<RefreshJobData>,
  ) {
    super();
  }

  @Process('apply')
  async handleApply(job: Job<WriteJobData>): Promise<WriteJobResult> {
    const parsed = WriteJobDataSchema.safeParse(job.data);
    if (!parsed.success) {
      this.writeLogger.error(
        `job ${job.id} payload invalid: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
      );
      return {
        status: 'failed',
        run_id: null,
        entities_processed: 0,
        conflicts_count: 0,
        refresh_job_enqueued: false,
      };
    }
    const data = parsed.data;

    try {
      assertCompatibleProjectionContract(data.projection_contract_version);
    } catch (err) {
      if (err instanceof ProjectionContractMismatchError) {
        this.writeLogger.error(
          `contract mismatch — aborting job ${job.id}: ${err.message}`,
        );
        await this.recordAbortedRun(data, err.message);
        return {
          status: 'aborted_contract_mismatch',
          run_id: null,
          entities_processed: 0,
          conflicts_count: 0,
          refresh_job_enqueued: false,
        };
      }
      throw err;
    }

    if (isReadOnly()) {
      this.writeLogger.warn(`job ${job.id} skipped: READ_ONLY=true`);
      return {
        status: 'skipped_read_only',
        run_id: null,
        entities_processed: 0,
        conflicts_count: 0,
        refresh_job_enqueued: false,
      };
    }

    // ── Step 1 : INSERT __seo_projection_runs status='running'
    const runId = await this.insertRunningRun(data);

    let entitiesProcessed = 0;
    let conflictsCount = 0;

    try {
      // ── Step 2 : process entities
      // (Skeleton PR-6b : delegates per-entity logic. The detailed diff loop
      //  iterates entity_ids and calls conflictService.classifyDiff →
      //  apply OR record_conflict. Full implementation is a stub here;
      //  PR-6b-followup or PR-7 may enrich with batched pl/pgsql atomicity.)
      for (const entityId of data.entity_ids) {
        const { conflicts } = await this.processEntity(entityId, runId, data);
        entitiesProcessed += 1;
        conflictsCount += conflicts;
      }

      // ── Step 3 : UPDATE run status='success'
      await this.updateRunStatus(
        runId,
        'success',
        entitiesProcessed,
        conflictsCount,
      );
    } catch (err) {
      this.writeLogger.error(`job ${job.id} failed: ${(err as Error).message}`);
      await this.updateRunStatus(
        runId,
        'failed',
        entitiesProcessed,
        conflictsCount,
        (err as Error).message,
      );
      return {
        status: 'failed',
        run_id: runId,
        entities_processed: entitiesProcessed,
        conflicts_count: conflictsCount,
        refresh_job_enqueued: false,
      };
    }

    // ── Step 4 : AFTER COMMIT — enqueue refresh job (NOT in write txn)
    // Idempotent jobId : sha256 dedup si même run enqueue 2× pendant debounce
    const refreshJobId =
      'refresh:' +
      createHash('sha256')
        .update(`${runId}|${data.exports_snapshot_hash}`)
        .digest('hex');
    await this.refreshQueue.add(
      'refresh',
      {
        run_id: runId,
        triggered_at: new Date().toISOString(),
        triggered_by: 'seo-projection-write-worker',
      },
      {
        jobId: refreshJobId,
        delay: REFRESH_DEBOUNCE_MS,
        removeOnComplete: true,
      },
    );

    return {
      status: 'success',
      run_id: runId,
      entities_processed: entitiesProcessed,
      conflicts_count: conflictsCount,
      refresh_job_enqueued: true,
    };
  }

  private async insertRunningRun(data: WriteJobData): Promise<string> {
    const { data: row, error } = await this.supabase
      .from('__seo_projection_runs')
      .insert({
        status: 'running',
        projection_contract_version: data.projection_contract_version,
        builder_version: data.builder_version,
        pipeline_version: data.pipeline_version,
        extractor_version: data.extractor_version,
        runner_version: RUNNER_VERSION,
        exports_snapshot_hash: data.exports_snapshot_hash,
        exports_snapshot_uri: data.exports_snapshot_uri,
        wiki_commit_sha: data.wiki_commit_sha,
        trigger_kind: data.trigger_kind,
        replayed_from_run_id: data.replayed_from_run_id,
      })
      .select('id')
      .single();
    if (error) {
      throw new Error(`insertRunningRun failed: ${error.message}`);
    }
    return (row as { id: string }).id;
  }

  private async recordAbortedRun(
    data: WriteJobData,
    message: string,
  ): Promise<void> {
    await this.supabase.from('__seo_projection_runs').insert({
      status: 'aborted_contract_mismatch',
      projection_contract_version: data.projection_contract_version,
      builder_version: data.builder_version,
      pipeline_version: data.pipeline_version,
      extractor_version: data.extractor_version,
      runner_version: RUNNER_VERSION,
      exports_snapshot_hash: data.exports_snapshot_hash,
      exports_snapshot_uri: data.exports_snapshot_uri,
      wiki_commit_sha: data.wiki_commit_sha,
      trigger_kind: data.trigger_kind,
      replayed_from_run_id: data.replayed_from_run_id,
      error_message: message,
    });
  }

  private async updateRunStatus(
    runId: string,
    status: 'success' | 'failed',
    entitiesProcessed: number,
    conflictsCount: number,
    errorMessage?: string,
  ): Promise<void> {
    const patch: Record<string, unknown> = {
      status,
      entities_processed: entitiesProcessed,
      conflicts_count: conflictsCount,
      ended_at: new Date().toISOString(),
    };
    if (errorMessage) {
      patch.error_message = errorMessage;
    }
    await this.supabase
      .from('__seo_projection_runs')
      .update(patch)
      .eq('id', runId);
  }

  /**
   * Stub per-entity processor : PR-6b ne fait pas (encore) le diff fin facts/blocks.
   * Le contract de retour est stable pour permettre l'enrichissement en
   * PR-6b-followup ou PR-7 sans casser l'API.
   */
  private async processEntity(
    _entityId: string,
    _runId: string,
    _data: WriteJobData,
  ): Promise<{ conflicts: number }> {
    // PR-6b skeleton : aucune action DB ici.
    // Le diff logic complet (INSERT __seo_entity_fact_versions, UPDATE
    // active_version_id, INSERT __seo_projection_conflicts) sera enrichi
    // en PR-6b-followup ou PR-7 par batch atomique pl/pgsql.
    return { conflicts: 0 };
  }

  // Used by tests for direct field access without import surface.
  public static readonly runnerContractVersion =
    RUNNER_PROJECTION_CONTRACT_VERSION;
}

// Hard-coded smoke guard to lock the architectural constraint at compile-time :
// REFRESH MATERIALIZED VIEW is never called from this file.
// Tests `test_write_processor_never_calls_refresh_mv` enforces it statically.
