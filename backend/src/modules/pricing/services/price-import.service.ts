/**
 * L3 — Price import lifecycle (NestJS orchestration).
 *
 * Wires RAW persistence, profile resolution (L0.5), the pure dry-run core, and
 * the chunked atomic commit / LIFO rollback (server-side functions). All DB I/O
 * goes through PricingRepository; the computation stays in the pure modules.
 *
 * Logs carry correlation IDs (batchId/rawId) per the observability contract.
 */
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { centsToEur } from './pricing-formula.service';
import {
  resolveCanonicalInputs,
  resolveProfile,
  ProfileError,
} from './supplier-profile.service';
import {
  computeDryRun,
  type CatalogPiece,
  type DryRunOptions,
  type DryRunReport,
  type ImportLine,
} from './price-import.dry-run';
import {
  computeStrategyVenteHt,
  type PricingRule,
} from './pricing-strategy.service';
import { PricingRepository, type CommitRowPayload } from './pricing.repository';
import { countInvariantRejections } from './price-guard-signal.core';
import { SupplierTruthRepository } from '../../supplier-truth';

const CHUNK_SIZE = 5000;

export interface ImportRequest {
  supplierId: string;
  /** Brand (pri_pm_id) the file targets — the matching scope. */
  brandPmId: string;
  sourceFile?: string;
  fileRows: Record<string, string>[];
  operator?: string;
  options?: DryRunOptions;
  /**
   * Commercial activation gate (owner doctrine 2026-06-04). Default false = PENDING:
   * the commit puts the cost in base but does NOT make pieces sellable
   * (INSERT → pri_dispo='0' + pending_stock_check; UPDATE → dispo preserved).
   * true = activate (pri_dispo='1') — only for portal-CONFIRMED refs, owner-gated.
   * See supplier-brand-price-load-procedure.md §Garde-fou storefront.
   */
  activate?: boolean;
  /**
   * Effective date of the supplier tariff (`YYYY-MM-DD`). Required by
   * {@link PriceImportService.commit}: it is written to `pieces_price.pri_date_from`
   * on each committed row, with the real supplier (`pri_frs`). Rows outside the
   * commit are not touched. Ignored by the dry-run.
   */
  tariffDate?: string;
}

const TARIFF_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * `YYYY-MM-DD` → `YYYY-MM-DDT00:00:00.000Z` (format of the historical
 * `pri_date_from` values). Throws on a missing or impossible date: the commit
 * never invents a tariff date.
 */
