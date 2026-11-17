import { BadRequestException, ConflictException } from '@nestjs/common';
import * as saleRules from '../../config/supplier-sale-rules';
import {
  classifyDeactivationRow,
  projectQuarantineImpact,
  PriceDeactivationService,
  type DeactivationOutcome,
} from '../price-deactivation.service';
import {
  DISPO_DEACTIVATION_OPERATION,
  PricingRepository,
  type DeactivationScopeRow,
  type SellabilityRow,
} from '../pricing.repository';

/**
 * The eligibility must mirror pricing_deactivate_chunk's SQL guards EXACTLY — a
 * withdrawal only ever touches a sellable, uncontrolled row with a whitelisted
 * reason, and never one whose state reason the rollback could not restore.
 */
describe('classifyDeactivationRow', () => {
  const row = (
    dispo: string | null,
    state = 'ACTIVE',
    stateReason: string | null = null,
  ) => ({ dispo, state, stateReason });

  it('DEACTIVATE: sellable (1/2/3) ACTIVE row, whitelisted reason', () => {
    for (const d of ['1', '2', '3'] as const) {
      expect(classifyDeactivationRow('DISCONTINUED_TARIFF', row(d))).toBe(
        'DEACTIVATE',
      );
      expect(classifyDeactivationRow('CONFIRMED_OUT', row(d))).toBe(
        'DEACTIVATE',
      );
    }
  });

  it('REJECTED: any reason outside the whitelist', () => {
    for (const r of ['', 'OUT', 'confirmed_out', 'ON_ORDER', 'x']) {
      expect(classifyDeactivationRow(r, row('1'))).toBe(
        'REJECTED' as DeactivationOutcome,
      );
    }
  });

  it('MISSING: no pieces_price row', () => {
    expect(classifyDeactivationRow('CONFIRMED_OUT', undefined)).toBe('MISSING');
  });

  it('SKIP_FROZEN_MANUAL: respects quarantine / manual control', () => {
    expect(classifyDeactivationRow('CONFIRMED_OUT', row('1', 'FROZEN'))).toBe(
      'SKIP_FROZEN_MANUAL',
    );
    expect(
      classifyDeactivationRow('CONFIRMED_OUT', row('1', 'MANUAL_OVERRIDE')),
    ).toBe('SKIP_FROZEN_MANUAL');
  });

  it('SKIP_NOT_SELLABLE: 0 / null are already out of sale', () => {
    expect(classifyDeactivationRow('CONFIRMED_OUT', row('0'))).toBe(
      'SKIP_NOT_SELLABLE',
    );
    expect(classifyDeactivationRow('CONFIRMED_OUT', row(null))).toBe(
      'SKIP_NOT_SELLABLE',
    );
  });

  it('SKIP_STATE_REASON: a row with a reason is never overwritten (rollback restores NULL)', () => {
    expect(
      classifyDeactivationRow('CONFIRMED_OUT', row('1', 'ACTIVE', 'manual')),
    ).toBe('SKIP_STATE_REASON');
  });

  it('rejection precedes row lookup (bad reason on a frozen row still REJECTED)', () => {
    expect(classifyDeactivationRow('ON_ORDER', row('1', 'FROZEN'))).toBe(
      'REJECTED',
    );
  });
});

