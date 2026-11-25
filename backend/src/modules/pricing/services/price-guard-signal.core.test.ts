/**
 * Garde-fou des prix → garde-prix.v1 (mandat EI). Contrat d'entrée de
 * .github/scripts/morning-health-digest.sh : schema, generated_at (texte),
 * declenchements[] de {cle (texte), at}, clé en [A-Za-z0-9_.:-] sur 64
 * caractères au plus ; une clé présente = un incident en cours.
 */
import {
  GARDE_PRIX_SCHEMA,
  buildGardePrix,
  countInvariantRejections,
  guardKey,
  readGardePrix,
  type GuardBatchRow,
  type SellAtLossScan,
} from './price-guard-signal.core';
import { OPERATION_ARRET_GARDE_FOU } from '../config/supplier-sale-rules';
import type { DryRunReport } from './price-import.dry-run';

const GEN = '2026-11-20T06:00:00.000Z';
const noLoss: SellAtLossScan = { scanned: 425_640, byBrand: new Map() };

const batch = (over: Partial<GuardBatchRow>): GuardBatchRow => ({
  batch_id: over.batch_id ?? `b-${Math.random()}`,
  supplier_id: '71',
  operation: null,
  status: 'COMMITTED',
  failed_rows: 0,
  started_at: '2026-11-01T10:00:00.000Z',
  completed_at: '2026-11-01T10:05:00.000Z',
  ...over,
});

const rows = (r: Array<Partial<DryRunReport['rows'][number]>>) =>
  ({ rows: r }) as unknown as DryRunReport;

describe('countInvariantRejections', () => {
  it('counts only rows refused by validatePriceChain', () => {
    expect(
      countInvariantRejections(
        rows([
          { rejected: false },
          { rejected: true, rejectReason: 'VENTE_BELOW_ACHAT' },
          {
            rejected: true,
            rejectReason: 'TVA_NOT_WHITELISTED,DELTA_EXCEEDS_MAX',
          },
          { rejected: true, rejectReason: 'NO_GRID_RULE' },
          { rejected: true, rejectReason: 'NO_MARGIN_FOR_INSERT' },
          { rejected: true, rejectReason: 'achat_ht illisible' },
          { rejected: true },
        ]),
      ),
    ).toBe(2);
  });

  it('is 0 for a clean report', () => {
    expect(countInvariantRejections(rows([{ rejected: false }]))).toBe(0);
  });
});

describe('guardKey', () => {
  it('keeps the characters and length the digest accepts', () => {
    const k = guardKey('perte', `pm${'x'.repeat(80)} é/`);
    expect(k).toMatch(/^[A-Za-z0-9_.:-]{1,64}$/);
    expect(k.startsWith('perte:pm')).toBe(true);
  });
});

