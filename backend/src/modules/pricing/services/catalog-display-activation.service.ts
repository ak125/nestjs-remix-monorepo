/**
 * Catalog visibility activation service (piece_display only — étape A, réf-level).
 *
 * Drives the governed catalog_display_activate RPC: flips pieces.piece_display
 * false -> true for the brand's pieces that are ALREADY sellable
 * (pieces_price.pri_dispo IN '1','2') and currently hidden. This is the
 * visibility step of the supplier activation flow that PriceActivationService
 * (dispo activation) started — sellability first, then visibility.
 *
 * SET-BASED + IDEMPOTENT: the scope is derived from the governed DB signal, not
 * from a passed id list. dryRun projects what WOULD flip with ZERO writes;
 * commit (owner-gated by `confirm:true`) applies it under a per-supplier batch
 * and is reversible via catalog_display_rollback_batch. The eligibility predicate
 * lives once, server-side, so dry-run and commit can never drift.
 *
 * SCOPE GUARDRAILS (enforced in the SQL function, mirrored here for intent):
 *   brand-locked · gated on pri_dispo IN '1','2' (REVIEW/BLOCK excluded) ·
 *   never touches gamme/vehicle/price/dispo · only false -> true.
 */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PricingRepository } from './pricing.repository';

export interface DisplayActivationRequest {
  /** pieces.piece_pm_id (brand), e.g. '3410' (NK). Brand-lock. */
  supplierId: string;
  operator?: string | null;
}

@Injectable()
export class CatalogDisplayActivationService {
  private readonly logger = new Logger(CatalogDisplayActivationService.name);

  constructor(private readonly repo: PricingRepository) {}

  /** Read-only projection of how many hidden-but-sellable refs WOULD be shown. */
  async dryRun(supplierId: string): Promise<{ eligible: number }> {
    if (!supplierId) {
      throw new BadRequestException('supplierId is required');
    }
    const res = await this.repo.displayActivate({
      batchId: null,
      supplier: supplierId,
      operator: null,
      dryRun: true,
    });
    this.logger.log(
      `[CATALOG_DISPLAY] dry-run supplier=${supplierId} eligible=${res.eligible}`,
    );
    return { eligible: res.eligible };
  }

  /**
   * Apply the visibility activation — requires `confirm:true` (owner-gated).
   * Opens a governed batch, runs the set-based flip, marks the batch COMMITTED.
   */
  async commit(
    req: DisplayActivationRequest & { confirm?: boolean },
  ): Promise<{ batchId: string; eligible: number; displayed: number }> {
    if (!req.supplierId) {
      throw new BadRequestException('supplierId is required');
    }
    if (req.confirm !== true) {
      throw new BadRequestException(
        'display activation commit requires confirm:true',
      );
    }
    const batchId = await this.repo.createActivationBatch({
      supplierId: req.supplierId,
      operator: req.operator ?? null,
    });
    await this.repo.setBatchStatus(batchId, 'COMMITTING'); // per-supplier mutex
    try {
      const res = await this.repo.displayActivate({
        batchId,
        supplier: req.supplierId,
        operator: req.operator ?? null,
        dryRun: false,
      });
      await this.repo.setBatchStatus(batchId, 'COMMITTED', {
        committed_rows: res.displayed ?? 0,
        completed_at: new Date().toISOString(),
      });
      this.logger.log(
        `[CATALOG_DISPLAY] commit batchId=${batchId} supplier=${req.supplierId} ` +
          `eligible=${res.eligible} displayed=${res.displayed ?? 0}`,
      );
      return {
        batchId,
        eligible: res.eligible,
        displayed: res.displayed ?? 0,
      };
    } catch (e) {
      await this.repo.setBatchStatus(batchId, 'FAILED', {
        completed_at: new Date().toISOString(),
      });
      this.logger.error(
        `[CATALOG_DISPLAY] commit FAILED batchId=${batchId}: ${(e as Error).message}`,
      );
      throw e;
    }
  }

  /** Restore the prior piece_display for a batch (reverses a commit). */
  async rollback(
    batchId: string,
    supplierId: string,
  ): Promise<{ restored: number }> {
    if (!batchId || !supplierId) {
      throw new BadRequestException('batchId and supplierId are required');
    }
    const res = await this.repo.displayRollback(batchId, supplierId);
    this.logger.log(
      `[CATALOG_DISPLAY] rollback batchId=${batchId} restored=${res.restored}`,
    );
    return { restored: res.restored };
  }
}
