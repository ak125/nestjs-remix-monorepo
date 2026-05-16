/**
 * ADR-072 PR 2D-3 — R8 seed-run job orchestrator.
 *
 * Owns the state-machine of admin-triggered R8 seed runs :
 *
 *   POST /api/admin/seo/r2/r8-seed/run
 *     → atomic INSERT/lookup `__seo_admin_job` (RPC __seo_admin_job_accept)
 *     → enqueue BullMQ job `r8-seed-run` (only if new — idempotent hits skip enqueue)
 *     → 202 Accepted
 *
 *   Worker (R8SeedRunProcessor)
 *     → RPC __seo_admin_job_transition (running)
 *     → R8SnapshotSeedService.run(input)
 *     → RPC __seo_admin_job_transition (completed | failed)
 *
 *   GET /api/admin/seo/r2/r8-seed/run/:runId
 *     → SELECT FROM __seo_admin_job
 *
 * Industry-standard patterns referenced :
 *   - Stripe idempotent requests (idempotency_key UNIQUE + RPC accept)
 *   - AWS Step Functions execution history (single source of truth row)
 *   - Temporal Workflow Executions (state-machine in DB, worker advances it)
 *
 * No "ad-hoc one-shot script". Every admin invocation = a traceable row.
 */

import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bull';
import { SupabaseBaseService } from '../../../../database/services/supabase-base.service';
import {
  R8_SEED_RUN_JOB_NAME,
  R8_SEED_RUN_QUEUE_NAME,
  R8SeedRunJobData,
} from '../queues/r8-seed-run.constants';
import {
  AdminJobRow,
  AdminJobRowSchema,
  AdminJobStatus,
  R8SeedRunAcceptResponse,
  R8SeedRunRequest,
} from '../schemas/admin-job.schema';

interface AcceptRpcRow {
  job_id: string;
  status: AdminJobStatus;
  idempotent_hit: boolean;
  accepted_at: string;
}

interface AdminJobDbRow {
  job_id: string;
  job_type: string;
  idempotency_key: string;
  status: AdminJobStatus;
  input: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  actor: string;
  trace_id: string | null;
  accepted_at: string;
  started_at: string | null;
  finished_at: string | null;
}

const R8_SEED_RUN_JOB_TYPE = 'r8_seed_run';

@Injectable()
export class R2R8SeedJobOrchestratorService extends SupabaseBaseService {
  protected readonly logger = new Logger(R2R8SeedJobOrchestratorService.name);

  constructor(
    @InjectQueue(R8_SEED_RUN_QUEUE_NAME)
    private readonly seedRunQueue: Queue<R8SeedRunJobData>,
  ) {
    super();
  }

  /**
   * Accept an R8 seed run request. Idempotent on `idempotencyKey` — same key
   * always returns the same `runId`.
   */
  async accept(
    request: R8SeedRunRequest,
    actor: string,
    traceId?: string,
  ): Promise<R8SeedRunAcceptResponse> {
    const input = {
      dryRun: request.dryRun,
      batchSize: request.batchSize ?? null,
      sinceTypeId: request.sinceTypeId ?? null,
      maxBatches: request.maxBatches ?? null,
    };

    const { data, error } = await this.callRpc<AcceptRpcRow[]>(
      '__seo_admin_job_accept',
      {
        p_job_type: R8_SEED_RUN_JOB_TYPE,
        p_idempotency_key: request.idempotencyKey,
        p_input: input,
        p_actor: actor,
        p_trace_id: traceId ?? null,
      },
    );

    if (error) {
      this.logger.error(
        `accept(${request.idempotencyKey}) RPC failed: ${error.message}`,
      );
      throw new Error(`r8_seed_accept_failed: ${error.message}`);
    }

    const row = Array.isArray(data) ? data[0] : (data as AcceptRpcRow | null);
    if (!row || typeof row.job_id !== 'string') {
      throw new Error('r8_seed_accept_invalid_response');
    }

    // Only enqueue for NEW jobs — idempotent hits return the cached row, no
    // double-work. If the original job is still 'pending' and somehow lost
    // from the queue (Redis restart), the operator can call POST again with
    // a different idempotencyKey to force a new run.
    if (!row.idempotent_hit) {
      await this.seedRunQueue.add(
        R8_SEED_RUN_JOB_NAME,
        { jobId: row.job_id, ...input } as R8SeedRunJobData,
        {
          jobId: `r8-seed-${row.job_id}`, // BullMQ-level idempotent enqueue
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 1, // failures persist in __seo_admin_job — no retry storms
        },
      );
    }

    return {
      runId: row.job_id,
      status: row.status,
      idempotentHit: row.idempotent_hit,
      acceptedAt: row.accepted_at,
      dryRun: request.dryRun,
    };
  }

  async getRun(runId: string): Promise<AdminJobRow | null> {
    const { data, error } = await this.supabase
      .from('__seo_admin_job')
      .select(
        'job_id, job_type, idempotency_key, status, input, result, error, actor, trace_id, accepted_at, started_at, finished_at',
      )
      .eq('job_id', runId)
      .maybeSingle();

    if (error) {
      this.logger.error(`getRun(${runId}) failed: ${error.message}`);
      throw new Error(`r8_seed_get_run_failed: ${error.message}`);
    }
    if (!data) {
      return null;
    }
    return this.toDomain(data as AdminJobDbRow);
  }

  /**
   * Worker-only state transition helper. Used by R8SeedRunProcessor.
   */
  async transition(
    runId: string,
    newStatus: AdminJobStatus,
    payload: { result?: Record<string, unknown>; error?: string } = {},
  ): Promise<AdminJobRow> {
    const { data, error } = await this.callRpc<AdminJobDbRow>(
      '__seo_admin_job_transition',
      {
        p_job_id: runId,
        p_new_status: newStatus,
        p_result: payload.result ?? null,
        p_error: payload.error ?? null,
      },
    );

    if (error) {
      this.logger.error(
        `transition(${runId}, ${newStatus}) RPC failed: ${error.message}`,
      );
      throw new Error(`r8_seed_transition_failed: ${error.message}`);
    }

    const row = Array.isArray(data) ? data[0] : (data as AdminJobDbRow | null);
    if (!row) {
      throw new Error('r8_seed_transition_invalid_response');
    }
    return this.toDomain(row);
  }

  private toDomain(row: AdminJobDbRow): AdminJobRow {
    const parsed = AdminJobRowSchema.safeParse({
      jobId: row.job_id,
      jobType: row.job_type,
      idempotencyKey: row.idempotency_key,
      status: row.status,
      input: row.input,
      result: row.result,
      error: row.error,
      actor: row.actor,
      traceId: row.trace_id,
      acceptedAt: row.accepted_at,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
    });

    if (!parsed.success) {
      throw new Error(`admin_job_zod_parse_failed: ${parsed.error.message}`);
    }
    return parsed.data;
  }
}
