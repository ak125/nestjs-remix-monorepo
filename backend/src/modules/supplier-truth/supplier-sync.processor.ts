import { Injectable, Logger } from '@nestjs/common';
import {
  SupplierTruthRepository,
  type SnapshotInsert,
  type ProjectionRow,
  type SupplierProfileRow,
} from './supplier-truth.repository';
import { resolvePieceId, type RefIndexLookup } from './domain/ref-resolver';
import {
  projectTruth,
  ConnectorState,
  type SupplierObservationInput,
  type SupplierProfileInput,
  type PrevProjection,
} from './domain/truth-engine';
import { AvailabilityState } from './domain/availability-state';
import type {
  SupplierConnector,
  SupplierObservation,
} from './connectors/supplier-connector.interface';

/**
 * Sync processor (Layers 1→2→3 orchestration).
 *
 * connector.fetchAvailability → resolve ref→piece_id → APPEND snapshot →
 * re-project per piece via the pure Truth Engine → upsert canonical projection.
 * Emits degradation/observability events. Pure orchestration with injected deps
 * (repository + event sink) so it is unit-testable without DB/HTTP.
 */

export type EventSink = (
  name: string,
  payload: Record<string, unknown>,
) => void;
const noopSink: EventSink = () => {};

export interface SyncResult {
  observations: number;
  snapshotsInserted: number;
  unresolved: number;
  projectionsUpserted: number;
}

@Injectable()
export class SupplierSyncProcessor {
  private readonly logger = new Logger(SupplierSyncProcessor.name);

  constructor(
    private readonly repo: SupplierTruthRepository,
    private readonly emit: EventSink = noopSink,
  ) {}

  /** Sync a bounded working-set of refs through one connector. */
  async syncRefs(
    connector: SupplierConnector,
    refs: string[],
    now: Date = new Date(),
  ): Promise<SyncResult> {
    const observations = await connector.fetchAvailability(refs);
    const lookup: RefIndexLookup = (n) => this.repo.resolveRefToPieceIds(n);

    const resolvedPieceIds = new Set<number>();
    let snapshotsInserted = 0;
    let unresolved = 0;

    for (const obs of observations) {
      const { pieceId, reason, normalizedRef } = await resolvePieceId(
        obs.rawRef,
        lookup,
      );
      await this.repo.insertSnapshot(
        toSnapshotInsert(obs, pieceId, normalizedRef),
      );
      snapshotsInserted++;
      if (pieceId == null) {
        unresolved++;
        this.emit('supplier.ref.unresolved', {
          supplierId: obs.supplierId,
          rawRef: obs.rawRef,
          reason,
        });
      } else {
        resolvedPieceIds.add(pieceId);
      }
    }

    let projectionsUpserted = 0;
    for (const pieceId of resolvedPieceIds) {
      await this.reproject(pieceId, now);
      projectionsUpserted++;
    }

    return {
      observations: observations.length,
      snapshotsInserted,
      unresolved,
      projectionsUpserted,
    };
  }

  /** Recompute and persist the canonical projection for one piece. */
  private async reproject(pieceId: number, now: Date): Promise<void> {
    const snaps = await this.repo.readRecentSnapshots(pieceId);
    const supplierIds = [...new Set(snaps.map((s) => s.supplier_id))];
    const profiles = await Promise.all(
      supplierIds.map((id) => this.repo.getSupplierProfile(id)),
    );
    const profileInputs = profiles
      .map((p, i) => (p ? toProfileInput(p) : coldStartProfile(supplierIds[i])))
      .filter(Boolean) as SupplierProfileInput[];

    const obsInputs: SupplierObservationInput[] = snaps.map((s) => ({
      supplierId: s.supplier_id,
      available: s.available,
      delayDays: s.delay_days,
      parseError: s.parse_error,
      fetchedAt: new Date(s.fetched_at),
      sourceVerifiedAt: s.source_verified_at
        ? new Date(s.source_verified_at)
        : null,
    }));

    const prev = await this.repo.getProjection(pieceId);
    const prevProjection: PrevProjection | null = prev
      ? {
          state: prev.state as AvailabilityState,
          stateCounter: prev.state_counter,
        }
      : null;

    const row = projectTruth(obsInputs, profileInputs, prevProjection, now);

    const wasVerified = prev?.state === AvailabilityState.VERIFIED_AVAILABLE;
    await this.repo.upsertProjection(toProjectionRow(pieceId, row, prev));

    if (
      row.state === AvailabilityState.HARD_CONFLICT ||
      (wasVerified && row.state !== AvailabilityState.VERIFIED_AVAILABLE)
    ) {
      this.emit('supplier.truth.degraded', {
        pieceId,
        from: prev?.state ?? null,
        to: row.state,
        reason: row.projectionReasonCode,
      });
    }
  }
}

// ---- mappers (connector/db ↔ domain) ----

function toSnapshotInsert(
  obs: SupplierObservation,
  pieceId: number | null,
  normalizedRef: string,
): SnapshotInsert {
  return {
    supplier_id: obs.supplierId,
    piece_id: pieceId,
    raw_ref: obs.rawRef,
    normalized_ref: normalizedRef,
    available: obs.available,
    delay_days: obs.delayDays,
    parse_error: obs.parseError,
    source_verified_at: obs.sourceVerifiedAt
      ? obs.sourceVerifiedAt.toISOString()
      : null,
    freshness_provenance: obs.freshnessProvenance,
    price_buy_ht: obs.priceBuyHt ?? null,
  };
}

function toProfileInput(p: SupplierProfileRow): SupplierProfileInput {
  const reliability = p.reliability_score;
  return {
    supplierId: p.supplier_id,
    reliabilityScore: reliability,
    supplierStability: reliability != null ? reliability / 100 : 0,
    mismatchRate: p.mismatch_rate,
    timeoutRate: p.timeout_rate,
    defaultTtlMinutes: p.default_ttl_minutes,
    connectorState: p.connector_state as ConnectorState,
  };
}

function coldStartProfile(supplierId: string): SupplierProfileInput {
  return {
    supplierId,
    reliabilityScore: null, // cold start → never VERIFIED on zero history
    supplierStability: 0,
    mismatchRate: 0.5,
    timeoutRate: 0,
    defaultTtlMinutes: null,
    connectorState: ConnectorState.ACTIVE,
  };
}

function toProjectionRow(
  pieceId: number,
  row: ReturnType<typeof projectTruth>,
  prev: ProjectionRow | null,
): ProjectionRow {
  const stateChanged = prev?.state !== row.state;
  return {
    piece_id: pieceId,
    state: row.state,
    confidence: row.confidence,
    delay_days: row.delayDays,
    source_supplier: row.sourceSupplierId,
    conflict_kind: row.conflictKind,
    state_since:
      stateChanged || !prev?.state_since
        ? new Date().toISOString()
        : prev.state_since,
    state_counter: row.stateCounter,
    projected_at: new Date().toISOString(),
    projection_reason_code: row.projectionReasonCode,
    projection_metadata: { sourceSupplier: row.sourceSupplierId },
    projection_inputs_hash: row.projectionInputsHash,
    projection_version: 1,
  };
}