describe('buildGardePrix', () => {
  it('writes the schema the digest validates, with no trigger when all is clean', () => {
    const out = buildGardePrix({
      generatedAt: GEN,
      batches: [batch({})],
      sellAtLoss: noLoss,
    });
    expect(out).toEqual({
      schema: GARDE_PRIX_SCHEMA,
      generated_at: GEN,
      declenchements: [],
    });
  });

  it('opens invariants:<supplier> when the latest import batch has refused rows', () => {
    const out = buildGardePrix({
      generatedAt: GEN,
      batches: [
        batch({ failed_rows: 0, started_at: '2026-11-01T10:00:00.000Z' }),
        batch({
          status: 'DRY_RUN_OK',
          failed_rows: 3,
          started_at: '2026-11-19T10:00:00.000Z',
          completed_at: null,
        }),
      ],
      sellAtLoss: noLoss,
    });
    expect(out.declenchements).toEqual([
      { cle: 'invariants:71', at: '2026-11-19T10:00:00.000Z' },
    ]);
  });

  it('closes the incident when a newer clean import batch exists', () => {
    const out = buildGardePrix({
      generatedAt: GEN,
      batches: [
        batch({ failed_rows: 3, started_at: '2026-11-19T10:00:00.000Z' }),
        batch({ failed_rows: 0, started_at: '2026-11-20T05:00:00.000Z' }),
      ],
      sellAtLoss: noLoss,
    });
    expect(out.declenchements).toEqual([]);
  });

  it('ignores in-flight or failed batches, so they never close an incident', () => {
    const out = buildGardePrix({
      generatedAt: GEN,
      batches: [
        batch({ failed_rows: 2, started_at: '2026-11-19T10:00:00.000Z' }),
        batch({ status: 'COMMITTING', started_at: '2026-11-20T05:00:00.000Z' }),
        batch({ status: 'FAILED', started_at: '2026-11-20T05:10:00.000Z' }),
        batch({
          status: 'ROLLED_BACK',
          started_at: '2026-11-20T05:20:00.000Z',
        }),
      ],
      sellAtLoss: noLoss,
    });
    expect(out.declenchements.map((d) => d.cle)).toEqual(['invariants:71']);
  });

  it('opens arret51:<supplier> on a decision-51 halt, closed by a later accepted withdrawal', () => {
    const halt = batch({
      supplier_id: '4200',
      operation: OPERATION_ARRET_GARDE_FOU,
      status: 'FAILED',
      failed_rows: 900,
      started_at: '2026-11-19T18:00:00.000Z',
      completed_at: '2026-11-19T18:00:01.000Z',
    });
    const open = buildGardePrix({
      generatedAt: GEN,
      batches: [halt],
      sellAtLoss: noLoss,
    });
    expect(open.declenchements).toEqual([
      { cle: 'arret51:4200', at: '2026-11-19T18:00:01.000Z' },
    ]);

    const accepted = batch({
      supplier_id: '4200',
      operation: 'DISPO_DEACTIVATION',
      status: 'COMMITTED',
      started_at: '2026-11-20T05:00:00.000Z',
    });
    const closed = buildGardePrix({
      generatedAt: GEN,
      batches: [halt, accepted],
      sellAtLoss: noLoss,
    });
    expect(closed.declenchements).toEqual([]);
  });

  it('keeps import and withdrawal incidents apart: one never closes the other', () => {
    const out = buildGardePrix({
      generatedAt: GEN,
      batches: [
        batch({ failed_rows: 1, started_at: '2026-11-18T10:00:00.000Z' }),
        batch({
          operation: 'DISPO_DEACTIVATION',
          status: 'COMMITTED',
          started_at: '2026-11-20T05:00:00.000Z',
        }),
      ],
      sellAtLoss: noLoss,
    });
    expect(out.declenchements.map((d) => d.cle)).toEqual(['invariants:71']);
  });

  it('opens one perte:pm<brand> per brand with sellable rows sold at a loss', () => {
    const out = buildGardePrix({
      generatedAt: GEN,
      batches: [],
      sellAtLoss: {
        scanned: 10,
        byBrand: new Map([
          ['4200', 3],
          ['71', 1],
        ]),
      },
    });
    expect(out.declenchements).toEqual([
      { cle: 'perte:pm4200', at: GEN },
      { cle: 'perte:pm71', at: GEN },
    ]);
  });
});

describe('readGardePrix', () => {
  const now = new Date(GEN);

  it('assembles both persisted sources', async () => {
    const out = await readGardePrix(
      {
        listBatchesForGuardSignal: async () => [batch({ failed_rows: 4 })],
        scanSellableAtLoss: async () => ({
          scanned: 5,
          byBrand: new Map([['9', 2]]),
        }),
      },
      now,
    );
    expect(out.generated_at).toBe(GEN);
    expect(out.declenchements.map((d) => d.cle)).toEqual([
      'invariants:71',
      'perte:pm9',
    ]);
  });

  it('rejects when a source is unreadable (never a fake green)', async () => {
    await expect(
      readGardePrix(
        {
          listBatchesForGuardSignal: async () => {
            throw new Error('PGRST');
          },
          scanSellableAtLoss: async () => noLoss,
        },
        now,
      ),
    ).rejects.toThrow('PGRST');
  });

  it('rejects an empty sellable scan as a broken read', async () => {
    await expect(
      readGardePrix(
        {
          listBatchesForGuardSignal: async () => [],
          scanSellableAtLoss: async () => ({ scanned: 0, byBrand: new Map() }),
        },
        now,
      ),
    ).rejects.toThrow(/aucune ligne vendable/);
  });
});
