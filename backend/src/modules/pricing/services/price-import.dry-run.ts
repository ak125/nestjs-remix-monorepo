/**
 * L3 — Dry-run orchestration (pure core), with UPSERT (recovery + re-price).
 *
 * Matches each parsed import line against (a) existing price rows → UPDATE, or
 * (b) catalog pieces with no price row → INSERT (recovery of lost/never-set
 * prices, e.g. the Valeo/Magneti regression). Recomputes the chain (L1),
 * validates it (L2), produces an explainable report. Pure — zero I/O.
 *
 * Margin resolution:
 *   - UPDATE, PRESERVE_EXISTING (default): keep the row's existing marge.
 *   - UPDATE/INSERT, marge from convention (MARGE_ON_NET) or APPLY_GRID line.
 *   - INSERT with no marge: fall back to the L4 grid (resolveGridMargePct); if
 *     no rule matches → explicit reject (NO_MARGIN_FOR_INSERT), never a default.
 *
 * MANUAL_OVERRIDE / FROZEN rows are never modified. A tariff activates the row
 * (pri_dispo→'1'); a recovered INSERT is active from the start.
 */
import {
  computeVenteHtCents,
  computeVenteTtcCents,
  computeMargePct,
  DEFAULT_TVA_RATE,
} from './pricing-formula.service';
import {
  validatePriceChain,
  type InvariantOptions,
} from './pricing-invariants.service';
import type { Derivation, ParseConfidence } from './supplier-profile.service';

export const PROTECTED_STATES = ['MANUAL_OVERRIDE', 'FROZEN'] as const;
export const DEFAULT_OUTLIER_PCT = 30;

export type MarginMode = 'PRESERVE_EXISTING' | 'APPLY_GRID';
export type Operation = 'INSERT' | 'UPDATE';

export interface ImportLine {
  key: string;
  matchedBy: 'REF' | 'EAN';
  achatHtCents: number;
  margePct?: number;
  grosHtCents?: number;
  remisePct?: number;
  confidence: ParseConfidence;
  derivation: Derivation;
  parseError?: string;
}

/** Existing price row (UPDATE target). */
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
  dispo: string;
}

/** Catalog piece with no price row (INSERT/recovery target). */
export interface CatalogPiece {
  priPieceIdI: number;
}

export interface DryRunRow {
  key: string;
  priPieceIdI?: number;
  matched: boolean;
  operation?: Operation;
  confidence: ParseConfidence;
  derivationUsed?: Derivation;
  marginSource?: 'existing' | 'import' | 'grid';
  appliedMargePct?: number;
  oldVenteHtCents?: number;
  newVenteHtCents?: number;
  oldVenteTtcCents?: number;
  newVenteTtcCents?: number;
  deltaVenteHtCents?: number;
  outlier?: boolean;
  willActivate?: boolean;
  rejected?: boolean;
  rejectReason?: string;
  skippedState?: string;
}

export interface DryRunReport {
  marginMode: MarginMode;
  matchedCount: number;
  insertedCount: number;
  updatedCount: number;
  unmatchedCount: number;
  rejectedCount: number;
  outlierCount: number;
  skippedStateCount: number;
  activatedCount: number;
  unmatchedKeys: string[];
  totalDeltaVenteHtCents: number;
  estimatedRevenueDeltaCents: number;
  rows: DryRunRow[];
}

export interface DryRunOptions {
  marginMode?: MarginMode;
  outlierPct?: number;
  invariants?: InvariantOptions;
  /**
   * Commercial activation mode for the eventual commit (owner doctrine 2026-06-04).
   * false (default) = PENDING: the commit puts cost only, pieces stay non-sellable
   * → willActivate is always false. true = activate (pri_dispo='1'). Makes the
   * preview's activatedCount truthful instead of always predicting activation.
   */
  activate?: boolean;
  /**
   * L4 grid resolver → the final floored/capped vente_HT (cents) for a cost, or
   * null if no rule matches. Used for APPLY_GRID and for INSERT rows lacking a
   * file marge. Returns the strategy result (floor + cap already applied).
   */
  resolveGridVenteHt?: (costCents: number) => number | null;
}

