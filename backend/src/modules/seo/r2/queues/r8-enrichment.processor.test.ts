/**
 * OutboxRelayProcessor.publish — R8SnapshotUpdated must not re-enqueue the
 * enrichment that emitted it : `__seo_r8_publish_snapshot` inserts a new
 * R8SnapshotUpdated on every call (idempotent hit included), so routing the
 * event back to `r8-enrichment` loops forever.
 */

import { OutboxRow } from '../services/outbox-relay.service';
import {
  R8_ENRICHMENT_JOB_NAME,
  R8_ENRICHMENT_QUEUE_NAME,
} from './r8-enrichment.constants';
import { OutboxRelayProcessor } from './r8-enrichment.processor';

function makeProcessor() {
  const added: Array<{ name: string; data: unknown }> = [];
  const processor = Object.create(
    OutboxRelayProcessor.prototype,
  ) as OutboxRelayProcessor;
  (processor as unknown as { r8EnrichmentQueue: unknown }).r8EnrichmentQueue = {
    async add(name: string, data: unknown) {
      added.push({ name, data });
    },
  };
  return { processor, added };
}

const row = (eventType: string): OutboxRow =>
  ({
    id: 42,
    aggregate_type: 'R8VehicleSnapshot',
    aggregate_id: '19053',
    event_type: eventType,
    payload: {},
  }) as unknown as OutboxRow;

describe('OutboxRelayProcessor.publish', () => {
  it('acks R8SnapshotUpdated without re-enqueueing r8-enrichment', async () => {
    const { processor, added } = makeProcessor();
    await expect(
      processor.publish(
        R8_ENRICHMENT_QUEUE_NAME,
        'R8SnapshotUpdated',
        row('R8SnapshotUpdated'),
      ),
    ).resolves.toBeUndefined();
    expect(added).toHaveLength(0);
  });

  it('still enqueues another event routed to r8-enrichment', async () => {
    const { processor, added } = makeProcessor();
    await processor.publish(
      R8_ENRICHMENT_QUEUE_NAME,
      'AutoTypeChanged',
      row('AutoTypeChanged'),
    );
    expect(added).toHaveLength(1);
    expect(added[0].name).toBe(R8_ENRICHMENT_JOB_NAME);
    expect(added[0].data).toMatchObject({ typeId: 19053 });
  });

  it('rejects an unrouted queue', async () => {
    const { processor } = makeProcessor();
    await expect(
      processor.publish('unknown-queue', 'R8SnapshotUpdated', row('X')),
    ).rejects.toThrow('unrouted_queue:unknown-queue');
  });
});
