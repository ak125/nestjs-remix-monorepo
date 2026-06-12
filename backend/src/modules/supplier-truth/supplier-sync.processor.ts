import { Injectable, Logger } from '@nestjs/common';
import {
  SupplierTruthRepository,
  type OfferSnapshotInsert,
} from './supplier-truth.repository';
import { resolvePieceId, type RefIndexLookup } from './domain/ref-resolver';
import type {
  SupplierConnector,
  SupplierObservation,
} from './connectors/supplier-connector.interface';

/**
 * Supplier-offer ingestion processor.
 *
 * connector.fetchAvailability → resolve ref→piece_id → APPEND the observed price
 * triplet + availability into the canonical `supplier_offer_snapshot` (pricing
 * H2, append-only). The availability-CONSENSUS projection (truth-engine →
 * supplier_truth_projection) is DEFERRED (H3, not wired): V1 margin checks read
 * the raw observed prices directly, no consensus state needed.
 *
 * Pure orchestration with injected deps (repository + event sink) so it is
 * unit-testable without DB/HTTP.
 */

export type EventSink = (
  name: string,
  payload: Record<string, unknown>,
) => void;
/** No-op sink — for UNIT TESTS only, never the implicit prod default (see worker wiring). */
export const noopSink: EventSink = () => {};

export interface SyncResult {
  observations: number;
  offersInserted: number;
  /**
   * Observations whose ref did not resolve to a piece_id.
   * `supplier_offer_snapshot.piece_id_i` is NOT NULL, so these can't be stored —
   * emitted as an observable event, then skipped (no silent drop).
   */
  unresolved: number;
}

@Injectable()
export class SupplierSyncProcessor {
  private readonly logger = new Logger(SupplierSyncProcessor.name);

  constructor(
    private readonly repo: SupplierTruthRepository,
    private readonly emit: EventSink = noopSink,
  ) {}

  /** Ingest a bounded working-set of refs from one connector into supplier_offer_snapshot. */
  async syncRefs(
    connector: SupplierConnector,
    refs: string[],
  ): Promise<SyncResult> {
    const observations = await connector.fetchAvailability(refs);
    const lookup: RefIndexLookup = (n) => this.repo.resolveRefToPieceIds(n);

    let offersInserted = 0;
    let unresolved = 0;

    for (const obs of observations) {
      const { pieceId, reason } = await resolvePieceId(obs.rawRef, lookup);
      if (pieceId == null) {
        // No silent drop: the canonical row requires a non-null piece_id_i, so an
        // unresolved ref is surfaced as an observable event, then skipped.
        unresolved++;
        this.emit('supplier.ref.unresolved', {
          supplierId: obs.supplierId,
          rawRef: obs.rawRef,
          reason,
        });
        continue;
      }
      await this.repo.insertOffer(toOfferInsert(obs, pieceId));
      offersInserted++;
    }

    if (unresolved > 0) {
      this.logger.warn(
        `${observations.length} obs, ${offersInserted} offers written, ${unresolved} unresolved (skipped)`,
      );
    }

    return {
      observations: observations.length,
      offersInserted,
      unresolved,
    };
  }
}

// ---- mappers (connector observation → canonical offer row) ----

/** Euros → integer cents (no float drift); null stays null. */
const eurosToCents = (v: number | null | undefined): number | null =>
  v == null ? null : Math.round(v * 100);

function toOfferInsert(
  obs: SupplierObservation,
  pieceId: number,
): OfferSnapshotInsert {
  return {
    piece_id_i: pieceId,
    supplier_id: obs.supplierId,
    supplier_ref: obs.rawRef,
    public_ht_cents: eurosToCents(obs.priceBaseHt),
    remise_pct: obs.remisePct ?? null,
    achat_ht_cents: eurosToCents(obs.priceBuyHt),
    available: obs.available,
    delay_days: obs.delayDays,
    parse_confidence: obs.parseError ? 'UNKNOWN' : 'HIGH_CONFIDENCE',
    source_verified_at: obs.sourceVerifiedAt
      ? obs.sourceVerifiedAt.toISOString()
      : null,
  };
}
