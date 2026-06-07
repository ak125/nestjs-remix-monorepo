/**
 * CatalogDisplayActivationService — orchestration coverage.
 *
 * The eligibility predicate itself lives server-side (catalog_display_activate
 * SQL function) and is empirically proven (6 431 == NK CONFIRMED set). These
 * tests pin the TS orchestration that surrounds it: the owner-gated confirm,
 * the governed batch lifecycle (COMMITTING → COMMITTED / FAILED), and the
 * dry-run/rollback wiring.
 */
import { BadRequestException } from '@nestjs/common';
import { CatalogDisplayActivationService } from './catalog-display-activation.service';
import type { PricingRepository } from './pricing.repository';

function makeRepo(
  overrides: Partial<PricingRepository> = {},
): PricingRepository {
  return {
    createActivationBatch: jest.fn().mockResolvedValue('batch-1'),
    setBatchStatus: jest.fn().mockResolvedValue(undefined),
    displayActivate: jest.fn().mockResolvedValue({
      dry_run: false,
      supplier: '3410',
      eligible: 6431,
      displayed: 6431,
      batch_id: 'batch-1',
    }),
    displayRollback: jest
      .fn()
      .mockResolvedValue({ restored: 6431, batch_id: 'batch-1' }),
    ...overrides,
  } as unknown as PricingRepository;
}

describe('CatalogDisplayActivationService', () => {
  describe('dryRun', () => {
    it('calls the fn with dryRun:true and never opens a batch', async () => {
      const repo = makeRepo({
        displayActivate: jest.fn().mockResolvedValue({
          dry_run: true,
          supplier: '3410',
          eligible: 6431,
        }),
      });
      const svc = new CatalogDisplayActivationService(repo);

      const res = await svc.dryRun('3410');

      expect(res).toEqual({ eligible: 6431 });
      expect(repo.displayActivate).toHaveBeenCalledWith({
        batchId: null,
        supplier: '3410',
        operator: null,
        dryRun: true,
      });
      expect(repo.createActivationBatch).not.toHaveBeenCalled();
      expect(repo.setBatchStatus).not.toHaveBeenCalled();
    });

    it('rejects an empty supplierId', async () => {
      const svc = new CatalogDisplayActivationService(makeRepo());
      await expect(svc.dryRun('')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('commit', () => {
    it('refuses to write without confirm:true (no batch opened)', async () => {
      const repo = makeRepo();
      const svc = new CatalogDisplayActivationService(repo);

      await expect(svc.commit({ supplierId: '3410' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repo.createActivationBatch).not.toHaveBeenCalled();
      expect(repo.displayActivate).not.toHaveBeenCalled();
    });

    it('opens a batch, flips (dryRun:false), marks COMMITTED, returns counts', async () => {
      const repo = makeRepo();
      const svc = new CatalogDisplayActivationService(repo);

      const res = await svc.commit({
        supplierId: '3410',
        operator: 'owner',
        confirm: true,
      });

      expect(res).toEqual({
        batchId: 'batch-1',
        eligible: 6431,
        displayed: 6431,
      });
      expect(repo.displayActivate).toHaveBeenCalledWith({
        batchId: 'batch-1',
        supplier: '3410',
        operator: 'owner',
        dryRun: false,
      });
      expect(repo.setBatchStatus).toHaveBeenNthCalledWith(
        1,
        'batch-1',
        'COMMITTING',
      );
      expect(repo.setBatchStatus).toHaveBeenNthCalledWith(
        2,
        'batch-1',
        'COMMITTED',
        expect.objectContaining({ committed_rows: 6431 }),
      );
    });

    it('marks the batch FAILED and rethrows when the flip errors', async () => {
      const repo = makeRepo({
        displayActivate: jest.fn().mockRejectedValue(new Error('boom')),
      });
      const svc = new CatalogDisplayActivationService(repo);

      await expect(
        svc.commit({ supplierId: '3410', confirm: true }),
      ).rejects.toThrow('boom');
      expect(repo.setBatchStatus).toHaveBeenNthCalledWith(
        2,
        'batch-1',
        'FAILED',
        expect.any(Object),
      );
    });
  });

  describe('rollback', () => {
    it('delegates to displayRollback', async () => {
      const repo = makeRepo();
      const svc = new CatalogDisplayActivationService(repo);

      const res = await svc.rollback('batch-1', '3410');

      expect(res).toEqual({ restored: 6431 });
      expect(repo.displayRollback).toHaveBeenCalledWith('batch-1', '3410');
    });

    it('rejects missing args', async () => {
      const svc = new CatalogDisplayActivationService(makeRepo());
      await expect(svc.rollback('', '3410')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