export function computeDryRun(
  lines: readonly ImportLine[],
  existingByKey: ReadonlyMap<string, ExistingPriceRow>,
  catalogByKey: ReadonlyMap<string, CatalogPiece>,
  opts: DryRunOptions = {},
): DryRunReport {
  const marginMode = opts.marginMode ?? 'PRESERVE_EXISTING';
  const outlierPct = opts.outlierPct ?? DEFAULT_OUTLIER_PCT;
  const rows: DryRunRow[] = [];

  let matchedCount = 0;
  let insertedCount = 0;
  let updatedCount = 0;
  let rejectedCount = 0;
  let outlierCount = 0;
  let skippedStateCount = 0;
  let activatedCount = 0;
  let totalDeltaVenteHtCents = 0;
  let estimatedRevenueDeltaCents = 0;
  const unmatchedKeys: string[] = [];

  for (const line of lines) {
    if (line.parseError) {
      rejectedCount++;
      rows.push({
        key: line.key,
        matched: false,
        confidence: line.confidence,
        rejected: true,
        rejectReason: line.parseError,
      });
      continue;
    }

    const existing = existingByKey.get(line.key);
    const catalog = existing ? undefined : catalogByKey.get(line.key);
    if (!existing && !catalog) {
      unmatchedKeys.push(line.key);
      rows.push({ key: line.key, matched: false, confidence: line.confidence });
      continue;
    }

    const operation: Operation = existing ? 'UPDATE' : 'INSERT';
    const priPieceIdI = existing ? existing.priPieceIdI : catalog!.priPieceIdI;

    if (
      existing &&
      (PROTECTED_STATES as readonly string[]).includes(existing.pricingState)
    ) {
      skippedStateCount++;
      rows.push({
        key: line.key,
        priPieceIdI,
        matched: true,
        operation,
        confidence: line.confidence,
        skippedState: existing.pricingState,
      });
      continue;
    }

    const fraisPort = existing?.fraisPortHtCents ?? 0;
    const fraisSupp = existing?.fraisSuppHtCents ?? 0;
    const tvaRate = existing?.tvaRate || DEFAULT_TVA_RATE;
    const dispo = existing?.dispo ?? '0';

    // Resolve vente_HT per the margin policy.
    //   APPLY_GRID                          → grid (floor/cap applied by resolver)
    //   file marge (convention/import)       → marge from the line
    //   UPDATE, no file marge                → preserve existing marge
    //   INSERT, no file marge                → grid; else explicit reject
    let newVenteHtCents: number;
    let appliedMargePct: number;
    let marginSource: DryRunRow['marginSource'];
    const useGrid =
      marginMode === 'APPLY_GRID' ||
      (operation === 'INSERT' && line.margePct == null);

    if (useGrid) {
      const gridVente = opts.resolveGridVenteHt?.(line.achatHtCents) ?? null;
      if (gridVente == null) {
        rejectedCount++;
        rows.push({
          key: line.key,
          priPieceIdI,
          matched: true,
          operation,
          confidence: line.confidence,
          rejected: true,
          rejectReason:
            operation === 'INSERT' ? 'NO_MARGIN_FOR_INSERT' : 'NO_GRID_RULE',
        });
        continue;
      }
      newVenteHtCents = gridVente;
      appliedMargePct = computeMargePct(line.achatHtCents, gridVente);
      marginSource = 'grid';
    } else if (line.margePct != null) {
      appliedMargePct = line.margePct;
      marginSource = 'import';
      newVenteHtCents = computeVenteHtCents(line.achatHtCents, appliedMargePct);
    } else {
      appliedMargePct = existing!.margePct; // PRESERVE_EXISTING (UPDATE only — INSERT handled above)
      marginSource = 'existing';
      newVenteHtCents = computeVenteHtCents(line.achatHtCents, appliedMargePct);
    }

    const newVenteTtcCents = computeVenteTtcCents(
      newVenteHtCents,
      fraisPort,
      fraisSupp,
      tvaRate,
    );
    const deltaVenteHtCents = existing
      ? newVenteHtCents - existing.venteHtCents
      : newVenteHtCents;

    const violations = validatePriceChain(
      {
        achatHtCents: line.achatHtCents,
        venteHtCents: newVenteHtCents,
        venteTtcCents: newVenteTtcCents,
        margePct: computeMargePct(line.achatHtCents, newVenteHtCents),
        tvaRate,
        // Delta guard only applies to UPDATE (an INSERT has no prior price).
        currentVenteHtCents: existing?.venteHtCents,
      },
      opts.invariants,
    );

    const outlier =
      !!existing &&
      existing.venteHtCents > 0 &&
      (Math.abs(deltaVenteHtCents) / existing.venteHtCents) * 100 > outlierPct;

    const row: DryRunRow = {
      key: line.key,
      priPieceIdI,
      matched: true,
      operation,
      confidence: line.confidence,
      derivationUsed: line.derivation,
      marginSource,
      appliedMargePct,
      oldVenteHtCents: existing?.venteHtCents,
      newVenteHtCents,
      oldVenteTtcCents: existing?.venteTtcCents,
      newVenteTtcCents,
      deltaVenteHtCents,
      outlier,
      willActivate: (opts.activate ?? false) && dispo !== '1',
    };

    matchedCount++;
    if (outlier) outlierCount++;
    if (violations.length > 0) {
      rejectedCount++;
      row.rejected = true;
      row.rejectReason = violations.map((v) => v.code).join(',');
    } else {
      if (operation === 'INSERT') insertedCount++;
      else updatedCount++;
      if (row.willActivate) activatedCount++;
      if (existing) {
        totalDeltaVenteHtCents += deltaVenteHtCents;
        estimatedRevenueDeltaCents +=
          (newVenteTtcCents - existing.venteTtcCents) * existing.qtySold12m;
      }
    }
    rows.push(row);
  }

  return {
    marginMode,
    matchedCount,
    insertedCount,
    updatedCount,
    unmatchedCount: unmatchedKeys.length,
    rejectedCount,
    outlierCount,
    skippedStateCount,
    activatedCount,
    unmatchedKeys,
    totalDeltaVenteHtCents,
    estimatedRevenueDeltaCents,
    rows,
  };
}
