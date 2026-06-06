/**
 * Availability activation service (dispo-only). Drives the governed
 * pricing_activate_chunk RPC: flips pri_dispo null/'0' -> '1' (agence) | '2'
 * (groupe), per portal-CONFIRMED supplier ref. Read-only dry-run projects what
 * WOULD change; commit (owner-gated by `confirm`) applies it under the COMMITTING
 * mutex and is reversible via pricing_rollback_batch. Prices are never mutated.
 *
 * The eligibility projection (classifyActivationRow) mirrors the SQL function's
 * guards EXACTLY and is a pure, unit-tested function (no DB).
 */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PricingRepository } from './pricing.repository';

export type ActivationTarget = '1' | '2';

export interface ActivationRequest {
  /** pri_pm_id (brand), e.g. '3410' (NK). Brand-lock. */
  supplierId: string;
  rows: { ref: string; dispo: ActivationTarget }[];
  operator?: string | null;
}

export type ActivationOutcome =
  | 'ACTIVATE'
  | 'SKIP_FROZEN_MANUAL'
  | 'SKIP_ALREADY_SELLABLE'
  | 'MISSING'
  | 'REJECTED';

/**
 * Pure eligibility — mirrors pricing_activate_chunk's guards verbatim:
 *  target whitelist {1,2} → else REJECTED; no row → MISSING; FROZEN/MANUAL →
 *  SKIP_FROZEN_MANUAL; already sellable (1/2/3) → SKIP_ALREADY_SELLABLE; else ACTIVATE.
 */
export function classifyActivationRow(
  target: string,
  row: { dispo: string | null; state: string } | undefined,
): ActivationOutcome {
  if (target !== '1' && target !== '2') return 'REJECTED';
  if (!row) return 'MISSING';
  if (row.state === 'FROZEN' || row.state === 'MANUAL_OVERRIDE')
    return 'SKIP_FROZEN_MANUAL';
  if (row.dispo === '1' || row.dispo === '2' || row.dispo === '3')
    return 'SKIP_ALREADY_SELLABLE';
  return 'ACTIVATE';
}

export interface ActivationReport {
  requested: number;
  eligible: number;
  byDispo: { '1': number; '2': number };
  skippedFrozenManual: number;
  skippedAlreadySellable: number;
  missing: number;
  rejected: number;
}

const ACTIVATION_CHUNK = 500;

@Injectable()
export class PriceActivationService {
  private readonly logger = new Logger(PriceActivationService.name);

  constructor(private readonly repo: PricingRepository) {}

  /** Resolve the scope against pieces_price + classify each row. */
  private async project(req: ActivationRequest): Promise<{
    report: ActivationReport;
    commitRows: {
      piece_id_i: number;
      pri_type: string;
      dispo: ActivationTarget;
    }[];
  }> {
    const refs = req.rows.map((r) => r.ref);
    const resolved = await this.repo.resolveActivationRows(
      req.supplierId,
      refs,
    );
    const report: ActivationReport = {
      requested: req.rows.length,
      eligible: 0,
      byDispo: { '1': 0, '2': 0 },
      skippedFrozenManual: 0,
      skippedAlreadySellable: 0,
      missing: 0,
      rejected: 0,
    };
    const commitRows: {
      piece_id_i: number;
      pri_type: string;
      dispo: ActivationTarget;
    }[] = [];
    for (const { ref, dispo } of req.rows) {
      const row = resolved.get(ref);
      switch (classifyActivationRow(dispo, row)) {
        case 'ACTIVATE':
          if (row?.pieceId == null) {
            report.missing++;
            break;
          }
          report.eligible++;
          // explicit keys (no dynamic property-name write from a remote value —
          // dispo is already constrained to '1'/'2' by classifyActivationRow, this
          // is defense-in-depth against property injection / prototype pollution)
          if (dispo === '1') report.byDispo['1']++;
          else report.byDispo['2']++;
          commitRows.push({
            piece_id_i: row.pieceId,
            pri_type: row.priType,
            dispo,
          });
          break;
        case 'SKIP_FROZEN_MANUAL':
          report.skippedFrozenManual++;
          break;
        case 'SKIP_ALREADY_SELLABLE':
          report.skippedAlreadySellable++;
          break;
        case 'MISSING':
          report.missing++;
          break;
        case 'REJECTED':
          report.rejected++;
          break;
      }
    }
    return { report, commitRows };
  }

  /** Read-only projection. NO write. */
  async dryRun(req: ActivationRequest): Promise<{ report: ActivationReport }> {
    const { report } = await this.project(req);
    this.logger.log(
      `[PRICING_ACTIVATE] dry-run supplier=${req.supplierId} requested=${report.requested} ` +
        `eligible=${report.eligible} (1=${report.byDispo['1']} 2=${report.byDispo['2']}) ` +
        `skipFM=${report.skippedFrozenManual} skipSell=${report.skippedAlreadySellable} ` +
        `missing=${report.missing} rejected=${report.rejected}`,
    );
    return { report };
  }

  /** Commit (owner-gated by `confirm:true`): dispo-only activation, chunked, reversible. */
  async commit(req: ActivationRequest & { confirm?: boolean }): Promise<{
    batchId: string;
    totals: {
      activated: number;
      skipped: number;
      missing: number;
      rejected: number;
    };
    report: ActivationReport;
  }> {
    if (req.confirm !== true) {
      throw new BadRequestException('activation commit requires confirm:true');
    }
    const { report, commitRows } = await this.project(req);
    const batchId = await this.repo.createActivationBatch({
      supplierId: req.supplierId,
      operator: req.operator ?? null,
    });
    await this.repo.setBatchStatus(batchId, 'COMMITTING'); // acquire per-supplier mutex
    const totals = { activated: 0, skipped: 0, missing: 0, rejected: 0 };
    try {
      for (
        let seq = 0, i = 0;
        i < commitRows.length;
        i += ACTIVATION_CHUNK, seq++
      ) {
        const slice = commitRows.slice(i, i + ACTIVATION_CHUNK);
        const chunkId = await this.repo.createChunk(
          batchId,
          seq,
          i,
          i + slice.length,
        );
        const res = await this.repo.activateChunk({
          batchId,
          chunkId,
          supplier: req.supplierId,
          operator: req.operator ?? null,
          rows: slice,
        });
        totals.activated += res.activated;
        totals.skipped += res.skipped;
        totals.missing += res.missing;
        totals.rejected += res.rejected;
      }
      await this.repo.setBatchStatus(batchId, 'COMMITTED', {
        committed_rows: totals.activated,
        completed_at: new Date().toISOString(),
      });
      this.logger.log(
        `[PRICING_ACTIVATE] commit batchId=${batchId} activated=${totals.activated} ` +
          `skipped=${totals.skipped} missing=${totals.missing} rejected=${totals.rejected}`,
      );
    } catch (e) {
      await this.repo.setBatchStatus(batchId, 'FAILED', {
        completed_at: new Date().toISOString(),
      });
      this.logger.error(
        `[PRICING_ACTIVATE] commit FAILED batchId=${batchId}: ${(e as Error).message}`,
      );
      throw e;
    }
    return { batchId, totals, report };
  }

  /** LIFO rollback of an activation batch (restores prior pri_dispo). */
  async rollback(
    batchId: string,
    supplierId: string,
  ): Promise<{ restored: number; superseded: number }> {
    const res = await this.repo.rollbackBatch(batchId, supplierId);
    this.logger.log(
      `[PRICING_ACTIVATE] rollback batchId=${batchId} restored=${res.restored} superseded=${res.superseded}`,
    );
    return res;
  }
}
