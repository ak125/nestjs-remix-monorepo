/**
 * ADR-072 PR 2D-3 — R2R8SeedJobOrchestratorService unit tests.
 *
 * Covers : idempotent accept (new vs hit), BullMQ enqueue gating, getRun
 * lookup, transition success/failure, Zod validation drift.
 */

import { Queue } from 'bull';
import { R2R8SeedJobOrchestratorService } from '../r2-r8-seed-job-orchestrator.service';

interface QueueCall {
  jobName: string;
  data: Record<string, unknown>;
  options: Record<string, unknown>;
}

function makeQueue(): { queue: Queue; calls: QueueCall[] } {
  const calls: QueueCall[] = [];
  const queue = {
    add: async (jobName: string, data: unknown, options: unknown) => {
      calls.push({
        jobName,
        data: data as Record<string, unknown>,
        options: options as Record<string, unknown>,
      });
    },
  } as unknown as Queue;
  return { queue, calls };
}

interface RpcCall {
  name: string;
  args: Record<string, unknown>;
}

function makeFakeSupabase(opts: {
  acceptResponse?: {
    data: unknown;
    error: { message: string } | null;
  };
  transitionResponse?: {
    data: unknown;
    error: { message: string } | null;
  };
  getRunResponse?: {
    data: unknown;
    error: { message: string } | null;
  };
}) {
  const calls: RpcCall[] = [];
  return {
    supabase: {
      rpc: (name: string, args: Record<string, unknown>) => {
        calls.push({ name, args });
        if (name === '__seo_admin_job_accept') {
          return Promise.resolve(
            opts.acceptResponse ?? { data: null, error: null },
          );
        }
        if (name === '__seo_admin_job_transition') {
          return Promise.resolve(
            opts.transitionResponse ?? { data: null, error: null },
          );
        }
        return Promise.resolve({ data: null, error: null });
      },
      from: (_table: string) => ({
        select: (_cols: string) => ({
          eq: (_col: string, _val: unknown) => ({
            maybeSingle: () =>
              Promise.resolve(
                opts.getRunResponse ?? { data: null, error: null },
              ),
          }),
        }),
      }),
    },
    calls,
  };
}

function createService(supabase: unknown, queue: Queue) {
  const svc = Object.create(
    R2R8SeedJobOrchestratorService.prototype,
  ) as R2R8SeedJobOrchestratorService;
  (
    svc as unknown as {
      logger: { log: () => void; error: () => void; warn: () => void };
    }
  ).logger = { log: () => {}, error: () => {}, warn: () => {} };
  (svc as unknown as { supabase: unknown }).supabase = supabase;
  (svc as unknown as { seedRunQueue: Queue }).seedRunQueue = queue;
  return svc;
}

const validJobUuid = '550e8400-e29b-41d4-a716-446655440000';
const validIdempotencyKey = 'unit-test-key-1234';

