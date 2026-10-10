/**
 * Availability WITHDRAWAL service (dispo-only) — the inverse of
 * PriceActivationService. Drives the governed pricing_deactivate_chunk RPC: flips
 * pri_dispo '1'/'2'/'3' -> '0' on every brand-locked row of a ref that carries a
 * POSITIVE proof of unavailability — discontinued in the supplier tariff, or out of
 * stock confirmed by a queryable supplier with no confirmation elsewhere. The proof
 * is established upstream (availability classifier report); this service only
 * accepts the whitelisted reasons and never infers one.
 *
 * '3' (PREORDER) is withdrawn too: the storefront sells a priced PREORDER row
 * (frontend stock.utils isSellable), so leaving it would keep the piece buyable.
 *
 * Dry-run is read-only and also projects how many visible pieces the
 * catalog_display_quarantine step would then hide. Commit is owner-gated
 * (`confirm:true`), runs under the per-supplier COMMITTING mutex, and is reversible
 * ONLY through the dedicated dispo-only rollback (pricing_deactivate_rollback) —
 * the generic pricing_rollback_batch rewrites price columns and is refused for
 * these batches (PricingRepository.rollbackBatch). Prices are never mutated.
 *
 * The eligibility (classifyDeactivationRow) mirrors the SQL function's guards and
 * the impact projection (projectQuarantineImpact) mirrors the storefront and
 * quarantine predicates; both are pure, unit-tested functions (no DB).
 */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import {
  DISPO_DEACTIVATION_OPERATION,
  PricingRepository,
  type SellabilityRow,
} from './pricing.repository';

export const DEACTIVATION_REASONS = [
  'DISCONTINUED_TARIFF',
  'CONFIRMED_OUT',
] as const;
export type DeactivationReason = (typeof DEACTIVATION_REASONS)[number];

export function isDeactivationReason(r: unknown): r is DeactivationReason {
  return r === 'DISCONTINUED_TARIFF' || r === 'CONFIRMED_OUT';
}

export interface DeactivationRequest {
  /** pri_pm_id (brand), e.g. '3410' (NK). Brand-lock. */
  supplierId: string;
  rows: { ref: string; reason: DeactivationReason }[];
  operator?: string | null;
}

export type DeactivationOutcome =
  | 'DEACTIVATE'
  | 'SKIP_FROZEN_MANUAL'
  | 'SKIP_NOT_SELLABLE'
  | 'SKIP_STATE_REASON'
  | 'MISSING'
  | 'REJECTED';

/**
 * Pure eligibility — mirrors pricing_deactivate_chunk's guards verbatim:
 *  reason whitelist → else REJECTED; no row → MISSING; FROZEN/MANUAL →
 *  SKIP_FROZEN_MANUAL; not sellable (not 1/2/3) → SKIP_NOT_SELLABLE; a state reason
 *  already set → SKIP_STATE_REASON (the rollback restores reason NULL, so it must
 *  only ever have been NULL); else DEACTIVATE.
 */
export function classifyDeactivationRow(
  reason: string,
  row:
    | { dispo: string | null; state: string; stateReason: string | null }
    | undefined,
): DeactivationOutcome {
  if (!isDeactivationReason(reason)) return 'REJECTED';
  if (!row) return 'MISSING';
  if (row.state === 'FROZEN' || row.state === 'MANUAL_OVERRIDE')
    return 'SKIP_FROZEN_MANUAL';
  if (row.dispo !== '1' && row.dispo !== '2' && row.dispo !== '3')
    return 'SKIP_NOT_SELLABLE';
  if (row.stateReason != null) return 'SKIP_STATE_REASON';
  return 'DEACTIVATE';
}

const rowKey = (pieceId: number, priType: string) => `${pieceId}:${priType}`;

/** Storefront isSellable for one row: priced AND pri_dispo IN ('1','2','3'). */
function isSellableRow(r: SellabilityRow): boolean {
  return (
    r.venteTtc != null &&
    r.venteTtc > 0 &&
    (r.dispo === '1' || r.dispo === '2' || r.dispo === '3')
  );
}

/** catalog_display_quarantine's price predicate: no '1'/'2' row and no sellable row. */
function isQuarantinable(rows: SellabilityRow[]): boolean {
  return (
    !rows.some((r) => r.dispo === '1' || r.dispo === '2') &&
    !rows.some(isSellableRow)
  );
}

export interface QuarantineImpact {
  /** Pieces sellable today that no row keeps sellable after the withdrawal. */
  piecesLosingSale: number;
  /** Visible brand pieces that catalog_display_quarantine would newly hide. */
  newlyQuarantinable: number;
}

