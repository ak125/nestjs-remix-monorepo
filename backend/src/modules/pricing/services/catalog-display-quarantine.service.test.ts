/**
 * CatalogDisplayQuarantineService — orchestration coverage (inverse of the
 * activation service).
 *
 * The eligibility predicate itself lives server-side (catalog_display_quarantine
 * SQL function) and is empirically proven (1 925 == NK visible-non-vendable set,
 * overlap=0 with the activated 6 431). These tests pin the TS orchestration that
 * surrounds it: the owner-gated confirm, the governed batch lifecycle
 * (COMMITTING → COMMITTED / FAILED), and the dry-run/rollback wiring.
 */
import { BadRequestException } from '@nestjs/common';
import { CatalogDisplayQuarantineService } from './catalog-display-quarantine.service';
import type { PricingRepository } from './pricing.repository';

function makeRepo(
  overrides: Partial<PricingRepository> = {},
): PricingRepository {
  return {
    createActivationBatch: jest.fn().mockResolvedValue('batch-q1'),
    setBatchStatus: jest.fn().mockResolvedValue(undefined),
    displayQuarantine: jest.fn().mockResolvedValue({
      dry_run: false,
      supplier: '3410',
      eligible: 1925,
      hidden: 1925,
      batch_id: 'batch-q1',
    }),
    displayRollback: jest
      .fn()
      .mockResolvedValue({ restored: 1925, batch_id: 'batch-q1' }),
    ...overrides,
  } as unknown as PricingRepository;
}

describe('CatalogDisplayQuarantineService', () => {
  describe('dryRun', () => {
    it('calls the fn with dryRun:true and never opens a batch', async () => {
      const repo = makeRepo({
        displayQuarantine: jest.fn().mockResolvedValue({
          dry_run: true,
          supplier: '3410',
          eligible: 1925,
        }),
      });
      const svc = new CatalogDisplayQuarantineService(repo);

      const res = await svc.dryRun('3410');

      expect(res).toEqual({ eligible: 1925 });
      expect(repo.displayQuarantine).toHaveBeenCalledWith({
        batchId: null,
        supplier: '3410',
        operator: null,
        dryRun: true,
      });
      expect(repo.createActivationBatch).not.toHaveBeenCalled();
      expect(repo.setBatchStatus).not.toHaveBeenCalled();
    });

    it('rejects an empty supplierId', async () => {
      const svc = new CatalogDisplayQuarantineService(makeRepo());
      await expect(svc.dryRun('')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('commit', () => {
    it('refuses to write without confirm:true (no batch opened)', async () => {
      const repo = makeRepo();
      const svc = new CatalogDisplayQuarantineService(repo);

      await expect(svc.commit({ supplierId: '3410' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repo.createActivationBatch).not.toHaveBeenCalled();
      expect(repo.displayQuarantine).not.toHaveBeenCalled();
    });

    it('opens a batch, flips (dryRun:false), marks COMMITTED, returns counts', async () => {
      const repo = makeRepo();
      const svc = new CatalogDisplayQuarantineService(repo);

      const res = await svc.commit({
        supplierId: '3410',
        operator: 'owner',
        confirm: true,
      });

      expect(res).toEqual({
        batchId: 'batch-q1',
        eligible: 1925,
        hidden: 1925,
      });
      expect(repo.displayQuarantine).toHaveBeenCalledWith({
        batchId: 'batch-q1',
        supplier: '3410',
        operator: 'owner',
        dryRun: false,
      });
      expect(repo.setBatchStatus).toHaveBeenNthCalledWith(
        1,
        'batch-q1',
        'COMMITTING',
      );
      expect(repo.setBatchStatus).toHaveBeenNthCalledWith(
        2,
        'batch-q1',
        'COMMITTED',
        expect.objectContaining({ committed_rows: 1925 }),
      );
    });

    it('marks the batch FAILED and rethrows when the flip errors', async () => {
      const repo = makeRepo({
        displayQuarantine: jest.fn().mockRejectedValue(new Error('boom')),
      });
      const svc = new CatalogDisplayQuarantineService(repo);

      await expect(
        svc.commit({ supplierId: '3410', confirm: true }),
      ).rejects.toThrow('boom');
      expect(repo.setBatchStatus).toHaveBeenNthCalledWith(
        2,
        'batch-q1',
        'FAILED',
        expect.any(Object),
      );
    });
  });

  describe('rollback', () => {
    it('delegates to the generic displayRollback', async () => {
      const repo = makeRepo();
      const svc = new CatalogDisplayQuarantineService(repo);

      const res = await svc.rollback('batch-q1', '3410');

      expect(res).toEqual({ restored: 1925 });
      expect(repo.displayRollback).toHaveBeenCalledWith('batch-q1', '3410');
    });

    it('rejects missing args', async () => {
      const svc = new CatalogDisplayQuarantineService(makeRepo());
      await expect(svc.rollback('', '3410')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