export function toPriDateFrom(tariffDate: string | undefined): string {
  const m = TARIFF_DATE_RE.exec((tariffDate ?? '').trim());
  if (!m) {
    throw new BadRequestException(
      'tariffDate (YYYY-MM-DD) is required to commit an import',
    );
  }
  const iso = `${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.toISOString() !== iso) {
    throw new BadRequestException(
      `tariffDate ${tariffDate} is not a valid date`,
    );
  }
  return iso;
}

/**
 * Pure: committable dry-run rows → RPC payloads, each stamped with the tariff's
 * real supplier and date. Rejected, unmatched and state-skipped rows are left out.
 */
export function buildCommitPayloads(
  report: DryRunReport,
  linesByKey: ReadonlyMap<string, ImportLine>,
  brandPmId: string,
  stamp: { frs: string; dateFrom: string },
): CommitRowPayload[] {
  const payloads: CommitRowPayload[] = [];
  for (const r of report.rows) {
    if (
      !r.matched ||
      r.rejected ||
      r.skippedState ||
      r.newVenteHtCents == null ||
      r.operation == null
    )
      continue;
    const line = linesByKey.get(r.key);
    if (!line || r.priPieceIdI == null) continue;
    payloads.push({
      piece_id_i: r.priPieceIdI,
      pri_type: '0',
      operation: r.operation,
      pm_id: brandPmId,
      gros_ht: centsToEur(line.grosHtCents ?? 0),
      remise: line.remisePct ?? 0,
      achat_ht: centsToEur(line.achatHtCents),
      marge: r.appliedMargePct ?? 0,
      vente_ht: centsToEur(r.newVenteHtCents),
      vente_ttc: centsToEur(r.newVenteTtcCents ?? 0),
      frs: stamp.frs,
      date_from: stamp.dateFrom,
    });
  }
  return payloads;
}

@Injectable()
export class PriceImportService {
  private readonly logger = new Logger(PriceImportService.name);

  constructor(
    private readonly repo: PricingRepository,
    /** Only reader of `___xtr_supplier` (ast-grep commerce-no-direct-supplier-read). */
    private readonly supplierTruth: SupplierTruthRepository,
  ) {}

  /**
   * Label written to `pieces_price.pri_frs` (`___xtr_supplier.spl_name` of
   * `spl_id = supplierId`), via the supplier directory of SupplierTruthModule.
   * Null when the id is unknown: the commit is refused, no default label.
   */
  private async supplierLabel(supplierId: string): Promise<string | null> {
    const directory = await this.supplierTruth.getSupplierDirectory();
    for (const entry of directory.values()) {
      if (entry.splId === supplierId.trim()) return entry.nom;
    }
    return null;
  }

  private hashRows(rows: Record<string, string>[]): string {
    return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  }

  private async buildLines(req: ImportRequest): Promise<ImportLine[]> {
    const profiles = await this.repo.fetchProfiles(req.supplierId);
    const profile = resolveProfile(profiles, { supplierId: req.supplierId });
    if (!profile) {
      throw new BadRequestException(
        `No active supplier_price_profile for supplier "${req.supplierId}" (author one before import)`,
      );
    }
    return req.fileRows.map((row): ImportLine => {
      try {
        const c = resolveCanonicalInputs(row, profile);
        return {
          key: profile.keyField === 'EAN' && c.ean ? c.ean : c.ref || c.ean,
          matchedBy: profile.keyField === 'EAN' && c.ean ? 'EAN' : 'REF',
          achatHtCents: c.achatHtCents,
          margePct: c.margePct,
          grosHtCents: c.grosHtCents,
          remisePct: c.remisePct,
          confidence: c.confidence,
          derivation: profile.derivation,
        };
      } catch (e) {
        const reason = e instanceof ProfileError ? e.message : 'parse error';
        return {
          key: row[profile.columnMapping.ref?.column ?? ''] ?? '(unparsed)',
          matchedBy: 'REF',
          achatHtCents: 0,
          confidence: 'AMBIGUOUS_MAPPING',
          derivation: profile.derivation,
          parseError: reason,
        };
      }
    });
  }

  /** L4 grid resolver → floored/capped vente_HT for a cost, or null if no rule. */
  private makeGridResolver(
    rules: PricingRule[],
  ): (costCents: number) => number | null {
    return (costCents: number) => {
      const res = computeStrategyVenteHt(rules, {
        costCents,
        customerType: 'B2C',
      });
      return res ? res.venteHtCents : null;
    };
  }

  /**
   * Match + compute the report. Fetches the brand catalog ONLY when some lines
   * are not found among existing price rows (recovery/INSERT case) — avoids a
   * 200K+ row catalog scan for a pure re-price (e.g. Bosch).
   */
  private async computeReport(
    req: ImportRequest,
    lines: ImportLine[],
  ): Promise<DryRunReport> {
    const existing = await this.repo.fetchExistingByBrand(req.brandPmId);
    const needCatalog = lines.some(
      (l) => !l.parseError && !existing.has(l.key),
    );
    const catalog: ReadonlyMap<string, CatalogPiece> = needCatalog
      ? await this.repo.fetchCatalogByBrand(req.brandPmId)
      : new Map();
    const rules = await this.repo.fetchRules();
    const opts: DryRunOptions = {
      ...req.options,
      activate: req.activate ?? false, // preview reflects the activation mode (default PENDING)
      resolveGridVenteHt: this.makeGridResolver(rules),
    };
    return computeDryRun(lines, existing, catalog, opts);
  }

  /** Dry-run: persist RAW, open a batch, compute the report. No price writes. */
  async dryRun(
    req: ImportRequest,
  ): Promise<{ batchId: string; report: DryRunReport }> {
    const sourceHash = this.hashRows(req.fileRows);
    const lines = await this.buildLines(req);
    const rawId = await this.repo.insertRaw({
      supplierId: req.supplierId,
      sourceFile: req.sourceFile ?? null,
      sourceHash,
      rawPayload: null,
      rowCount: req.fileRows.length,
    });
    const batchId = await this.repo.createBatch({
      supplierId: req.supplierId,
      rawId,
      sourceFile: req.sourceFile ?? null,
      sourceFileHash: sourceHash,
      operator: req.operator ?? null,
    });
    const report = await this.computeReport(req, lines);
    // failed_rows = lignes refusées par le garde-fou des prix : état lu par le
    // producteur du rapport du matin (price-guard-signal.core, mandat EI).
    await this.repo.setBatchStatus(batchId, 'DRY_RUN_OK', {
      checksum: sourceHash,
      failed_rows: countInvariantRejections(report),
    });
    this.logger.log(
      `[PRICING_IMPORT] dry-run batchId=${batchId} rawId=${rawId} matched=${report.matchedCount} ` +
        `(insert=${report.insertedCount} update=${report.updatedCount}) unmatched=${report.unmatchedCount} ` +
        `rejected=${report.rejectedCount} outliers=${report.outlierCount} activated=${report.activatedCount} ` +
        `ΔventeHT_cents=${report.totalDeltaVenteHtCents} ΔCA_cents=${report.estimatedRevenueDeltaCents}`,
    );
    return { batchId, report };
  }

  /** Commit: chunked atomic upsert under the COMMITTING mutex. */
  async commit(
    batchId: string,
    req: ImportRequest,
  ): Promise<{ committed: number; skipped: number; missing: number }> {
    // Tariff date and real supplier are written on every committed row: refuse
    // the commit before any write when either is missing (no default value).
    const dateFrom = toPriDateFrom(req.tariffDate);
    const frs = await this.supplierLabel(req.supplierId);
    if (!frs) {
      throw new BadRequestException(
        `supplier ${req.supplierId} has no label in ___xtr_supplier: commit refused`,
      );
    }

    const lines = await this.buildLines(req);
    const linesByKey = new Map(lines.map((l) => [l.key, l]));
    const report = await this.computeReport(req, lines);

    const payloads = buildCommitPayloads(report, linesByKey, req.brandPmId, {
      frs,
      dateFrom,
    });

    // Acquire the per-supplier mutex (partial unique index rejects a concurrent one).
    await this.repo.setBatchStatus(batchId, 'COMMITTING');
    const totals = { committed: 0, skipped: 0, missing: 0 };
    try {
      for (let seq = 0, i = 0; i < payloads.length; i += CHUNK_SIZE, seq++) {
        const slice = payloads.slice(i, i + CHUNK_SIZE);
        const chunkId = await this.repo.createChunk(
          batchId,
          seq,
          i,
          i + slice.length,
        );
        const res = await this.repo.commitChunk({
          batchId,
          chunkId,
          supplier: req.supplierId,
          operator: req.operator ?? null,
          rows: slice,
          activate: req.activate ?? false, // default PENDING: cost only, not sellable
        });
        totals.committed += res.committed;
        totals.skipped += res.skipped;
        totals.missing += res.missing;
      }
      await this.repo.setBatchStatus(batchId, 'COMMITTED', {
        committed_rows: totals.committed,
        failed_rows: countInvariantRejections(report),
        completed_at: new Date().toISOString(),
      });
      this.logger.log(
        `[PRICING_IMPORT] commit batchId=${batchId} frs=${frs} dateFrom=${dateFrom} committed=${totals.committed} skipped=${totals.skipped} missing=${totals.missing}`,
      );
    } catch (e) {
      await this.repo.setBatchStatus(batchId, 'FAILED', {
        completed_at: new Date().toISOString(),
      });
      this.logger.error(
        `[PRICING_IMPORT] commit FAILED batchId=${batchId}: ${(e as Error).message}`,
      );
      throw e;
    }
    return totals;
  }

  async rollback(
    batchId: string,
    supplierId: string,
  ): Promise<{ restored: number; superseded: number }> {
    const res = await this.repo.rollbackBatch(batchId, supplierId);
    this.logger.log(
      `[PRICING_ROLLBACK] batchId=${batchId} restored=${res.restored} superseded=${res.superseded}`,
    );
    return res;
  }
}