/**
 * Pure projection of the withdrawal's catalog effect: applies pri_dispo '0' to the
 * withdrawn rows and compares each piece's state before/after.
 */
export function projectQuarantineImpact(
  rowsByPiece: Map<number, SellabilityRow[]>,
  visibleBrand: Map<number, boolean>,
  withdrawn: Set<string>,
): QuarantineImpact {
  const impact: QuarantineImpact = {
    piecesLosingSale: 0,
    newlyQuarantinable: 0,
  };
  for (const [pieceId, before] of rowsByPiece) {
    const after = before.map((r) =>
      withdrawn.has(rowKey(pieceId, r.priType)) ? { ...r, dispo: '0' } : r,
    );
    if (before.some(isSellableRow) && !after.some(isSellableRow))
      impact.piecesLosingSale++;
    if (
      visibleBrand.get(pieceId) === true &&
      !isQuarantinable(before) &&
      isQuarantinable(after)
    )
      impact.newlyQuarantinable++;
  }
  return impact;
}

export interface DeactivationReport {
  requestedRefs: number;
  duplicateRefs: number;
  rejectedRefs: number;
  missingRefs: number;
  /** Rows (a ref can carry several pieces_price rows). */
  eligible: number;
  byReason: { DISCONTINUED_TARIFF: number; CONFIRMED_OUT: number };
  skippedFrozenManual: number;
  skippedNotSellable: number;
  skippedStateReason: number;
  rowsWithoutPiece: number;
  piecesAffected: number;
}

interface DeactivationCommitRow {
  piece_id_i: number;
  pri_type: string;
  reason: DeactivationReason;
}

const DEACTIVATION_CHUNK = 500;

@Injectable()
export class PriceDeactivationService {
  private readonly logger = new Logger(PriceDeactivationService.name);

  constructor(private readonly repo: PricingRepository) {}

  /** Resolve the scope against pieces_price + classify each row. */
  private async project(req: DeactivationRequest): Promise<{
    report: DeactivationReport;
    commitRows: DeactivationCommitRow[];
  }> {
    if (!req?.supplierId || !Array.isArray(req.rows)) {
      throw new BadRequestException(
        'deactivation requires supplierId and rows[]',
      );
    }
    const report: DeactivationReport = {
      requestedRefs: req.rows.length,
      duplicateRefs: 0,
      rejectedRefs: 0,
      missingRefs: 0,
      eligible: 0,
      byReason: { DISCONTINUED_TARIFF: 0, CONFIRMED_OUT: 0 },
      skippedFrozenManual: 0,
      skippedNotSellable: 0,
      skippedStateReason: 0,
      rowsWithoutPiece: 0,
      piecesAffected: 0,
    };

    // First occurrence of a ref wins; a bad reason is rejected before any read.
    const wanted = new Map<string, DeactivationReason>();
    for (const { ref, reason } of req.rows) {
      if (wanted.has(ref)) {
        report.duplicateRefs++;
        continue;
      }
      if (!isDeactivationReason(reason)) {
        report.rejectedRefs++;
        continue;
      }
      wanted.set(ref, reason);
    }

    const resolved = await this.repo.resolveDeactivationRows(req.supplierId, [
      ...wanted.keys(),
    ]);
    const commitRows: DeactivationCommitRow[] = [];
    const seen = new Set<string>();
    for (const [ref, reason] of wanted) {
      const rows = resolved.get(ref);
      if (!rows || rows.length === 0) {
        report.missingRefs++;
        continue;
      }
      for (const row of rows) {
        switch (classifyDeactivationRow(reason, row)) {
          case 'DEACTIVATE': {
            if (row.pieceId == null) {
              report.rowsWithoutPiece++;
              break;
            }
            const key = rowKey(row.pieceId, row.priType);
            if (seen.has(key)) break;
            seen.add(key);
            report.eligible++;
            // explicit keys (no dynamic property-name write from a remote value)
            if (reason === 'DISCONTINUED_TARIFF')
              report.byReason.DISCONTINUED_TARIFF++;
            else report.byReason.CONFIRMED_OUT++;
            commitRows.push({
              piece_id_i: row.pieceId,
              pri_type: row.priType,
              reason,
            });
            break;
          }
          case 'SKIP_FROZEN_MANUAL':
            report.skippedFrozenManual++;
            break;
          case 'SKIP_NOT_SELLABLE':
            report.skippedNotSellable++;
            break;
          case 'SKIP_STATE_REASON':
            report.skippedStateReason++;
            break;
          case 'MISSING':
          case 'REJECTED':
            // unreachable: the ref has rows and its reason was validated above
            break;
        }
      }
    }
    report.piecesAffected = new Set(commitRows.map((r) => r.piece_id_i)).size;
    return { report, commitRows };
  }