describe('projectQuarantineImpact', () => {
  const r = (
    priType: string,
    dispo: string | null,
    venteTtc: number | null,
    state: string | null = 'ACTIVE',
  ): SellabilityRow => ({ priType, dispo, venteTtc, state });
  const shown = new Map([[1, true]]);

  it('a visible piece whose only sellable row is withdrawn loses sale and becomes quarantinable', () => {
    const impact = projectQuarantineImpact(
      new Map([[1, [r('0', '1', 25)]]]),
      new Map([[1, true]]),
      new Set(['1:0']),
      shown,
    );
    expect(impact).toEqual({ piecesLosingSale: 1, newlyQuarantinable: 1 });
  });

  it('a second sellable row (other pri_type) keeps the piece on sale', () => {
    const impact = projectQuarantineImpact(
      new Map([[1, [r('0', '1', 25), r('1', '1', 30)]]]),
      new Map([[1, true]]),
      new Set(['1:0']),
      shown,
    );
    expect(impact).toEqual({ piecesLosingSale: 0, newlyQuarantinable: 0 });
  });

  it('a hidden or other-brand piece is never counted as quarantinable', () => {
    const impact = projectQuarantineImpact(
      new Map([[1, [r('0', '1', 25)]]]),
      new Map([[1, false]]),
      new Set(['1:0']),
      shown,
    );
    expect(impact).toEqual({ piecesLosingSale: 1, newlyQuarantinable: 0 });
  });

  it('an unpriced 1/2 row blocks the quarantine until withdrawn (same predicate as the SQL)', () => {
    // unpriced '1' row: not sellable today, but it keeps the piece out of the quarantine
    const before = projectQuarantineImpact(
      new Map([[1, [r('0', '1', null)]]]),
      new Map([[1, true]]),
      new Set(),
      shown,
    );
    expect(before).toEqual({ piecesLosingSale: 0, newlyQuarantinable: 0 });
    const after = projectQuarantineImpact(
      new Map([[1, [r('0', '1', null)]]]),
      new Map([[1, true]]),
      new Set(['1:0']),
      shown,
    );
    expect(after).toEqual({ piecesLosingSale: 0, newlyQuarantinable: 1 });
  });

  it("décision 118 : a remaining '2' or '3' row keeps the piece on sale", () => {
    for (const d of ['2', '3'] as const) {
      const impact = projectQuarantineImpact(
        new Map([[1, [r('0', '1', 25), r('1', d, 30)]]]),
        new Map([[1, true]]),
        new Set(['1:0']),
        shown,
      );
      expect(impact).toEqual({ piecesLosingSale: 0, newlyQuarantinable: 0 });
    }
  });

  it("décision 118 : withdrawing the only '3' row takes the piece out of sale", () => {
    const impact = projectQuarantineImpact(
      new Map([[1, [r('0', '3', 25)]]]),
      new Map([[1, true]]),
      new Set(['1:0']),
      shown,
    );
    expect(impact).toEqual({ piecesLosingSale: 1, newlyQuarantinable: 1 });
  });

  it('décision 51 : a masked piece or a FROZEN row was never on sale', () => {
    const masked = projectQuarantineImpact(
      new Map([[1, [r('0', '1', 25)]]]),
      new Map([[1, false]]),
      new Set(['1:0']),
      new Map([[1, false]]),
    );
    expect(masked.piecesLosingSale).toBe(0);
    const frozen = projectQuarantineImpact(
      new Map([[1, [r('0', '1', 25, 'FROZEN')]]]),
      new Map([[1, true]]),
      new Set(['1:0']),
      shown,
    );
    expect(frozen.piecesLosingSale).toBe(0);
  });

  it('an already-quarantinable piece is not counted again', () => {
    const impact = projectQuarantineImpact(
      new Map([[1, [r('0', '0', 25)]]]),
      new Map([[1, true]]),
      new Set(['1:0']),
      shown,
    );
    expect(impact).toEqual({ piecesLosingSale: 0, newlyQuarantinable: 0 });
  });
});

function scopeRow(
  pieceId: number | null,
  priType = '0',
  dispo: string | null = '1',
  supplierLabel: string | null = 'ACR',
): DeactivationScopeRow {
  return {
    pieceId,
    priType,
    dispo,
    state: 'ACTIVE',
    stateReason: null,
    supplierLabel,
  };
}

/** Sellable scope of `n` displayed pieces 0..n-1, one '1' row each. */
function sellableScope(pieceIds: number[]) {
  return {
    rows: new Map(
      pieceIds.map((id) => [
        id,
        [{ priType: '0', dispo: '1', venteTtc: 20, state: 'ACTIVE' }],
      ]),
    ),
    visibleBrand: new Map(pieceIds.map((id) => [id, true])),
    displayed: new Map(pieceIds.map((id) => [id, true])),
  };
}

