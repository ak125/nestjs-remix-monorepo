import {
  projectTruth,
  ConnectorState,
  type SupplierObservationInput,
  type SupplierProfileInput,
} from './truth-engine';
import { AvailabilityState, ConflictKind } from './availability-state';

const NOW = new Date('2026-05-20T12:00:00Z');

const obs = (
  o: Partial<SupplierObservationInput> & { supplierId: string },
): SupplierObservationInput => ({
  available: true,
  delayDays: null,
  parseError: false,
  fetchedAt: new Date('2026-05-20T11:30:00Z'),
  sourceVerifiedAt: null,
  ...o,
});

const profile = (
  p: Partial<SupplierProfileInput> & { supplierId: string },
): SupplierProfileInput => ({
  reliabilityScore: 90,
  supplierStability: 1,
  mismatchRate: 0,
  timeoutRate: 0,
  defaultTtlMinutes: 720,
  connectorState: ConnectorState.ACTIVE,
  ...p,
});

describe('projectTruth', () => {
  it('no observations ⇒ UNKNOWN', () => {
    const r = projectTruth([], [], null, NOW);
    expect(r.state).toBe(AvailabilityState.UNKNOWN);
    expect(r.projectionReasonCode).toBe('NO_SNAPSHOT');
  });

  it('single fresh reliable available ⇒ VERIFIED_AVAILABLE', () => {
    const r = projectTruth(
      [obs({ supplierId: 's1' })],
      [profile({ supplierId: 's1' })],
      null,
      NOW,
    );
    expect(r.state).toBe(AvailabilityState.VERIFIED_AVAILABLE);
    expect(r.sourceSupplierId).toBe('s1');
  });

  it('cold-start (no profile) is never VERIFIED_AVAILABLE', () => {
    const r = projectTruth([obs({ supplierId: 's1' })], [], null, NOW);
    expect(r.state).not.toBe(AvailabilityState.VERIFIED_AVAILABLE);
  });

  it('reliable-but-older source beats fresh-but-broken source', () => {
    const r = projectTruth(
      [
        obs({
          supplierId: 'reliable',
          fetchedAt: new Date('2026-05-20T08:00:00Z'), // older
          available: true,
        }),
        obs({
          supplierId: 'broken',
          fetchedAt: new Date('2026-05-20T11:59:00Z'), // fresher
          parseError: true,
        }),
      ],
      [
        profile({ supplierId: 'reliable', reliabilityScore: 95 }),
        profile({ supplierId: 'broken', reliabilityScore: 95 }),
      ],
      null,
      NOW,
    );
    expect(r.sourceSupplierId).toBe('reliable');
  });

  it('two reliable sources disagreeing on availability ⇒ HARD_CONFLICT', () => {
    const r = projectTruth(
      [
        obs({ supplierId: 's1', available: true }),
        obs({ supplierId: 's2', available: false, delayDays: 5 }),
      ],
      [profile({ supplierId: 's1' }), profile({ supplierId: 's2' })],
      null,
      NOW,
    );
    expect(r.conflictKind).toBe(ConflictKind.HARD_CONFLICT);
    expect(r.state).toBe(AvailabilityState.HARD_CONFLICT);
  });

  it('snapshot older than TTL ⇒ STALE', () => {
    const r = projectTruth(
      [
        obs({
          supplierId: 's1',
          fetchedAt: new Date('2026-05-18T12:00:00Z'), // 48h old
        }),
      ],
      [profile({ supplierId: 's1', defaultTtlMinutes: 720 })], // 12h ttl
      null,
      NOW,
    );
    expect(r.state).toBe(AvailabilityState.STALE);
  });

  it('quarantined connector never yields VERIFIED_AVAILABLE', () => {
    const r = projectTruth(
      [obs({ supplierId: 's1' })],
      [
        profile({
          supplierId: 's1',
          connectorState: ConnectorState.QUARANTINED,
        }),
      ],
      null,
      NOW,
    );
    expect(r.state).not.toBe(AvailabilityState.VERIFIED_AVAILABLE);
  });

  it('anti-flap: a held VERIFIED_AVAILABLE survives one soft downgrade (dwell 2)', () => {
    // a single stale observation; prev was VERIFIED with counter 0
    const r = projectTruth(
      [obs({ supplierId: 's1', fetchedAt: new Date('2026-05-18T12:00:00Z') })],
      [profile({ supplierId: 's1', defaultTtlMinutes: 720 })],
      { state: AvailabilityState.VERIFIED_AVAILABLE, stateCounter: 0 },
      NOW,
      { hysteresisDwell: 2 },
    );
    expect(r.state).toBe(AvailabilityState.VERIFIED_AVAILABLE);
    expect(r.projectionReasonCode).toBe('HELD_ANTIFLAP');
    expect(r.stateCounter).toBe(1);
  });

  it('anti-flap: second consecutive soft downgrade confirms the change', () => {
    const r = projectTruth(
      [obs({ supplierId: 's1', fetchedAt: new Date('2026-05-18T12:00:00Z') })],
      [profile({ supplierId: 's1', defaultTtlMinutes: 720 })],
      { state: AvailabilityState.VERIFIED_AVAILABLE, stateCounter: 1 },
      NOW,
      { hysteresisDwell: 2 },
    );
    expect(r.state).toBe(AvailabilityState.STALE);
  });

  it('HARD_CONFLICT bypasses hysteresis (immediate)', () => {
    const r = projectTruth(
      [
        obs({ supplierId: 's1', available: true }),
        obs({ supplierId: 's2', available: false, delayDays: 5 }),
      ],
      [profile({ supplierId: 's1' }), profile({ supplierId: 's2' })],
      { state: AvailabilityState.VERIFIED_AVAILABLE, stateCounter: 0 },
      NOW,
    );
    expect(r.state).toBe(AvailabilityState.HARD_CONFLICT);
  });

  // --- deterministic invariant sweep (property-style without fast-check) ---
  it('is deterministic: identical inputs ⇒ identical row + same inputs hash', () => {
    const o = [
      obs({ supplierId: 's1' }),
      obs({ supplierId: 's2', available: false, delayDays: 3 }),
    ];
    const p = [profile({ supplierId: 's1' }), profile({ supplierId: 's2' })];
    const a = projectTruth(o, p, null, NOW);
    const b = projectTruth(o, p, null, NOW);
    expect(a).toEqual(b);
    expect(a.projectionInputsHash).toBe(b.projectionInputsHash);
  });

  it('invariant: parse-error or quarantined best source ⇒ never VERIFIED_AVAILABLE (seeded sweep)', () => {
    let seed = 12345;
    const rand = () => {
      // deterministic LCG
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < 300; i++) {
      const parseError = rand() > 0.5;
      const quarantined = rand() > 0.5;
      if (!parseError && !quarantined) continue;
      const r = projectTruth(
        [
          obs({
            supplierId: 's1',
            available: rand() > 0.3,
            parseError,
            delayDays: rand() > 0.5 ? Math.floor(rand() * 10) : null,
          }),
        ],
        [
          profile({
            supplierId: 's1',
            connectorState: quarantined
              ? ConnectorState.QUARANTINED
              : ConnectorState.ACTIVE,
            reliabilityScore: Math.floor(rand() * 100),
          }),
        ],
        null,
        NOW,
      );
      expect(r.state).not.toBe(AvailabilityState.VERIFIED_AVAILABLE);
    }
  });
});
