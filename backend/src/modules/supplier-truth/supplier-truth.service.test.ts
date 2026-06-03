import { SupplierTruthService } from './supplier-truth.service';
import type {
  SupplierTruthRepository,
  ProjectionRow,
} from './supplier-truth.repository';
import { AvailabilityState } from './domain/availability-state';

function svc(getProjection: (id: number) => Promise<ProjectionRow | null>) {
  const repo = { getProjection } as unknown as SupplierTruthRepository;
  return new SupplierTruthService(repo);
}

const row: ProjectionRow = {
  piece_id: 12345,
  state: 'VERIFIED_AVAILABLE',
  confidence: 85,
  delay_days: null,
  source_supplier: '26',
  conflict_kind: 'NONE',
  state_counter: 0,
  projection_reason_code: 'STATE_VERIFIED_AVAILABLE',
  projection_inputs_hash: 'abc',
  projection_version: 1,
};

describe('SupplierTruthService', () => {
  it('maps a projection row to the availability view', async () => {
    const v = await svc(async () => row).getProjection(12345);
    expect(v).toEqual({
      state: AvailabilityState.VERIFIED_AVAILABLE,
      confidence: 85,
      delayDays: null,
      sourceSupplier: '26',
    });
  });

  it('returns UNKNOWN when no projection exists (never throws)', async () => {
    const v = await svc(async () => null).getProjection(999);
    expect(v.state).toBe(AvailabilityState.UNKNOWN);
    expect(v.confidence).toBe(0);
  });

  it('batch maps missing pieces to UNKNOWN', async () => {
    const s = svc(async (id) => (id === 12345 ? row : null));
    const m = await s.getProjections([12345, 999]);
    expect(m.get(12345)?.state).toBe(AvailabilityState.VERIFIED_AVAILABLE);
    expect(m.get(999)?.state).toBe(AvailabilityState.UNKNOWN);
  });
});