function makeRepo(
  overrides: Partial<Record<keyof PricingRepository, jest.Mock>> = {},
): PricingRepository {
  return {
    resolveDeactivationRows: jest.fn().mockResolvedValue(new Map()),
    fetchSellabilityScope: jest.fn().mockResolvedValue({
      rows: new Map(),
      visibleBrand: new Map(),
      displayed: new Map(),
    }),
    countSellablePieces: jest.fn().mockResolvedValue(1000),
    getBatchSummary: jest.fn().mockResolvedValue(null),
    createActivationBatch: jest.fn().mockResolvedValue('batch-d1'),
    setBatchStatus: jest.fn().mockResolvedValue(undefined),
    createChunk: jest.fn().mockResolvedValue('chunk-1'),
    deactivateChunk: jest.fn().mockImplementation(({ rows }) =>
      Promise.resolve({
        deactivated: rows.length,
        skipped: 0,
        missing: 0,
        rejected: 0,
      }),
    ),
    getBatchOperation: jest
      .fn()
      .mockResolvedValue(DISPO_DEACTIVATION_OPERATION),
    rollbackDeactivationBatch: jest
      .fn()
      .mockResolvedValue({ restored: 3, superseded: 0 }),
    ...overrides,
  } as unknown as PricingRepository;
}