  /** Read-only projection, including the catalog effect. NO write. */
  async dryRun(
    req: DeactivationRequest,
  ): Promise<{ report: DeactivationReport; impact: QuarantineImpact }> {
    const { report, commitRows } = await this.project(req);
    const pieceIds = [...new Set(commitRows.map((r) => r.piece_id_i))];
    const scope = await this.repo.fetchSellabilityScope(
      req.supplierId,
      pieceIds,
    );
    const impact = projectQuarantineImpact(
      scope.rows,
      scope.visibleBrand,
      new Set(commitRows.map((r) => rowKey(r.piece_id_i, r.pri_type))),
    );
    this.logger.log(
      `[PRICING_DEACTIVATE] dry-run supplier=${req.supplierId} refs=${report.requestedRefs} ` +
        `eligibleRows=${report.eligible} (discontinued=${report.byReason.DISCONTINUED_TARIFF} ` +
        `out=${report.byReason.CONFIRMED_OUT}) pieces=${report.piecesAffected} ` +
        `losingSale=${impact.piecesLosingSale} newlyQuarantinable=${impact.newlyQuarantinable} ` +
        `skipFM=${report.skippedFrozenManual} skipNotSellable=${report.skippedNotSellable} ` +
        `skipReason=${report.skippedStateReason} missing=${report.missingRefs} ` +
        `rejected=${report.rejectedRefs} dup=${report.duplicateRefs}`,
    );
    return { report, impact };
  }

  /** Commit (owner-gated by `confirm:true`): dispo-only withdrawal, chunked, reversible. */
  async commit(req: DeactivationRequest & { confirm?: boolean }): Promise<{
    batchId: string;
    totals: {
      deactivated: number;
      skipped: number;
      missing: number;
      rejected: number;
    };
    report: DeactivationReport;
  }> {
    if (req.confirm !== true) {
      throw new BadRequestException(
        'deactivation commit requires confirm:true',
      );
    }
    const { report, commitRows } = await this.project(req);
    const batchId = await this.repo.createActivationBatch({
      supplierId: req.supplierId,
      operator: req.operator ?? null,
      operation: DISPO_DEACTIVATION_OPERATION,
    });
    await this.repo.setBatchStatus(batchId, 'COMMITTING'); // acquire per-supplier mutex
    const totals = { deactivated: 0, skipped: 0, missing: 0, rejected: 0 };
    try {
      for (
        let seq = 0, i = 0;
        i < commitRows.length;
        i += DEACTIVATION_CHUNK, seq++
      ) {
        const slice = commitRows.slice(i, i + DEACTIVATION_CHUNK);
        const chunkId = await this.repo.createChunk(
          batchId,
          seq,
          i,
          i + slice.length,
        );
        const res = await this.repo.deactivateChunk({
          batchId,
          chunkId,
          supplier: req.supplierId,
          operator: req.operator ?? null,
          rows: slice,
        });
        totals.deactivated += res.deactivated;
        totals.skipped += res.skipped;
        totals.missing += res.missing;
        totals.rejected += res.rejected;
      }
      await this.repo.setBatchStatus(batchId, 'COMMITTED', {
        committed_rows: totals.deactivated,
        completed_at: new Date().toISOString(),
      });
      this.logger.log(
        `[PRICING_DEACTIVATE] commit batchId=${batchId} deactivated=${totals.deactivated} ` +
          `skipped=${totals.skipped} missing=${totals.missing} rejected=${totals.rejected}`,
      );
    } catch (e) {
      await this.repo.setBatchStatus(batchId, 'FAILED', {
        completed_at: new Date().toISOString(),
      });
      this.logger.error(
        `[PRICING_DEACTIVATE] commit FAILED batchId=${batchId}: ${(e as Error).message}`,
      );
      throw e;
    }
    return { batchId, totals, report };
  }

  /** LIFO, dispo-only rollback of a withdrawal batch (restores prior pri_dispo, clears the reason). */
  async rollback(
    batchId: string,
    supplierId: string,
  ): Promise<{ restored: number; superseded: number }> {
    const operation = await this.repo.getBatchOperation(batchId);
    if (operation !== DISPO_DEACTIVATION_OPERATION) {
      throw new BadRequestException(
        `batch ${batchId} is not a ${DISPO_DEACTIVATION_OPERATION} batch (operation=${operation ?? 'null'})`,
      );
    }
    const res = await this.repo.rollbackDeactivationBatch(batchId, supplierId);
    this.logger.log(
      `[PRICING_DEACTIVATE] rollback batchId=${batchId} restored=${res.restored} superseded=${res.superseded}`,
    );
    return res;
  }
}
