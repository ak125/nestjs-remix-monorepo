// backend/src/workers/processors/__tests__/pipeline-chain.processor.test.ts

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY || 'test-service-key';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

/**
 * Statut de la ligne `__pipeline_chain_queue` (pcqId) mise à jour par le
 * processor après `router.execute()`.
 *
 * Avant : calcul local `every(success) ? 'done' : 'failed'` — une cible
 * `skipped` (dont le refus WriteGate R8 `write_gate_blocked`) passait la ligne
 * en `failed` pendant que `logExecution` écrivait `done` pour la même
 * exécution, et le détail d'un échec sans `error` était perdu
 * (« Some targets failed — check execution result »).
 *
 * Après : même calcul que `logExecution` (`summarizeQueueOutcome`).
 */

// Modules lourds sans rapport avec le calcul du statut (même stratégie que
// execution-router.service.test.ts).
jest.mock(
  '../../../modules/admin/services/buying-guide-enricher.service',
  () => ({
    BuyingGuideEnricherService: class {},
  }),
);
jest.mock('../../../modules/admin/services/r2-enricher.service', () => ({
  R2EnricherService: class {},
}));
jest.mock(
  '../../../modules/admin/services/r8-vehicle-enricher.service',
  () => ({
    R8VehicleEnricherService: class {},
  }),
);
jest.mock('../../../modules/admin/services/r7-brand-enricher.service', () => ({
  R7BrandEnricherService: class {},
}));
jest.mock(
  '../../../modules/admin/services/r4-content-enricher.service',
  () => ({
    R4ContentEnricherService: class {},
  }),
);
jest.mock('../../../modules/seo/services/reference.service', () => ({
  ReferenceService: class {},
}));
jest.mock('../../../modules/seo/validation/diagnostic.service', () => ({
  DiagnosticService: class {},
}));

import type { Job } from 'bull';
import {
  ExecutionRouterService,
  type ExecutionResult,
} from '../../../modules/admin/services/execution-router.service';
import {
  PipelineChainProcessor,
  type PipelineChainJobData,
} from '../pipeline-chain.processor';

const PCQ_ID = 4242;
const TYPE_ID = 19053;

type QueueUpdate = { pcqId: unknown; payload: Record<string, unknown> };

function buildProcessor(result: ExecutionResult) {
  const updates: QueueUpdate[] = [];
  const client = {
    from: jest.fn(() => ({
      update: jest.fn((payload: Record<string, unknown>) => ({
        eq: jest.fn((_column: string, pcqId: unknown) => {
          updates.push({ pcqId, payload });
          return Promise.resolve({ error: null });
        }),
      })),
    })),
  };

  // Vrai routeur (summarizeQueueOutcome réel), seul `execute` est simulé.
  const router = Object.create(
    ExecutionRouterService.prototype,
  ) as ExecutionRouterService;
  const execute = jest.fn().mockResolvedValue(result);
  Object.assign(router as unknown as Record<string, unknown>, { execute });

  const processor = Object.create(
    PipelineChainProcessor.prototype,
  ) as PipelineChainProcessor;
  Object.assign(processor as unknown as Record<string, unknown>, {
    logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    supabase: client,
    moduleRef: { get: jest.fn(() => router) },
    flags: { ragMergeAllowedRoles: [] },
  });

  const run = (data: Partial<PipelineChainJobData> = {}) =>
    processor.handleExecute({
      id: 'job-1',
      data: {
        roleId: 'R8_VEHICLE',
        targetIds: [String(TYPE_ID)],
        source: 'api',
        ...data,
      },
    } as unknown as Job<PipelineChainJobData>);

  return { run, updates, execute };
}

const r8Result = (
  status: 'success' | 'skipped' | 'failed',
  data: Record<string, unknown>,
): ExecutionResult => ({
  roleId: 'R8_VEHICLE',
  mode: 'draft',
  dryRun: false,
  totalTargets: 1,
  duration: 1,
  results: [{ targetId: String(TYPE_ID), status, data }],
});

describe('PipelineChainProcessor — queue row status after execution', () => {
  it('P1. R8 write_gate_blocked (skipped) → done + skipped reason, never failed', async () => {
    const { run, updates } = buildProcessor(
      r8Result('skipped', {
        status: 'write_gate_blocked',
        reason: 'WRITE_GATE_BLOCKED: stale_base',
        pageKey: `r8_vehicle_${TYPE_ID}`,
      }),
    );

    await run({ pcqId: PCQ_ID });

    expect(updates.map((u) => u.payload.pcq_status)).toEqual([
      'processing',
      'done',
    ]);
    expect(updates[1].pcqId).toBe(PCQ_ID);
    expect(updates[1].payload.pcq_error).toBe(
      '1/1 skipped: WRITE_GATE_BLOCKED: stale_base',
    );
    expect(updates[1].payload.pcq_processed_at).toEqual(expect.any(String));
  });

  it('P2. R8 DB_ERROR (failed, no thrown error) → failed + R8 reason, not the generic message', async () => {
    const { run, updates } = buildProcessor(
      r8Result('failed', {
        status: 'failed',
        reason: 'DB_ERROR: op=upsert code=42703 column does not exist',
        pageKey: `r8_vehicle_${TYPE_ID}`,
      }),
    );

    await run({ pcqId: PCQ_ID });

    expect(updates[1].payload).toMatchObject({
      pcq_status: 'failed',
      pcq_error: 'DB_ERROR: op=upsert code=42703 column does not exist',
    });
  });

  it('P3. written page → done, pcq_error untouched (control)', async () => {
    const { run, updates } = buildProcessor(
      r8Result('success', { status: 'draft' }),
    );

    await run({ pcqId: PCQ_ID });

    expect(updates[1].payload.pcq_status).toBe('done');
    expect(updates[1].payload).not.toHaveProperty('pcq_error');
  });

  it('P4. no pcqId → no queue update (unchanged)', async () => {
    const { run, updates, execute } = buildProcessor(
      r8Result('skipped', { status: 'write_gate_blocked' }),
    );

    await run();

    expect(execute).toHaveBeenCalledTimes(1);
    expect(updates).toEqual([]);
  });
});