describe('PriceDeactivationService', () => {
  /** Freshness active for ACR only, so DISCONTINUED_TARIFF rows are committable. */
  let freshness: jest.SpyInstance;
  beforeEach(() => {
    freshness = jest
      .spyOn(saleRules, 'fraicheurActive')
      .mockImplementation((label) => label === 'ACR');
  });
  afterEach(() => freshness.mockRestore());

  describe('dryRun', () => {
    it('reaches EVERY row of a ref (pri_type 0 and 1) and never writes', async () => {
      const repo = makeRepo({
        resolveDeactivationRows: jest
          .fn()
          .mockResolvedValue(
            new Map([['R1', [scopeRow(10, '0'), scopeRow(10, '1', '2')]]]),
          ),
      });
      const svc = new PriceDeactivationService(repo);

      const { report } = await svc.dryRun({
        supplierId: '4500',
        rows: [{ ref: 'R1', reason: 'DISCONTINUED_TARIFF' }],
      });

      expect(report.eligible).toBe(2);
      expect(report.byReason).toEqual({
        DISCONTINUED_TARIFF: 2,
        CONFIRMED_OUT: 0,
      });
      expect(report.piecesAffected).toBe(1);
      expect(repo.fetchSellabilityScope).toHaveBeenCalledWith('4500', [10]);
      expect(repo.createActivationBatch).not.toHaveBeenCalled();
      expect(repo.setBatchStatus).not.toHaveBeenCalled();
    });

    it('rejects a bad reason before any read, counts duplicates and missing refs', async () => {
      const repo = makeRepo({
        resolveDeactivationRows: jest
          .fn()
          .mockResolvedValue(new Map([['R1', [scopeRow(10)]]])),
      });
      const svc = new PriceDeactivationService(repo);

      const { report } = await svc.dryRun({
        supplierId: '4500',
        rows: [
          { ref: 'R1', reason: 'CONFIRMED_OUT' },
          { ref: 'R1', reason: 'DISCONTINUED_TARIFF' },
          { ref: 'R2', reason: 'ON_ORDER' as never },
          { ref: 'R3', reason: 'CONFIRMED_OUT' },
        ],
      });

      expect(repo.resolveDeactivationRows).toHaveBeenCalledWith('4500', [
        'R1',
        'R3',
      ]);
      expect(report).toMatchObject({
        requestedRefs: 4,
        duplicateRefs: 1,
        rejectedRefs: 1,
        missingRefs: 1,
        eligible: 1,
        byReason: { DISCONTINUED_TARIFF: 0, CONFIRMED_OUT: 1 },
      });
    });

    it('skips a row without a piece id instead of sending it', async () => {
      const repo = makeRepo({
        resolveDeactivationRows: jest
          .fn()
          .mockResolvedValue(new Map([['R1', [scopeRow(null)]]])),
      });
      const svc = new PriceDeactivationService(repo);

      const { report } = await svc.dryRun({
        supplierId: '4500',
        rows: [{ ref: 'R1', reason: 'CONFIRMED_OUT' }],
      });

      expect(report.eligible).toBe(0);
      expect(report.rowsWithoutPiece).toBe(1);
    });

    it('refuses a request without supplierId or rows', async () => {
      const svc = new PriceDeactivationService(makeRepo());
      await expect(
        svc.dryRun({ supplierId: '', rows: [] }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        svc.dryRun({ supplierId: '4500' } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('décision 51 : DISCONTINUED_TARIFF of a supplier without a complete update only alerts', async () => {
      const repo = makeRepo({
        resolveDeactivationRows: jest.fn().mockResolvedValue(
          new Map([
            [
              'R1',
              [
                scopeRow(10, '0', '1', 'SASIC'),
                scopeRow(11, '0', '1', 'SASIC'),
              ],
            ],
            ['R2', [scopeRow(12, '0', '1', 'SASIC')]],
            ['R3', [scopeRow(13, '0', '1', 'ACR')]],
          ]),
        ),
      });
      const svc = new PriceDeactivationService(repo);

      const { report } = await svc.dryRun({
        supplierId: '4120',
        rows: [
          { ref: 'R1', reason: 'DISCONTINUED_TARIFF' },
          { ref: 'R2', reason: 'CONFIRMED_OUT' },
          { ref: 'R3', reason: 'DISCONTINUED_TARIFF' },
        ],
      });

      expect(report.freshnessAlerts).toEqual([
        { supplierLabel: 'SASIC', rows: 2 },
      ]);
      // CONFIRMED_OUT (positive proof) is not a freshness exit: still eligible
      expect(report.byReason).toEqual({
        DISCONTINUED_TARIFF: 1,
        CONFIRMED_OUT: 1,
      });
      expect(report.eligible).toBe(2);
    });

    it('the shipped configuration keeps every supplier on alert only', () => {
      freshness.mockRestore();
      for (const label of Object.keys(saleRules.FRAICHEUR_PAR_FOURNISSEUR)) {
        expect(saleRules.fraicheurActive(label)).toBe(false);
      }
      expect(saleRules.fraicheurActive('INCONNU')).toBe(false);
      expect(saleRules.fraicheurActive(null)).toBe(false);
    });

    it('reports the 5 % guard against the brand sellable count', async () => {
      const ids = Array.from({ length: 6 }, (_, i) => i);
      const repo = makeRepo({
        resolveDeactivationRows: jest
          .fn()
          .mockResolvedValue(new Map(ids.map((i) => [`R${i}`, [scopeRow(i)]]))),
        fetchSellabilityScope: jest.fn().mockResolvedValue(sellableScope(ids)),
        countSellablePieces: jest.fn().mockResolvedValue(100),
      });
      const svc = new PriceDeactivationService(repo);

      const { guard } = await svc.dryRun({
        supplierId: '4500',
        rows: ids.map((i) => ({ ref: `R${i}`, reason: 'CONFIRMED_OUT' })),
      });

      expect(guard).toEqual({
        vendablesAvant: 100,
        sortantes: 6,
        part: 0.06,
        seuil: 0.05,
        arret: true,
      });
      expect(repo.createActivationBatch).not.toHaveBeenCalled();
    });

    it('refuses a numeric supplierId (the brand lock compares strings)', async () => {
      const svc = new PriceDeactivationService(makeRepo());
      await expect(
        svc.dryRun({ supplierId: 4500 as never, rows: [] }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('commit', () => {
    it('requires confirm:true and opens nothing without it', async () => {
      const repo = makeRepo();
      const svc = new PriceDeactivationService(repo);
      await expect(
        svc.commit({ supplierId: '4500', rows: [] }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.createActivationBatch).not.toHaveBeenCalled();
    });

    it('tags the batch DISPO_DEACTIVATION, chunks by 500 and ends COMMITTED', async () => {
      const refs = Array.from({ length: 501 }, (_, i) => `R${i}`);
      const repo = makeRepo({
        resolveDeactivationRows: jest
          .fn()
          .mockResolvedValue(
            new Map(refs.map((ref, i) => [ref, [scopeRow(i)]])),
          ),
      });
      const svc = new PriceDeactivationService(repo);

      const res = await svc.commit({
        supplierId: '4500',
        operator: 'owner',
        confirm: true,
        rows: refs.map((ref) => ({ ref, reason: 'CONFIRMED_OUT' as const })),
      });

      expect(repo.createActivationBatch).toHaveBeenCalledWith({
        supplierId: '4500',
        operator: 'owner',
        operation: DISPO_DEACTIVATION_OPERATION,
      });
      expect(repo.deactivateChunk).toHaveBeenCalledTimes(2);
      expect(res.totals.deactivated).toBe(501);
      expect(repo.setBatchStatus).toHaveBeenNthCalledWith(
        1,
        'batch-d1',
        'COMMITTING',
      );
      expect(repo.setBatchStatus).toHaveBeenLastCalledWith(
        'batch-d1',
        'COMMITTED',
        expect.objectContaining({ committed_rows: 501 }),
      );
    });

    it('marks the batch FAILED and rethrows when a chunk fails', async () => {
      const repo = makeRepo({
        resolveDeactivationRows: jest
          .fn()
          .mockResolvedValue(new Map([['R1', [scopeRow(10)]]])),
        deactivateChunk: jest.fn().mockRejectedValue(new Error('lock timeout')),
      });
      const svc = new PriceDeactivationService(repo);

      await expect(
        svc.commit({
          supplierId: '4500',
          confirm: true,
          rows: [{ ref: 'R1', reason: 'CONFIRMED_OUT' }],
        }),
      ).rejects.toThrow('lock timeout');
      expect(repo.setBatchStatus).toHaveBeenLastCalledWith(
        'batch-d1',
        'FAILED',
        expect.any(Object),
      );
    });
  });

  describe('commit — garde-fou 5 % (décision 51)', () => {
    const ids = Array.from({ length: 6 }, (_, i) => i);
    const lot = {
      supplierId: '4500',
      operator: 'owner',
      confirm: true,
      rows: ids.map((i) => ({
        ref: `R${i}`,
        reason: 'CONFIRMED_OUT' as const,
      })),
    };
    const haltingRepo = (over: Record<string, jest.Mock> = {}) =>
      makeRepo({
        resolveDeactivationRows: jest
          .fn()
          .mockResolvedValue(new Map(ids.map((i) => [`R${i}`, [scopeRow(i)]]))),
        fetchSellabilityScope: jest.fn().mockResolvedValue(sellableScope(ids)),
        countSellablePieces: jest.fn().mockResolvedValue(100),
        createActivationBatch: jest.fn().mockResolvedValue('halt-1'),
        ...over,
      });

    it('stops above 5 %, records a FAILED halt batch and writes no row', async () => {
      const repo = haltingRepo();
      const svc = new PriceDeactivationService(repo);

      await expect(svc.commit(lot)).rejects.toBeInstanceOf(ConflictException);
      expect(repo.createActivationBatch).toHaveBeenCalledWith({
        supplierId: '4500',
        operator: 'owner',
        operation: saleRules.OPERATION_ARRET_GARDE_FOU,
      });
      expect(repo.setBatchStatus).toHaveBeenCalledWith(
        'halt-1',
        'FAILED',
        expect.objectContaining({ failed_rows: 6, committed_rows: 0 }),
      );
      expect(repo.setBatchStatus).not.toHaveBeenCalledWith(
        expect.anything(),
        'COMMITTING',
      );
      expect(repo.deactivateChunk).not.toHaveBeenCalled();
    });

    it('commits at exactly 5 %', async () => {
      const repo = haltingRepo({
        countSellablePieces: jest.fn().mockResolvedValue(120),
        createActivationBatch: jest.fn().mockResolvedValue('batch-d1'),
      });
      const svc = new PriceDeactivationService(repo);

      const res = await svc.commit(lot);

      expect(res.guard.arret).toBe(false);
      expect(repo.deactivateChunk).toHaveBeenCalledTimes(1);
    });

    it('proceeds once the owner acknowledges the matching halt batch', async () => {
      const repo = haltingRepo({
        createActivationBatch: jest.fn().mockResolvedValue('batch-d2'),
        getBatchSummary: jest.fn().mockResolvedValue({
          batchId: 'halt-1',
          status: 'FAILED',
          supplierId: '4500',
          operation: saleRules.OPERATION_ARRET_GARDE_FOU,
          failedRows: 6,
        }),
      });
      const svc = new PriceDeactivationService(repo);

      const res = await svc.commit({
        ...lot,
        guardAcknowledgement: { haltBatchId: 'halt-1', approvedBy: 'Marwane' },
      });

      expect(res.acknowledgedBy).toBe('Marwane');
      expect(res.totals.deactivated).toBe(6);
      expect(repo.createActivationBatch).toHaveBeenCalledWith(
        expect.objectContaining({ operation: DISPO_DEACTIVATION_OPERATION }),
      );
    });

    it('refuses an acknowledgement of another brand or another projection', async () => {
      for (const summary of [
        { supplierId: '9999', failedRows: 6 },
        { supplierId: '4500', failedRows: 7 },
      ]) {
        const repo = haltingRepo({
          getBatchSummary: jest.fn().mockResolvedValue({
            batchId: 'halt-1',
            status: 'FAILED',
            operation: saleRules.OPERATION_ARRET_GARDE_FOU,
            ...summary,
          }),
        });
        const svc = new PriceDeactivationService(repo);
        await expect(
          svc.commit({
            ...lot,
            guardAcknowledgement: { haltBatchId: 'halt-1', approvedBy: 'x' },
          }),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(repo.deactivateChunk).not.toHaveBeenCalled();
      }
    });
  });

  describe('rollback', () => {
    it('uses the dedicated dispo-only rollback for a withdrawal batch', async () => {
      const repo = makeRepo();
      const svc = new PriceDeactivationService(repo);
      await expect(svc.rollback('batch-d1', '4500')).resolves.toEqual({
        restored: 3,
        superseded: 0,
      });
      expect(repo.rollbackDeactivationBatch).toHaveBeenCalledWith(
        'batch-d1',
        '4500',
      );
    });

    it('refuses any other batch kind', async () => {
      const repo = makeRepo({
        getBatchOperation: jest.fn().mockResolvedValue(null),
      });
      const svc = new PriceDeactivationService(repo);
      await expect(svc.rollback('batch-import', '4500')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repo.rollbackDeactivationBatch).not.toHaveBeenCalled();
    });
  });
});

describe('PricingRepository.rollbackBatch (generic)', () => {
  // The generic rollback rewrites price columns: it must refuse a withdrawal batch.
  function bareRepo(operation: string | null) {
    const repo = Object.create(
      PricingRepository.prototype,
    ) as PricingRepository;
    const callRpc = jest
      .fn()
      .mockResolvedValue({ data: { restored: 1, superseded: 0 }, error: null });
    Object.assign(repo, {
      getBatchOperation: jest.fn().mockResolvedValue(operation),
      callRpc,
    });
    return { repo, callRpc };
  }

  it('refuses a DISPO_DEACTIVATION batch without calling the RPC', async () => {
    const { repo, callRpc } = bareRepo(DISPO_DEACTIVATION_OPERATION);
    await expect(repo.rollbackBatch('batch-d1', '4500')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(callRpc).not.toHaveBeenCalled();
  });

  it('still rolls back an import / activation batch', async () => {
    const { repo, callRpc } = bareRepo(null);
    await expect(repo.rollbackBatch('batch-a1', '4500')).resolves.toEqual({
      restored: 1,
      superseded: 0,
    });
    expect(callRpc).toHaveBeenCalledWith('pricing_rollback_batch', {
      p_batch_id: 'batch-a1',
      p_supplier: '4500',
    });
  });
});
