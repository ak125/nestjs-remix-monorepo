/**
 * L3 — Dry-run orchestration (pure core).
 *
 * Given parsed import lines (post L0.5) and the existing price rows, recomputes
 * the price chain (L1), validates it (L2), and produces an explainable report:
 * matched/unmatched/rejected/outliers, before→after deltas, weighted CA impact,
 * and per-line "why it changed". Pure — zero I/O, fully unit-testable. The
 * NestJS service supplies the data and reuses this.
 *
 * Margin modes:
 *   - PRESERVE_EXISTING (default import): keep each row's existing taux de marge,
 *     recompute vente from the new achat. ⇒ delta ≈ 0 when achat unchanged.
 *   - APPLY_GRID: the caller has already resolved a target marge per line (L4).
 *
 * MANUAL_OVERRIDE / FROZEN rows are never modified (skipped, reported).
 */
import {
  computeVenteHtCents,
  computeVenteTtcCents,
  computeMargePct,
  DEFAULT_TVA_RATE,
} from './pricing-formula.service';
import { validatePriceChain, type InvariantOptions } from './pricing-invariants.service';
import type { Derivation, ParseConfidence } from './supplier-profile.service';

export const PROTECTED_STATES = ['MANUAL_OVERRIDE', 'FROZEN'] as const;
export const DEFAULT_OUTLIER_PCT = 30;

export type MarginMode = 'PRESERVE_EXISTING' | 'APPLY_GRID';

/** One parsed import line (post L0.5), keyed for matching. */
export interface ImportLine {
  key: string; // normalized ref OR ean used for matching
  matchedBy: 'REF' | 'EAN';
  achatHtCents: number;
  /** Present when the convention carries marge (MARGE_ON_NET) or APPLY_GRID resolved it. */
  margePct?: number;
  /** Carried for persistence/audit when the convention provides them. */
  grosHtCents?: number;
  remisePct?: number;
  confidence: ParseConfidence;
  derivation: Derivation;
  /** Set if L0.5 rejected this row (e.g. missing column) — surfaced, never silently dropped. */
  parseError?: string;
}

/** Existing price row from `pieces_price` (the match target). */
export interface ExistingPriceRow {
  priPieceIdI: number;
  priType: string;
  achatHtCents: number;
  margePct: number;
  venteHtCents: number;
  venteTtcCents: number;
  fraisPortHtCents: number;
  fraisSuppHtCents: number;
  tvaRate: number;
  pricingState: string;
  qtySold12m: number;
}

export interface DryRunRow {
  key: string;
  priPieceIdI?: number;
  matched: boolean;
  confidence: ParseConfidence;
  // explainability
  derivationUsed?: Derivation;
  marginSource?: 'existing' | 'import' | 'grid';
  appliedMargePct?: number;
  // before → after
  oldVenteHtCents?: number;
  newVenteHtCents?: number;
  oldVenteTtcCents?: number;
  newVenteTtcCents?: number;
  deltaVenteHtCents?: number;
  outlier?: boolean;
  rejected?: boolean;
  rejectReason?: string;
  skippedState?: string;
}

export interface DryRunReport {
  marginMode: MarginMode;
  matchedCount: number;
  unmatchedCount: number;
  rejectedCount: number;
  outlierCount: number;
  skippedStateCount: number;
  unmatchedKeys: string[];
  totalDeltaVenteHtCents: number;
  /** Σ Δvente_TTC × qty_sold_12m — weighted revenue impact proxy. */
  estimatedRevenueDeltaCents: number;
  rows: DryRunRow[];
}

export interface DryRunOptions {
  marginMode?: MarginMode;
  outlierPct?: number;
  invariants?: InvariantOptions;
}

