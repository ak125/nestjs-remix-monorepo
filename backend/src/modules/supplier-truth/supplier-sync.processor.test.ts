import { SupplierSyncProcessor } from './supplier-sync.processor';
import type {
  SupplierTruthRepository,
  OfferSnapshotInsert,
} from './supplier-truth.repository';
import type {
  SupplierConnector,
  SupplierObservation,
} from './connectors/supplier-connector.interface';

const obs = (o: Partial<SupplierObservation>): SupplierObservation => ({
  supplierId: '71',
  rawRef: 'ELH4261',
  available: true,
  delayDays: null,
  sourceVerifiedAt: null,
  freshnessProvenance: 'CONNECTOR_FETCHED',
  parseError: false,
  priceBuyHt: null,
  priceBaseHt: null,
  remisePct: null,
  ...o,
});

function mockConnector(observations: SupplierObservation[]): SupplierConnector {
  return {
    supplierId: '71',
    platform: 'inoshop',
    login: jest.fn(async () => {}),
    fetchAvailability: jest.fn(async () => observations),
  };
}

function mockRepo() {
  const offers: OfferSnapshotInsert[] = [];
  const repo = {
    resolveRefToPieceIds: jest.fn(async (n: string) =>
      n === 'ELH4261' ? [123] : [],
    ),
    insertOffer: jest.fn(async (o: OfferSnapshotInsert) => {
      offers.push(o);
    }),
  } as unknown as SupplierTruthRepository;
  return { repo, offers };
}

describe('SupplierSyncProcessor.syncRefs (canonical supplier_offer_snapshot ingestion)', () => {
  it('writes one offer per RESOLVED observation; emits + skips unresolved (piece_id_i is NOT NULL)', async () => {
    const { repo, offers } = mockRepo();
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
    expect(res.offersInserted).toBe(1); // only the resolved ref is written
    expect(res.unresolved).toBe(1);
    expect(offers).toHaveLength(1);
    expect(offers[0].piece_id_i).toBe(123);
    expect(events.some((e) => e.name === 'supplier.ref.unresolved')).toBe(true);
  });

  it('captures the FULL price triplet in integer cents (no data loss)', async () => {
    const { repo, offers } = mockRepo();
    const proc = new SupplierSyncProcessor(repo);

    await proc.syncRefs(
      mockConnector([
        obs({
          rawRef: 'ELH4261',
          priceBaseHt: 320.3, // public HT €
          remisePct: 50,
          priceBuyHt: 160.15, // achat HT €
          delayDays: 3,
        }),
      ]),
      ['ELH4261'],
    );

    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({
      supplier_id: '71',
      supplier_ref: 'ELH4261',
      public_ht_cents: 32030,
      remise_pct: 50,
      achat_ht_cents: 16015,
      available: true,
      delay_days: 3,
      parse_confidence: 'HIGH_CONFIDENCE',
    });
  });

  it('a parse-error observation is stored with parse_confidence UNKNOWN', async () => {
    const { repo, offers } = mockRepo();
    const proc = new SupplierSyncProcessor(repo);

    const res = await proc.syncRefs(
      mockConnector([
        obs({ rawRef: 'ELH4261', parseError: true, available: false }),
      ]),
      ['ELH4261'],
    );

    expect(res.offersInserted).toBe(1);
    expect(offers[0].parse_confidence).toBe('UNKNOWN');
  });
});
