import { SupplierSyncProcessor } from './supplier-sync.processor';
import type { SupplierTruthRepository } from './supplier-truth.repository';
import type {
  SupplierConnector,
  SupplierObservation,
} from './connectors/supplier-connector.interface';
import { AvailabilityState } from './domain/availability-state';

const obs = (o: Partial<SupplierObservation>): SupplierObservation => ({
  supplierId: '26',
  rawRef: 'ELH4261',
  available: true,
  delayDays: null,
  sourceVerifiedAt: null,
  freshnessProvenance: 'CONNECTOR_FETCHED',
  parseError: false,
  priceBuyHt: null,
  ...o,
});

function mockConnector(observations: SupplierObservation[]): SupplierConnector {
  return {
    supplierId: '26',
    platform: 'inoshop',
    login: jest.fn(async () => {}),
    fetchAvailability: jest.fn(async () => observations),
  };
}

function mockRepo() {
  const inserted: unknown[] = [];
  const upserted: { piece_id: number; state: string }[] = [];
  const repo = {
    resolveRefToPieceIds: jest.fn(async (n: string) =>
      n === 'ELH4261' ? [123] : [],
    ),
    insertSnapshot: jest.fn(async (s: unknown) => {
      inserted.push(s);
    }),
    readRecentSnapshots: jest.fn(async (pieceId: number) => [
      {
        id: 1,
        supplier_id: '26',
        piece_id: pieceId,
        raw_ref: 'ELH4261',
        normalized_ref: 'ELH4261',
        available: true,
        delay_days: null,
        parse_error: false,
        fetched_at: new Date().toISOString(),
        source_verified_at: null,
        freshness_provenance: 'CONNECTOR_FETCHED',
      },
    ]),
    getSupplierProfile: jest.fn(async () => null), // cold start
    getProjection: jest.fn(async () => null),
    upsertProjection: jest.fn(
      async (row: { piece_id: number; state: string }) => {
        upserted.push({ piece_id: row.piece_id, state: row.state });
      },
    ),
  } as unknown as SupplierTruthRepository;
  return { repo, inserted, upserted };
}

describe('SupplierSyncProcessor.syncRefs', () => {
  it('inserts a snapshot per observation, emits unresolved, upserts resolved projections', async () => {
    const { repo, inserted, upserted } = mockRepo();
    const events: { name: string; payload: unknown }[] = [];
    const proc = new SupplierSyncProcessor(repo, (name, payload) =>
      events.push({ name, payload }),
    );
    const connector = mockConnector([
      obs({ rawRef: 'ELH4261' }),
      obs({ rawRef: 'NOPE', available: false }),
    ]);

    const res = await proc.syncRefs(connector, ['ELH4261', 'NOPE']);

    expect(res.observations).toBe(2);
    expect(res.snapshotsInserted).toBe(2);
    expect(inserted).toHaveLength(2);
    expect(res.unresolved).toBe(1);
    expect(events.some((e) => e.name === 'supplier.ref.unresolved')).toBe(true);
    // only the resolved piece (123) gets a projection
    expect(res.projectionsUpserted).toBe(1);
    expect(upserted).toHaveLength(1);
    expect(upserted[0].piece_id).toBe(123);
  });

  it('cold-start supplier (no profile) never yields VERIFIED_AVAILABLE', async () => {
    const { repo, upserted } = mockRepo();
    const proc = new SupplierSyncProcessor(repo);
    await proc.syncRefs(mockConnector([obs({ rawRef: 'ELH4261' })]), [
      'ELH4261',
    ]);
    expect(upserted[0].state).not.toBe(AvailabilityState.VERIFIED_AVAILABLE);
    expect(upserted[0].state).toBe(AvailabilityState.SUPPLIER_PENDING);
  });

  it('a parse-error observation is still snapshotted (append-only) but stays safe', async () => {
    const { repo, inserted } = mockRepo();
    const proc = new SupplierSyncProcessor(repo);
    const res = await proc.syncRefs(
      mockConnector([
        obs({ rawRef: 'ELH4261', parseError: true, available: false }),
      ]),
      ['ELH4261'],
    );
    expect(inserted).toHaveLength(1);
    expect(res.projectionsUpserted).toBe(1);
  });
});
