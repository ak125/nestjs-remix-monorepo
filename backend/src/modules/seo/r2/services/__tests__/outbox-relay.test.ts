/**
 * ADR-072 PR 2D-2 — OutboxRelayService unit tests.
 *
 * Covers : empty claim short-circuit, RPC error short-circuit, route-and-publish
 * happy path, unroutable event_type → requeue + attempts++, publisher throw →
 * markFailed.
 */

import {
  OutboxRelayPublisher,
  OutboxRelayService,
  OutboxRow,
} from '../outbox-relay.service';

const sampleOutboxRow: OutboxRow = {
  id: 11,
  aggregate_type: 'R8VehicleSnapshot',
  aggregate_id: '12345',
  event_type: 'R8SnapshotUpdated',
  payload: { typeId: 12345 },
  trace_id: null,
  occurred_at: '2026-05-16T10:00:00Z',
  attempts: 0,
};

interface RecordedPublish {
  queue: string;
  eventType: string;
  row: OutboxRow;
}

function makePublisher(opts: { throwOn?: number } = {}): {
  publisher: OutboxRelayPublisher;
  published: RecordedPublish[];
} {
  const published: RecordedPublish[] = [];
  const publisher: OutboxRelayPublisher = {
    publish: async (queue, eventType, row) => {
      if (opts.throwOn === row.id) {
        throw new Error('queue down');
      }
      published.push({ queue, eventType, row });
    },
  };
  return { publisher, published };
}

interface RecordedUpdate {
  values: Record<string, unknown>;
  where: Record<string, unknown>;
}

function makeFakeSupabase(opts: {
  rpcRows?: OutboxRow[] | null;
  rpcError?: { message: string };
}) {
  const updates: RecordedUpdate[] = [];
  return {
    supabase: {
      rpc(name: string, _args: Record<string, unknown>) {
        expect(name).toBe('__seo_outbox_claim_batch');
        if (opts.rpcError) {
          return Promise.resolve({ data: null, error: opts.rpcError });
        }
        return Promise.resolve({
          data: opts.rpcRows ?? [],
          error: null,
        });
      },
      from(_table: string) {
        return {
          update(values: Record<string, unknown>) {
            return {
              eq(col: string, val: unknown) {
                updates.push({ values, where: { [col]: val } });
                return Promise.resolve({ data: null, error: null });
              },
            };
          },
        };
      },
    },
    updates,
  };
}

function createService(supabase: unknown): OutboxRelayService {
  const svc = Object.create(OutboxRelayService.prototype) as OutboxRelayService;
  (
    svc as unknown as {
      logger: { log: () => void; error: () => void; warn: () => void };
    }
  ).logger = { log: () => {}, error: () => {}, warn: () => {} };
  (svc as unknown as { supabase: unknown }).supabase = supabase;
  return svc;
}

describe('OutboxRelayService.pollOnce', () => {
  it('short-circuits cleanly when no rows are claimed', async () => {
    const { supabase, updates } = makeFakeSupabase({ rpcRows: [] });
    const { publisher, published } = makePublisher();
    const svc = createService(supabase);
    const result = await svc.pollOnce({ publisher });

    expect(result.claimed).toBe(0);
    expect(result.published).toBe(0);
    expect(result.failed).toBe(0);
    expect(updates).toHaveLength(0);
    expect(published).toHaveLength(0);
  });

  it('returns zero counts when RPC errors out (no throw)', async () => {
    const { supabase } = makeFakeSupabase({
      rpcError: { message: 'tx timeout' },
    });
    const { publisher } = makePublisher();
    const svc = createService(supabase);
    const result = await svc.pollOnce({ publisher });

    expect(result.claimed).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('publishes routable events to r8-enrichment queue', async () => {
    const { supabase, updates } = makeFakeSupabase({
      rpcRows: [sampleOutboxRow],
    });
    const { publisher, published } = makePublisher();
    const svc = createService(supabase);
    const result = await svc.pollOnce({ publisher });

    expect(result.claimed).toBe(1);
    expect(result.published).toBe(1);
    expect(result.failed).toBe(0);
    expect(published).toHaveLength(1);
    expect(published[0].queue).toBe('r8-enrichment');
    expect(published[0].eventType).toBe('R8SnapshotUpdated');
    expect(updates).toHaveLength(0);
  });

  it('requeues unroutable events (resets published_at, increments attempts)', async () => {
    const { supabase, updates } = makeFakeSupabase({
      rpcRows: [{ ...sampleOutboxRow, event_type: 'UnknownEvent' }],
    });
    const { publisher, published } = makePublisher();
    const svc = createService(supabase);
    const result = await svc.pollOnce({ publisher });

    expect(result.claimed).toBe(1);
    expect(result.published).toBe(0);
    expect(result.failed).toBe(1);
    expect(published).toHaveLength(0);
    expect(updates).toHaveLength(1);
    expect(updates[0].values.published_at).toBeNull();
    expect(updates[0].values.attempts).toBe(1);
    expect(updates[0].values.last_error).toContain('unroutable_event_type');
  });

  it('marks failed when publisher throws (without reverting published_at)', async () => {
    const { supabase, updates } = makeFakeSupabase({
      rpcRows: [sampleOutboxRow],
    });
    const { publisher } = makePublisher({ throwOn: sampleOutboxRow.id });
    const svc = createService(supabase);
    const result = await svc.pollOnce({ publisher });

    expect(result.claimed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.published).toBe(0);
    expect(updates).toHaveLength(1);
    expect(updates[0].values.last_error).toMatch(/queue down/);
    expect(updates[0].values.published_at).toBeUndefined(); // not reverted
  });
});
