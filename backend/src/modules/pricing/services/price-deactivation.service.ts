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
 * the impact projection (projectQuarantineImpact) mirrors the quarantine predicate;
 * both are pure, unit-tested functions (no DB).
 *
 * Decision 51 (owner, 2026-11-15/16), amended by decision 118 (2026-11-17),
 * on top of the SQL guards:
 *  - « losing sale » is measured with the single definition of sellable
 *    (`@database/services/vendable`: dispo '1', '2' or '3', not FROZEN, piece
 *    displayed, priced) — the 5 % guard and the reports count the same thing
 *    as the cart;
 *  - freshness: a DISCONTINUED_TARIFF row whose supplier (pri_frs) has not had
 *    its first complete update only ALERTS (never committed), see
 *    `../config/supplier-sale-rules.ts`;
 *  - guard: a lot that would take more than 5 % of the brand's sellable pieces
 *    out of sale stops (recorded FAILED batch, operation
 *    DISPO_DEACTIVATION_GUARD_HALT) and waits for the owner's acknowledgement.
 */
import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { estVendable } from '@database/services/vendable';
import {
  DISPO_DEACTIVATION_OPERATION,
  PricingRepository,
  type SellabilityRow,
} from './pricing.repository';
import {
  OPERATION_ARRET_GARDE_FOU,
  evaluerGardeFou,
  fraicheurActive,
  type GardeFouSortie,
} from '../config/supplier-sale-rules';

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

/**
 * Owner acknowledgement of a guard halt (decision 51 : « s'arrête et attend
 * Marwane »). Accepted only if it names the FAILED halt batch of the same brand
 * recorded for the SAME number of pieces leaving sale as the current projection.
 */
export interface GuardAcknowledgement {
  haltBatchId: string;
  approvedBy: string;
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

/**
 * Served quarantine/storefront predicate for one row: priced AND pri_dispo IN
 * ('1','2','3'), whatever the FROZEN state or piece_display. Kept ONLY to mirror
 * catalog_display_quarantine (SQL, unchanged); « losing sale » uses the single
 * definition (estVendable, decisions 51 and 118).
 */
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
  /** Pieces sellable today (decision 51) that no row keeps sellable after the withdrawal. */
  piecesLosingSale: number;
  /** Visible brand pieces that catalog_display_quarantine would newly hide. */
  newlyQuarantinable: number;
}

/**
 * Pure projection of the withdrawal's catalog effect: applies pri_dispo '0' to the
 * withdrawn rows and compares each piece's state before/after. `displayed` is
 * piece_display (any brand), input of the decision-51 sellable definition.
 */
