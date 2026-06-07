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
    gammeDisplayActivate: jest.fn().mockResolvedValue({
      dry_run: false,
      supplier: '3410',
      eligible: 1,
      refs: 11,
      displayed: 1,
      gamme_ids: [1330],
      batch_id: 'batch-1',
    }),
    gammeDisplayRollback: jest.fn().mockResolvedValue({
      rolled_back: 1,
      skipped_value_changed: 0,
      skipped_missing_gamme: 0,
      batch_id: 'batch-1',
    }),
    accessoryLinkActivate: jest.fn().mockResolvedValue({
      dry_run: false,
      main_pg_id: 82,
      eligible_count: 1,
      rejected_count: 0,
      rejected: [],
      linked: 1,
    }),
    accessoryLinkRollback: jest.fn().mockResolvedValue({
      rolled_back: 1,
      skipped_value_changed: 0,
      skipped_missing_gamme: 0,
      batch_id: 'batch-acc',
    }),
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

  // ── Étape B1 — gamme visibility (pg_display) ──────────────────────────────────────
  describe('gammeDryRun', () => {
    it('returns the owner-gate values (eligible/refs/gammeIds) and never opens a batch', async () => {
      const repo = makeRepo({
        gammeDisplayActivate: jest.fn().mockResolvedValue({
          dry_run: true,
          supplier: '3410',
          eligible: 1,
          refs: 11,
          gamme_ids: [1330],
        }),
      });
      const svc = new CatalogDisplayActivationService(repo);

      const res = await svc.gammeDryRun('3410');

      expect(res).toEqual({ eligible: 1, refs: 11, gammeIds: [1330] });
      expect(repo.gammeDisplayActivate).toHaveBeenCalledWith({
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
      await expect(svc.gammeDryRun('')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('gammeCommit', () => {
    it('refuses to write without confirm:true (no batch opened)', async () => {
      const repo = makeRepo();
      const svc = new CatalogDisplayActivationService(repo);

      await expect(
        svc.gammeCommit({ supplierId: '3410' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.createActivationBatch).not.toHaveBeenCalled();
      expect(repo.gammeDisplayActivate).not.toHaveBeenCalled();
    });

    it('opens a GAMME_DISPLAY_ACTIVATION batch, flips, marks COMMITTED, returns counts', async () => {
      const repo = makeRepo();
      const svc = new CatalogDisplayActivationService(repo);

      const res = await svc.gammeCommit({
        supplierId: '3410',
        operator: 'owner',
        confirm: true,
      });

      expect(res).toEqual({
        batchId: 'batch-1',
        eligible: 1,
        refs: 11,
        displayed: 1,
        gammeIds: [1330],
      });
      expect(repo.createActivationBatch).toHaveBeenCalledWith({
        supplierId: '3410',
        operator: 'owner',
        operation: 'GAMME_DISPLAY_ACTIVATION',
      });
      expect(repo.gammeDisplayActivate).toHaveBeenCalledWith({
        batchId: 'batch-1',
        supplier: '3410',
        operator: 'owner',
        dryRun: false,
      });
      expect(repo.setBatchStatus).toHaveBeenNthCalledWith(
        2,
        'batch-1',
        'COMMITTED',
        expect.objectContaining({ committed_rows: 1 }),
      );
    });

    it('marks the batch FAILED and rethrows when the flip errors', async () => {
      const repo = makeRepo({
        gammeDisplayActivate: jest.fn().mockRejectedValue(new Error('boom')),
      });
      const svc = new CatalogDisplayActivationService(repo);

      await expect(
        svc.gammeCommit({ supplierId: '3410', confirm: true }),
      ).rejects.toThrow('boom');
      expect(repo.setBatchStatus).toHaveBeenNthCalledWith(
        2,
        'batch-1',
        'FAILED',
        expect.any(Object),
      );
    });
  });

  describe('gammeRollback', () => {
    it('delegates to gammeDisplayRollback and classifies skipped rows (value-changed vs missing)', async () => {
      const repo = makeRepo({
        gammeDisplayRollback: jest.fn().mockResolvedValue({
          rolled_back: 0,
          skipped_value_changed: 1,
          skipped_missing_gamme: 0,
          batch_id: 'batch-1',
        }),
      });
      const svc = new CatalogDisplayActivationService(repo);

      const res = await svc.gammeRollback('batch-1', '3410');

      expect(res).toEqual({
        rolledBack: 0,
        skippedValueChanged: 1,
        skippedMissingGamme: 0,
      });
      expect(repo.gammeDisplayRollback).toHaveBeenCalledWith('batch-1', '3410');
    });

    it('rejects missing args', async () => {
      const svc = new CatalogDisplayActivationService(makeRepo());
      await expect(svc.gammeRollback('', '3410')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  // ── Accessory commercial link (pg_parent_gamme_id) ────────────────────────────────
  describe('accessoryLinkDryRun', () => {
    it('projects eligible/rejected without opening a batch', async () => {
      const repo = makeRepo({
        accessoryLinkActivate: jest.fn().mockResolvedValue({
          dry_run: true,
          main_pg_id: 82,
          eligible_count: 1,
          eligible: [{ pg_id: 1330, pg_name: 'Déflecteur disque de frein' }],
          rejected_count: 0,
          rejected: [],
        }),
      });
      const svc = new CatalogDisplayActivationService(repo);

      const res = await svc.accessoryLinkDryRun(82, [1330]);

      expect(res).toEqual({
        eligibleCount: 1,
        eligible: [{ pg_id: 1330, pg_name: 'Déflecteur disque de frein' }],
        rejectedCount: 0,
        rejected: [],
      });
      expect(repo.accessoryLinkActivate).toHaveBeenCalledWith({
        batchId: null,
        mainPgId: 82,
        accessoryPgIds: [1330],
        operator: null,
        dryRun: true,
      });
    });

    it('rejects a missing mainPgId or empty accessory list', async () => {
      const svc = new CatalogDisplayActivationService(makeRepo());
      await expect(svc.accessoryLinkDryRun(0, [1330])).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(svc.accessoryLinkDryRun(82, [])).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('accessoryLinkCommit', () => {
    it('refuses to write without confirm:true', async () => {
      const repo = makeRepo();
      const svc = new CatalogDisplayActivationService(repo);

      await expect(
        svc.accessoryLinkCommit({ mainPgId: 82, accessoryPgIds: [1330] }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.accessoryLinkActivate).not.toHaveBeenCalled();
    });

    it('generates a batchId, commits (dryRun:false), returns linked count', async () => {
      const repo = makeRepo();
      const svc = new CatalogDisplayActivationService(repo);

      const res = await svc.accessoryLinkCommit({
        mainPgId: 82,
        accessoryPgIds: [1330],
        operator: 'owner',
        confirm: true,
      });

      expect(typeof res.batchId).toBe('string');
      expect(res.batchId.length).toBeGreaterThan(0);
      expect(res.linked).toBe(1);
      expect(repo.accessoryLinkActivate).toHaveBeenCalledWith(
        expect.objectContaining({
          batchId: res.batchId,
          mainPgId: 82,
          accessoryPgIds: [1330],
          operator: 'owner',
          dryRun: false,
        }),
      );
    });
  });

  describe('accessoryLinkRollback', () => {
    it('delegates and surfaces classified skip counts', async () => {
      const repo = makeRepo();
      const svc = new CatalogDisplayActivationService(repo);

      const res = await svc.accessoryLinkRollback('batch-acc');

      expect(res).toEqual({
        rolledBack: 1,
        skippedValueChanged: 0,
        skippedMissingGamme: 0,
      });
      expect(repo.accessoryLinkRollback).toHaveBeenCalledWith('batch-acc');
    });

    it('rejects a missing batchId', async () => {
      const svc = new CatalogDisplayActivationService(makeRepo());
      await expect(svc.accessoryLinkRollback('')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
