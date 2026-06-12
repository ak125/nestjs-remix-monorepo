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
}

@Injectable()
export class PriceImportService {
  private readonly logger = new Logger(PriceImportService.name);

  constructor(private readonly repo: PricingRepository) {}

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
    await this.repo.setBatchStatus(batchId, 'DRY_RUN_OK', {
      checksum: sourceHash,
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
    const lines = await this.buildLines(req);
    const linesByKey = new Map(lines.map((l) => [l.key, l]));
    const report = await this.computeReport(req, lines);

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
        pm_id: req.brandPmId,
        gros_ht: centsToEur(line.grosHtCents ?? 0),
        remise: line.remisePct ?? 0,
        achat_ht: centsToEur(line.achatHtCents),
        marge: r.appliedMargePct ?? 0,
        vente_ht: centsToEur(r.newVenteHtCents),
        vente_ttc: centsToEur(r.newVenteTtcCents ?? 0),
      });
    }

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
        completed_at: new Date().toISOString(),
      });
      this.logger.log(
        `[PRICING_IMPORT] commit batchId=${batchId} committed=${totals.committed} skipped=${totals.skipped} missing=${totals.missing}`,
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