/** Compute the dry-run report. Pure. */
export function computeDryRun(
  lines: readonly ImportLine[],
  existingByKey: ReadonlyMap<string, ExistingPriceRow>,
  opts: DryRunOptions = {},
): DryRunReport {
  const marginMode = opts.marginMode ?? 'PRESERVE_EXISTING';
  const outlierPct = opts.outlierPct ?? DEFAULT_OUTLIER_PCT;
  const rows: DryRunRow[] = [];

  let matchedCount = 0;
  let rejectedCount = 0;
  let outlierCount = 0;
  let skippedStateCount = 0;
  let totalDeltaVenteHtCents = 0;
  let estimatedRevenueDeltaCents = 0;
  const unmatchedKeys: string[] = [];

  for (const line of lines) {
    if (line.parseError) {
      rejectedCount++;
      rows.push({ key: line.key, matched: false, confidence: line.confidence, rejected: true, rejectReason: line.parseError });
      continue;
    }

    const existing = existingByKey.get(line.key);
    if (!existing) {
      unmatchedKeys.push(line.key);
      rows.push({ key: line.key, matched: false, confidence: line.confidence });
      continue;
    }

    if ((PROTECTED_STATES as readonly string[]).includes(existing.pricingState)) {
      skippedStateCount++;
      rows.push({
        key: line.key,
        priPieceIdI: existing.priPieceIdI,
        matched: true,
        confidence: line.confidence,
        skippedState: existing.pricingState,
      });
      continue;
    }

    // Resolve applied marge per mode.
    let appliedMargePct: number;
    let marginSource: DryRunRow['marginSource'];
    if (marginMode === 'APPLY_GRID' && line.margePct != null) {
      appliedMargePct = line.margePct;
      marginSource = 'grid';
    } else if (line.margePct != null) {
      appliedMargePct = line.margePct; // convention carried marge (MARGE_ON_NET)
      marginSource = 'import';
    } else {
      appliedMargePct = existing.margePct; // PRESERVE_EXISTING
      marginSource = 'existing';
    }

    const newVenteHtCents = computeVenteHtCents(line.achatHtCents, appliedMargePct);
    const newVenteTtcCents = computeVenteTtcCents(
      newVenteHtCents,
      existing.fraisPortHtCents,
      existing.fraisSuppHtCents,
      existing.tvaRate || DEFAULT_TVA_RATE,
    );
    const deltaVenteHtCents = newVenteHtCents - existing.venteHtCents;

    const violations = validatePriceChain(
      {
        achatHtCents: line.achatHtCents,
        venteHtCents: newVenteHtCents,
        venteTtcCents: newVenteTtcCents,
        margePct: computeMargePct(line.achatHtCents, newVenteHtCents),
        tvaRate: existing.tvaRate || DEFAULT_TVA_RATE,
        currentVenteHtCents: existing.venteHtCents,
      },
      opts.invariants,
    );

    const outlier =
      existing.venteHtCents > 0 &&
      (Math.abs(deltaVenteHtCents) / existing.venteHtCents) * 100 > outlierPct;

    const row: DryRunRow = {
      key: line.key,
      priPieceIdI: existing.priPieceIdI,
      matched: true,
      confidence: line.confidence,
      derivationUsed: line.derivation,
      marginSource,
      appliedMargePct,
      oldVenteHtCents: existing.venteHtCents,
      newVenteHtCents,
      oldVenteTtcCents: existing.venteTtcCents,
      newVenteTtcCents,
      deltaVenteHtCents,
      outlier,
    };

    matchedCount++;
    if (outlier) outlierCount++;
    if (violations.length > 0) {
      rejectedCount++;
      row.rejected = true;
      row.rejectReason = violations.map((v) => v.code).join(',');
    } else {
      totalDeltaVenteHtCents += deltaVenteHtCents;
      estimatedRevenueDeltaCents += (newVenteTtcCents - existing.venteTtcCents) * existing.qtySold12m;
    }
    rows.push(row);
  }

  return {
    marginMode,
    matchedCount,
    unmatchedCount: unmatchedKeys.length,
    rejectedCount,
    outlierCount,
    skippedStateCount,
    unmatchedKeys,
    totalDeltaVenteHtCents,
    estimatedRevenueDeltaCents,
    rows,
  };
}
