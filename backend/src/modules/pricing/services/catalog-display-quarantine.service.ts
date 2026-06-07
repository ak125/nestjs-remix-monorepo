/**
 * Catalog visibility quarantine service (piece_display only) — the inverse of
 * {@link CatalogDisplayActivationService}.
 *
 * Drives the governed catalog_display_quarantine RPC: flips pieces.piece_display
 * true -> false for the brand's refs that are currently visible AND non-vendable
 * per the storefront isSellable gate (no pieces_price row with pri_dispo IN
 * '1','2','3' AND pri_vente_ttc_n > 0). These are the refs that render at 0 € /
 * OUT_OF_STOCK in R2 listings: visually present but not buyable (listing-quality
 * drag). Hiding them is the mirror-image of the activation flow.
 *
 * SET-BASED + IDEMPOTENT: the scope is derived from the governed DB signal, not
 * from a passed id list. dryRun projects what WOULD hide with ZERO writes; commit
 * (owner-gated by `confirm:true`) applies it under a per-supplier batch and is
 * reversible via the SAME generic catalog_display_rollback_batch. The eligibility
 * predicate lives once, server-side, so dry-run and commit can never drift.
 *
 * SCOPE GUARDRAILS (enforced in the SQL function, mirrored here for intent):
 *   brand-locked · STRUCTURALLY DISJOINT from the activate domain (never touches a
 *   ref with a sellable-dispo price) · gated on the inverse-isSellable predicate ·
 *   never touches gamme/vehicle/price/dispo · only true -> false.
 */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PricingRepository } from './pricing.repository';

export interface DisplayQuarantineRequest {
  /** pieces.piece_pm_id (brand), e.g. '3410' (NK). Brand-lock. */
  supplierId: string;
  operator?: string | null;
}

@Injectable()
export class CatalogDisplayQuarantineService {
  private readonly logger = new Logger(CatalogDisplayQuarantineService.name);

  constructor(private readonly repo: PricingRepository) {}

  /** Read-only projection of how many visible-but-non-vendable refs WOULD be hidden. */
  async dryRun(supplierId: string): Promise<{ eligible: number }> {
    if (!supplierId) {
      throw new BadRequestException('supplierId is required');
    }
    const res = await this.repo.displayQuarantine({
      batchId: null,
      supplier: supplierId,
      operator: null,
      dryRun: true,
    });
    this.logger.log(
      `[CATALOG_DISPLAY] quarantine dry-run supplier=${supplierId} eligible=${res.eligible}`,
    );
    return { eligible: res.eligible };
  }

  /**
   * Apply the visibility quarantine — requires `confirm:true` (owner-gated).
   * Opens a governed batch, runs the set-based flip, marks the batch COMMITTED.
   */
  async commit(
    req: DisplayQuarantineRequest & { confirm?: boolean },
  ): Promise<{ batchId: string; eligible: number; hidden: number }> {
    if (!req.supplierId) {
      throw new BadRequestException('supplierId is required');
    }
    if (req.confirm !== true) {
      throw new BadRequestException(
        'display quarantine commit requires confirm:true',
      );
    }
    const batchId = await this.repo.createActivationBatch({
      supplierId: req.supplierId,
      operator: req.operator ?? null,
    });
    await this.repo.setBatchStatus(batchId, 'COMMITTING'); // per-supplier mutex
    try {
      const res = await this.repo.displayQuarantine({
        batchId,
        supplier: req.supplierId,
        operator: req.operator ?? null,
        dryRun: false,
      });
      await this.repo.setBatchStatus(batchId, 'COMMITTED', {
        committed_rows: res.hidden ?? 0,
        completed_at: new Date().toISOString(),
      });
      this.logger.log(
        `[CATALOG_DISPLAY] quarantine commit batchId=${batchId} supplier=${req.supplierId} ` +
          `eligible=${res.eligible} hidden=${res.hidden ?? 0}`,
      );
      return {
        batchId,
        eligible: res.eligible,
        hidden: res.hidden ?? 0,
      };
    } catch (e) {
      await this.repo.setBatchStatus(batchId, 'FAILED', {
        completed_at: new Date().toISOString(),
      });
      this.logger.error(
        `[CATALOG_DISPLAY] quarantine commit FAILED batchId=${batchId}: ${(e as Error).message}`,
      );
      throw e;
    }
  }

  /**
   * Restore the prior piece_display for a batch (reverses a quarantine commit).
   * Delegates to the SAME generic rollback as the activation flow.
   */
  async rollback(
    batchId: string,
    supplierId: string,
  ): Promise<{ restored: number }> {
    if (!batchId || !supplierId) {
      throw new BadRequestException('batchId and supplierId are required');
    }
    const res = await this.repo.displayRollback(batchId, supplierId);
    this.logger.log(
      `[CATALOG_DISPLAY] quarantine rollback batchId=${batchId} restored=${res.restored}`,
    );
    return { restored: res.restored };
  }
}