export function projectQuarantineImpact(
  rowsByPiece: Map<number, SellabilityRow[]>,
  visibleBrand: Map<number, boolean>,
  withdrawn: Set<string>,
  displayed: Map<number, boolean>,
): QuarantineImpact {
  const impact: QuarantineImpact = {
    piecesLosingSale: 0,
    newlyQuarantinable: 0,
  };
  for (const [pieceId, before] of rowsByPiece) {
    const after = before.map((r) =>
      withdrawn.has(rowKey(pieceId, r.priType)) ? { ...r, dispo: '0' } : r,
    );
    const sellable = (r: SellabilityRow) =>
      estVendable({
        dispo: r.dispo,
        etatTarif: r.state,
        venteTtc: r.venteTtc,
        pieceAffichee: displayed.get(pieceId),
      });
    if (before.some(sellable) && !after.some(sellable))
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
  /**
   * DISCONTINUED_TARIFF rows held back because their supplier's freshness
   * condition is not active yet (decision 51 : alert only), per pri_frs label.
   */
  freshnessAlerts: { supplierLabel: string; rows: number }[];
}

export interface DeactivationAssessment {
  report: DeactivationReport;
  impact: QuarantineImpact;
  guard: GardeFouSortie;
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
    if (
      typeof req?.supplierId !== 'string' ||
      !req.supplierId ||
      !Array.isArray(req.rows)
    ) {
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
      freshnessAlerts: [],
    };
    const alerts = new Map<string, number>();

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
            if (
              reason === 'DISCONTINUED_TARIFF' &&
              !fraicheurActive(row.supplierLabel)
            ) {
              const label = row.supplierLabel ?? '(sans libellé)';
              alerts.set(label, (alerts.get(label) ?? 0) + 1);
              break;
            }
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
    report.freshnessAlerts = [...alerts]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([supplierLabel, rows]) => ({ supplierLabel, rows }));
    return { report, commitRows };
  }

  /** Classification + catalog effect + 5 % guard. Reads only. */
  private async assess(
    req: DeactivationRequest,
  ): Promise<DeactivationAssessment & { commitRows: DeactivationCommitRow[] }> {
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
      scope.displayed,
    );
    const guard = evaluerGardeFou(
      impact.piecesLosingSale,
      impact.piecesLosingSale > 0
        ? await this.repo.countSellablePieces(req.supplierId)
        : 0,
    );
    return { report, impact, guard, commitRows };
  }

  /** Read-only projection, including the catalog effect and the guard. NO write. */
  async dryRun(req: DeactivationRequest): Promise<DeactivationAssessment> {
    const { report, impact, guard } = await this.assess(req);
    for (const a of report.freshnessAlerts) {
      this.logger.warn(
        `[PRICING_DEACTIVATE] fraîcheur inactive supplier=${req.supplierId} frs=${a.supplierLabel} ` +
          `rows=${a.rows} : alerte seulement (décision 51)`,
      );
    }
    this.logger.log(
      `[PRICING_DEACTIVATE] dry-run supplier=${req.supplierId} refs=${report.requestedRefs} ` +
        `eligibleRows=${report.eligible} (discontinued=${report.byReason.DISCONTINUED_TARIFF} ` +
        `out=${report.byReason.CONFIRMED_OUT}) pieces=${report.piecesAffected} ` +
        `losingSale=${impact.piecesLosingSale} newlyQuarantinable=${impact.newlyQuarantinable} ` +
        `skipFM=${report.skippedFrozenManual} skipNotSellable=${report.skippedNotSellable} ` +
        `skipReason=${report.skippedStateReason} missing=${report.missingRefs} ` +
        `rejected=${report.rejectedRefs} dup=${report.duplicateRefs} ` +
        `guard=${guard.sortantes}/${guard.vendablesAvant} halt=${guard.arret}`,
    );
    return { report, impact, guard };
  }

  /**
   * Accept an owner acknowledgement only if it names the halt batch recorded for
   * this brand and this exact projection (a changed lot needs a new halt).
   */
  private async checkAcknowledgement(
    req: DeactivationRequest,
    guard: GardeFouSortie,
    ack: GuardAcknowledgement | undefined,
  ): Promise<boolean> {
    if (!ack) return false;
    if (
      typeof ack.haltBatchId !== 'string' ||
      typeof ack.approvedBy !== 'string' ||
      !ack.approvedBy.trim()
    ) {
      throw new BadRequestException(
        'guardAcknowledgement requires haltBatchId and approvedBy',
      );
    }
    const halt = await this.repo.getBatchSummary(ack.haltBatchId);
    if (
      !halt ||
      halt.operation !== OPERATION_ARRET_GARDE_FOU ||
      halt.status !== 'FAILED' ||
      halt.supplierId !== req.supplierId ||
      halt.failedRows !== guard.sortantes
    ) {
      throw new ConflictException(
        `guardAcknowledgement: batch ${ack.haltBatchId} is not the guard halt of this lot ` +
          `(brand ${req.supplierId}, ${guard.sortantes} pieces leaving sale) — re-run the commit to record a new halt`,
      );
    }
    return true;
  }

  /** Commit (owner-gated by `confirm:true`): dispo-only withdrawal, chunked, reversible. */
  async commit(
    req: DeactivationRequest & {
      confirm?: boolean;
      guardAcknowledgement?: GuardAcknowledgement;
    },
  ): Promise<{
    batchId: string;
    totals: {
      deactivated: number;
      skipped: number;
      missing: number;
      rejected: number;
    };
    report: DeactivationReport;
    impact: QuarantineImpact;
    guard: GardeFouSortie;
    acknowledgedBy: string | null;
  }> {
    if (req.confirm !== true) {
      throw new BadRequestException(
        'deactivation commit requires confirm:true',
      );
    }
    const { report, impact, guard, commitRows } = await this.assess(req);
    let acknowledgedBy: string | null = null;
    if (guard.arret) {
      if (
        await this.checkAcknowledgement(req, guard, req.guardAcknowledgement)
      ) {
        acknowledgedBy = req.guardAcknowledgement!.approvedBy;
        this.logger.warn(
          `[PRICING_DEACTIVATE] garde-fou levé par ${acknowledgedBy} (lot arrêté ` +
            `${req.guardAcknowledgement!.haltBatchId}) supplier=${req.supplierId} ` +
            `sortantes=${guard.sortantes}/${guard.vendablesAvant}`,
        );
      } else {
        const haltBatchId = await this.repo.createActivationBatch({
          supplierId: req.supplierId,
          operator: req.operator ?? null,
          operation: OPERATION_ARRET_GARDE_FOU,
        });
        await this.repo.setBatchStatus(haltBatchId, 'FAILED', {
          failed_rows: guard.sortantes,
          committed_rows: 0,
          completed_at: new Date().toISOString(),
        });
        this.logger.warn(
          `[PRICING_DEACTIVATE] ARRÊT garde-fou supplier=${req.supplierId} haltBatchId=${haltBatchId} ` +
            `sortantes=${guard.sortantes}/${guard.vendablesAvant} (${(guard.part * 100).toFixed(2)} % > ` +
            `${(guard.seuil * 100).toFixed(0)} %) — attend l'accord de l'owner`,
        );
        throw new ConflictException({
          message:
            `garde-fou décision 51 : ce lot ferait sortir ${guard.sortantes} pièces sur ` +
            `${guard.vendablesAvant} vendables (> ${(guard.seuil * 100).toFixed(0)} %) ; ` +
            `lot arrêté, accord de l'owner requis (guardAcknowledgement)`,
          haltBatchId,
          guard,
        });
      }
    }
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
    return { batchId, totals, report, impact, guard, acknowledgedBy };
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