describe('R2R8SeedJobOrchestratorService', () => {
  describe('accept', () => {
    it('enqueues BullMQ job on a new run', async () => {
      const { supabase, calls: rpcCalls } = makeFakeSupabase({
        acceptResponse: {
          data: [
            {
              job_id: validJobUuid,
              status: 'pending',
              idempotent_hit: false,
              accepted_at: '2026-05-16T14:00:00Z',
            },
          ],
          error: null,
        },
      });
      const { queue, calls: queueCalls } = makeQueue();
      const svc = createService(supabase, queue);

      const response = await svc.accept(
        {
          idempotencyKey: validIdempotencyKey,
          dryRun: false,
        },
        'alice@example.com',
      );

      expect(response.runId).toBe(validJobUuid);
      expect(response.status).toBe('pending');
      expect(response.idempotentHit).toBe(false);
      expect(rpcCalls).toHaveLength(1);
      expect(rpcCalls[0].args.p_idempotency_key).toBe(validIdempotencyKey);
      expect(rpcCalls[0].args.p_actor).toBe('alice@example.com');
      expect(queueCalls).toHaveLength(1);
      expect(queueCalls[0].options.jobId).toBe(`r8-seed-${validJobUuid}`);
    });

    it('skips enqueue on idempotent hit', async () => {
      const { supabase } = makeFakeSupabase({
        acceptResponse: {
          data: [
            {
              job_id: validJobUuid,
              status: 'completed',
              idempotent_hit: true,
              accepted_at: '2026-05-16T14:00:00Z',
            },
          ],
          error: null,
        },
      });
      const { queue, calls: queueCalls } = makeQueue();
      const svc = createService(supabase, queue);

      const response = await svc.accept(
        { idempotencyKey: validIdempotencyKey, dryRun: false },
        'alice@example.com',
      );

      expect(response.idempotentHit).toBe(true);
      expect(response.status).toBe('completed');
      expect(queueCalls).toHaveLength(0);
    });

    it('throws when RPC errors', async () => {
      const { supabase } = makeFakeSupabase({
        acceptResponse: {
          data: null,
          error: { message: 'unique violation race' },
        },
      });
      const { queue } = makeQueue();
      const svc = createService(supabase, queue);

      await expect(
        svc.accept(
          { idempotencyKey: validIdempotencyKey, dryRun: false },
          'alice@example.com',
        ),
      ).rejects.toThrow(/r8_seed_accept_failed/);
    });

    it('throws on malformed RPC response', async () => {
      const { supabase } = makeFakeSupabase({
        acceptResponse: { data: [], error: null },
      });
      const { queue } = makeQueue();
      const svc = createService(supabase, queue);

      await expect(
        svc.accept(
          { idempotencyKey: validIdempotencyKey, dryRun: false },
          'alice@example.com',
        ),
      ).rejects.toThrow(/r8_seed_accept_invalid_response/);
    });
  });

  describe('getRun', () => {
    it('returns null when row missing', async () => {
      const { supabase } = makeFakeSupabase({
        getRunResponse: { data: null, error: null },
      });
      const { queue } = makeQueue();
      const svc = createService(supabase, queue);
      const result = await svc.getRun(validJobUuid);
      expect(result).toBeNull();
    });

    it('maps DB row to domain via Zod', async () => {
      const { supabase } = makeFakeSupabase({
        getRunResponse: {
          data: {
            job_id: validJobUuid,
            job_type: 'r8_seed_run',
            idempotency_key: validIdempotencyKey,
            status: 'completed',
            input: { dryRun: false },
            result: { totalSeeded: 10 },
            error: null,
            actor: 'alice@example.com',
            trace_id: null,
            accepted_at: '2026-05-16T14:00:00Z',
            started_at: '2026-05-16T14:00:05Z',
            finished_at: '2026-05-16T14:01:30Z',
          },
          error: null,
        },
      });
      const { queue } = makeQueue();
      const svc = createService(supabase, queue);
      const result = await svc.getRun(validJobUuid);
      expect(result?.jobId).toBe(validJobUuid);
      expect(result?.status).toBe('completed');
      expect(result?.result?.totalSeeded).toBe(10);
    });

    it('throws when DB query errors', async () => {
      const { supabase } = makeFakeSupabase({
        getRunResponse: {
          data: null,
          error: { message: 'connection refused' },
        },
      });
      const { queue } = makeQueue();
      const svc = createService(supabase, queue);
      await expect(svc.getRun(validJobUuid)).rejects.toThrow(
        /r8_seed_get_run_failed/,
      );
    });
  });

  describe('transition', () => {
    it('calls __seo_admin_job_transition RPC and parses result', async () => {
      const { supabase, calls: rpcCalls } = makeFakeSupabase({
        transitionResponse: {
          data: {
            job_id: validJobUuid,
            job_type: 'r8_seed_run',
            idempotency_key: validIdempotencyKey,
            status: 'running',
            input: {},
            result: null,
            error: null,
            actor: 'alice@example.com',
            trace_id: null,
            accepted_at: '2026-05-16T14:00:00Z',
            started_at: '2026-05-16T14:00:05Z',
            finished_at: null,
          },
          error: null,
        },
      });
      const { queue } = makeQueue();
      const svc = createService(supabase, queue);
      const result = await svc.transition(validJobUuid, 'running');
      expect(rpcCalls[0].args.p_new_status).toBe('running');
      expect(result.status).toBe('running');
    });

    it('throws when state-machine RPC rejects the transition', async () => {
      const { supabase } = makeFakeSupabase({
        transitionResponse: {
          data: null,
          error: { message: 'admin_job_invalid_transition:completed->running' },
        },
      });
      const { queue } = makeQueue();
      const svc = createService(supabase, queue);
      await expect(svc.transition(validJobUuid, 'running')).rejects.toThrow(
        /r8_seed_transition_failed/,
      );
    });
  });
});
